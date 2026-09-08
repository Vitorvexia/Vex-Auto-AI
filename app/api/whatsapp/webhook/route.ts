import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizePhone } from "@/lib/phone";
import { verifyMetaSignature } from "@/lib/whatsapp-signature";
import { ingestMessage } from "@/lib/ingest";
import { dispatchAiPipeline } from "@/lib/pipeline-dispatch";
import { isReplayedMessage } from "@/lib/replay-guard";
import { maskPhone } from "@/lib/pii";
import * as Sentry from "@sentry/nextjs";

// Precisamos de Node runtime para node:crypto (HMAC)
export const runtime = "nodejs";

// ============================================================================
// GET: verificação do webhook pela Meta
// ============================================================================

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

// ============================================================================
// Tipos
// ============================================================================

type Result = {
  message_external_id: string;
  status: "ok" | "duplicate" | "skipped" | "error";
  lead_id?: string;
  conversation_id?: string;
  agent_status?: string;
  error?: string;
};

// ============================================================================
// POST: recebe mensagens do WhatsApp
// ============================================================================

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!verifyMetaSignature(rawBody, signature)) {
    return NextResponse.json(
      { ok: false, error: "invalid signature" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid json" },
      { status: 400 }
    );
  }

  const payload = body as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          metadata?: { display_phone_number?: string };
          contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
          messages?: Array<{
            id?: string;
            from?: string;
            type?: string;
            text?: { body?: string };
            timestamp?: string;
          }>;
        };
      }>;
    }>;
  };

  const results: Result[] = [];
  let systemicError = false;

  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      const metadata = value?.metadata;
      const contacts = value?.contacts ?? [];
      const messages = value?.messages ?? [];

      if (messages.length === 0) continue;

      const destNormalized = normalizePhone(metadata?.display_phone_number);
      if (!destNormalized) {
        for (const m of messages) {
          results.push({
            message_external_id: m?.id ?? "?",
            status: "skipped",
            error: "invalid destination",
          });
        }
        continue;
      }

      const { data: store, error: storeErr } = await supabaseAdmin
        .from("stores")
        .select("id")
        .eq("whatsapp_numero", destNormalized)
        .maybeSingle();

      if (storeErr) {
        systemicError = true;
        Sentry.captureException(storeErr, { tags: { webhook_stage: "store_lookup" } });
        for (const m of messages) {
          results.push({
            message_external_id: m?.id ?? "?",
            status: "error",
            error: storeErr.message,
          });
        }
        continue;
      }
      if (!store) {
        for (const m of messages) {
          results.push({
            message_external_id: m?.id ?? "?",
            status: "skipped",
            error: `store not found for ${maskPhone(destNormalized)}`,
          });
        }
        continue;
      }

      for (const msg of messages) {
        const externalId = msg?.id;
        const fromRaw = msg?.from;

        if (!externalId || !fromRaw) {
          results.push({
            message_external_id: externalId ?? "?",
            status: "skipped",
            error: "missing id or from",
          });
          continue;
        }

        if (msg.type !== "text") {
          results.push({
            message_external_id: externalId,
            status: "skipped",
            error: `type=${msg.type}`,
          });
          continue;
        }

        const text = msg.text?.body;
        const fromNormalized = normalizePhone(fromRaw);
        if (!fromNormalized || !text) {
          results.push({
            message_external_id: externalId,
            status: "skipped",
            error: "invalid payload",
          });
          continue;
        }

        const contact = contacts.find((c) => c?.wa_id === fromRaw);
        const contactName = contact?.profile?.name ?? null;

        const tsRaw = msg.timestamp;
        const receivedAt =
          tsRaw && /^\d+$/.test(tsRaw)
            ? new Date(parseInt(tsRaw, 10) * 1000).toISOString()
            : new Date().toISOString();

        // Replay guard: bloqueia WAMID já visto em memória (TTL 10min)
        if (isReplayedMessage(externalId)) {
          console.log(
            JSON.stringify({ event: "webhook_replay_guard_hit", wamid: externalId })
          );
          results.push({
            message_external_id: externalId,
            status: "duplicate",
            agent_status: "skipped_duplicate",
          });
          continue;
        }

        try {
          const r = await ingestMessage({
            storeId: store.id,
            phoneNormalized: fromNormalized,
            contactName,
            messageExternalId: externalId,
            mensagem: text,
            receivedAt,
          });

          const result: Result = {
            message_external_id: externalId,
            status: r.duplicate ? "duplicate" : "ok",
            lead_id: r.lead_id,
            conversation_id: r.conversation_id,
          };

          if (!r.duplicate) {
            // Opt-out determinístico (nunca pela LLM) — detectado dentro de
            // runAiPipeline (lib/ai-pipeline.ts), não aqui: precisa rodar sob
            // o claim atômico do dispatchAiPipeline (evita detecção/gravação
            // duplicada se 2 requests concorrentes chegarem pra mesma
            // conversa) e precisa poder substituir a resposta da LLM neste
            // turno, não só gatear envio futuro de marketing.

            // dispatchAiPipeline faz claim atômico por conversation_id antes de
            // rodar o pipeline — evita 2 runAiPipeline concorrentes pra mesma
            // conversa quando mensagens do mesmo lead chegam em requests
            // próximos (bug de produção 2026-07-30). Se o claim falhar, esta
            // mensagem já está salva (ingestMessage já rodou) e será pega no
            // dreno de quem detém o lock — não perde a mensagem, só não gera
            // agent_status próprio aqui.
            const dispatch = await dispatchAiPipeline({
              storeId: store.id,
              leadId: r.lead_id,
              conversationId: r.conversation_id,
              isNewConversation: r.is_new_conversation,
            });
            if (!dispatch.ran) {
              result.agent_status = "skipped_locked";
            } else {
              const last = dispatch.results[dispatch.results.length - 1];
              result.agent_status = last?.agent_status ?? "error";
              if (last?.error) result.error = last.error;
            }
          } else {
            result.agent_status = "skipped_duplicate";
          }

          results.push(result);
        } catch (e: unknown) {
          // unique_violation (23505): WAMID já existe no banco via outro caminho — duplicate, não erro
          if (
            e !== null &&
            typeof e === "object" &&
            "code" in e &&
            (e as { code: string }).code === "23505"
          ) {
            console.log(
              JSON.stringify({ event: "webhook_unique_violation", wamid: externalId })
            );
            results.push({
              message_external_id: externalId,
              status: "duplicate",
              agent_status: "skipped_duplicate",
            });
          } else {
            systemicError = true;
            Sentry.captureException(e, { tags: { webhook_stage: "ingest_or_pipeline" } });
            results.push({
              message_external_id: externalId,
              status: "error",
              error: e instanceof Error ? e.message : "rpc failed",
            });
          }
        }
      }
    }
  }

  return NextResponse.json({ ok: !systemicError, results });
}
