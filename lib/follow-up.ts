import { supabaseAdmin } from "@/lib/supabase";
import { sendWhatsAppMessage, sendWhatsAppTemplateMessage } from "@/lib/whatsapp-send";
import { getStoreWhatsAppPhoneId } from "@/lib/whatsapp-credentials";
import { maskPhone } from "@/lib/pii";
import { getSafeName } from "@/lib/lead-name";
import { canSendMarketingMessage } from "@/lib/messaging-eligibility";

// Envio por template Meta aprovado (follow_up_1/2/3) — desligado por padrão.
// Template não aprovado retorna erro da Meta; ativar só depois da aprovação
// dos 9 templates (roadmap 0.2, docs/vex/29_DECISIONS_LOG.md).
//
// Fora da janela de 24h (M1, BL-0040/DL-0021) o envio SÓ pode ser via
// template — texto livre é rejeitado pela Meta fora da sessão. Se o flag
// estiver desligado nesse caso, a tentativa é pulada (não falha, não
// consome tentativa) até os templates serem aprovados.
const TEMPLATE_SEND_ENABLED = process.env.WHATSAPP_TEMPLATE_SEND_ENABLED === "true";
const TEMPLATE_LANGUAGE = "pt_BR";

// Janela de sessão da WhatsApp Cloud API — texto livre só é aceito até 24h
// depois da última mensagem do LEAD (last_inbound_at). Fora disso, é
// business-initiated e precisa de template aprovado.
const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

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
  return TEMPLATES[clampAttempt(attemptNumber)](getSafeName(nome));
}

/** Nome do template Meta aprovado pra essa tentativa (ex: "follow_up_1"). */
export function followUpTemplateName(attemptNumber: number): string {
  return `follow_up_${clampAttempt(attemptNumber)}`;
}

/** Parâmetros do template na ordem — {{1}} = nome. Mesmo fallback de buildFollowUpText. */
export function followUpTemplateParams(nome: string | null): string[] {
  return [getSafeName(nome)];
}

// ---------------------------------------------------------------------------
// markFollowUpCompletedIfInterrupted — M6 (BL-0040/DL-0021)
//
// Chamado pelo pipeline de IA ao processar mensagem entrante (mesmo padrão
// de markReactivationResponded em lib/reactivation.ts). A RPC de
// elegibilidade já exclui conversas onde o lead respondeu — isso só faz o
// motor parar de tentar de novo, mas nunca grava follow_up_completed_at
// sozinho. Sem esse marcador, a reativação (âncora = follow_up_completed_at)
// nunca saberia que a sequência de follow-up acabou.
// ---------------------------------------------------------------------------

export async function markFollowUpCompletedIfInterrupted(
  leadId: string,
  conversationId: string
): Promise<void> {
  try {
    const { data: attempts, error: selectError } = await supabaseAdmin
      .from("follow_up_logs")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("status", "sent")
      .limit(1);

    if (selectError) {
      console.error("[follow-up] markFollowUpCompletedIfInterrupted select failed:", selectError.message);
      return;
    }
    // Nenhuma tentativa de follow-up nesta conversa — nada a interromper.
    if (!attempts || attempts.length === 0) return;

    const { error } = await supabaseAdmin
      .from("leads")
      .update({ follow_up_completed_at: new Date().toISOString() })
      .eq("id", leadId)
      .is("follow_up_completed_at", null);

    if (error) {
      console.error("[follow-up] markFollowUpCompletedIfInterrupted update failed:", error.message);
    }
  } catch (e) {
    console.error("[follow-up] markFollowUpCompletedIfInterrupted exception:", e);
  }
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
  last_inbound_at: string | null;
  last_marketing_sent_at: string | null;
  business_hours_start: string | null;
  business_hours_end: string | null;
}

export async function runFollowUpJob(opts?: {
  storeId?: string;
  limit?: number;
  now?: Date;
}): Promise<FollowUpJobResult> {
  const storeId = opts?.storeId ?? null;
  const limit = opts?.limit ?? 20;
  const now = opts?.now ?? new Date();

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

    // Trava única (opt-out / frequência / horário comercial) — compartilhada
    // com reativação. Bloqueado aqui não consome tentativa: sem claim
    // inserido, a RPC devolve a mesma conversa no próximo cron elegível.
    const eligibility = canSendMarketingMessage(
      { marketing_opt_out: false, last_marketing_sent_at: conv.last_marketing_sent_at },
      { business_hours_start: conv.business_hours_start, business_hours_end: conv.business_hours_end },
      now
    );
    if (!eligibility.allowed) {
      console.log(
        `[follow-up] skipped conv=${conv.conversation_id} attempt=${attemptNumber} reason=${eligibility.reason}`
      );
      result.skipped++;
      continue;
    }

    // M1: dentro da janela de sessão de 24h (última msg do lead), texto
    // livre é válido — mais barato e não depende de template aprovado. Fora
    // da janela, só template é aceito pela Meta.
    const withinSessionWindow =
      !!conv.last_inbound_at &&
      now.getTime() - new Date(conv.last_inbound_at).getTime() < SESSION_WINDOW_MS;

    if (!withinSessionWindow && !TEMPLATE_SEND_ENABLED) {
      console.log(
        `[follow-up] skipped conv=${conv.conversation_id} attempt=${attemptNumber} reason=template_required_not_enabled`
      );
      result.skipped++;
      continue;
    }

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
      if (withinSessionWindow) {
        await sendWhatsAppMessage(conv.phone_normalized, text, phoneId);
      } else {
        await sendWhatsAppTemplateMessage(
          conv.phone_normalized,
          followUpTemplateName(attemptNumber),
          TEMPLATE_LANGUAGE,
          followUpTemplateParams(conv.nome),
          phoneId
        );
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

      // Non-fatal: envio já confirmado acima. Falha aqui nunca deve virar
      // "failed" pro job — só perde a trava de frequência/marcador de fim
      // de sequência, não a mensagem em si.
      try {
        await supabaseAdmin
          .from("leads")
          .update({ last_marketing_sent_at: now.toISOString() })
          .eq("id", conv.lead_id);

        // Última tentativa da sequência — marca fim do follow-up, gatilho da
        // elegibilidade de reativação (ver migration 044).
        if (attemptNumber === 3) {
          await supabaseAdmin
            .from("leads")
            .update({ follow_up_completed_at: now.toISOString() })
            .eq("id", conv.lead_id)
            .is("follow_up_completed_at", null);
        }
      } catch (bookkeepingErr) {
        console.error(
          `[follow-up] bookkeeping update failed conv=${conv.conversation_id}:`,
          bookkeepingErr instanceof Error ? bookkeepingErr.message : bookkeepingErr
        );
      }

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
