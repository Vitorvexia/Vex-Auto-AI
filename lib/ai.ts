import Anthropic from "@anthropic-ai/sdk";
import type { AgentContext } from "@/lib/agent-context";
import type { PromptPayload } from "@/lib/prompts";

// ============================================================================
// Types
// ============================================================================

export interface AgentResult {
  reply_text: string;
  should_handoff: boolean;
  score: number;
  intent_tags: string[];
  summary: string;
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
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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
  } catch (e: any) {
    if (e?.name === "APITimeoutError" || e?.status === 408) {
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
  try {
    return JSON.parse(raw);
  } catch {
    throw new AgentParseError(raw);
  }
}

// ============================================================================
// Step 4: validate fields and apply fallbacks — exported for unit testing
// ============================================================================

export function validateOutput(raw: unknown, leadScore: number): AgentResult {
  const obj = raw as Record<string, unknown>;

  const reply_text =
    typeof obj?.reply_text === "string" ? obj.reply_text.trim() : "";
  if (!reply_text) {
    throw new AgentOutputError("reply_text ausente ou vazio");
  }

  const should_handoff =
    typeof obj?.should_handoff === "boolean" ? obj.should_handoff : false;

  const rawScore = typeof obj?.score === "number" ? obj.score : -1;
  const score = rawScore >= 0 && rawScore <= 100 ? rawScore : leadScore;

  const intent_tags = Array.isArray(obj?.intent_tags)
    ? (obj.intent_tags as string[])
    : [];

  const summary = typeof obj?.summary === "string" ? obj.summary : "";

  return { reply_text, should_handoff, score, intent_tags, summary };
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

  const timeoutMs =
    options?.timeoutMs ??
    parseInt(process.env.AGENT_TIMEOUT_MS ?? "8000", 10);

  const response = await callAnthropic(payload, model, timeoutMs);
  const raw = extractText(response);
  const parsed = parseOutput(raw);
  return validateOutput(parsed, ctx.lead.score);
}
