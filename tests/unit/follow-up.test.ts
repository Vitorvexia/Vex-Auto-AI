/**
 * Testes unitários para lib/follow-up.ts
 *
 * Coberturas:
 * - buildFollowUpText: templates e fallback de nome
 * - runFollowUpJob: lote vazio, envio bem-sucedido, falha WA, 23505 skip, erro RPC
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted() — variáveis usadas nas factories dos vi.mock()
// ---------------------------------------------------------------------------

const { mockFrom, mockRpc, mockSend, mockGetPhoneId } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockSend: vi.fn(),
  mockGetPhoneId: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom, rpc: mockRpc },
}));

vi.mock("@/lib/whatsapp-send", () => ({
  sendWhatsAppMessage: mockSend,
  WhatsAppSendError: class WhatsAppSendError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "WhatsAppSendError";
    }
  },
}));

vi.mock("@/lib/whatsapp-credentials", () => ({
  getStoreWhatsAppPhoneId: mockGetPhoneId,
}));

// ---------------------------------------------------------------------------
// Import após mocks
// ---------------------------------------------------------------------------

import {
  buildFollowUpText,
  followUpTemplateName,
  followUpTemplateParams,
  runFollowUpJob,
} from "@/lib/follow-up";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cadeia fluente do Supabase — o último método chamado precisa ter o override */
function chain(overrides: Record<string, unknown> = {}) {
  const c: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    match: vi.fn(),
    gt: vi.fn(),
    gte: vi.fn(),
    lt: vi.fn(),
    not: vi.fn(),
    is: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  };
  for (const k of Object.keys(c)) c[k].mockReturnValue(c);
  for (const [k, v] of Object.entries(overrides)) c[k].mockResolvedValue(v);
  return c;
}

const ELIGIBLE_CONV = {
  conversation_id: "conv-1",
  store_id: "store-1",
  lead_id: "lead-1",
  nome: "Carlos",
  phone_normalized: "+5511999990001",
  attempt_count: 0,
};

// ---------------------------------------------------------------------------
// Env setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  process.env.WHATSAPP_ACCESS_TOKEN = "tok";
  mockGetPhoneId.mockResolvedValue("123456");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  delete process.env.WHATSAPP_ACCESS_TOKEN;
});

// ---------------------------------------------------------------------------
// buildFollowUpText
// ---------------------------------------------------------------------------

describe("buildFollowUpText — templates", () => {
  it("attempt 1: nome null usa 'você'", () => {
    const text = buildFollowUpText(1, null);
    expect(text).toContain("você");
    expect(text).not.toMatch(/\{\{/);
  });

  it("attempt 1: nome preenchido aparece no texto", () => {
    const text = buildFollowUpText(1, "Carlos");
    expect(text).toContain("Carlos");
  });

  it("attempt 1: nome com espaços extras usa trim", () => {
    const text = buildFollowUpText(1, "  Ana  ");
    expect(text).toContain("Ana");
    expect(text).not.toContain("  Ana");
  });

  it("attempt 1, 2, 3 têm textos distintos", () => {
    const t1 = buildFollowUpText(1, "X");
    const t2 = buildFollowUpText(2, "X");
    const t3 = buildFollowUpText(3, "X");
    expect(t1).not.toBe(t2);
    expect(t2).not.toBe(t3);
    expect(t1).not.toBe(t3);
  });

  it("attempt 3: menciona encerrar", () => {
    const text = buildFollowUpText(3, "João");
    expect(text.toLowerCase()).toMatch(/encerrar|encerr/);
  });
});

// ---------------------------------------------------------------------------
// followUpTemplateName / followUpTemplateParams — envio por template Meta
// (funções puras — não dependem de WHATSAPP_TEMPLATE_SEND_ENABLED; o flag só
// decide QUAL função de envio é chamada em runFollowUpJob, testado em
// tests/unit/follow-up-template-send.test.ts)
// ---------------------------------------------------------------------------

describe("followUpTemplateName", () => {
  it("attempt 1 → follow_up_1", () => {
    expect(followUpTemplateName(1)).toBe("follow_up_1");
  });

  it("attempt 2 → follow_up_2", () => {
    expect(followUpTemplateName(2)).toBe("follow_up_2");
  });

  it("attempt 3 → follow_up_3", () => {
    expect(followUpTemplateName(3)).toBe("follow_up_3");
  });

  it("attempt inválido (fora de 1-3) cai no fallback follow_up_1 — mesmo clamp de buildFollowUpText", () => {
    expect(followUpTemplateName(99)).toBe("follow_up_1");
    expect(followUpTemplateName(0)).toBe("follow_up_1");
  });
});

describe("followUpTemplateParams", () => {
  it("nome preenchido vira único parâmetro ({{1}})", () => {
    expect(followUpTemplateParams("Carlos")).toEqual(["Carlos"]);
  });

  it("nome null vira 'você' — mesmo fallback de buildFollowUpText", () => {
    expect(followUpTemplateParams(null)).toEqual(["você"]);
  });

  it("nome com espaços extras usa trim — mesmo fallback de buildFollowUpText", () => {
    expect(followUpTemplateParams("  Ana  ")).toEqual(["Ana"]);
  });
});

describe("followUpTemplateName/Params — consistência com buildFollowUpText (texto do inbox precisa bater com o que o template renderiza)", () => {
  it("param[0] é exatamente o nome usado no texto renderizado, em todas as 3 tentativas", () => {
    for (const attempt of [1, 2, 3]) {
      const text = buildFollowUpText(attempt, "Fernanda");
      const [param] = followUpTemplateParams("Fernanda");
      expect(text).toContain(param);
    }
  });

  it("nome null: texto e param usam 'você' de forma idêntica", () => {
    const text = buildFollowUpText(1, null);
    const [param] = followUpTemplateParams(null);
    expect(param).toBe("você");
    expect(text).toContain(param);
  });
});

// ---------------------------------------------------------------------------
// runFollowUpJob — sem conversas elegíveis
// ---------------------------------------------------------------------------

describe("runFollowUpJob — sem conversas elegíveis", () => {
  it("retorna { processed:0, sent:0, skipped:0, failed:0 } quando RPC retorna vazio", async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    const result = await runFollowUpJob();

    expect(result).toEqual({ processed: 0, sent: 0, skipped: 0, failed: 0 });
  });

  it("retorna zeros quando RPC retorna erro", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "RPC error" } });

    const result = await runFollowUpJob();

    expect(result).toEqual({ processed: 0, sent: 0, skipped: 0, failed: 0 });
  });

  it("passa storeId e limit ao RPC", async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    await runFollowUpJob({ storeId: "store-abc", limit: 5 });

    expect(mockRpc).toHaveBeenCalledWith(
      "get_followup_eligible_conversations",
      { p_store_id: "store-abc", p_limit: 5 }
    );
  });

  it("usa limit default 20 quando omitido", async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    await runFollowUpJob();

    expect(mockRpc).toHaveBeenCalledWith(
      "get_followup_eligible_conversations",
      { p_store_id: null, p_limit: 20 }
    );
  });
});

// ---------------------------------------------------------------------------
// runFollowUpJob — envio bem-sucedido
// ---------------------------------------------------------------------------

describe("runFollowUpJob — envio bem-sucedido", () => {
  it("conversa elegível recebe follow-up: processed=1, sent=1", async () => {
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_CONV], error: null });
    // follow_up_logs insert → sucesso
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockSend.mockResolvedValueOnce(undefined);
    // messages insert → sucesso
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));

    const result = await runFollowUpJob();

    expect(result).toMatchObject({ processed: 1, sent: 1, skipped: 0, failed: 0 });
  });

  it("insere em follow_up_logs com status='sent' antes de chamar WA", async () => {
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_CONV], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockSend.mockResolvedValueOnce(undefined);
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));

    await runFollowUpJob();

    const logInsertCall = mockFrom.mock.calls[0];
    expect(logInsertCall[0]).toBe("follow_up_logs");
  });

  it("attempt_number correto: conversa com 0 tentativas usa attempt 1", async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ ...ELIGIBLE_CONV, attempt_count: 0 }], error: null });
    const logChain = chain({ insert: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(logChain);
    mockSend.mockResolvedValueOnce(undefined);
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));

    await runFollowUpJob();

    expect(logChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ attempt_number: 1, status: "sent" })
    );
  });

  it("attempt_number correto: conversa com 1 tentativa usa attempt 2", async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ ...ELIGIBLE_CONV, attempt_count: 1 }], error: null });
    const logChain = chain({ insert: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(logChain);
    mockSend.mockResolvedValueOnce(undefined);
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));

    await runFollowUpJob();

    expect(logChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ attempt_number: 2 })
    );
  });

  it("lead sem nome usa 'você' no template enviado", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ ...ELIGIBLE_CONV, nome: null }],
      error: null,
    });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockSend.mockResolvedValueOnce(undefined);
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));

    await runFollowUpJob();

    const sentText = mockSend.mock.calls[0][1] as string;
    expect(sentText).toContain("você");
  });

  it("insere mensagem em messages com autor='sistema'", async () => {
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_CONV], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockSend.mockResolvedValueOnce(undefined);
    const msgChain = chain({ insert: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(msgChain);

    await runFollowUpJob();

    expect(mockFrom.mock.calls[1][0]).toBe("messages");
    expect(msgChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ direcao: "saida", autor: "sistema" })
    );
  });

  it("telefone nunca aparece completo nos logs", async () => {
    const logSpy = vi.spyOn(console, "log");
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_CONV], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockSend.mockResolvedValueOnce(undefined);
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));

    await runFollowUpJob();

    for (const call of logSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain("+5511999990001");
    }
  });
});

// ---------------------------------------------------------------------------
// runFollowUpJob — falha no envio WA
// ---------------------------------------------------------------------------

describe("runFollowUpJob — falha no envio WA", () => {
  it("registra failed e continua o lote sem quebrar", async () => {
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_CONV], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockSend.mockRejectedValueOnce(new Error("WA timeout"));
    // update follow_up_logs para 'failed'
    mockFrom.mockReturnValueOnce(chain({ match: { data: null, error: null } }));

    const result = await runFollowUpJob();

    expect(result).toMatchObject({ processed: 1, sent: 0, failed: 1 });
  });

  it("atualiza follow_up_logs para status='failed' quando WA falha", async () => {
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_CONV], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockSend.mockRejectedValueOnce(new Error("timeout"));
    const updateChain = chain({ match: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(updateChain);

    await runFollowUpJob();

    expect(mockFrom.mock.calls[1][0]).toBe("follow_up_logs");
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" })
    );
  });

  it("grava error_message identificável em follow_up_logs quando WA falha — falha não fica silenciosa", async () => {
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_CONV], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockSend.mockRejectedValueOnce(new Error("WhatsApp API retornou 400"));
    const updateChain = chain({ match: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(updateChain);

    await runFollowUpJob();

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", error_message: "WhatsApp API retornou 400" })
    );
  });

  it("erro não-Error (ex: string lançada) vira error_message via String(err) — nunca undefined", async () => {
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_CONV], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    // eslint-disable-next-line prefer-promise-reject-errors
    mockSend.mockRejectedValueOnce("falha crua sem Error");
    const updateChain = chain({ match: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(updateChain);

    await runFollowUpJob();

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ error_message: "falha crua sem Error" })
    );
  });

  it("dois leads: primeiro falha WA, segundo é enviado — ambos processados", async () => {
    const conv2 = { ...ELIGIBLE_CONV, conversation_id: "conv-2", lead_id: "lead-2" };
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_CONV, conv2], error: null });

    // conv1: log insert ok, WA fail, log update
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockSend.mockRejectedValueOnce(new Error("fail"));
    mockFrom.mockReturnValueOnce(chain({ match: { data: null, error: null } }));

    // conv2: log insert ok, WA ok, messages insert
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockSend.mockResolvedValueOnce(undefined);
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));

    const result = await runFollowUpJob();

    expect(result).toMatchObject({ processed: 2, sent: 1, failed: 1 });
  });
});

// ---------------------------------------------------------------------------
// runFollowUpJob — falha na busca de credencial
// ---------------------------------------------------------------------------

describe("runFollowUpJob — falha no getStoreWhatsAppPhoneId", () => {
  it("service_error na credencial → failed=1, WA não chamado", async () => {
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_CONV], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockGetPhoneId.mockRejectedValueOnce(
      new (class extends Error {
        name = "WhatsAppSendError"; category = "service_error"; isRetryable = true;
        constructor() { super("store_credential_lookup_failed"); }
      })()
    );
    mockFrom.mockReturnValueOnce(chain({ match: { data: null, error: null } }));

    const result = await runFollowUpJob();

    expect(result).toMatchObject({ processed: 1, sent: 0, failed: 1 });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("auth_error na credencial → failed=1, WA não chamado", async () => {
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_CONV], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockGetPhoneId.mockRejectedValueOnce(
      new (class extends Error {
        name = "WhatsAppSendError"; category = "auth_error"; isRetryable = false;
        constructor() { super("store_whatsapp_not_configured"); }
      })()
    );
    mockFrom.mockReturnValueOnce(chain({ match: { data: null, error: null } }));

    const result = await runFollowUpJob();

    expect(result).toMatchObject({ processed: 1, sent: 0, failed: 1 });
    expect(mockSend).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// runFollowUpJob — idempotência (23505)
// ---------------------------------------------------------------------------

describe("runFollowUpJob — 23505 atomic claim", () => {
  it("23505 no insert do log → skipped, WA não é chamado", async () => {
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_CONV], error: null });
    mockFrom.mockReturnValueOnce(
      chain({ insert: { data: null, error: { code: "23505" } } })
    );

    const result = await runFollowUpJob();

    expect(result).toMatchObject({ processed: 1, skipped: 1, sent: 0, failed: 0 });
    expect(mockSend).not.toHaveBeenCalled();
  });
});
