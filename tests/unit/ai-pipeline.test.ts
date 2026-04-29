/**
 * Testes unitários para runAiPipeline (lib/ai-pipeline.ts)
 *
 * Foca no comportamento não-fatal do envio WhatsApp:
 * falha no sendWhatsAppMessage não deve alterar o agent_status
 * nem propagar exceção — reply já está salvo no banco.
 *
 * Test 15: regressão — result.score do LLM não persiste em leads.score.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks de módulos (deve vir antes do import do módulo testado)
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase", () => {
  const mkChain = () => {
    const c: any = {};
    // insert returns a chainable object so that .insert().select("id").single() works.
    // Also directly awaitable for old-style `await insert({...})` callers.
    const insertResult: any = {
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      then: (resolve: any, reject?: any) =>
        Promise.resolve({ data: null, error: null }).then(resolve, reject),
    };
    c.insert = vi.fn().mockReturnValue(insertResult);
    c.update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    c.select = vi.fn().mockReturnValue(c);
    c.eq = vi.fn().mockReturnValue(c);
    c.order = vi.fn().mockReturnValue(c);
    c.limit = vi.fn().mockReturnValue(c);
    c.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    // Make chain awaitable for count queries that terminate with .eq()
    c.then = (resolve: any, reject?: any) =>
      Promise.resolve({ data: null, error: null, count: 0 }).then(resolve, reject);
    return c;
  };
  return {
    supabaseAdmin: { from: vi.fn().mockImplementation(mkChain) },
  };
});

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
    statusCode?: number; category: string; isRetryable: boolean;
    constructor(msg: string, code?: number, cat = "unknown", retryable = true) {
      super(msg); this.name = "WhatsAppSendError";
      this.statusCode = code; this.category = cat; this.isRetryable = retryable;
    }
  },
}));

vi.mock("@/lib/lead-scoring", () => ({
  calculateLeadScore: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports após mocks
// ---------------------------------------------------------------------------

import { runAiPipeline } from "@/lib/ai-pipeline";
import { buildAgentContext } from "@/lib/agent-context";
import { runGuardrails } from "@/lib/guardrails";
import { buildPrompt } from "@/lib/prompts";
import { runAgent, AgentTimeoutError, AgentParseError, AgentOutputError } from "@/lib/ai";
import { transitionConversationStatus } from "@/lib/status";
import { supabaseAdmin } from "@/lib/supabase";
import { sendWhatsAppMessage, WhatsAppSendError } from "@/lib/whatsapp-send";
import { calculateLeadScore } from "@/lib/lead-scoring";

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

const DEFAULT_SCORE_RESULT = { newScore: 15, delta: 5, reasons: ["mensagem"] };

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.mocked(buildAgentContext).mockResolvedValue(BASE_CTX as any);
  vi.mocked(runGuardrails).mockReturnValue({ mode: "normal", reason: "normal" } as any);
  vi.mocked(buildPrompt).mockReturnValue({ system: "sys", messages: [] } as any);
  vi.mocked(runAgent).mockResolvedValue(BASE_RESULT as any);
  vi.mocked(sendWhatsAppMessage).mockResolvedValue(undefined);
  vi.mocked(calculateLeadScore).mockReturnValue(DEFAULT_SCORE_RESULT as any);
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

  it("trunca reply_text acima de 4096 chars antes de enviar e salvar no banco", async () => {
    const longText = "x".repeat(5000);
    vi.mocked(runAgent).mockResolvedValueOnce({ ...BASE_RESULT, reply_text: longText } as any);

    await runAiPipeline(BASE_PARAMS);

    const expectedText = "x".repeat(4093) + "...";
    expect(sendWhatsAppMessage).toHaveBeenCalledWith(
      BASE_CTX.lead.phone_normalized,
      expectedText
    );
  });

  it("retorna ok_send_failed quando sendWhatsAppMessage lança WhatsAppSendError", async () => {
    vi.mocked(sendWhatsAppMessage).mockRejectedValueOnce(
      new WhatsAppSendError("WhatsApp API retornou 401: token inválido", 401)
    );

    const result = await runAiPipeline(BASE_PARAMS);

    // IA funcionou, reply no banco — mas entrega falhou: status distinto de "ok"
    expect(result.agent_status).toBe("ok_send_failed");
    expect(result.error).toBeUndefined();
  });

  it("retorna ok_send_failed quando sendWhatsAppMessage lança TypeError (rede)", async () => {
    vi.mocked(sendWhatsAppMessage).mockRejectedValueOnce(
      new TypeError("fetch failed")
    );

    const result = await runAiPipeline(BASE_PARAMS);

    expect(result.agent_status).toBe("ok_send_failed");
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

  it("retorna timeout quando runAgent lança AgentTimeoutError", async () => {
    vi.mocked(runAgent).mockRejectedValueOnce(new AgentTimeoutError());

    const result = await runAiPipeline(BASE_PARAMS);

    expect(result.agent_status).toBe("timeout");
    expect(result.error).toContain("timeout");
    expect(sendWhatsAppMessage).not.toHaveBeenCalled();
  });

  it("retorna parse_error quando runAgent lança AgentParseError", async () => {
    vi.mocked(runAgent).mockRejectedValueOnce(new AgentParseError("{invalid json}"));

    const result = await runAiPipeline(BASE_PARAMS);

    expect(result.agent_status).toBe("parse_error");
    expect(sendWhatsAppMessage).not.toHaveBeenCalled();
  });

  it("retorna output_error quando runAgent lança AgentOutputError", async () => {
    vi.mocked(runAgent).mockRejectedValueOnce(new AgentOutputError("missing reply_text"));

    const result = await runAiPipeline(BASE_PARAMS);

    expect(result.agent_status).toBe("output_error");
    expect(sendWhatsAppMessage).not.toHaveBeenCalled();
  });

  it("chama transitionConversationStatus quando should_handoff=true", async () => {
    vi.mocked(runAgent).mockResolvedValueOnce({
      ...BASE_RESULT,
      should_handoff: true,
    } as any);

    const result = await runAiPipeline(BASE_PARAMS);

    expect(result.agent_status).toBe("ok");
    expect(transitionConversationStatus).toHaveBeenCalledOnce();
    expect(transitionConversationStatus).toHaveBeenCalledWith(
      BASE_PARAMS.conversationId,
      "AGUARDANDO_HUMANO",
      { handoff_to: "HUMANO" }
    );
  });

  it("nao propaga erro de transitionConversationStatus (falha nao-fatal)", async () => {
    vi.mocked(runAgent).mockResolvedValueOnce({
      ...BASE_RESULT,
      should_handoff: true,
    } as any);
    vi.mocked(transitionConversationStatus).mockRejectedValueOnce(
      new Error("DB offline")
    );

    // Pipeline deve continuar e retornar ok mesmo com falha na transição
    const result = await runAiPipeline(BASE_PARAMS);

    expect(result.agent_status).toBe("ok");
    expect(result.error).toBeUndefined();
  });

  it("scorer determinístico atualiza leads quando delta != 0", async () => {
    vi.mocked(calculateLeadScore).mockReturnValueOnce({
      newScore: 20,
      delta: 10,
      reasons: ["mensagem", "preco"],
    } as any);

    const fromSpy = vi.mocked(supabaseAdmin.from);

    await runAiPipeline(BASE_PARAMS);

    // leads.update foi chamado (via from("leads"))
    const leadsCalls = fromSpy.mock.calls.filter(([t]) => t === "leads");
    expect(leadsCalls.length).toBeGreaterThan(0);
  });

  it("nao chama leads.update quando delta == 0", async () => {
    vi.mocked(calculateLeadScore).mockReturnValueOnce({
      newScore: 10,
      delta: 0,
      reasons: [],
    } as any);

    const fromSpy = vi.mocked(supabaseAdmin.from);

    await runAiPipeline(BASE_PARAMS);

    // leads table should not be accessed (no update needed)
    const leadsCalls = fromSpy.mock.calls.filter(([t]) => t === "leads");
    expect(leadsCalls.length).toBe(0);
  });

  it("usa model=null quando ANTHROPIC_MODEL nao esta definido", async () => {
    delete process.env.ANTHROPIC_MODEL;

    // Deve completar sem erros — model null é passado ao logAi
    const result = await runAiPipeline(BASE_PARAMS);

    expect(result.agent_status).toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// Test 15 — Regressão: result.score do LLM não persiste em leads.score
// ---------------------------------------------------------------------------

describe("runAiPipeline — regressão: scorer determinístico (test 15)", () => {
  it("result.score do LLM (99) nunca é escrito em leads.score", async () => {
    // LLM retorna score=99 (valor arbitrário do LLM)
    vi.mocked(runAgent).mockResolvedValueOnce({
      ...BASE_RESULT,
      score: 99,
    } as any);

    // Scorer determinístico retorna newScore=15 (delta=5)
    vi.mocked(calculateLeadScore).mockReturnValueOnce({
      newScore: 15,
      delta: 5,
      reasons: ["mensagem"],
    } as any);

    // Capturar chamadas ao update de leads com mock específico
    const leadsUpdateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const auditInsertMock = vi.fn().mockResolvedValue({ data: null, error: null });

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === "leads") {
        return { update: leadsUpdateMock } as any;
      }
      // lead_score_events: supports both the COUNT query (select/eq/then)
      // in Promise.all AND the audit insert after scoring.
      if (table === "lead_score_events") {
        const c: any = {};
        c.insert = auditInsertMock;
        c.select = vi.fn().mockReturnValue(c);
        c.eq = vi.fn().mockReturnValue(c);
        c.then = (resolve: any, reject?: any) =>
          Promise.resolve({ data: null, error: null, count: 0 }).then(resolve, reject);
        return c;
      }
      // Default chain for messages, ai_logs, follow_up_logs, reactivation_logs, etc.
      const c: any = {};
      const insertResult: any = {
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
        then: (resolve: any, reject?: any) =>
          Promise.resolve({ data: null, error: null }).then(resolve, reject),
      };
      c.insert = vi.fn().mockReturnValue(insertResult);
      c.select = vi.fn().mockReturnValue(c);
      c.eq = vi.fn().mockReturnValue(c);
      c.order = vi.fn().mockReturnValue(c);
      c.limit = vi.fn().mockReturnValue(c);
      c.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      c.then = (resolve: any, reject?: any) =>
        Promise.resolve({ data: null, error: null, count: 0 }).then(resolve, reject);
      return c;
    });

    await runAiPipeline(BASE_PARAMS);

    // Assert 1: leads.update NUNCA chamado com { score: 99 } (valor do LLM)
    const updateArgs = leadsUpdateMock.mock.calls.map((c) => c[0]);
    expect(updateArgs.some((a) => a?.score === 99)).toBe(false);

    // Assert 2: leads.update chamado com { score: 15 } (valor do scorer)
    expect(updateArgs.some((a) => a?.score === 15)).toBe(true);

    // Assert 3: lead_score_events.insert chamado (trilha auditável existe)
    expect(auditInsertMock).toHaveBeenCalledOnce();
    const auditPayload = auditInsertMock.mock.calls[0][0];
    expect(auditPayload).toMatchObject({
      lead_id: BASE_PARAMS.leadId,
      new_score: 15,
      delta: 5,
    });
  });
});

// ---------------------------------------------------------------------------
// message_id capture e sendCategory — PR 15
// ---------------------------------------------------------------------------

describe("runAiPipeline — PR 15: message_id e sendCategory", () => {
  it("message_id capturado do insert de messages é persistido em ai_logs", async () => {
    const aiLogsInsertMock = vi.fn().mockResolvedValue({ data: null, error: null });

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === "messages") {
        // Suporta insert().select("id").single() → retorna id da mensagem salva
        const singleMock = vi.fn().mockResolvedValue({ data: { id: "msg-captured-123" }, error: null });
        const selectAfterInsert = vi.fn().mockReturnValue({ single: singleMock });
        const insertMock = vi.fn().mockReturnValue({ select: selectAfterInsert });
        return { insert: insertMock } as any;
      }
      if (table === "ai_logs") {
        return { insert: aiLogsInsertMock } as any;
      }
      // Default chain for all other tables
      const c: any = {};
      c.insert = vi.fn().mockResolvedValue({ data: null, error: null });
      c.select = vi.fn().mockReturnValue(c);
      c.eq = vi.fn().mockReturnValue(c);
      c.order = vi.fn().mockReturnValue(c);
      c.limit = vi.fn().mockReturnValue(c);
      c.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      c.then = (resolve: any, reject?: any) =>
        Promise.resolve({ data: null, error: null, count: 0 }).then(resolve, reject);
      return c;
    });

    await runAiPipeline(BASE_PARAMS);

    // ai_logs.insert deve ter sido chamado com message_id = id retornado pelo messages.insert
    expect(aiLogsInsertMock).toHaveBeenCalledOnce();
    const aiLogPayload = aiLogsInsertMock.mock.calls[0][0];
    expect(aiLogPayload.message_id).toBe("msg-captured-123");
  });

  it("sendCategory da WhatsAppSendError é persistido em ai_logs como last_send_error", async () => {
    const aiLogsInsertMock = vi.fn().mockResolvedValue({ data: null, error: null });

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === "messages") {
        const singleMock = vi.fn().mockResolvedValue({ data: { id: "msg-abc" }, error: null });
        const selectAfterInsert = vi.fn().mockReturnValue({ single: singleMock });
        const insertMock = vi.fn().mockReturnValue({ select: selectAfterInsert });
        return { insert: insertMock } as any;
      }
      if (table === "ai_logs") {
        return { insert: aiLogsInsertMock } as any;
      }
      const c: any = {};
      c.insert = vi.fn().mockResolvedValue({ data: null, error: null });
      c.select = vi.fn().mockReturnValue(c);
      c.eq = vi.fn().mockReturnValue(c);
      c.order = vi.fn().mockReturnValue(c);
      c.limit = vi.fn().mockReturnValue(c);
      c.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      c.then = (resolve: any, reject?: any) =>
        Promise.resolve({ data: null, error: null, count: 0 }).then(resolve, reject);
      return c;
    });

    vi.mocked(sendWhatsAppMessage).mockRejectedValueOnce(
      new WhatsAppSendError("WhatsApp API retornou 400", 400, "invalid_recipient", false)
    );

    const result = await runAiPipeline(BASE_PARAMS);

    expect(result.agent_status).toBe("ok_send_failed");
    expect(aiLogsInsertMock).toHaveBeenCalledOnce();
    const aiLogPayload = aiLogsInsertMock.mock.calls[0][0];
    expect(aiLogPayload.last_send_error).toBe("invalid_recipient");
  });
});
