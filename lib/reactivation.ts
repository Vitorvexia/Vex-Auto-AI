import { supabaseAdmin } from "@/lib/supabase";
import { sendWhatsAppMessage, sendWhatsAppTemplateMessage } from "@/lib/whatsapp-send";
import { getStoreWhatsAppPhoneId } from "@/lib/whatsapp-credentials";
import { maskPhone } from "@/lib/pii";
import { getSafeName } from "@/lib/lead-name";
import { canSendMarketingMessage } from "@/lib/messaging-eligibility";

// Envio por template Meta aprovado (reactivation_vehicle_1/2/3,
// reactivation_no_vehicle_1/2/3) — desligado por padrão, mesmo mecanismo de
// lib/follow-up.ts. Ativar só depois da aprovação dos 9 templates.
//
// Fora da janela de 24h (M1, BL-0040/DL-0021) o envio SÓ pode ser via
// template — se o flag estiver desligado, a tentativa é pulada (não falha,
// não consome tentativa) até os templates serem aprovados.
const TEMPLATE_SEND_ENABLED = process.env.WHATSAPP_TEMPLATE_SEND_ENABLED === "true";
const TEMPLATE_LANGUAGE = "pt_BR";

// Janela de sessão da WhatsApp Cloud API — mesmo mecanismo de lib/follow-up.ts.
const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Context de reativação — dados do lead usados para enriquecer templates
// ---------------------------------------------------------------------------

export interface LeadReactivationContext {
  veiculo_interesse?: string | null;
}

// ---------------------------------------------------------------------------
// Templates — 3 tentativas, enriquecidos com nome + veículo
// ---------------------------------------------------------------------------

const TEMPLATES_WITH_VEHICLE: Record<number, (nome: string, veiculo: string) => string> = {
  1: (nome, veiculo) =>
    `Oi, ${nome}! Tudo bem? Vi que você estava interessado em ${veiculo}. Ainda está buscando?`,
  2: (nome, veiculo) =>
    `Oi, ${nome}! Voltando para saber sobre o ${veiculo} que conversamos. Ainda tem interesse? Temos novidades!`,
  3: (nome, veiculo) =>
    `Oi, ${nome}! Passando uma última vez — o ${veiculo} ainda está disponível. Se quiser retomar, é só me chamar!`,
};

const TEMPLATES_NO_VEHICLE: Record<number, (nome: string) => string> = {
  1: (nome) =>
    `Oi, ${nome}! Tudo bem? Você ainda está procurando um veículo ou já conseguiu resolver?`,
  2: (nome) =>
    `Oi, ${nome}! Voltando para saber se ainda posso te ajudar a encontrar o veículo certo. Última tentativa — é só me chamar!`,
  3: (nome) =>
    `Oi, ${nome}! Passando uma última vez — se quiser conversar sobre veículos, é só me chamar por aqui.`,
};

/** Único ponto de fallback de tentativa inválida — texto e nome de template SEMPRE usam isso, senão divergem. */
function clampAttempt(attemptNumber: number): 1 | 2 | 3 {
  return attemptNumber === 2 || attemptNumber === 3 ? attemptNumber : 1;
}

function safeVehicle(leadContext?: LeadReactivationContext | null): string | null {
  return leadContext?.veiculo_interesse?.trim() || null;
}

export function buildReactivationText(
  attemptNumber: number,
  nome: string | null,
  leadContext?: LeadReactivationContext | null
): string {
  const safeName = getSafeName(nome);
  const veiculo = safeVehicle(leadContext);
  const n = clampAttempt(attemptNumber);

  if (veiculo) return TEMPLATES_WITH_VEHICLE[n](safeName, veiculo);
  return TEMPLATES_NO_VEHICLE[n](safeName);
}

/** Nome do template Meta aprovado (ex: "reactivation_vehicle_1" / "reactivation_no_vehicle_1"). */
export function reactivationTemplateName(
  attemptNumber: number,
  leadContext?: LeadReactivationContext | null
): string {
  const n = clampAttempt(attemptNumber);
  return safeVehicle(leadContext) ? `reactivation_vehicle_${n}` : `reactivation_no_vehicle_${n}`;
}

/**
 * Parâmetros do template na ordem — reactivation_vehicle: {{1}}=nome, {{2}}=veículo.
 * reactivation_no_vehicle: {{1}}=nome. Mesmo fallback de buildReactivationText.
 */
export function reactivationTemplateParams(
  nome: string | null,
  leadContext?: LeadReactivationContext | null
): string[] {
  const safeName = getSafeName(nome);
  const veiculo = safeVehicle(leadContext);
  return veiculo ? [safeName, veiculo] : [safeName];
}

// ---------------------------------------------------------------------------
// markReactivationResponded — chamado pelo pipeline ao receber msg entrante
// ---------------------------------------------------------------------------

export async function markReactivationResponded(leadId: string): Promise<void> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabaseAdmin
      .from("reactivation_logs")
      .update({ responded_at: new Date().toISOString() })
      .eq("lead_id", leadId)
      .eq("status", "sent")
      .is("responded_at", null)
      .gte("logged_at", thirtyDaysAgo);

    if (error) {
      console.error("[reactivation] markReactivationResponded failed:", error.message);
    }
  } catch (e) {
    console.error("[reactivation] markReactivationResponded exception:", e);
  }
}

// ---------------------------------------------------------------------------
// markReactivationConverted — chamado quando lead_status → FECHADO
// ---------------------------------------------------------------------------

export async function markReactivationConverted(
  leadId: string,
  storeId: string
): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from("reactivation_logs")
      .update({ converted_at: new Date().toISOString() })
      .eq("lead_id", leadId)
      .eq("store_id", storeId)
      .not("responded_at", "is", null)
      .is("converted_at", null);

    if (error) {
      console.error("[reactivation] markReactivationConverted failed:", error.message);
    }
  } catch (e) {
    console.error("[reactivation] markReactivationConverted exception:", e);
  }
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
  veiculo_interesse: string | null;
  last_inbound_at: string | null;
  last_marketing_sent_at: string | null;
  business_hours_start: string | null;
  business_hours_end: string | null;
}

export async function runReactivationJob(opts?: {
  storeId?: string;
  limit?: number;
  now?: Date;
}): Promise<ReactivationJobResult> {
  const storeId = opts?.storeId ?? null;
  const limit = opts?.limit ?? 20;
  const now = opts?.now ?? new Date();

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

    // Trava única (opt-out / frequência / horário comercial) — compartilhada
    // com follow-up. Bloqueado aqui não consome tentativa: sem claim
    // inserido, a RPC devolve o mesmo lead no próximo cron elegível.
    const eligibility = canSendMarketingMessage(
      { marketing_opt_out: false, last_marketing_sent_at: lead.last_marketing_sent_at },
      { business_hours_start: lead.business_hours_start, business_hours_end: lead.business_hours_end },
      now
    );
    if (!eligibility.allowed) {
      console.log(
        `[reactivation] skipped lead=${lead.lead_id} attempt=${attemptNumber} reason=${eligibility.reason}`
      );
      result.skipped++;
      continue;
    }

    // M1: dentro da janela de sessão de 24h, texto livre é válido.
    const withinSessionWindow =
      !!lead.last_inbound_at &&
      now.getTime() - new Date(lead.last_inbound_at).getTime() < SESSION_WINDOW_MS;

    if (!withinSessionWindow && !TEMPLATE_SEND_ENABLED) {
      console.log(
        `[reactivation] skipped lead=${lead.lead_id} attempt=${attemptNumber} reason=template_required_not_enabled`
      );
      result.skipped++;
      continue;
    }

    // Texto gerado ANTES do insert para garantir consistência entre log e mensagem
    const text = buildReactivationText(attemptNumber, lead.nome, {
      veiculo_interesse: lead.veiculo_interesse,
    });

    // 1. Claim atômico: 23505 = outra instância já processou
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

    const maskedPhone = maskPhone(lead.phone_normalized);

    // 2. Persistir mensagem ANTES do envio WA — falha de envio nunca perde o histórico
    const { error: msgInsertError } = await supabaseAdmin.from("messages").insert({
      conversation_id: lead.conversation_id,
      store_id: lead.store_id,
      lead_id: lead.lead_id,
      mensagem: text,
      direcao: "saida",
      autor: "sistema",
      received_at: new Date().toISOString(),
    });

    if (msgInsertError) {
      console.error(
        `[reactivation] messages insert failed lead=${lead.lead_id}:`,
        msgInsertError.message ?? msgInsertError
      );
      // Non-fatal: texto está em reactivation_logs.message_text, prosseguir com envio
    }

    // 3. Enviar via WhatsApp
    try {
      const phoneId = await getStoreWhatsAppPhoneId(lead.store_id);
      const leadContext: LeadReactivationContext = { veiculo_interesse: lead.veiculo_interesse };

      // Texto renderizado (buildReactivationText, já em message_text/messages)
      // e template enviado à Meta usam o mesmo clampAttempt/nome/veículo —
      // precisam bater, senão o vendedor vê no inbox algo diferente do que
      // o cliente recebeu.
      if (withinSessionWindow) {
        await sendWhatsAppMessage(lead.phone_normalized, text, phoneId);
      } else {
        await sendWhatsAppTemplateMessage(
          lead.phone_normalized,
          reactivationTemplateName(attemptNumber, leadContext),
          TEMPLATE_LANGUAGE,
          reactivationTemplateParams(lead.nome, leadContext),
          phoneId
        );
      }

      // Non-fatal: envio já confirmado acima. Falha aqui nunca deve virar
      // "failed" pro job — só perde a trava de frequência compartilhada.
      try {
        await supabaseAdmin
          .from("leads")
          .update({ last_marketing_sent_at: now.toISOString() })
          .eq("id", lead.lead_id);
      } catch (bookkeepingErr) {
        console.error(
          `[reactivation] bookkeeping update failed lead=${lead.lead_id}:`,
          bookkeepingErr instanceof Error ? bookkeepingErr.message : bookkeepingErr
        );
      }

      console.log(
        `[reactivation] sent lead=${lead.lead_id} attempt=${attemptNumber} phone=${maskedPhone}`
      );
      result.sent++;
    } catch (err) {
      console.error(
        `[reactivation] WA failed lead=${lead.lead_id} attempt=${attemptNumber} phone=${maskedPhone}:`,
        err instanceof Error ? err.message : err
      );

      // 4. Marcar como falha no log (idempotente se chamado novamente)
      await supabaseAdmin
        .from("reactivation_logs")
        .update({
          status: "failed",
          error_message: err instanceof Error ? err.message : String(err),
        })
        .match({ lead_id: lead.lead_id, attempt_number: attemptNumber });

      result.failed++;
    }
  }

  return result;
}
