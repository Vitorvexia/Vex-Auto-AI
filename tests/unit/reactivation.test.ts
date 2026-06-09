/**
 * Testes unitários para lib/reactivation.ts
 *
 * Coberturas:
 * - buildReactivationText: templates 1-3, com/sem veículo, fallback de nome
 * - markReactivationResponded: idempotência, falha silenciosa
 * - markReactivationConverted: só se respondeu, multi-tenant, falha silenciosa
 * - runReactivationJob: lote vazio, envio bem-sucedido, falha WA, 23505 skip
 *   Invariante: messages.insert ocorre ANTES de sendWhatsAppMessage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted()
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
  buildReactivationText,
  markReactivationResponded,
  markReactivationConverted,
  runReactivationJob,
} from "@/lib/reactivation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

const ELIGIBLE_LEAD = {
  lead_id: "lead-1",
  store_id: "store-1",
  conversation_id: "conv-1",
  nome: "Carlos",
  phone_normalized: "+5511999990001",
  attempt_count: 0,
  veiculo_interesse: null,
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
// buildReactivationText — sem veículo (fallback)
// ---------------------------------------------------------------------------

describe("buildReactivationText — sem veículo", () => {
  it("attempt 1: nome null usa 'você'", () => {
    const text = buildReactivationText(1, null);
    expect(text).toContain("você");
    expect(text).not.toMatch(/\{\{/);
  });

  it("attempt 1: nome preenchido aparece no texto", () => {
    const text = buildReactivationText(1, "Carlos");
    expect(text).toContain("Carlos");
  });

  it("attempt 1: nome com espaços extras usa trim", () => {
    const text = buildReactivationText(1, "  Ana  ");
    expect(text).toContain("Ana");
    expect(text).not.toContain("  Ana");
  });

  it("attempt 1 e 2 têm textos distintos", () => {
    const t1 = buildReactivationText(1, "X");
    const t2 = buildReactivationText(2, "X");
    expect(t1).not.toBe(t2);
  });

  it("attempt 2: menciona última vez ou encerrar", () => {
    const text = buildReactivationText(2, "João");
    expect(text.toLowerCase()).toMatch(/última|ultima|encerrar/);
  });

  it("attempt 3: existe e difere de 1 e 2", () => {
    const t1 = buildReactivationText(1, "X");
    const t2 = buildReactivationText(2, "X");
    const t3 = buildReactivationText(3, "X");
    expect(t3).not.toBe(t1);
    expect(t3).not.toBe(t2);
  });

  it("attempt 3: menciona última vez", () => {
    const text = buildReactivationText(3, "Maria");
    expect(text.toLowerCase()).toMatch(/última|ultima/);
  });

  it("attempt inválido usa fallback do template 1", () => {
    const t_invalid = buildReactivationText(99, "X");
    const t1 = buildReactivationText(1, "X");
    expect(t_invalid).toBe(t1);
  });
});

// ---------------------------------------------------------------------------
// buildReactivationText — com veículo
// ---------------------------------------------------------------------------

describe("buildReactivationText — com veículo", () => {
  it("attempt 1: veículo aparece no texto", () => {
    const text = buildReactivationText(1, "Carlos", { veiculo_interesse: "Honda Civic 2020" });
    expect(text).toContain("Honda Civic 2020");
    expect(text).toContain("Carlos");
  });

  it("attempt 2: veículo aparece no texto", () => {
    const text = buildReactivationText(2, "Ana", { veiculo_interesse: "Toyota Corolla" });
    expect(text).toContain("Toyota Corolla");
  });

  it("attempt 3: veículo aparece no texto", () => {
    const text = buildReactivationText(3, "João", { veiculo_interesse: "VW Gol" });
    expect(text).toContain("VW Gol");
  });

  it("veiculo_interesse null cai no template sem veículo", () => {
    const with_null = buildReactivationText(1, "X", { veiculo_interesse: null });
    const without_ctx = buildReactivationText(1, "X");
    expect(with_null).toBe(without_ctx);
  });

  it("veiculo_interesse string vazia cai no template sem veículo", () => {
    const text = buildReactivationText(1, "X", { veiculo_interesse: "   " });
    const no_veh = buildReactivationText(1, "X");
    expect(text).toBe(no_veh);
  });

  it("template com veículo e template sem veículo são distintos", () => {
    const with_veh = buildReactivationText(1, "X", { veiculo_interesse: "Fiat Uno" });
    const no_veh = buildReactivationText(1, "X");
    expect(with_veh).not.toBe(no_veh);
  });
});

// ---------------------------------------------------------------------------
// markReactivationResponded
// ---------------------------------------------------------------------------

describe("markReactivationResponded", () => {
  it("chama update em reactivation_logs com responded_at", async () => {
    const rlogChain = chain({ gte: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(rlogChain);

    await markReactivationResponded("lead-1");

    expect(mockFrom).toHaveBeenCalledWith("reactivation_logs");
    expect(rlogChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ responded_at: expect.any(String) })
    );
  });

  it("filtra por lead_id e status='sent'", async () => {
    const rlogChain = chain({ gte: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(rlogChain);

    await markReactivationResponded("lead-abc");

    expect(rlogChain.eq).toHaveBeenCalledWith("lead_id", "lead-abc");
    expect(rlogChain.eq).toHaveBeenCalledWith("status", "sent");
  });

  it("filtra responded_at IS NULL — idempotência", async () => {
    const rlogChain = chain({ gte: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(rlogChain);

    await markReactivationResponded("lead-1");

    expect(rlogChain.is).toHaveBeenCalledWith("responded_at", null);
  });

  it("falha silenciosa — não propaga erro", async () => {
    const rlogChain = chain({ gte: { data: null, error: { message: "db error" } } });
    mockFrom.mockReturnValueOnce(rlogChain);

    await expect(markReactivationResponded("lead-1")).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// markReactivationConverted
// ---------------------------------------------------------------------------

describe("markReactivationConverted", () => {
  it("chama update em reactivation_logs com converted_at", async () => {
    const rlogChain = chain({ is: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(rlogChain);

    await markReactivationConverted("lead-1", "store-1");

    expect(mockFrom).toHaveBeenCalledWith("reactivation_logs");
    expect(rlogChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ converted_at: expect.any(String) })
    );
  });

  it("filtra por lead_id e store_id — multi-tenant", async () => {
    const rlogChain = chain({ is: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(rlogChain);

    await markReactivationConverted("lead-xyz", "store-xyz");

    expect(rlogChain.eq).toHaveBeenCalledWith("lead_id", "lead-xyz");
    expect(rlogChain.eq).toHaveBeenCalledWith("store_id", "store-xyz");
  });

  it("exige responded_at NOT NULL — só converte se respondeu", async () => {
    const rlogChain = chain({ is: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(rlogChain);

    await markReactivationConverted("lead-1", "store-1");

    expect(rlogChain.not).toHaveBeenCalledWith("responded_at", "is", null);
  });

  it("filtra converted_at IS NULL — idempotência", async () => {
    const rlogChain = chain({ is: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(rlogChain);

    await markReactivationConverted("lead-1", "store-1");

    expect(rlogChain.is).toHaveBeenCalledWith("converted_at", null);
  });

  it("falha silenciosa — não propaga erro", async () => {
    const rlogChain = chain({ is: { data: null, error: { message: "db error" } } });
    mockFrom.mockReturnValueOnce(rlogChain);

    await expect(markReactivationConverted("lead-1", "store-1")).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// runReactivationJob — sem leads elegíveis
// ---------------------------------------------------------------------------

describe("runReactivationJob — sem leads elegíveis", () => {
  it("retorna zeros quando RPC retorna vazio", async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    const result = await runReactivationJob();
    expect(result).toEqual({ processed: 0, sent: 0, skipped: 0, failed: 0 });
  });

  it("retorna zeros quando RPC retorna erro", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "RPC error" } });
    const result = await runReactivationJob();
    expect(result).toEqual({ processed: 0, sent: 0, skipped: 0, failed: 0 });
  });

  it("passa storeId e limit ao RPC", async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    await runReactivationJob({ storeId: "store-abc", limit: 5 });
    expect(mockRpc).toHaveBeenCalledWith("get_reactivation_eligible_leads", {
      p_store_id: "store-abc",
      p_limit: 5,
    });
  });

  it("usa limit default 20 quando omitido", async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    await runReactivationJob();
    expect(mockRpc).toHaveBeenCalledWith("get_reactivation_eligible_leads", {
      p_store_id: null,
      p_limit: 20,
    });
  });
});

// ---------------------------------------------------------------------------
// runReactivationJob — envio bem-sucedido
// ---------------------------------------------------------------------------

describe("runReactivationJob — envio bem-sucedido", () => {
  it("lead elegível recebe reativação: processed=1, sent=1", async () => {
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_LEAD], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));   // reactivation_logs claim
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));   // messages
    mockSend.mockResolvedValueOnce(undefined);

    const result = await runReactivationJob();

    expect(result).toMatchObject({ processed: 1, sent: 1, skipped: 0, failed: 0 });
  });

  it("insere em reactivation_logs ANTES de messages e WA — invariante", async () => {
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_LEAD], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));   // reactivation_logs
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));   // messages
    mockSend.mockResolvedValueOnce(undefined);

    await runReactivationJob();

    // Primeira chamada a from() = reactivation_logs
    expect(mockFrom.mock.calls[0][0]).toBe("reactivation_logs");
    // Segunda chamada a from() = messages (ANTES de WA)
    expect(mockFrom.mock.calls[1][0]).toBe("messages");
    // WA send chamado após ambos os inserts
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("attempt_number correto: lead com 0 tentativas usa attempt 1", async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ ...ELIGIBLE_LEAD, attempt_count: 0 }], error: null });
    const logChain = chain({ insert: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(logChain);
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockSend.mockResolvedValueOnce(undefined);

    await runReactivationJob();

    expect(logChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ attempt_number: 1, status: "sent" })
    );
  });

  it("attempt_number correto: lead com 1 tentativa usa attempt 2", async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ ...ELIGIBLE_LEAD, attempt_count: 1 }], error: null });
    const logChain = chain({ insert: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(logChain);
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockSend.mockResolvedValueOnce(undefined);

    await runReactivationJob();

    expect(logChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ attempt_number: 2 })
    );
  });

  it("attempt_number correto: lead com 2 tentativas usa attempt 3", async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ ...ELIGIBLE_LEAD, attempt_count: 2 }], error: null });
    const logChain = chain({ insert: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(logChain);
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockSend.mockResolvedValueOnce(undefined);

    await runReactivationJob();

    expect(logChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ attempt_number: 3 })
    );
  });

  it("lead sem nome usa 'você' no template enviado", async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ ...ELIGIBLE_LEAD, nome: null }], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockSend.mockResolvedValueOnce(undefined);

    await runReactivationJob();

    const sentText = mockSend.mock.calls[0][1] as string;
    expect(sentText).toContain("você");
  });

  it("lead com veiculo_interesse usa template com veículo", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ ...ELIGIBLE_LEAD, veiculo_interesse: "Honda Civic 2020" }],
      error: null,
    });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockSend.mockResolvedValueOnce(undefined);

    await runReactivationJob();

    const sentText = mockSend.mock.calls[0][1] as string;
    expect(sentText).toContain("Honda Civic 2020");
  });

  it("insere mensagem em messages com autor='sistema'", async () => {
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_LEAD], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    const msgChain = chain({ insert: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(msgChain);
    mockSend.mockResolvedValueOnce(undefined);

    await runReactivationJob();

    // Segunda chamada a from() é messages
    expect(mockFrom.mock.calls[1][0]).toBe("messages");
    expect(msgChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ direcao: "saida", autor: "sistema" })
    );
  });

  it("telefone nunca aparece completo nos logs", async () => {
    const logSpy = vi.spyOn(console, "log");
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_LEAD], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockSend.mockResolvedValueOnce(undefined);

    await runReactivationJob();

    for (const call of logSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain("+5511999990001");
    }
  });
});

// ---------------------------------------------------------------------------
// runReactivationJob — falha no envio WA
// ---------------------------------------------------------------------------

describe("runReactivationJob — falha no envio WA", () => {
  it("registra failed e continua o lote sem quebrar", async () => {
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_LEAD], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));   // claim
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));   // messages (antes do WA)
    mockSend.mockRejectedValueOnce(new Error("WA timeout"));
    mockFrom.mockReturnValueOnce(chain({ match: { data: null, error: null } }));    // update failed

    const result = await runReactivationJob();

    expect(result).toMatchObject({ processed: 1, sent: 0, failed: 1 });
  });

  it("atualiza reactivation_logs para status='failed' quando WA falha", async () => {
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_LEAD], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));   // claim
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));   // messages
    mockSend.mockRejectedValueOnce(new Error("timeout"));
    const updateChain = chain({ match: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(updateChain);

    await runReactivationJob();

    expect(mockFrom.mock.calls[2][0]).toBe("reactivation_logs");
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" })
    );
  });

  it("dois leads: primeiro falha WA, segundo é enviado — ambos processados", async () => {
    const lead2 = { ...ELIGIBLE_LEAD, lead_id: "lead-2", conversation_id: "conv-2" };
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_LEAD, lead2], error: null });

    // Lead 1
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));   // claim
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));   // messages
    mockSend.mockRejectedValueOnce(new Error("fail"));
    mockFrom.mockReturnValueOnce(chain({ match: { data: null, error: null } }));    // update failed

    // Lead 2
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));   // claim
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));   // messages
    mockSend.mockResolvedValueOnce(undefined);

    const result = await runReactivationJob();

    expect(result).toMatchObject({ processed: 2, sent: 1, failed: 1 });
  });
});

// ---------------------------------------------------------------------------
// runReactivationJob — falha na busca de credencial
// ---------------------------------------------------------------------------

describe("runReactivationJob — falha no getStoreWhatsAppPhoneId", () => {
  it("service_error na credencial → failed=1, WA não chamado", async () => {
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_LEAD], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));   // claim
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));   // messages
    mockGetPhoneId.mockRejectedValueOnce(
      new (class extends Error {
        name = "WhatsAppSendError"; category = "service_error"; isRetryable = true;
        constructor() { super("store_credential_lookup_failed"); }
      })()
    );
    mockFrom.mockReturnValueOnce(chain({ match: { data: null, error: null } }));    // update failed

    const result = await runReactivationJob();

    expect(result).toMatchObject({ processed: 1, sent: 0, failed: 1 });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("auth_error na credencial → failed=1, WA não chamado", async () => {
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_LEAD], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));   // claim
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));   // messages
    mockGetPhoneId.mockRejectedValueOnce(
      new (class extends Error {
        name = "WhatsAppSendError"; category = "auth_error"; isRetryable = false;
        constructor() { super("store_whatsapp_not_configured"); }
      })()
    );
    mockFrom.mockReturnValueOnce(chain({ match: { data: null, error: null } }));    // update failed

    const result = await runReactivationJob();

    expect(result).toMatchObject({ processed: 1, sent: 0, failed: 1 });
    expect(mockSend).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// runReactivationJob — idempotência (23505)
// ---------------------------------------------------------------------------

describe("runReactivationJob — 23505 atomic claim", () => {
  it("23505 no insert do log → skipped, WA não é chamado", async () => {
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_LEAD], error: null });
    mockFrom.mockReturnValueOnce(
      chain({ insert: { data: null, error: { code: "23505" } } })
    );

    const result = await runReactivationJob();

    expect(result).toMatchObject({ processed: 1, skipped: 1, sent: 0, failed: 0 });
    expect(mockSend).not.toHaveBeenCalled();
  });
});
