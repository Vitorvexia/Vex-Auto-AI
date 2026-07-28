import { supabaseAdmin } from "@/lib/supabase";
import { sendWhatsAppMessage, sendWhatsAppTemplateMessage } from "@/lib/whatsapp-send";
import { getStoreWhatsAppPhoneId } from "@/lib/whatsapp-credentials";
import { maskPhone } from "@/lib/pii";

// Envio por template Meta aprovado (follow_up_1/2/3) — desligado por padrão.
// Template não aprovado retorna erro da Meta; ativar só depois da aprovação
// dos 9 templates (roadmap 0.2, docs/vex/29_DECISIONS_LOG.md).
const TEMPLATE_SEND_ENABLED = process.env.WHATSAPP_TEMPLATE_SEND_ENABLED === "true";
const TEMPLATE_LANGUAGE = "pt_BR";

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

/** Único ponto de fallback de tentativa inválida — texto e nome de template SEMPRE usam isso, senão divergem. */
function clampAttempt(attemptNumber: number): 1 | 2 | 3 {
  return attemptNumber === 2 || attemptNumber === 3 ? attemptNumber : 1;
}

export function buildFollowUpText(
  attemptNumber: number,
  nome: string | null
): string {
  const safeName = nome?.trim() || "você";
  return TEMPLATES[clampAttempt(attemptNumber)](safeName);
}

/** Nome do template Meta aprovado pra essa tentativa (ex: "follow_up_1"). */
export function followUpTemplateName(attemptNumber: number): string {
  return `follow_up_${clampAttempt(attemptNumber)}`;
}

/** Parâmetros do template na ordem — {{1}} = nome. Mesmo fallback de buildFollowUpText. */
export function followUpTemplateParams(nome: string | null): string[] {
  return [nome?.trim() || "você"];
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
    const maskedPhone = maskPhone(conv.phone_normalized);

    try {
      const phoneId = await getStoreWhatsAppPhoneId(conv.store_id);

      // Texto renderizado (buildFollowUpText) e template enviado à Meta usam
      // o mesmo clampAttempt/nome — precisam bater, senão o vendedor vê no
      // inbox algo diferente do que o cliente recebeu.
      if (TEMPLATE_SEND_ENABLED) {
        await sendWhatsAppTemplateMessage(
          conv.phone_normalized,
          followUpTemplateName(attemptNumber),
          TEMPLATE_LANGUAGE,
          followUpTemplateParams(conv.nome),
          phoneId
        );
      } else {
        await sendWhatsAppMessage(conv.phone_normalized, text, phoneId);
      }

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
        .update({
          status: "failed",
          error_message: err instanceof Error ? err.message : String(err),
        })
        .match({
          conversation_id: conv.conversation_id,
          attempt_number: attemptNumber,
        });

      result.failed++;
    }
  }

  return result;
}
