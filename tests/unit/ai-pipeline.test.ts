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
  PERMANENT_CATEGORIES: ["invalid_recipient", "auth_error"],
  WhatsAppSendError: class WhatsAppSendError extends Error {
    statusCode?: number; category: string; isRetryable: boolean;
    constructor(msg: string, code?: number, cat = "unknown", retryable = true) {
      super(msg); this.name = "WhatsAppSendError";
      this.statusCode = code; this.category = cat; this.isRetryable = retryable;
    }
  },
}));

vi.mock("@/lib/whatsapp-credentials", () => ({
  getStoreWhatsAppPhoneId: vi.fn(),
}));

vi.mock("@/lib/lead-scoring", () => ({
  calculateLeadScore: vi.fn(),
}));

vi.mock("@/lib/reactivation", () => ({
  markReactivationResponded: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/follow-up", () => ({
  markFollowUpCompletedIfInterrupted: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/timing", () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
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
import { getStoreWhatsAppPhoneId } from "@/lib/whatsapp-credentials";
import { calculateLeadScore } from "@/lib/lead-scoring";
import { sleep } from "@/lib/timing";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_PARAMS = {
  storeId: "store-1",
  leadId: "lead-1",
  conversationId: "conv-1",
  incomingText: "Olá, quero um carro",
  isNewConversation: false,
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
  reply_texts: ["Olá! Posso ajudar."],
  should_handoff: false,
  score: 15,
  intent_tags: ["greeting"],
  summary: "Lead novo.",
};

const DEFAULT_SCORE_RESULT = { newScore: 15, delta: 5, reasons: ["mensagem"] };

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

// Default chain factory — mirrors the one inside the `@/lib/supabase` mock
// factory above. Several tests (test 15, PR 15 block) replace
// `supabaseAdmin.from`'s implementation via `mockImplementation` to assert on
// specific tables; `vi.clearAllMocks()` in afterEach clears call history but
// does NOT restore the original implementation, so without this reset here
// that override leaks into every test that runs afterwards. Re-applying the
// default chain in beforeEach keeps each test isolated regardless of run order.
function defaultSupabaseChain() {
  const c: any = {};
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
  c.then = (resolve: any, reject?: any) =>
    Promise.resolve({ data: null, error: null, count: 0 }).then(resolve, reject);
  return c;
}

beforeEach(() => {
  vi.mocked(buildAgentContext).mockResolvedValue(BASE_CTX as any);
  vi.mocked(runGuardrails).mockReturnValue({ mode: "normal", reason: "normal" } as any);
  vi.mocked(buildPrompt).mockReturnValue({ system: "sys", messages: [] } as any);
  vi.mocked(runAgent).mockResolvedValue(BASE_RESULT as any);
  vi.mocked(sendWhatsAppMessage).mockResolvedValue(undefined);
  vi.mocked(sleep).mockResolvedValue(undefined);
  vi.mocked(getStoreWhatsAppPhoneId).mockResolvedValue("test-phone-id");
  vi.mocked(calculateLeadScore).mockReturnValue(DEFAULT_SCORE_RESULT as any);
  vi.mocked(supabaseAdmin.from).mockImplementation(defaultSupabaseChain as any);
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

  it("chama sendWhatsAppMessage com phone e reply_texts[0] corretos", async () => {
    await runAiPipeline(BASE_PARAMS);
    expect(sendWhatsAppMessage).toHaveBeenCalledOnce();
    expect(sendWhatsAppMessage).toHaveBeenCalledWith(
      BASE_CTX.lead.phone_normalized,
      BASE_RESULT.reply_texts[0],
      "test-phone-id"
    );
  });

  it("trunca cada item de reply_texts acima de 4096 chars antes de enviar e salvar no banco", async () => {
    const longText = "x".repeat(5000);
    vi.mocked(runAgent).mockResolvedValueOnce({ ...BASE_RESULT, reply_texts: [longText] } as any);

    await runAiPipeline(BASE_PARAMS);

    const expectedText = "x".repeat(4093) + "...";
    expect(sendWhatsAppMessage).toHaveBeenCalledWith(
      BASE_CTX.lead.phone_normalized,
      expectedText,
      "test-phone-id"
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

  it("getStoreWhatsAppPhoneId service_error → ok_send_failed (retryable)", async () => {
    vi.mocked(getStoreWhatsAppPhoneId).mockRejectedValueOnce(
      new WhatsAppSendError("store_credential_lookup_failed", undefined, "service_error", true)
    );

    const result = await runAiPipeline(BASE_PARAMS);

    expect(result.agent_status).toBe("ok_send_failed");
    expect(sendWhatsAppMessage).not.toHaveBeenCalled();
  });

  it("getStoreWhatsAppPhoneId auth_error → ok_send_failed_permanent (não retried)", async () => {
    vi.mocked(getStoreWhatsAppPhoneId).mockRejectedValueOnce(
      new WhatsAppSendError("store_whatsapp_not_configured", undefined, "auth_error", false)
    );

    const result = await runAiPipeline(BASE_PARAMS);

    expect(result.agent_status).toBe("ok_send_failed_permanent");
    expect(sendWhatsAppMessage).not.toHaveBeenCalled();
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
      { handoff_to: "HUMANO", handoff_topics: ["preco_negociacao"] }
    );
  });

  // -------------------------------------------------------------------------
  // Roadmap 1.11 — handoff parcial por assunto: union de handoff_topics
  // -------------------------------------------------------------------------

  it("1.11: should_handoff=true (via LLM, fora de collection) marca handoff_topics=['preco_negociacao']", async () => {
    vi.mocked(runAgent).mockResolvedValueOnce({
      ...BASE_RESULT,
      should_handoff: true,
    } as any);

    await runAiPipeline(BASE_PARAMS);

    expect(transitionConversationStatus).toHaveBeenCalledWith(
      BASE_PARAMS.conversationId,
      "AGUARDANDO_HUMANO",
      expect.objectContaining({ handoff_topics: ["preco_negociacao"] })
    );
  });

  it("1.11: já com handoff_topics=['preco_negociacao'] — união não duplica", async () => {
    vi.mocked(buildAgentContext).mockResolvedValue({
      ...BASE_CTX,
      conversation: { ...BASE_CTX.conversation, handoff_topics: ["preco_negociacao"] },
    } as any);
    vi.mocked(runAgent).mockResolvedValueOnce({
      ...BASE_RESULT,
      should_handoff: true,
    } as any);

    await runAiPipeline(BASE_PARAMS);

    expect(transitionConversationStatus).toHaveBeenCalledWith(
      BASE_PARAMS.conversationId,
      "AGUARDANDO_HUMANO",
      { handoff_to: "HUMANO", handoff_topics: ["preco_negociacao"] }
    );
  });

  it("1.11: should_handoff forçado por coleta de financiamento/troca NÃO marca handoff_topics (handoff é total, não por tópico)", async () => {
    vi.mocked(runGuardrails).mockReturnValue({
      mode: "normal", reason: "normal",
      collection: { ask: [], collect: ["financiamento"], missingTrocaFields: [] },
    } as any);
    vi.mocked(runAgent).mockResolvedValueOnce({
      ...BASE_RESULT,
      should_handoff: false,
      collected_data: { financiamento: { nome_completo: "João", cpf: "111.222.333-44", renda_aproximada: "3000", entrada_disposta: "2000" } },
    } as any);

    await runAiPipeline(BASE_PARAMS);

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
    expect(aiLogPayload.message_ids).toEqual(["msg-captured-123"]);
    expect(aiLogPayload.failed_message_ids).toBeNull();
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

    // D2: invalid_recipient é PERMANENT_CATEGORY → ok_send_failed_permanent (não retried)
    expect(result.agent_status).toBe("ok_send_failed_permanent");
    expect(aiLogsInsertMock).toHaveBeenCalledOnce();
    const aiLogPayload = aiLogsInsertMock.mock.calls[0][0];
    expect(aiLogPayload.last_send_error).toBe("invalid_recipient");
  });
});

// ---------------------------------------------------------------------------
// Multi-bolha (BL-0008 / DL-0008) — envio sequencial de reply_texts[]
// ---------------------------------------------------------------------------

function messagesTableSequentialIds(ids: (string | null)[]) {
  let call = 0;
  return vi.fn().mockImplementation(() => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: ids[call++] ?? null }, error: null }),
    }),
  }));
}

describe("runAiPipeline — multi-bolha (BL-0008)", () => {
  it("array com 1 item: 1 insert, 1 send, sem chamar sleep", async () => {
    await runAiPipeline(BASE_PARAMS);
    expect(sendWhatsAppMessage).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("envia bolhas em ordem sequencial (insert→send→sleep por item), nunca paralelo, sem sleep após a última", async () => {
    const callOrder: string[] = [];
    const messagesInsertMock = messagesTableSequentialIds(["msg-1", "msg-2", "msg-3"]);
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) =>
      table === "messages" ? ({ insert: messagesInsertMock } as any) : defaultSupabaseChain()
    );
    vi.mocked(sendWhatsAppMessage).mockImplementation(async (_to, text) => {
      callOrder.push(`send:${text}`);
    });
    vi.mocked(sleep).mockImplementation(async () => {
      callOrder.push("sleep");
    });
    vi.mocked(runAgent).mockResolvedValueOnce({
      ...BASE_RESULT,
      reply_texts: ["Oi!", "Tudo bem?", "Como posso ajudar?"],
    } as any);

    await runAiPipeline(BASE_PARAMS);

    expect(messagesInsertMock).toHaveBeenCalledTimes(3);
    expect(sendWhatsAppMessage).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2); // entre 1→2 e 2→3, nunca após a última
    expect(callOrder).toEqual([
      "send:Oi!",
      "sleep",
      "send:Tudo bem?",
      "sleep",
      "send:Como posso ajudar?",
    ]);
  });

  it("cada bolha insere uma linha própria em messages, com o texto correto e na ordem", async () => {
    const messagesInsertMock = messagesTableSequentialIds(["msg-1", "msg-2"]);
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) =>
      table === "messages" ? ({ insert: messagesInsertMock } as any) : defaultSupabaseChain()
    );
    vi.mocked(runAgent).mockResolvedValueOnce({
      ...BASE_RESULT,
      reply_texts: ["Primeira bolha", "Segunda bolha"],
    } as any);

    await runAiPipeline(BASE_PARAMS);

    expect(messagesInsertMock.mock.calls[0][0].mensagem).toBe("Primeira bolha");
    expect(messagesInsertMock.mock.calls[1][0].mensagem).toBe("Segunda bolha");
    expect(messagesInsertMock.mock.calls[0][0].autor).toBe("ia");
    expect(messagesInsertMock.mock.calls[1][0].autor).toBe("ia");
  });

  it("messageIds persistidos em ai_logs.message_ids na ordem de envio; message_id (singular) é o primeiro item", async () => {
    const aiLogsInsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const messagesInsertMock = messagesTableSequentialIds(["msg-1", "msg-2"]);
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === "messages") return { insert: messagesInsertMock } as any;
      if (table === "ai_logs") return { insert: aiLogsInsertMock } as any;
      return defaultSupabaseChain();
    });
    vi.mocked(runAgent).mockResolvedValueOnce({
      ...BASE_RESULT,
      reply_texts: ["Primeira", "Segunda"],
    } as any);

    await runAiPipeline(BASE_PARAMS);

    const payload = aiLogsInsertMock.mock.calls[0][0];
    expect(payload.message_ids).toEqual(["msg-1", "msg-2"]);
    expect(payload.message_id).toBe("msg-1");
    expect(payload.failed_message_ids).toBeNull();
  });

  it("uma bolha falha (retryable) entre duas com sucesso: status ok_send_failed, failed_message_ids só com a que falhou, envio das demais continua", async () => {
    const aiLogsInsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const messagesInsertMock = messagesTableSequentialIds(["msg-1", "msg-2", "msg-3"]);
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === "messages") return { insert: messagesInsertMock } as any;
      if (table === "ai_logs") return { insert: aiLogsInsertMock } as any;
      return defaultSupabaseChain();
    });
    vi.mocked(runAgent).mockResolvedValueOnce({
      ...BASE_RESULT,
      reply_texts: ["Primeira", "Segunda", "Terceira"],
    } as any);
    vi.mocked(sendWhatsAppMessage)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new WhatsAppSendError("service error", 503, "service_error", true))
      .mockResolvedValueOnce(undefined);

    const result = await runAiPipeline(BASE_PARAMS);

    expect(result.agent_status).toBe("ok_send_failed");
    expect(sendWhatsAppMessage).toHaveBeenCalledTimes(3);
    const payload = aiLogsInsertMock.mock.calls[0][0];
    expect(payload.message_ids).toEqual(["msg-1", "msg-2", "msg-3"]);
    expect(payload.failed_message_ids).toEqual(["msg-2"]);
    expect(payload.last_send_error).toBe("service_error");
  });

  it("uma bolha falha com categoria permanente: status ok_send_failed_permanent mesmo com outras tendo sucesso", async () => {
    const aiLogsInsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const messagesInsertMock = messagesTableSequentialIds(["msg-1", "msg-2"]);
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === "messages") return { insert: messagesInsertMock } as any;
      if (table === "ai_logs") return { insert: aiLogsInsertMock } as any;
      return defaultSupabaseChain();
    });
    vi.mocked(runAgent).mockResolvedValueOnce({
      ...BASE_RESULT,
      reply_texts: ["Primeira", "Segunda"],
    } as any);
    vi.mocked(sendWhatsAppMessage)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new WhatsAppSendError("invalid", 400, "invalid_recipient", false));

    const result = await runAiPipeline(BASE_PARAMS);

    expect(result.agent_status).toBe("ok_send_failed_permanent");
    const payload = aiLogsInsertMock.mock.calls[0][0];
    expect(payload.failed_message_ids).toEqual(["msg-2"]);
  });
});

// ---------------------------------------------------------------------------
// Task 8 — coleta de financiamento/troca: persistência, handoff forçado, redação de CPF
// ---------------------------------------------------------------------------

describe("runAiPipeline — coleta de financiamento/troca", () => {
  it("fase ask: persiste pending_topics em leads.contexto", async () => {
    vi.mocked(runGuardrails).mockReturnValue({
      mode: "normal", reason: "normal",
      collection: { ask: ["financiamento"], collect: [], missingTrocaFields: [] },
    } as any);

    await runAiPipeline(BASE_PARAMS);

    // "leads" também recebe update de score no fluxo base — não basta checar
    // que .from("leads") foi chamado, tem que achar a chamada de update que
    // carrega especificamente o pending_topics novo.
    const leadsChains = vi.mocked(supabaseAdmin.from).mock.calls
      .map((call, i) => ({ table: call[0], chain: vi.mocked(supabaseAdmin.from).mock.results[i].value }))
      .filter((c) => c.table === "leads");
    const contextoUpdateCall = leadsChains
      .flatMap((c) => c.chain.update.mock.calls)
      .find((args: any[]) => args[0]?.contexto?.pending_topics?.includes("financiamento"));
    expect(contextoUpdateCall).toBeDefined();
  });

  it("fase collect financiamento: força should_handoff=true mesmo que a LLM tenha retornado false", async () => {
    vi.mocked(runGuardrails).mockReturnValue({
      mode: "normal", reason: "normal",
      collection: { ask: [], collect: ["financiamento"], missingTrocaFields: [] },
    } as any);
    vi.mocked(runAgent).mockResolvedValueOnce({
      ...BASE_RESULT,
      should_handoff: false,
      collected_data: { financiamento: { nome_completo: "João", cpf: "111.222.333-44", renda_aproximada: "3000", entrada_disposta: "2000" } },
    } as any);

    await runAiPipeline(BASE_PARAMS);

    expect(transitionConversationStatus).toHaveBeenCalledWith(
      BASE_PARAMS.conversationId,
      "AGUARDANDO_HUMANO",
      { handoff_to: "HUMANO" }
    );
  });

  it("CPF nunca aparece no objeto passado a ai_logs.llm_output", async () => {
    vi.mocked(runGuardrails).mockReturnValue({
      mode: "normal", reason: "normal",
      collection: { ask: [], collect: ["financiamento"], missingTrocaFields: [] },
    } as any);
    vi.mocked(runAgent).mockResolvedValueOnce({
      ...BASE_RESULT,
      collected_data: { financiamento: { nome_completo: "João", cpf: "111.222.333-44", renda_aproximada: "3000", entrada_disposta: "2000" } },
    } as any);

    await runAiPipeline(BASE_PARAMS);

    const aiLogsInsertCall = vi.mocked(supabaseAdmin.from).mock.calls
      .map((call, i) => ({ table: call[0], result: vi.mocked(supabaseAdmin.from).mock.results[i].value }))
      .find((c) => c.table === "ai_logs");
    expect(aiLogsInsertCall).toBeDefined();
    const insertedPayload = aiLogsInsertCall!.result.insert.mock.calls[0][0];
    const loggedOutput = JSON.stringify(insertedPayload.llm_output);
    expect(loggedOutput).not.toContain("111.222.333-44");
  });

  it("CPF ecoado em summary/reply_texts pela LLM nunca aparece no objeto passado a ai_logs.llm_output", async () => {
    vi.mocked(runGuardrails).mockReturnValue({
      mode: "normal", reason: "normal",
      collection: { ask: [], collect: ["financiamento"], missingTrocaFields: [] },
    } as any);
    vi.mocked(runAgent).mockResolvedValueOnce({
      ...BASE_RESULT,
      reply_texts: ["Obrigado! Confirmando seu CPF 111.222.333-44 para o financiamento."],
      summary: "João, CPF 111.222.333-44, quer financiar uma moto.",
      collected_data: { financiamento: { nome_completo: "João", cpf: "111.222.333-44", renda_aproximada: "3000", entrada_disposta: "2000" } },
    } as any);

    await runAiPipeline(BASE_PARAMS);

    const aiLogsInsertCall = vi.mocked(supabaseAdmin.from).mock.calls
      .map((call, i) => ({ table: call[0], result: vi.mocked(supabaseAdmin.from).mock.results[i].value }))
      .find((c) => c.table === "ai_logs");
    expect(aiLogsInsertCall).toBeDefined();
    const insertedPayload = aiLogsInsertCall!.result.insert.mock.calls[0][0];
    const loggedOutput = JSON.stringify(insertedPayload.llm_output);
    expect(loggedOutput).not.toContain("111.222.333-44");
    // Placeholder deve substituir o CPF nos campos de texto livre
    expect((insertedPayload.llm_output as any).reply_texts[0]).toContain("[CPF removido]");
    expect((insertedPayload.llm_output as any).summary).toContain("[CPF removido]");
  });

  it("fase collect troca incompleta: não força should_handoff", async () => {
    vi.mocked(runGuardrails).mockReturnValue({
      mode: "normal", reason: "normal",
      collection: { ask: [], collect: ["troca"], missingTrocaFields: ["quantos km rodados"] },
    } as any);
    vi.mocked(buildAgentContext).mockResolvedValue({
      ...BASE_CTX,
      lead: { ...BASE_CTX.lead, contexto: { pending_topics: ["troca"], troca_draft: { modelo: "Bros 160", ano: 2019 } } },
    } as any);
    vi.mocked(runAgent).mockResolvedValueOnce({
      ...BASE_RESULT,
      should_handoff: false,
      collected_data: { troca: { modelo: null, ano: null, km: 32000, servico_recente: null, agendamento_data: null, agendamento_horario: null } },
    } as any);

    const result = await runAiPipeline(BASE_PARAMS);

    expect(result.agent_status).toBe("ok");
    expect(transitionConversationStatus).not.toHaveBeenCalled();
  });

  it("sem collection (guardrail.collection null): comportamento idêntico ao caso normal, sem updates extras de contexto", async () => {
    vi.mocked(runGuardrails).mockReturnValue({ mode: "normal", reason: "normal", collection: null } as any);

    const result = await runAiPipeline(BASE_PARAMS);

    expect(result.agent_status).toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// Item 0.7 parte 2 — Aviso de IA na primeira mensagem (transparência LGPD)
// ---------------------------------------------------------------------------

// Mock de "messages" com comportamentos configuráveis:
// - a checagem de idempotência (select().eq().eq().eq().limit().maybeSingle(),
//   filtro real é meta->>kind="ai_disclosure") resolve `existingDisclosure`
//   (null por padrão → nenhum aviso prévio)
// - o insert (aviso "sistema" com .select("id").single(), e reply "ia" também
//   com .select("id").single()) é capturado por `insertMock`
// - o update (meta.sent: false → true após envio confirmado) é capturado por
//   `updateMock`, default resolve com sucesso
function mockMessagesTable(
  existingDisclosure: { id: string } | null,
  opts?: { insertMock?: any; updateMock?: any }
) {
  const selectChain: any = {};
  selectChain.eq = vi.fn().mockReturnValue(selectChain);
  selectChain.limit = vi.fn().mockReturnValue(selectChain);
  selectChain.maybeSingle = vi.fn().mockResolvedValue({ data: existingDisclosure, error: null });

  const c: any = {};
  c.select = vi.fn().mockReturnValue(selectChain);
  c.insert = opts?.insertMock ?? defaultMessagesInsertMock();
  c.update =
    opts?.updateMock ??
    vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) });
  return c;
}

function defaultMessagesInsertMock() {
  return vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: "msg-id" }, error: null }),
    }),
  });
}

describe("runAiPipeline — aviso de IA (item 0.7 parte 2)", () => {
  it("is_new_conversation=true: insere aviso de sistema ANTES da resposta da IA e envia ambos nessa ordem", async () => {
    const messagesInsertMock = defaultMessagesInsertMock();
    const messagesUpdateEqMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const messagesUpdateMock = vi.fn().mockReturnValue({ eq: messagesUpdateEqMock });
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) =>
      table === "messages"
        ? mockMessagesTable(null, { insertMock: messagesInsertMock, updateMock: messagesUpdateMock })
        : defaultSupabaseChain()
    );

    await runAiPipeline({ ...BASE_PARAMS, isNewConversation: true });

    expect(messagesInsertMock).toHaveBeenCalledTimes(2);
    const [disclosureArgs] = messagesInsertMock.mock.calls[0];
    const [replyArgs] = messagesInsertMock.mock.calls[1];
    expect(disclosureArgs.autor).toBe("sistema");
    expect(disclosureArgs.direcao).toBe("saida");
    expect(disclosureArgs.mensagem).toContain("assistente virtual");
    expect(disclosureArgs.mensagem).toContain(BASE_CTX.store_name);
    expect(disclosureArgs.meta).toEqual({ kind: "ai_disclosure", sent: false });
    expect(replyArgs.autor).toBe("ia");
    expect(replyArgs.mensagem).toBe(BASE_RESULT.reply_texts[0]);

    expect(sendWhatsAppMessage).toHaveBeenCalledTimes(2);
    expect(sendWhatsAppMessage).toHaveBeenNthCalledWith(
      1,
      BASE_CTX.lead.phone_normalized,
      expect.stringContaining("assistente virtual"),
      "test-phone-id"
    );
    expect(sendWhatsAppMessage).toHaveBeenNthCalledWith(
      2,
      BASE_CTX.lead.phone_normalized,
      BASE_RESULT.reply_texts[0],
      "test-phone-id"
    );

    // Envio confirmado → meta atualizado pra sent=true (rastro reflete a realidade)
    expect(messagesUpdateMock).toHaveBeenCalledTimes(1);
    expect(messagesUpdateMock).toHaveBeenCalledWith({ meta: { kind: "ai_disclosure", sent: true } });
    expect(messagesUpdateEqMock).toHaveBeenCalledWith("id", "msg-id");
  });

  it("falha no envio do aviso: meta permanece sent=false, sem update pra true (rastro não mente)", async () => {
    const messagesInsertMock = defaultMessagesInsertMock();
    const messagesUpdateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) });
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) =>
      table === "messages"
        ? mockMessagesTable(null, { insertMock: messagesInsertMock, updateMock: messagesUpdateMock })
        : defaultSupabaseChain()
    );
    // sendWhatsAppMessage rejeita só na 1ª chamada (envio do aviso) — reply segue normal depois
    vi.mocked(sendWhatsAppMessage).mockRejectedValueOnce(new Error("timeout"));

    const result = await runAiPipeline({ ...BASE_PARAMS, isNewConversation: true });

    expect(result.agent_status).toBe("ok"); // falha no aviso é não-fatal pro pipeline
    const [disclosureArgs] = messagesInsertMock.mock.calls[0];
    expect(disclosureArgs.meta).toEqual({ kind: "ai_disclosure", sent: false });
    expect(messagesUpdateMock).not.toHaveBeenCalled(); // envio falhou → nunca vira sent=true
  });

  it("is_new_conversation=false: nenhum aviso é inserido nem enviado", async () => {
    const messagesInsertMock = defaultMessagesInsertMock();
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) =>
      table === "messages" ? mockMessagesTable(null, { insertMock: messagesInsertMock }) : defaultSupabaseChain()
    );

    await runAiPipeline({ ...BASE_PARAMS, isNewConversation: false });

    expect(messagesInsertMock).toHaveBeenCalledTimes(1);
    expect(messagesInsertMock.mock.calls[0][0].autor).toBe("ia");
    expect(sendWhatsAppMessage).toHaveBeenCalledTimes(1);
    expect(sendWhatsAppMessage).toHaveBeenCalledWith(
      BASE_CTX.lead.phone_normalized,
      BASE_RESULT.reply_texts[0],
      "test-phone-id"
    );
  });

  it("reabertura de conversa (lead com histórico, conversa nova): gatilho é is_new_conversation, não is_new_lead", async () => {
    // Lead com contexto/score de long-timer — não é "novo", mas a conversa é.
    vi.mocked(buildAgentContext).mockResolvedValue({
      ...BASE_CTX,
      lead: { ...BASE_CTX.lead, score: 65, contexto: { veiculo_interesse: "Titan 160" } },
      conversation: { ...BASE_CTX.conversation, summary: "Cliente antigo, sumiu por 40 dias." },
    } as any);

    const messagesInsertMock = defaultMessagesInsertMock();
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) =>
      table === "messages" ? mockMessagesTable(null, { insertMock: messagesInsertMock }) : defaultSupabaseChain()
    );

    await runAiPipeline({ ...BASE_PARAMS, isNewConversation: true });

    expect(messagesInsertMock).toHaveBeenCalledTimes(2);
    expect(messagesInsertMock.mock.calls[0][0].autor).toBe("sistema");
  });

  it("idempotência: se já existir aviso salvo nesta conversa, não duplica nem reenvia", async () => {
    const messagesInsertMock = defaultMessagesInsertMock();
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) =>
      table === "messages"
        ? mockMessagesTable({ id: "existing-disclosure" }, { insertMock: messagesInsertMock })
        : defaultSupabaseChain()
    );

    await runAiPipeline({ ...BASE_PARAMS, isNewConversation: true });

    // Só o insert do reply da IA — aviso já existia, não foi reinserido
    expect(messagesInsertMock).toHaveBeenCalledTimes(1);
    expect(messagesInsertMock.mock.calls[0][0].autor).toBe("ia");
    expect(sendWhatsAppMessage).toHaveBeenCalledTimes(1);
    expect(sendWhatsAppMessage).toHaveBeenCalledWith(
      BASE_CTX.lead.phone_normalized,
      BASE_RESULT.reply_texts[0],
      "test-phone-id"
    );
  });

  it("human_handoff com is_new_conversation=true: early return antes do bloco de aviso — nada é enviado", async () => {
    vi.mocked(runGuardrails).mockReturnValue({
      mode: "human_handoff",
      reason: "conversa sob controle humano",
    } as any);

    const result = await runAiPipeline({ ...BASE_PARAMS, isNewConversation: true });

    expect(result.agent_status).toBe("skipped_handoff");
    expect(sendWhatsAppMessage).not.toHaveBeenCalled();
  });

  it("aviso não interfere na coleta de financiamento/troca nem no reply_text da IA", async () => {
    vi.mocked(runGuardrails).mockReturnValue({
      mode: "normal",
      reason: "normal",
      collection: { ask: ["financiamento"], collect: [], missingTrocaFields: [] },
    } as any);

    const messagesInsertMock = defaultMessagesInsertMock();
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === "messages") return mockMessagesTable(null, { insertMock: messagesInsertMock });
      return defaultSupabaseChain();
    });

    await runAiPipeline({ ...BASE_PARAMS, isNewConversation: true });

    // Aviso + reply, nessa ordem, reply_text intacto (sem prefixo do aviso)
    expect(messagesInsertMock).toHaveBeenCalledTimes(2);
    expect(messagesInsertMock.mock.calls[0][0].autor).toBe("sistema");
    expect(messagesInsertMock.mock.calls[1][0].autor).toBe("ia");
    expect(messagesInsertMock.mock.calls[1][0].mensagem).toBe(BASE_RESULT.reply_texts[0]);

    // Coleta de financiamento continua persistindo pending_topics normalmente
    const leadsChains = vi.mocked(supabaseAdmin.from).mock.calls
      .map((call, i) => ({ table: call[0], chain: vi.mocked(supabaseAdmin.from).mock.results[i].value }))
      .filter((c) => c.table === "leads");
    const contextoUpdateCall = leadsChains
      .flatMap((c) => c.chain.update.mock.calls)
      .find((args: any[]) => args[0]?.contexto?.pending_topics?.includes("financiamento"));
    expect(contextoUpdateCall).toBeDefined();
  });
});
