import { supabaseAdmin } from "@/lib/supabase";
import { sendWhatsAppMessage } from "@/lib/whatsapp-send";
import { getStoreWhatsAppPhoneId } from "@/lib/whatsapp-credentials";

// ---------------------------------------------------------------------------
// Templates — 3 tentativas com textos distintos
// ---------------------------------------------------------------------------

const TEMPLATES: Record<number, (nome: string) => string> = {
  1: (nome) =>
    `Olá, ${nome}! Vimos que você demonstrou interesse em nossos veículos. Ainda posso te ajudar a encontrar o carro ideal?`,
  2: (nome) =>
    `${nome}, ainda estamos aqui para ajudar! Temos ótimas condições disponíveis. Quer conversar sobre as opções?`,
  3: (nome) =>
    `${nome}, esta é nossa última tentativa de contato. Podemos encerrar por aqui — mas adoraríamos te ajudar a encontrar o veículo perfeito antes disso!`,
};

export function buildFollowUpText(
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

export interface FollowUpJobResult {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
}

interface EligibleConv {
  conversation_id: string;
  store_id: string;
  lead_id: string;
  nome: string | null;
  phone_normalized: string;
  attempt_count: number;
}

export async function runFollowUpJob(opts?: {
  storeId?: string;
  limit?: number;
}): Promise<FollowUpJobResult> {
  const storeId = opts?.storeId ?? null;
  const limit = opts?.limit ?? 20;

  const { data, error } = await supabaseAdmin.rpc(
    "get_followup_eligible_conversations",
    { p_store_id: storeId, p_limit: limit }
  );

  if (error || !data || (data as EligibleConv[]).length === 0) {
    if (error) console.error("[follow-up] RPC error:", error.message);
    return { processed: 0, sent: 0, skipped: 0, failed: 0 };
  }

  const result: FollowUpJobResult = {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  for (const conv of data as EligibleConv[]) {
    result.processed++;
    const attemptNumber = conv.attempt_count + 1;

    // Atomic claim: insert BEFORE sending — 23505 means another instance claimed it
    const { error: insertError } = await supabaseAdmin
      .from("follow_up_logs")
      .insert({
        conversation_id: conv.conversation_id,
        store_id: conv.store_id,
        lead_id: conv.lead_id,
        attempt_number: attemptNumber,
        status: "sent",
      });

    if (insertError) {
      if ((insertError as { code?: string }).code === "23505") {
        console.log(
          `[follow-up] skipped conv=${conv.conversation_id} attempt=${attemptNumber} (concurrent claim)`
        );
        result.skipped++;
        continue;
      }
      console.error("[follow-up] log insert failed:", insertError.message ?? insertError);
      result.failed++;
      continue;
    }

    const text = buildFollowUpText(attemptNumber, conv.nome);
    const maskedPhone = `****${conv.phone_normalized.slice(-4)}`;

    try {
      const phoneId = await getStoreWhatsAppPhoneId(conv.store_id);
      await sendWhatsAppMessage(conv.phone_normalized, text, phoneId);

      await supabaseAdmin.from("messages").insert({
        conversation_id: conv.conversation_id,
        store_id: conv.store_id,
        lead_id: conv.lead_id,
        mensagem: text,
        direcao: "saida",
        // autor='sistema': nenhum LLM invocado, mensagem de template
        autor: "sistema",
        received_at: new Date().toISOString(),
      });

      console.log(
        `[follow-up] sent conv=${conv.conversation_id} attempt=${attemptNumber} phone=${maskedPhone}`
      );
      result.sent++;
    } catch (err) {
      console.error(
        `[follow-up] WA failed conv=${conv.conversation_id} attempt=${attemptNumber} phone=${maskedPhone}:`,
        err instanceof Error ? err.message : err
      );

      await supabaseAdmin
        .from("follow_up_logs")
        .update({ status: "failed" })
        .match({
          conversation_id: conv.conversation_id,
          attempt_number: attemptNumber,
        });

      result.failed++;
    }
  }

  return result;
}
