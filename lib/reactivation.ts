import { supabaseAdmin } from "@/lib/supabase";
import { sendWhatsAppMessage } from "@/lib/whatsapp-send";

// ---------------------------------------------------------------------------
// Templates — 2 tentativas, tom de reabordagem cuidadosa
// ---------------------------------------------------------------------------

const TEMPLATES: Record<number, (nome: string) => string> = {
  1: (nome) =>
    `Oi, ${nome}! Tudo bem? Você ainda está procurando um veículo ou já conseguiu resolver?`,
  2: (nome) =>
    `Oi, ${nome}! Passando uma última vez para saber se ainda posso te ajudar a encontrar um veículo. Se quiser, é só me chamar por aqui.`,
};

export function buildReactivationText(
  attemptNumber: number,
  nome: string | null
): string {
  const safeName = nome?.trim() || "você";
  const template = TEMPLATES[attemptNumber] ?? TEMPLATES[1];
  return template(safeName);
}

// ---------------------------------------------------------------------------
// Job
// ---------------------------------------------------------------------------

export interface ReactivationJobResult {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
}

interface EligibleLead {
  lead_id: string;
  store_id: string;
  conversation_id: string;
  nome: string | null;
  phone_normalized: string;
  attempt_count: number;
}

export async function runReactivationJob(opts?: {
  storeId?: string;
  limit?: number;
}): Promise<ReactivationJobResult> {
  const storeId = opts?.storeId ?? null;
  const limit = opts?.limit ?? 20;

  const { data, error } = await supabaseAdmin.rpc(
    "get_reactivation_eligible_leads",
    { p_store_id: storeId, p_limit: limit }
  );

  if (error || !data || (data as EligibleLead[]).length === 0) {
    if (error) console.error("[reactivation] RPC error:", error.message);
    return { processed: 0, sent: 0, skipped: 0, failed: 0 };
  }

  const result: ReactivationJobResult = {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  for (const lead of data as EligibleLead[]) {
    result.processed++;
    const attemptNumber = lead.attempt_count + 1;

    // Text computed BEFORE insert so message_text is in scope for the claim row
    const text = buildReactivationText(attemptNumber, lead.nome);

    // Atomic claim: insert BEFORE sending — 23505 means another instance claimed it
    const { error: insertError } = await supabaseAdmin
      .from("reactivation_logs")
      .insert({
        lead_id: lead.lead_id,
        store_id: lead.store_id,
        conversation_id: lead.conversation_id,
        attempt_number: attemptNumber,
        message_text: text,
        status: "sent",
      });

    if (insertError) {
      if ((insertError as { code?: string }).code === "23505") {
        console.log(
          `[reactivation] skipped lead=${lead.lead_id} attempt=${attemptNumber} (concurrent claim)`
        );
        result.skipped++;
        continue;
      }
      console.error("[reactivation] log insert failed:", insertError.message ?? insertError);
      result.failed++;
      continue;
    }

    const maskedPhone = `****${lead.phone_normalized.slice(-4)}`;

    try {
      await sendWhatsAppMessage(lead.phone_normalized, text);

      await supabaseAdmin.from("messages").insert({
        conversation_id: lead.conversation_id,
        store_id: lead.store_id,
        lead_id: lead.lead_id,
        mensagem: text,
        direcao: "saida",
        autor: "sistema",
        received_at: new Date().toISOString(),
      });

      console.log(
        `[reactivation] sent lead=${lead.lead_id} attempt=${attemptNumber} phone=${maskedPhone}`
      );
      result.sent++;
    } catch (err) {
      console.error(
        `[reactivation] WA failed lead=${lead.lead_id} attempt=${attemptNumber} phone=${maskedPhone}:`,
        err instanceof Error ? err.message : err
      );

      await supabaseAdmin
        .from("reactivation_logs")
        .update({ status: "failed" })
        .match({ lead_id: lead.lead_id, attempt_number: attemptNumber });

      result.failed++;
    }
  }

  return result;
}
