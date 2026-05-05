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

const { mockFrom, mockSend, mockGetPhoneId } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockSend: vi.fn(),
  mockGetPhoneId: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
}));

vi.mock("@/lib/whatsapp-send", () => ({
  sendWhatsAppMessage: mockSend,
  PERMANENT_CATEGORIES: ["invalid_recipient", "auth_error"],
  WhatsAppSendError: class WhatsAppSendError extends Error {
    statusCode?: number;
    category: string;
    isRetryable: boolean;
    constructor(msg: string, code?: number, cat = "unknown", retryable = true) {
      super(msg);
      this.name = "WhatsAppSendError";
      this.statusCode = code;
      this.category = cat;
      this.isRetryable = retryable;
    }
  },
}));

vi.mock("@/lib/whatsapp-credentials", () => ({
  getStoreWhatsAppPhoneId: mockGetPhoneId,
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
    neq: vi.fn(),
    in: vi.fn(),
    gte: vi.fn(),
    lt: vi.fn(),
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
  mockGetPhoneId.mockResolvedValue("123456");
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
      { id: "log-1", conversation_id: "conv-1", lead_id: "lead-1", store_id: "store-1", message_id: null, retry_count: 0, last_send_error: null },
      { id: "log-2", conversation_id: "conv-2", lead_id: "lead-2", store_id: "store-1", message_id: null, retry_count: 0, last_send_error: null },
    ];
    // Apenas log-1 foi claimado — log-2 já estava sendo processado por outra instância
    const claimed = [candidates[0]];

    const staleChain = chain();
    const fetchChain = chain({ limit: { data: candidates, error: null } });
    const claimChain = chain({ select: { data: claimed, error: null } });
    const msgChain = chain({ maybeSingle: { data: { mensagem: "Olá!" } } });
    const leadChain = chain({ maybeSingle: { data: { phone_normalized: "+5511999990000" } } });
    const updateChain = chain({ eq: { data: null, error: null } });

    mockFrom
      .mockReturnValueOnce(staleChain)  // staleness recovery
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
    const candidates = [{ id: "log-1", conversation_id: "conv-1", lead_id: "lead-1", store_id: "store-1", message_id: null, retry_count: 0, last_send_error: null }];
    const claimed = [...candidates];

    const updateStatuses: string[] = [];
    const updateChain: Record<string, ReturnType<typeof vi.fn>> = chain();
    updateChain.update = vi.fn().mockImplementation((patch: { status: string }) => {
      updateStatuses.push(patch.status);
      return updateChain;
    });
    updateChain.eq.mockResolvedValue({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(chain())                                                               // staleness recovery
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
    const candidates = [{ id: "log-1", conversation_id: "conv-1", lead_id: "lead-1", store_id: "store-1", message_id: null, retry_count: 0, last_send_error: null }];
    const claimed = [...candidates];

    const updateStatuses: string[] = [];
    const updateChain: Record<string, ReturnType<typeof vi.fn>> = chain();
    updateChain.update = vi.fn().mockImplementation((patch: { status: string }) => {
      updateStatuses.push(patch.status);
      return updateChain;
    });
    updateChain.eq.mockResolvedValue({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(chain())                                                               // staleness recovery
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
    // call 0: staleness recovery (no-op), call 1: fetch candidates (fails)
    const staleChain = chain();
    mockFrom
      .mockReturnValueOnce(staleChain)
      .mockReturnValue(chain({ limit: { data: null, error: { message: "DB offline" } } }));

    const res = await POST(makeReq("valid-secret-key"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("query_failed");
  });
});

// ---------------------------------------------------------------------------
// Staleness recovery
// ---------------------------------------------------------------------------

describe("POST /api/internal/retry-failed — staleness recovery", () => {
  it("reseta ok_send_failed_retrying > 15min para ok_send_failed antes de buscar candidatos", async () => {
    const staleChain = chain();
    const updateStale = vi.fn().mockReturnValue(staleChain);
    staleChain.update = updateStale;

    mockFrom
      .mockReturnValueOnce(staleChain)        // staleness recovery
      .mockReturnValue(chain({ limit: { data: [], error: null } }));

    await POST(makeReq("valid-secret-key"));

    // staleness recovery must UPDATE with status ok_send_failed
    expect(updateStale).toHaveBeenCalledWith({ status: "ok_send_failed" });
  });
});

// ---------------------------------------------------------------------------
// message_id — direct fetch vs fallback
// ---------------------------------------------------------------------------

describe("POST /api/internal/retry-failed — message_id fetch", () => {
  it("com message_id: busca mensagem diretamente por PK (não 'mais recente')", async () => {
    const candidates = [{
      id: "log-1", conversation_id: "conv-1", lead_id: "lead-1", store_id: "store-1",
      message_id: "msg-uuid-direct", retry_count: 0, last_send_error: null,
    }];
    const claimed = [...candidates];

    // Track which ids were queried via .eq("id", ...)
    const messageQueryIds: string[] = [];
    const msgChain = chain({ maybeSingle: { data: { mensagem: "Mensagem direta" } } });
    const origEq = msgChain.eq;
    msgChain.eq = vi.fn().mockImplementation((...args: unknown[]) => {
      if (args[0] === "id") messageQueryIds.push(args[1] as string);
      return msgChain;
    });

    const staleChain = chain();
    mockFrom
      .mockReturnValueOnce(staleChain)
      .mockReturnValueOnce(chain({ limit: { data: candidates, error: null } }))
      .mockReturnValueOnce(chain({ select: { data: claimed, error: null } }))
      .mockReturnValueOnce(msgChain)                                           // messages lookup
      .mockReturnValueOnce(chain({ maybeSingle: { data: { phone_normalized: "+5511999990000" } } }))
      .mockReturnValue(chain({ eq: { data: null, error: null } }));

    mockSend.mockResolvedValue(undefined);

    await POST(makeReq("valid-secret-key"));

    // Must query by message_id directly, NOT by conversation_id
    expect(messageQueryIds).toContain("msg-uuid-direct");
  });

  it("sem message_id: fallback para query por conversation_id (legacy logs)", async () => {
    const candidates = [{
      id: "log-1", conversation_id: "conv-1", lead_id: "lead-1", store_id: "store-1",
      message_id: null, retry_count: 0, last_send_error: null,
    }];
    const claimed = [...candidates];

    // Track which fields were queried
    const queryFields: string[] = [];
    const msgChain = chain({ maybeSingle: { data: { mensagem: "Fallback msg" } } });
    msgChain.eq = vi.fn().mockImplementation((...args: unknown[]) => {
      queryFields.push(args[0] as string);
      return msgChain;
    });

    const staleChain = chain();
    mockFrom
      .mockReturnValueOnce(staleChain)
      .mockReturnValueOnce(chain({ limit: { data: candidates, error: null } }))
      .mockReturnValueOnce(chain({ select: { data: claimed, error: null } }))
      .mockReturnValueOnce(msgChain)
      .mockReturnValueOnce(chain({ maybeSingle: { data: { phone_normalized: "+5511999990000" } } }))
      .mockReturnValue(chain({ eq: { data: null, error: null } }));

    mockSend.mockResolvedValue(undefined);

    await POST(makeReq("valid-secret-key"));

    // Fallback: must query by conversation_id (not by message id)
    expect(queryFields).toContain("conversation_id");
    expect(queryFields).not.toContain("id");
  });
});

// ---------------------------------------------------------------------------
// retry_count — incremento
// ---------------------------------------------------------------------------

describe("POST /api/internal/retry-failed — retry_count", () => {
  it("incrementa retry_count em 1 no sucesso", async () => {
    const candidates = [{
      id: "log-1", conversation_id: "conv-1", lead_id: "lead-1", store_id: "store-1",
      message_id: "msg-1", retry_count: 1, last_send_error: null,
    }];
    const claimed = [...candidates];

    const updatePatches: Record<string, unknown>[] = [];
    const updateChain = chain();
    updateChain.update = vi.fn().mockImplementation((patch: Record<string, unknown>) => {
      updatePatches.push(patch);
      return updateChain;
    });
    updateChain.eq.mockResolvedValue({ data: null, error: null });

    const staleChain = chain();
    mockFrom
      .mockReturnValueOnce(staleChain)
      .mockReturnValueOnce(chain({ limit: { data: candidates, error: null } }))
      .mockReturnValueOnce(chain({ select: { data: claimed, error: null } }))
      .mockReturnValueOnce(chain({ maybeSingle: { data: { mensagem: "msg" } } }))
      .mockReturnValueOnce(chain({ maybeSingle: { data: { phone_normalized: "+5511999990000" } } }))
      .mockReturnValue(updateChain);

    mockSend.mockResolvedValue(undefined);

    await POST(makeReq("valid-secret-key"));

    const successPatch = updatePatches.find((p) => p.status === "ok");
    expect(successPatch).toBeDefined();
    expect(successPatch!.retry_count).toBe(2); // 1 + 1
  });

  it("incrementa retry_count em 1 na falha transitória", async () => {
    const candidates = [{
      id: "log-1", conversation_id: "conv-1", lead_id: "lead-1", store_id: "store-1",
      message_id: "msg-1", retry_count: 0, last_send_error: null,
    }];
    const claimed = [...candidates];

    const updatePatches: Record<string, unknown>[] = [];
    const updateChain = chain();
    updateChain.update = vi.fn().mockImplementation((patch: Record<string, unknown>) => {
      updatePatches.push(patch);
      return updateChain;
    });
    updateChain.eq.mockResolvedValue({ data: null, error: null });

    const staleChain = chain();
    mockFrom
      .mockReturnValueOnce(staleChain)
      .mockReturnValueOnce(chain({ limit: { data: candidates, error: null } }))
      .mockReturnValueOnce(chain({ select: { data: claimed, error: null } }))
      .mockReturnValueOnce(chain({ maybeSingle: { data: { mensagem: "msg" } } }))
      .mockReturnValueOnce(chain({ maybeSingle: { data: { phone_normalized: "+5511999990000" } } }))
      .mockReturnValue(updateChain);

    // Lança erro transitório (isRetryable=true)
    const { WhatsAppSendError: WASErr } = await import("@/lib/whatsapp-send");
    mockSend.mockRejectedValue(new WASErr("service error", 503, "service_error", true));

    await POST(makeReq("valid-secret-key"));

    const failPatch = updatePatches.find((p) => p.status === "ok_send_failed");
    expect(failPatch).toBeDefined();
    expect(failPatch!.retry_count).toBe(1); // 0 + 1
    expect(failPatch!.last_send_error).toBe("service_error");
  });
});

// ---------------------------------------------------------------------------
// Escalada para ok_send_failed_permanent
// ---------------------------------------------------------------------------

describe("POST /api/internal/retry-failed — escalada permanente", () => {
  it("erro isRetryable=false → ok_send_failed_permanent independente de retry_count", async () => {
    const candidates = [{
      id: "log-1", conversation_id: "conv-1", lead_id: "lead-1", store_id: "store-1",
      message_id: "msg-1", retry_count: 0, last_send_error: null,
    }];
    const claimed = [...candidates];

    const updatePatches: Record<string, unknown>[] = [];
    const updateChain = chain();
    updateChain.update = vi.fn().mockImplementation((patch: Record<string, unknown>) => {
      updatePatches.push(patch);
      return updateChain;
    });
    updateChain.eq.mockResolvedValue({ data: null, error: null });

    const staleChain = chain();
    mockFrom
      .mockReturnValueOnce(staleChain)
      .mockReturnValueOnce(chain({ limit: { data: candidates, error: null } }))
      .mockReturnValueOnce(chain({ select: { data: claimed, error: null } }))
      .mockReturnValueOnce(chain({ maybeSingle: { data: { mensagem: "msg" } } }))
      .mockReturnValueOnce(chain({ maybeSingle: { data: { phone_normalized: "+5511999990000" } } }))
      .mockReturnValue(updateChain);

    const { WhatsAppSendError: WASErr } = await import("@/lib/whatsapp-send");
    mockSend.mockRejectedValue(new WASErr("invalid phone", 400, "invalid_recipient", false));

    await POST(makeReq("valid-secret-key"));

    const patch = updatePatches.find((p) => p.status === "ok_send_failed_permanent");
    expect(patch).toBeDefined();
    expect(patch!.retry_count).toBe(1);
  });

  it("retry_count >= MAX_RETRY_ATTEMPTS → ok_send_failed_permanent mesmo em erro transitório", async () => {
    const candidates = [{
      id: "log-1", conversation_id: "conv-1", lead_id: "lead-1", store_id: "store-1",
      message_id: "msg-1", retry_count: 2, last_send_error: "service_error", // já em 2 (MAX=3, então 3 >= 3)
    }];
    const claimed = [...candidates];

    const updatePatches: Record<string, unknown>[] = [];
    const updateChain = chain();
    updateChain.update = vi.fn().mockImplementation((patch: Record<string, unknown>) => {
      updatePatches.push(patch);
      return updateChain;
    });
    updateChain.eq.mockResolvedValue({ data: null, error: null });

    const staleChain = chain();
    mockFrom
      .mockReturnValueOnce(staleChain)
      .mockReturnValueOnce(chain({ limit: { data: candidates, error: null } }))
      .mockReturnValueOnce(chain({ select: { data: claimed, error: null } }))
      .mockReturnValueOnce(chain({ maybeSingle: { data: { mensagem: "msg" } } }))
      .mockReturnValueOnce(chain({ maybeSingle: { data: { phone_normalized: "+5511999990000" } } }))
      .mockReturnValue(updateChain);

    const { WhatsAppSendError: WASErr } = await import("@/lib/whatsapp-send");
    mockSend.mockRejectedValue(new WASErr("timeout", 503, "service_error", true));

    await POST(makeReq("valid-secret-key"));

    const patch = updatePatches.find((p) => p.status === "ok_send_failed_permanent");
    expect(patch).toBeDefined();
    expect(patch!.retry_count).toBe(3); // 2 + 1
  });
});

// ---------------------------------------------------------------------------
// Pre-send guard (known permanent category)
// ---------------------------------------------------------------------------

describe("POST /api/internal/retry-failed — pre-send guard", () => {
  it("last_send_error=invalid_recipient → marca permanent sem chamar sendWhatsAppMessage", async () => {
    const candidates = [{
      id: "log-1", conversation_id: "conv-1", lead_id: "lead-1", store_id: "store-1",
      message_id: "msg-1", retry_count: 1, last_send_error: "invalid_recipient",
    }];
    const claimed = [...candidates];

    const updatePatches: Record<string, unknown>[] = [];
    const updateChain = chain();
    updateChain.update = vi.fn().mockImplementation((patch: Record<string, unknown>) => {
      updatePatches.push(patch);
      return updateChain;
    });
    updateChain.eq.mockResolvedValue({ data: null, error: null });

    const staleChain = chain();
    mockFrom
      .mockReturnValueOnce(staleChain)
      .mockReturnValueOnce(chain({ limit: { data: candidates, error: null } }))
      .mockReturnValueOnce(chain({ select: { data: claimed, error: null } }))
      .mockReturnValue(updateChain);

    await POST(makeReq("valid-secret-key"));

    // sendWhatsAppMessage must NOT be called for known permanent errors
    expect(mockSend).not.toHaveBeenCalled();
    const patch = updatePatches.find((p) => p.status === "ok_send_failed_permanent");
    expect(patch).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Log sanitization
// ---------------------------------------------------------------------------

describe("POST /api/internal/retry-failed — sanitização de log de erro", () => {
  it("log de falha contém category e status_code mas não sendErr.message", async () => {
    const candidates = [{
      id: "log-1", conversation_id: "conv-1", lead_id: "lead-1", store_id: "store-1",
      message_id: "msg-1", retry_count: 0, last_send_error: null,
    }];
    const claimed = [...candidates];

    const staleChain = chain();
    const updateChain = chain({ eq: { data: null, error: null } });
    mockFrom
      .mockReturnValueOnce(staleChain)
      .mockReturnValueOnce(chain({ limit: { data: candidates, error: null } }))
      .mockReturnValueOnce(chain({ select: { data: claimed, error: null } }))
      .mockReturnValueOnce(chain({ maybeSingle: { data: { mensagem: "msg" } } }))
      .mockReturnValueOnce(chain({ maybeSingle: { data: { phone_normalized: "+5511999990000" } } }))
      .mockReturnValue(updateChain);

    const { WhatsAppSendError: WASErr } = await import("@/lib/whatsapp-send");
    const rawMsg = "raw Meta error with sensitive data: token=abc123";
    mockSend.mockRejectedValue(new WASErr(rawMsg, 503, "service_error", true));

    const errorSpy = vi.spyOn(console, "error");

    await POST(makeReq("valid-secret-key"));

    const errorLogs = errorSpy.mock.calls
      .map((args) => { try { return JSON.parse(args[0] as string); } catch { return null; } })
      .filter(Boolean);

    const sendErrLog = errorLogs.find((l) => l.event === "retry_failed_send_error");
    expect(sendErrLog).toBeDefined();
    expect(sendErrLog.category).toBe("service_error");
    expect(sendErrLog.status_code).toBe(503);
    // Raw error message must never appear in logs
    const rawLogStr = JSON.stringify(sendErrLog);
    expect(rawLogStr).not.toContain(rawMsg);
    expect(rawLogStr).not.toContain("sensitive data");
  });
});
