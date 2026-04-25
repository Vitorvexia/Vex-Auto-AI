// ============================================================================
// Endpoint interno: retenta mensagens com status ok_send_failed
//
// Chamada manual ou por cron externo (ex: GitHub Actions scheduled).
// Protegido por INTERNAL_API_KEY — nunca expor sem autenticação.
//
// POST /api/internal/retry-failed
// Header: x-internal-key: <INTERNAL_API_KEY>
// Body (opcional): { "window_hours": 24, "limit": 50 }
//
// Segurança:
//   - comparação de chave com timingSafeEqual (resistente a timing attack)
//   - claim atômico antes do envio — previne double-send em chamadas concorrentes
//   - audit log estruturado sem PII
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { sendWhatsAppMessage } from "@/lib/whatsapp-send";

export const runtime = "nodejs";

// Limites operacionais
const MAX_WINDOW_HOURS = 72;
const MAX_LIMIT = 200;
const DEFAULT_WINDOW_HOURS = 24;
const DEFAULT_LIMIT = 50;

// ============================================================================
// Comparação de chave resistente a timing attack
// ============================================================================

function verifyApiKey(provided: string, expected: string): boolean {
  try {
    // Normaliza comprimentos via hash para evitar vazamento de tamanho
    const a = createHash("sha256").update(provided).digest();
    const b = createHash("sha256").update(expected).digest();
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ============================================================================
// POST handler
// ============================================================================

export async function POST(req: NextRequest) {
  const startMs = Date.now();

  // ---- Autenticação --------------------------------------------------------
  const expectedKey = process.env.INTERNAL_API_KEY;
  const providedKey = req.headers.get("x-internal-key") ?? "";

  if (!expectedKey || !verifyApiKey(providedKey, expectedKey)) {
    // Audit: tentativa de acesso não autorizada (sem revelar IP ou chave)
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "retry_failed_unauthorized",
        ts: new Date().toISOString(),
      })
    );
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ---- Parâmetros ----------------------------------------------------------
  let windowHours = DEFAULT_WINDOW_HOURS;
  let limit = DEFAULT_LIMIT;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.window_hours === "number")
      windowHours = Math.min(Math.max(1, body.window_hours), MAX_WINDOW_HOURS);
    if (typeof body.limit === "number")
      limit = Math.min(Math.max(1, body.limit), MAX_LIMIT);
  } catch {
    // usa defaults
  }

  const since = new Date(Date.now() - windowHours * 60 * 60_000).toISOString();

  // ---- Buscar candidatos ---------------------------------------------------
  const { data: candidates, error: fetchErr } = await supabaseAdmin
    .from("ai_logs")
    .select("id, conversation_id, lead_id, store_id")
    .eq("status", "ok_send_failed")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (fetchErr) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "retry_failed_fetch_error",
        error: fetchErr.message,
        ts: new Date().toISOString(),
      })
    );
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  if (!candidates?.length) {
    console.log(
      JSON.stringify({
        level: "info",
        event: "retry_failed_run",
        retried: 0,
        failed: 0,
        skipped: 0,
        total_candidates: 0,
        window_hours: windowHours,
        latency_ms: Date.now() - startMs,
        ts: new Date().toISOString(),
      })
    );
    return NextResponse.json({ retried: 0, failed: 0, skipped: 0 });
  }

  // ---- Claim atômico -------------------------------------------------------
  // Atualiza para "ok_send_failed_retrying" somente os registros ainda
  // em "ok_send_failed". Chamadas concorrentes obterão conjunto disjunto.
  // Status "ok_send_failed_retrying" é um estado transitório — limpo ao final.
  const candidateIds = candidates.map((c) => c.id);

  const { data: claimed, error: claimErr } = await supabaseAdmin
    .from("ai_logs")
    .update({ status: "ok_send_failed_retrying" })
    .in("id", candidateIds)
    .eq("status", "ok_send_failed")   // condição de guarda — race-safe
    .select("id, conversation_id, lead_id, store_id");

  if (claimErr) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "retry_failed_claim_error",
        error: claimErr.message,
        ts: new Date().toISOString(),
      })
    );
    return NextResponse.json({ error: "claim_failed" }, { status: 500 });
  }

  const skipped = candidates.length - (claimed?.length ?? 0);
  let retried = 0;
  let failed = 0;

  // ---- Processar apenas os registros efetivamente claimados ----------------
  for (const log of claimed ?? []) {
    // Mensagem mais recente de saída da IA para esta conversa
    const { data: msg } = await supabaseAdmin
      .from("messages")
      .select("mensagem")
      .eq("conversation_id", log.conversation_id)
      .eq("direcao", "saida")
      .eq("autor", "ia")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Telefone do lead
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("phone_normalized")
      .eq("id", log.lead_id)
      .maybeSingle();

    if (!msg?.mensagem || !lead?.phone_normalized) {
      // Não temos dados suficientes para reenviar — reverter para ok_send_failed
      await supabaseAdmin
        .from("ai_logs")
        .update({ status: "ok_send_failed" })
        .eq("id", log.id);
      failed++;
      continue;
    }

    try {
      await sendWhatsAppMessage(lead.phone_normalized, msg.mensagem);

      await supabaseAdmin
        .from("ai_logs")
        .update({ status: "ok" })
        .eq("id", log.id);

      retried++;
    } catch (sendErr) {
      // Reverter para ok_send_failed — próxima invocação tentará novamente
      await supabaseAdmin
        .from("ai_logs")
        .update({ status: "ok_send_failed" })
        .eq("id", log.id);

      console.error(
        JSON.stringify({
          level: "error",
          event: "retry_failed_send_error",
          log_id: log.id,
          error: sendErr instanceof Error ? sendErr.message : String(sendErr),
          ts: new Date().toISOString(),
        })
      );
      failed++;
    }
  }

  // ---- Audit log -----------------------------------------------------------
  console.log(
    JSON.stringify({
      level: "info",
      event: "retry_failed_run",
      retried,
      failed,
      skipped,
      total_candidates: candidates.length,
      window_hours: windowHours,
      latency_ms: Date.now() - startMs,
      ts: new Date().toISOString(),
    })
  );

  return NextResponse.json({
    retried,
    failed,
    skipped,
    total: candidates.length,
  });
}
