import type { AgentContext, LeadContexto, TrocaData } from "@/lib/agent-context";
import { detectSignals } from "@/lib/lead-scoring";

export type GuardrailMode =
  | "normal"
  | "short_message"
  | "reopen"
  | "human_handoff";

export type CollectionTopic = "financiamento" | "troca";

export interface CollectionState {
  ask: CollectionTopic[];
  collect: CollectionTopic[];
  missingTrocaFields: string[];
}

export interface GuardrailResult {
  mode: GuardrailMode;
  reason: string;
  collection: CollectionState | null;
  // Ortogonal ao mode — a IA atende normalmente a qualquer hora (24/7 é a
  // proposta de valor central do produto). Isso só informa lib/prompts.ts
  // pra frasear corretamente um handoff real que aconteça fora do horário
  // (quem retoma é o vendedor humano, não a IA — ela continua disponível).
  outsideBusinessHours: boolean;
  businessHoursStart: number;
  businessHoursEnd: number;
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

const TROCA_REQUIRED_FIELDS: Array<{ key: keyof TrocaData; label: string }> = [
  { key: "modelo", label: "modelo da moto" },
  { key: "ano", label: "ano da moto" },
  { key: "km", label: "quantos km rodados" },
  { key: "servico_recente", label: "se fez algum serviço recente, principalmente no motor" },
  { key: "agendamento_horario", label: "dia e horário que consegue vir até a loja" },
];

function isFilled(v: unknown): boolean {
  return v !== undefined && v !== null && v !== "";
}

function computeMissingTrocaFields(draft: Partial<TrocaData> | null | undefined): string[] {
  const d = draft ?? {};
  return TROCA_REQUIRED_FIELDS.filter(({ key }) => !isFilled(d[key])).map(({ label }) => label);
}

function detectCollection(ctx: AgentContext): CollectionState | null {
  const contexto: LeadContexto = ctx.lead.contexto ?? {};
  const pending = new Set(contexto.pending_topics ?? []);
  const collect: CollectionTopic[] = [];
  if (pending.has("financiamento")) collect.push("financiamento");
  if (pending.has("troca")) collect.push("troca");

  const signals = detectSignals(ctx.incoming_text);
  const ask: CollectionTopic[] = [];
  if (signals.includes("financiamento") && !pending.has("financiamento") && !contexto.financiamento) {
    ask.push("financiamento");
  }
  if (signals.includes("troca") && !pending.has("troca") && !contexto.troca) {
    ask.push("troca");
  }

  if (ask.length === 0 && collect.length === 0) return null;

  const missingTrocaFields = collect.includes("troca")
    ? computeMissingTrocaFields(contexto.troca_draft)
    : [];

  return { ask, collect, missingTrocaFields };
}

export function runGuardrails(
  ctx: AgentContext,
  config?: GuardrailConfig
): GuardrailResult {
  const start = config?.businessHoursStart ?? 8;
  const end   = config?.businessHoursEnd   ?? 18;
  const tz    = config?.timezone           ?? "America/Sao_Paulo";
  const now   = config?.now                ?? new Date();

  // Calculado sempre, independente do mode — NUNCA suprime atendimento
  // normal. IA responde 24/7, qualquer assunto, qualquer hora; isso só
  // habilita lib/prompts.ts a frasear corretamente um handoff real que
  // aconteça fora do horário (vendedor humano retoma, não a IA).
  const hour = getHourInTimezone(now, tz);
  const outsideBusinessHours = hour < start || hour >= end;

  // 1. Conversa encerrada → reavaliar contexto (prioridade máxima)
  if (ctx.conversation.conversation_status === "ENCERRADA") {
    return {
      mode: "reopen",
      reason: "conversa encerrada — tratar como novo contato",
      collection: detectCollection(ctx),
      outsideBusinessHours,
      businessHoursStart: start,
      businessHoursEnd: end,
    };
  }

  // 2. Handoff humano ativo → IA não deve responder, coleta não se aplica
  if (
    ctx.conversation.handoff_to === "HUMANO" ||
    ctx.conversation.conversation_status === "AGUARDANDO_HUMANO"
  ) {
    return {
      mode: "human_handoff",
      reason: "conversa sob controle humano",
      collection: null,
      outsideBusinessHours,
      businessHoursStart: start,
      businessHoursEnd: end,
    };
  }

  // 3. Mensagem muito curta
  if (ctx.incoming_text.trim().length < 10) {
    return {
      mode: "short_message",
      reason: "mensagem muito curta — estimular continuação",
      collection: detectCollection(ctx),
      outsideBusinessHours,
      businessHoursStart: start,
      businessHoursEnd: end,
    };
  }

  return {
    mode: "normal",
    reason: "atendimento comercial padrão",
    collection: detectCollection(ctx),
    outsideBusinessHours,
    businessHoursStart: start,
    businessHoursEnd: end,
  };
}
