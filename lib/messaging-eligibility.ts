// ============================================================================
// Trava única compartilhada por follow-up e reativação (BL-0040/DL-0021).
//
// canSendMarketingMessage() é chamada pelos dois motores, sempre, antes de
// qualquer envio business-initiated (template ou texto livre fora da sessão
// de 24h) — nunca antes de uma resposta normal da IA dentro da conversa.
// ============================================================================

// Timezone fixo — só existe 1 loja hoje (Speed Motos, BRT), sem coluna de
// timezone por loja ainda (mesma dívida de fuso do BL-0016 original, ver
// DL-0021 seção "perguntas em aberto"). stores.business_hours_start/end são
// interpretados neste fuso até isso virar coluna própria.
export const MARKETING_TIMEZONE = "America/Sao_Paulo";

// Trava de frequência única entre os dois motores — evita colisão de
// follow-up e reativação no mesmo lead no mesmo dia (motivo original desta
// entrega, ver DL-0021).
export const MARKETING_FREQUENCY_CAP_HOURS = 48;

export type MarketingBlockReason = "opt_out" | "frequency_cap" | "outside_hours";

export interface MarketingEligibilityResult {
  allowed: boolean;
  reason?: MarketingBlockReason;
}

export interface MarketingEligibilityLead {
  marketing_opt_out: boolean | null | undefined;
  last_marketing_sent_at: string | null | undefined;
}

export interface MarketingEligibilityStore {
  business_hours_start: string | null | undefined; // "HH:MM" ou "HH:MM:SS" (Postgres TIME)
  business_hours_end: string | null | undefined;
}

function minutesOfDayInTimezone(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    timeZone: timezone,
  }).formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  // Intl pode devolver hour=24 à meia-noite dependendo do runtime — normaliza.
  return (hour % 24) * 60 + minute;
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":");
  const hour = parseInt(h ?? "0", 10);
  const minute = parseInt(m ?? "0", 10);
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
}

/**
 * Regras, nesta ordem — a primeira que falhar decide:
 *   1) opt-out do lead
 *   2) trava de frequência (48h desde o último envio business-initiated,
 *      de QUALQUER um dos dois motores)
 *   3) janela de horário comercial da loja
 */
export function canSendMarketingMessage(
  lead: MarketingEligibilityLead,
  store: MarketingEligibilityStore,
  now: Date
): MarketingEligibilityResult {
  if (lead.marketing_opt_out) {
    return { allowed: false, reason: "opt_out" };
  }

  if (lead.last_marketing_sent_at) {
    const hoursSince =
      (now.getTime() - new Date(lead.last_marketing_sent_at).getTime()) / (60 * 60 * 1000);
    if (hoursSince < MARKETING_FREQUENCY_CAP_HOURS) {
      return { allowed: false, reason: "frequency_cap" };
    }
  }

  const start = parseTimeToMinutes(store.business_hours_start ?? "08:00");
  const end = parseTimeToMinutes(store.business_hours_end ?? "20:00");
  const nowMinutes = minutesOfDayInTimezone(now, MARKETING_TIMEZONE);
  if (nowMinutes < start || nowMinutes >= end) {
    return { allowed: false, reason: "outside_hours" };
  }

  return { allowed: true };
}
