/**
 * Testes unitários para app/api/internal/retry-failed/route.ts
 *
 * Coberturas prioritárias:
 * - Autorização (chave correta/inválida/ausente)
 * - Claim atômico previne double-send em chamadas concorrentes
 * - Reenvio bem-sucedido atualiza status para "ok"
 * - Falha no envio reverte para "ok_send_failed"
 * - Skipped = candidatos não claimados por outra instância
 * - Audit log emitido corretamente
 * - 500 quando query ao ai_logs falha
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// vi.hoisted() — variáveis usadas nas factories dos vi.mock()
// ---------------------------------------------------------------------------

const { mockFrom, mockSend } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockSend: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
}));

vi.mock("@/lib/whatsapp-send", () => ({
  sendWhatsAppMessage: mockSend,
  WhatsAppSendError: class WhatsAppSendError extends Error {
    statusCode?: number;
    constructor(msg: string, code?: number) {
      super(msg);
      this.name = "WhatsAppSendError";
      this.statusCode = code;
    }
  },
}));

// ---------------------------------------------------------------------------
// Import após mocks
// ---------------------------------------------------------------------------

import { POST } from "@/app/api/internal/retry-failed/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(key: string, body?: object): NextRequest {
  return new NextRequest("http://localhost/api/internal/retry-failed", {
    method: "POST",
    headers: {
      "x-internal-key": key,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : "{}",
  });
}

/** Cadeia fluente do supabase — cada método retorna a si mesmo por padrão */
function chain(overrides: Record<string, unknown> = {}): Record<string, ReturnType<typeof vi.fn>> {
  const c: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    gte: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
  };
  for (const k of Object.keys(c)) c[k].mockReturnValue(c);
  for (const [k, v] of Object.entries(overrides)) {
    c[k].mockResolvedValue(v);
  }
  return c;
}

// ---------------------------------------------------------------------------
// Env setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  process.env.INTERNAL_API_KEY = "valid-secret-key";
  process.env.WHATSAPP_ACCESS_TOKEN = "tok";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.INTERNAL_API_KEY;
});

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("POST /api/internal/retry-failed — autenticação", () => {
  it("retorna 401 com chave inválida", async () => {
    const res = await POST(makeReq("wrong-key"));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("unauthorized");
  });

  it("retorna 401 sem chave (header ausente)", async () => {
    const req = new NextRequest("http://localhost/api/internal/retry-failed", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("emite warn de auditoria em acesso não autorizado", async () => {
    const warnSpy = vi.spyOn(console, "warn");
    await POST(makeReq("bad-key"));
    const call = warnSpy.mock.calls.find((a) => {
      try { return JSON.parse(a[0] as string).event === "retry_failed_unauthorized"; }
      catch { return false; }
    });
    expect(call).toBeDefined();
  });
});

describe("POST /api/internal/retry-failed — sem candidatos", () => {
  it("retorna { retried:0, failed:0, skipped:0 }", async () => {
    mockFrom.mockReturnValue(chain({ limit: { data: [], error: null } }));

    const res = await POST(makeReq("valid-secret-key"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ retried: 0, failed: 0, skipped: 0 });
  });

  it("emite audit log mesmo sem candidatos", async () => {
    mockFrom.mockReturnValue(chain({ limit: { data: [], error: null } }));
    const logSpy = vi.spyOn(console, "log");

    await POST(makeReq("valid-secret-key"));

    const audit = logSpy.mock.calls.find((a) => {
      try { return JSON.parse(a[0] as string).event === "retry_failed_run"; }
      catch { return false; }
    });
    expect(audit).toBeDefined();
    const parsed = JSON.parse(audit![0] as string);
    expect(typeof parsed.latency_ms).toBe("number");
  });
});

describe("POST /api/internal/retry-failed — claim atômico", () => {
  it("skipped conta registros não claimados (race condition prevenida)", async () => {
    const candidates = [
      { id: "log-1", conversation_id: "conv-1", lead_id: "lead-1", store_id: "store-1" },
      { id: "log-2", conversation_id: "conv-2", lead_id: "lead-2", store_id: "store-1" },
    ];
    // Apenas log-1 foi claimado — log-2 já estava sendo processado por outra instância
    const claimed = [candidates[0]];

    const fetchChain = chain({ limit: { data: candidates, error: null } });
    const claimChain = chain({ select: { data: claimed, error: null } });
    const msgChain = chain({ maybeSingle: { data: { mensagem: "Olá!" } } });
    const leadChain = chain({ maybeSingle: { data: { phone_normalized: "+5511999990000" } } });
    const updateChain = chain({ eq: { data: null, error: null } });

    mockFrom
      .mockReturnValueOnce(fetchChain)  // SELECT ok_send_failed
      .mockReturnValueOnce(claimChain)  // UPDATE to retrying (claim)
      .mockReturnValueOnce(msgChain)    // SELECT messages
      .mockReturnValueOnce(leadChain)   // SELECT leads
      .mockReturnValue(updateChain);    // UPDATE to ok

    mockSend.mockResolvedValue(undefined);

    const res = await POST(makeReq("valid-secret-key"));
    const body = await res.json();

    expect(body.skipped).toBe(1);
    expect(body.retried).toBe(1);
    expect(body.failed).toBe(0);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/internal/retry-failed — envio e reversão", () => {
  it("sucesso no envio → status atualizado para 'ok'", async () => {
    const candidates = [{ id: "log-1", conversation_id: "conv-1", lead_id: "lead-1", store_id: "store-1" }];
    const claimed = [...candidates];

    const updateStatuses: string[] = [];
    const updateChain: Record<string, ReturnType<typeof vi.fn>> = chain();
    updateChain.update = vi.fn().mockImplementation((patch: { status: string }) => {
      updateStatuses.push(patch.status);
      return updateChain;
    });
    updateChain.eq.mockResolvedValue({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(chain({ limit: { data: candidates, error: null } }))
      .mockReturnValueOnce(chain({ select: { data: claimed, error: null } }))
      .mockReturnValueOnce(chain({ maybeSingle: { data: { mensagem: "msg" } } }))
      .mockReturnValueOnce(chain({ maybeSingle: { data: { phone_normalized: "+5511999990000" } } }))
      .mockReturnValue(updateChain);

    mockSend.mockResolvedValue(undefined);

    const res = await POST(makeReq("valid-secret-key"));
    const body = await res.json();

    expect(body.retried).toBe(1);
    expect(body.failed).toBe(0);
    expect(updateStatuses).toContain("ok");
  });

  it("falha no envio → status revertido para 'ok_send_failed'", async () => {
    const candidates = [{ id: "log-1", conversation_id: "conv-1", lead_id: "lead-1", store_id: "store-1" }];
    const claimed = [...candidates];

    const updateStatuses: string[] = [];
    const updateChain: Record<string, ReturnType<typeof vi.fn>> = chain();
    updateChain.update = vi.fn().mockImplementation((patch: { status: string }) => {
      updateStatuses.push(patch.status);
      return updateChain;
    });
    updateChain.eq.mockResolvedValue({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(chain({ limit: { data: candidates, error: null } }))
      .mockReturnValueOnce(chain({ select: { data: claimed, error: null } }))
      .mockReturnValueOnce(chain({ maybeSingle: { data: { mensagem: "msg" } } }))
      .mockReturnValueOnce(chain({ maybeSingle: { data: { phone_normalized: "+5511999990000" } } }))
      .mockReturnValue(updateChain);

    mockSend.mockRejectedValue(new Error("network error"));

    const res = await POST(makeReq("valid-secret-key"));
    const body = await res.json();

    expect(body.failed).toBe(1);
    expect(body.retried).toBe(0);
    expect(updateStatuses).toContain("ok_send_failed");
    expect(updateStatuses).not.toContain("ok");
  });
});

describe("POST /api/internal/retry-failed — erros de infraestrutura", () => {
  it("500 quando query ao ai_logs falha", async () => {
    mockFrom.mockReturnValue(
      chain({ limit: { data: null, error: { message: "DB offline" } } })
    );

    const res = await POST(makeReq("valid-secret-key"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("query_failed");
  });
});
