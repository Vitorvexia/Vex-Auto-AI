/**
 * Testes unitários para runAiPipeline (lib/ai-pipeline.ts)
 *
 * Foca no comportamento não-fatal do envio WhatsApp:
 * falha no sendWhatsAppMessage não deve alterar o agent_status
 * nem propagar exceção — reply já está salvo no banco.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks de módulos (deve vir antes do import do módulo testado)
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  },
}));

vi.mock("@/lib/agent-context", () => ({
  buildAgentContext: vi.fn(),
}));

vi.mock("@/lib/guardrails", () => ({
  runGuardrails: vi.fn(),
}));

vi.mock("@/lib/prompts", () => ({
  buildPrompt: vi.fn(),
}));

vi.mock("@/lib/ai", () => ({
  runAgent: vi.fn(),
  AgentTimeoutError: class AgentTimeoutError extends Error {
    constructor() { super("timeout"); this.name = "AgentTimeoutError"; }
  },
  AgentParseError: class AgentParseError extends Error {
    constructor(raw: string) { super(raw); this.name = "AgentParseError"; }
  },
  AgentOutputError: class AgentOutputError extends Error {
    constructor(r: string) { super(r); this.name = "AgentOutputError"; }
  },
}));

vi.mock("@/lib/status", () => ({
  transitionConversationStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/whatsapp-send", () => ({
  sendWhatsAppMessage: vi.fn(),
  WhatsAppSendError: class WhatsAppSendError extends Error {
    statusCode?: number;
    constructor(msg: string, code?: number) {
      super(msg); this.name = "WhatsAppSendError"; this.statusCode = code;
    }
  },
}));

// ---------------------------------------------------------------------------
// Imports após mocks
// ---------------------------------------------------------------------------

import { runAiPipeline } from "@/lib/ai-pipeline";
import { buildAgentContext } from "@/lib/agent-context";
import { runGuardrails } from "@/lib/guardrails";
import { buildPrompt } from "@/lib/prompts";
import { runAgent } from "@/lib/ai";
import { sendWhatsAppMessage, WhatsAppSendError } from "@/lib/whatsapp-send";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_PARAMS = {
  storeId: "store-1",
  leadId: "lead-1",
  conversationId: "conv-1",
  incomingText: "Olá, quero um carro",
};

const BASE_CTX = {
  store_id: "store-1",
  store_name: "Vex Motors",
  lead: {
    id: "lead-1",
    nome: "Carlos",
    phone_normalized: "+5511999990000",
    lead_status: "NOVO",
    score: 10,
    origem: "whatsapp",
  },
  conversation: {
    id: "conv-1",
    conversation_status: "ATIVA",
    handoff_to: "IA",
    summary: null,
    ultima_mensagem_em: new Date().toISOString(),
  },
  last_messages: [],
  vehicles: [],
  incoming_text: "Olá, quero um carro",
};

const BASE_RESULT = {
  reply_text: "Olá! Posso ajudar.",
  should_handoff: false,
  score: 15,
  intent_tags: ["greeting"],
  summary: "Lead novo.",
};

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.mocked(buildAgentContext).mockResolvedValue(BASE_CTX as any);
  vi.mocked(runGuardrails).mockReturnValue({ mode: "normal", reason: "normal" } as any);
  vi.mocked(buildPrompt).mockReturnValue({ system: "sys", messages: [] } as any);
  vi.mocked(runAgent).mockResolvedValue(BASE_RESULT as any);
  vi.mocked(sendWhatsAppMessage).mockResolvedValue(undefined);
  process.env.ANTHROPIC_MODEL = "claude-haiku-4-5";
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.ANTHROPIC_MODEL;
});

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("runAiPipeline — integração sendWhatsAppMessage", () => {
  it("retorna agent_status ok quando envio WA tem sucesso", async () => {
    const result = await runAiPipeline(BASE_PARAMS);
    expect(result.agent_status).toBe("ok");
    expect(result.error).toBeUndefined();
  });

  it("chama sendWhatsAppMessage com phone e reply_text corretos", async () => {
    await runAiPipeline(BASE_PARAMS);
    expect(sendWhatsAppMessage).toHaveBeenCalledOnce();
    expect(sendWhatsAppMessage).toHaveBeenCalledWith(
      BASE_CTX.lead.phone_normalized,
      BASE_RESULT.reply_text
    );
  });

  it("retorna agent_status ok mesmo quando sendWhatsAppMessage lança WhatsAppSendError", async () => {
    vi.mocked(sendWhatsAppMessage).mockRejectedValueOnce(
      new WhatsAppSendError("WhatsApp API retornou 401: token inválido", 401)
    );

    const result = await runAiPipeline(BASE_PARAMS);

    // Falha no envio é não-fatal: reply já está no banco
    expect(result.agent_status).toBe("ok");
    expect(result.error).toBeUndefined();
  });

  it("retorna agent_status ok mesmo quando sendWhatsAppMessage lança TypeError (rede)", async () => {
    vi.mocked(sendWhatsAppMessage).mockRejectedValueOnce(
      new TypeError("fetch failed")
    );

    const result = await runAiPipeline(BASE_PARAMS);

    expect(result.agent_status).toBe("ok");
    expect(result.error).toBeUndefined();
  });

  it("retorna skipped_handoff sem chamar sendWhatsAppMessage em human_handoff", async () => {
    vi.mocked(runGuardrails).mockReturnValue({
      mode: "human_handoff",
      reason: "conversa sob controle humano",
    } as any);

    const result = await runAiPipeline(BASE_PARAMS);

    expect(result.agent_status).toBe("skipped_handoff");
    expect(sendWhatsAppMessage).not.toHaveBeenCalled();
  });

  it("retorna error quando runAgent lança exceção", async () => {
    vi.mocked(runAgent).mockRejectedValueOnce(new Error("LLM unavailable"));

    const result = await runAiPipeline(BASE_PARAMS);

    expect(result.agent_status).toBe("error");
    expect(result.error).toContain("LLM unavailable");
    // sendWhatsApp não deve ser chamado (falhou antes do insert)
    expect(sendWhatsAppMessage).not.toHaveBeenCalled();
  });
});
