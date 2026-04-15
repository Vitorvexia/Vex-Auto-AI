import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizePhone } from "@/lib/phone";
import { verifyMetaSignature } from "@/lib/whatsapp-signature";
import { ingestMessage } from "@/lib/ingest";

// Precisamos de Node runtime para node:crypto (HMAC)
export const runtime = "nodejs";

/**
 * GET: verificacao do webhook pela Meta.
 */
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

type Result = {
  message_external_id: string;
  status: "ok" | "duplicate" | "skipped" | "error";
  lead_id?: string;
  conversation_id?: string;
  error?: string;
};

/**
 * POST: recebe mensagens do WhatsApp.
 *
 * Fluxo endurecido:
 *   1) Le corpo bruto
 *   2) Valida HMAC (X-Hub-Signature-256) antes de qualquer parse
 *   3) Itera entry[] / changes[] / messages[] (batch completo)
 *   4) Cada mensagem vai por RPC webhook_ingest_message (transacao + race-safe)
 *   5) received_at = timestamp da Meta (fallback now())
 *   6) Erros sistemicos -> 500 (Meta reenvia; idempotencia cobre)
 */
export async function POST(req: NextRequest) {
  // 1) corpo bruto para HMAC
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  // 2) HMAC
  if (!verifyMetaSignature(rawBody, signature)) {
    return NextResponse.json(
      { ok: false, error: "invalid signature" },
      { status: 403 }
    );
  }

  // 3) parse
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid json" },
      { status: 400 }
    );
  }

  const results: Result[] = [];
  let systemicError = false;

  // 4) iterar todas as entries / changes / messages (batch completo)
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      const metadata = value?.metadata;
      const contacts: any[] = value?.contacts ?? [];
      const messages: any[] = value?.messages ?? [];

      // Status updates (delivered/read) nao tem messages[] -> ignora o change
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

      // Resolve store uma vez por change (mesmo numero destino p/ todas)
      const { data: store, error: storeErr } = await supabaseAdmin
        .from("stores")
        .select("id")
        .eq("whatsapp_numero", destNormalized)
        .maybeSingle();

      if (storeErr) {
        systemicError = true;
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
            error: `store not found for ${destNormalized}`,
          });
        }
        continue;
      }

      // 5) processar cada mensagem
      for (const msg of messages) {
        const externalId: string | undefined = msg?.id;
        const fromRaw: string | undefined = msg?.from;

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

        const text: string | undefined = msg.text?.body;
        const fromNormalized = normalizePhone(fromRaw);
        if (!fromNormalized || !text) {
          results.push({
            message_external_id: externalId,
            status: "skipped",
            error: "invalid payload",
          });
          continue;
        }

        // nome: procura contact cujo wa_id bata com o `from`
        const contact = contacts.find((c) => c?.wa_id === fromRaw);
        const contactName: string | null = contact?.profile?.name ?? null;

        // timestamp Meta em segundos (epoch string) -> ISO
        const tsRaw: string | undefined = msg.timestamp;
        const receivedAt =
          tsRaw && /^\d+$/.test(tsRaw)
            ? new Date(parseInt(tsRaw, 10) * 1000).toISOString()
            : new Date().toISOString();

        try {
          const r = await ingestMessage({
            storeId: store.id,
            phoneNormalized: fromNormalized,
            contactName,
            messageExternalId: externalId,
            mensagem: text,
            receivedAt,
          });
          results.push({
            message_external_id: externalId,
            status: r.duplicate ? "duplicate" : "ok",
            lead_id: r.lead_id,
            conversation_id: r.conversation_id,
          });
        } catch (e: any) {
          systemicError = true;
          results.push({
            message_external_id: externalId,
            status: "error",
            error: e?.message ?? "rpc failed",
          });
        }
      }
    }
  }

  // 6) erro sistemico -> 500 para Meta reenviar (idempotencia cobre)
  if (systemicError) {
    return NextResponse.json({ ok: false, results }, { status: 500 });
  }
  return NextResponse.json({ ok: true, results });
}
