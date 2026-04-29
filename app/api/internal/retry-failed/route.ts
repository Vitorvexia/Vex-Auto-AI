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
import { sendWhatsAppMessage, WhatsAppSendError, PERMANENT_CATEGORIES } from "@/lib/whatsapp-send";

export const runtime = "nodejs";

// Limites operacionais
const MAX_WINDOW_HOURS = 72;
const MAX_LIMIT = 200;
const DEFAULT_WINDOW_HOURS = 24;
const DEFAULT_LIMIT = 50;
const MAX_RETRY_ATTEMPTS = 3;
// Registros em ok_send_failed_retrying por mais de 15min → processo crashou mid-loop
const STALE_RETRYING_MINUTES = 15;

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

  // ---- Staleness recovery --------------------------------------------------
  // Registros em ok_send_failed_retrying > STALE_RETRYING_MINUTES indicam
  // processo que crashou mid-loop. Resetar para ok_send_failed para reprocessar.
  // updated_at é mantido pelo trigger ai_logs_updated_at (moddatetime).
  const staleThreshold = new Date(Date.now() - STALE_RETRYING_MINUTES * 60_000).toISOString();
  await supabaseAdmin
    .from("ai_logs")
    .update({ status: "ok_send_failed" })
    .eq("status", "ok_send_failed_retrying")
    .lt("updated_at", staleThreshold);

  // ---- Buscar candidatos ---------------------------------------------------
  const { data: candidates, error: fetchErr } = await supabaseAdmin
    .from("ai_logs")
    .select("id, conversation_id, lead_id, store_id, message_id, retry_count, last_send_error")
    .eq("status", "ok_send_failed")
    .lt("retry_count", MAX_RETRY_ATTEMPTS)
    .neq("last_send_error", "invalid_recipient")
    .neq("last_send_error", "auth_error")
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
  const candidateIds = candidates.map((c) => c.id);

  const { data: claimed, error: claimErr } = await supabaseAdmin
    .from("ai_logs")
    .update({ status: "ok_send_failed_retrying" })
    .in("id", candidateIds)
    .eq("status", "ok_send_failed")
    .select("id, conversation_id, lead_id, store_id, message_id, retry_count, last_send_error");

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
    // Pre-send guard: categoria permanente conhecida → escalada direta sem tentar envio
    if (
      log.last_send_error &&
      PERMANENT_CATEGORIES.includes(log.last_send_error as typeof PERMANENT_CATEGORIES[number])
    ) {
      await supabaseAdmin
        .from("ai_logs")
        .update({
          status: "ok_send_failed_permanent",
          retry_count: (log.retry_count ?? 0) + 1,
        })
        .eq("id", log.id);
      failed++;
      continue;
    }

    // Buscar texto da mensagem
    let msgText: string | null = null;

    if (log.message_id) {
      // DIRECT: link exato ao message_id — elimina risco de double-send
      const { data: msg } = await supabaseAdmin
        .from("messages")
        .select("mensagem")
        .eq("id", log.message_id)
        .maybeSingle();
      msgText = msg?.mensagem ?? null;
    } else {
      // FALLBACK: logs antigos sem message_id — remover após janela de 72h
      // TODO(PR16): remover este fallback após 2026-05-02
      const { data: msg } = await supabaseAdmin
        .from("messages")
        .select("mensagem")
        .eq("conversation_id", log.conversation_id)
        .eq("direcao", "saida")
        .eq("autor", "ia")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      msgText = msg?.mensagem ?? null;
    }

    // Telefone do lead
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("phone_normalized")
      .eq("id", log.lead_id)
      .maybeSingle();

    if (!msgText || !lead?.phone_normalized) {
      // Sem dados para reenviar — permanente (não vai melhorar com mais tentativas)
      await supabaseAdmin
        .from("ai_logs")
        .update({
          status: "ok_send_failed_permanent",
          retry_count: (log.retry_count ?? 0) + 1,
        })
        .eq("id", log.id);
      failed++;
      continue;
    }

    try {
      await sendWhatsAppMessage(lead.phone_normalized, msgText);

      await supabaseAdmin
        .from("ai_logs")
        .update({
          status: "ok",
          retry_count: (log.retry_count ?? 0) + 1,
        })
        .eq("id", log.id);

      retried++;
    } catch (sendErr) {
      const newCount = (log.retry_count ?? 0) + 1;
      const isPermanent = sendErr instanceof WhatsAppSendError && !sendErr.isRetryable;
      const isMaxed = newCount >= MAX_RETRY_ATTEMPTS;
      const finalStatus = isPermanent || isMaxed ? "ok_send_failed_permanent" : "ok_send_failed";
      const errorCategory =
        sendErr instanceof WhatsAppSendError ? sendErr.category : "unknown";
      const errorStatusCode =
        sendErr instanceof WhatsAppSendError ? sendErr.statusCode : undefined;

      await supabaseAdmin
        .from("ai_logs")
        .update({
          status: finalStatus,
          retry_count: newCount,
          last_send_error: errorCategory,
        })
        .eq("id", log.id);

      // Logar apenas categoria e status_code — nunca sendErr.message (pode conter PII da Meta)
      console.error(
        JSON.stringify({
          level: "error",
          event: "retry_failed_send_error",
          log_id: log.id,
          category: errorCategory,
          status_code: errorStatusCode,
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
