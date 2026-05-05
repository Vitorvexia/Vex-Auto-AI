// ============================================================================
// Job de retry de mensagens WhatsApp com status ok_send_failed
//
// Extraído de app/api/internal/retry-failed/route.ts para reutilização
// no orquestrador diário sem import cross-route.
// ============================================================================

import { supabaseAdmin } from "@/lib/supabase";
import { sendWhatsAppMessage, WhatsAppSendError, PERMANENT_CATEGORIES } from "@/lib/whatsapp-send";
import { getStoreWhatsAppPhoneId } from "@/lib/whatsapp-credentials";

const MAX_WINDOW_HOURS = 72;
const MAX_LIMIT = 200;
const DEFAULT_WINDOW_HOURS = 24;
const DEFAULT_LIMIT = 50;
const MAX_RETRY_ATTEMPTS = 3;
const STALE_RETRYING_MINUTES = 15;

export interface RetryFailedResult {
  retried: number;
  failed: number;
  skipped: number;
  total: number;
}

export async function runRetryFailedJob(opts?: {
  windowHours?: number;
  limit?: number;
}): Promise<RetryFailedResult> {
  const startMs = Date.now();

  const windowHours = Math.min(
    Math.max(1, opts?.windowHours ?? DEFAULT_WINDOW_HOURS),
    MAX_WINDOW_HOURS
  );
  const limit = Math.min(
    Math.max(1, opts?.limit ?? DEFAULT_LIMIT),
    MAX_LIMIT
  );

  const since = new Date(Date.now() - windowHours * 60 * 60_000).toISOString();

  // Staleness recovery: retrying > 15min → processo crashou → resetar
  const staleThreshold = new Date(Date.now() - STALE_RETRYING_MINUTES * 60_000).toISOString();
  await supabaseAdmin
    .from("ai_logs")
    .update({ status: "ok_send_failed" })
    .eq("status", "ok_send_failed_retrying")
    .lt("updated_at", staleThreshold);

  // Buscar candidatos
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
    console.error(JSON.stringify({
      level: "error",
      event: "retry_failed_fetch_error",
      error: fetchErr.message,
      ts: new Date().toISOString(),
    }));
    throw new Error("query_failed");
  }

  if (!candidates?.length) {
    console.log(JSON.stringify({
      level: "info",
      event: "retry_failed_run",
      retried: 0, failed: 0, skipped: 0, total_candidates: 0,
      window_hours: windowHours,
      latency_ms: Date.now() - startMs,
      ts: new Date().toISOString(),
    }));
    return { retried: 0, failed: 0, skipped: 0, total: 0 };
  }

  // Claim atômico — previne double-send em chamadas concorrentes
  const candidateIds = candidates.map((c) => c.id);
  const { data: claimed, error: claimErr } = await supabaseAdmin
    .from("ai_logs")
    .update({ status: "ok_send_failed_retrying" })
    .in("id", candidateIds)
    .eq("status", "ok_send_failed")
    .select("id, conversation_id, lead_id, store_id, message_id, retry_count, last_send_error");

  if (claimErr) {
    console.error(JSON.stringify({
      level: "error",
      event: "retry_failed_claim_error",
      error: claimErr.message,
      ts: new Date().toISOString(),
    }));
    throw new Error("claim_failed");
  }

  const skipped = candidates.length - (claimed?.length ?? 0);
  let retried = 0;
  let failed = 0;

  for (const log of claimed ?? []) {
    // Pre-send guard: categoria permanente → escalada direta sem envio
    if (
      log.last_send_error &&
      PERMANENT_CATEGORIES.includes(log.last_send_error as typeof PERMANENT_CATEGORIES[number])
    ) {
      await supabaseAdmin
        .from("ai_logs")
        .update({ status: "ok_send_failed_permanent", retry_count: (log.retry_count ?? 0) + 1 })
        .eq("id", log.id);
      failed++;
      continue;
    }

    // Buscar texto da mensagem
    let msgText: string | null = null;
    if (log.message_id) {
      const { data: msg } = await supabaseAdmin
        .from("messages")
        .select("mensagem")
        .eq("id", log.message_id)
        .maybeSingle();
      msgText = msg?.mensagem ?? null;
    } else {
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
      await supabaseAdmin
        .from("ai_logs")
        .update({ status: "ok_send_failed_permanent", retry_count: (log.retry_count ?? 0) + 1 })
        .eq("id", log.id);
      failed++;
      continue;
    }

    try {
      const phoneId = await getStoreWhatsAppPhoneId(log.store_id);
      await sendWhatsAppMessage(lead.phone_normalized, msgText, phoneId);
      await supabaseAdmin
        .from("ai_logs")
        .update({ status: "ok", retry_count: (log.retry_count ?? 0) + 1 })
        .eq("id", log.id);
      retried++;
    } catch (sendErr) {
      const newCount = (log.retry_count ?? 0) + 1;
      const isPermanent = sendErr instanceof WhatsAppSendError && !sendErr.isRetryable;
      const isMaxed = newCount >= MAX_RETRY_ATTEMPTS;
      const finalStatus = isPermanent || isMaxed ? "ok_send_failed_permanent" : "ok_send_failed";
      const errorCategory = sendErr instanceof WhatsAppSendError ? sendErr.category : "unknown";
      const errorStatusCode = sendErr instanceof WhatsAppSendError ? sendErr.statusCode : undefined;

      await supabaseAdmin
        .from("ai_logs")
        .update({ status: finalStatus, retry_count: newCount, last_send_error: errorCategory })
        .eq("id", log.id);

      console.error(JSON.stringify({
        level: "error",
        event: "retry_failed_send_error",
        log_id: log.id,
        category: errorCategory,
        status_code: errorStatusCode,
        ts: new Date().toISOString(),
      }));
      failed++;
    }
  }

  console.log(JSON.stringify({
    level: "info",
    event: "retry_failed_run",
    retried, failed, skipped,
    total_candidates: candidates.length,
    window_hours: windowHours,
    latency_ms: Date.now() - startMs,
    ts: new Date().toISOString(),
  }));

  return { retried, failed, skipped, total: candidates.length };
}
