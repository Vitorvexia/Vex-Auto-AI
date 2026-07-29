import Anthropic, { APIConnectionTimeoutError } from "@anthropic-ai/sdk";
import type { AgentContext, FinanciamentoData, TrocaData } from "@/lib/agent-context";
import type { PromptPayload } from "@/lib/prompts";

// ============================================================================
// Types
// ============================================================================

export interface CollectedData {
  financiamento?: FinanciamentoData | null;
  troca?: TrocaData | null;
}

export interface AgentResult {
  reply_text: string;
  should_handoff: boolean;
  score: number;
  intent_tags: string[];
  summary: string;
  collected_data?: CollectedData;
}

// ============================================================================
// Typed errors
// ============================================================================

export class AgentTimeoutError extends Error {
  constructor() {
    super("runAgent: timeout excedido");
    this.name = "AgentTimeoutError";
  }
}

export class AgentParseError extends Error {
  constructor(raw: string) {
    super(`runAgent: JSON inválido — ${raw.slice(0, 80)}`);
    this.name = "AgentParseError";
  }
}

export class AgentOutputError extends Error {
  constructor(reason: string) {
    super(`runAgent: saída inválida — ${reason}`);
    this.name = "AgentOutputError";
  }
}

// ============================================================================
// Step 1: call Anthropic API
// ============================================================================

async function callAnthropic(
  payload: PromptPayload,
  model: string,
  timeoutMs: number
): Promise<Anthropic.Message> {
  // maxRetries: 0 — SDK retries silently multiply effective timeout by 3 (default=2).
  // With Vercel Hobby wall at 10s and AGENT_TIMEOUT_MS=8s, retries push past the wall
  // before AgentTimeoutError can propagate to the catch block. Disable retries so the
  // timeout fires deterministically and the catch block always has a chance to run.
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0 });
  try {
    return await client.messages.create(
      {
        model,
        max_tokens: 512,
        system: payload.system,
        messages: payload.messages,
      },
      { timeout: timeoutMs }
    );
  } catch (e: unknown) {
    if (e instanceof APIConnectionTimeoutError) {
      throw new AgentTimeoutError();
    }
    throw e;
  }
}

// ============================================================================
// Step 2: extract text from response
// ============================================================================

function extractText(response: Anthropic.Message): string {
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new AgentOutputError("nenhum bloco de texto na resposta");
  }
  return block.text.trim();
}

// ============================================================================
// Step 3: parse JSON
// ============================================================================

function parseOutput(raw: string): unknown {
  // Remove markdown code fences (```json ... ``` or ``` ... ```)
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    throw new AgentParseError(raw);
  }
}

// ============================================================================
// Step 4: validate fields and apply fallbacks — exported for unit testing
// ============================================================================

const CONTROL_CHARS = /[\x00-\x08\x0E-\x1F]/g;

function strip(s: string): string {
  return s.replace(CONTROL_CHARS, "");
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 3) + "...";
}

function coerceStringOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function coerceNumberOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function validateFinanciamento(raw: unknown): FinanciamentoData | null {
  if (raw === null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    nome_completo: coerceStringOrNull(o.nome_completo),
    cpf: coerceStringOrNull(o.cpf),
    renda_aproximada: coerceStringOrNull(o.renda_aproximada),
    entrada_disposta: coerceStringOrNull(o.entrada_disposta),
    data_nascimento: coerceStringOrNull(o.data_nascimento),
  };
}

function validateTroca(raw: unknown): TrocaData | null {
  if (raw === null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    modelo: coerceStringOrNull(o.modelo),
    ano: coerceNumberOrNull(o.ano),
    km: coerceNumberOrNull(o.km),
    servico_recente: coerceStringOrNull(o.servico_recente),
    agendamento_data: coerceStringOrNull(o.agendamento_data),
    agendamento_horario: coerceStringOrNull(o.agendamento_horario),
  };
}

function validateCollectedData(raw: unknown): CollectedData | undefined {
  if (raw === null || raw === undefined || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const financiamento = validateFinanciamento(o.financiamento);
  const troca = validateTroca(o.troca);
  if (!financiamento && !troca) return undefined;
  return { financiamento, troca };
}

export function validateOutput(raw: unknown, leadScore: number): AgentResult {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new AgentOutputError("resposta não é um objeto JSON válido");
  }
  const obj = raw as Record<string, unknown>;

  let reply_text =
    typeof obj?.reply_text === "string" ? obj.reply_text.trim() : "";
  if (!reply_text) {
    throw new AgentOutputError("reply_text ausente ou vazio");
  }
  reply_text = truncate(strip(reply_text), 4096);

  const should_handoff =
    typeof obj?.should_handoff === "boolean" ? obj.should_handoff : false;

  const rawScore = typeof obj?.score === "number" ? obj.score : -1;
  const score =
    Number.isFinite(rawScore) && rawScore >= 0 && rawScore <= 100
      ? rawScore
      : leadScore;

  const intent_tags = (
    Array.isArray(obj?.intent_tags)
      ? (obj.intent_tags as unknown[]).filter((t): t is string => typeof t === "string")
      : []
  )
    .slice(0, 10)
    .map((t) => t.slice(0, 50));

  const summary = typeof obj?.summary === "string"
    ? truncate(strip(obj.summary), 1000)
    : "";

  const collected_data = validateCollectedData(obj?.collected_data);

  return {
    reply_text,
    should_handoff,
    score,
    intent_tags,
    summary,
    ...(collected_data ? { collected_data } : {}),
  };
}

// ============================================================================
// Main function
// ============================================================================

export async function runAgent(
  payload: PromptPayload,
  ctx: AgentContext,
  options?: { timeoutMs?: number }
): Promise<AgentResult> {
  const model = process.env.ANTHROPIC_MODEL;
  if (!model) throw new Error("ANTHROPIC_MODEL não configurado");

  const parsedTimeout = parseInt(process.env.AGENT_TIMEOUT_MS ?? "8000", 10);
  const timeoutMs = options?.timeoutMs ?? (Number.isFinite(parsedTimeout) ? parsedTimeout : 8000);

  const response = await callAnthropic(payload, model, timeoutMs);
  const raw = extractText(response);
  const parsed = parseOutput(raw);
  return validateOutput(parsed, ctx.lead.score);
}
