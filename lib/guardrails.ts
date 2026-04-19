import type { AgentContext } from "@/lib/agent-context";

export type GuardrailMode =
  | "normal"
  | "short_message"
  | "off_hours"
  | "reopen"
  | "human_handoff";

export interface GuardrailResult {
  mode: GuardrailMode;
  reason: string;
}

export interface GuardrailConfig {
  businessHoursStart?: number; // default: 8
  businessHoursEnd?: number;   // default: 18
  timezone?: string;           // default: "America/Sao_Paulo"
  now?: Date;                  // injetável para testes
}

function getHourInTimezone(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: timezone,
  }).formatToParts(date);
  return parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
}

export function runGuardrails(
  ctx: AgentContext,
  config?: GuardrailConfig
): GuardrailResult {
  const start = config?.businessHoursStart ?? 8;
  const end   = config?.businessHoursEnd   ?? 18;
  const tz    = config?.timezone           ?? "America/Sao_Paulo";
  const now   = config?.now                ?? new Date();

  // 1. Conversa encerrada → reavaliar contexto (prioridade máxima)
  if (ctx.conversation.conversation_status === "ENCERRADA") {
    return { mode: "reopen", reason: "conversa encerrada — tratar como novo contato" };
  }

  // 2. Handoff humano ativo → IA não deve responder
  if (
    ctx.conversation.handoff_to === "HUMANO" ||
    ctx.conversation.conversation_status === "AGUARDANDO_HUMANO"
  ) {
    return { mode: "human_handoff", reason: "conversa sob controle humano" };
  }

  // 3. Fora do horário comercial (engloba mensagem curta fora do horário)
  const hour = getHourInTimezone(now, tz);
  if (hour < start || hour >= end) {
    return {
      mode: "off_hours",
      reason: `fora do horário comercial (${hour}h, esperado ${start}h–${end}h BRT)`,
    };
  }

  // 4. Mensagem muito curta
  if (ctx.incoming_text.trim().length < 10) {
    return { mode: "short_message", reason: "mensagem muito curta — estimular continuação" };
  }

  return { mode: "normal", reason: "atendimento comercial padrão" };
}
