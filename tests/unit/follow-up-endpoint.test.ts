/**
 * Testes unitários para app/api/internal/follow-up/run/route.ts
 *
 * Coberturas:
 * - Auth: CRON_SECRET (Bearer), INTERNAL_API_KEY (x-internal-key), inválida, ausente
 * - GET e POST ambos funcionam com auth correta
 * - Repassa storeId e limit da query string / body
 * - Resposta estruturada: { ok, result }
 * - Erro em runFollowUpJob → 500
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// vi.hoisted()
// ---------------------------------------------------------------------------

const { mockRunFollowUpJob } = vi.hoisted(() => ({
  mockRunFollowUpJob: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/follow-up", () => ({
  runFollowUpJob: mockRunFollowUpJob,
}));

// ---------------------------------------------------------------------------
// Import após mocks
// ---------------------------------------------------------------------------

import { GET, POST } from "@/app/api/internal/follow-up/run/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CRON_SECRET = "cron-secret-xyz";
const INTERNAL_KEY = "internal-key-abc";

const DEFAULT_RESULT = { processed: 3, sent: 2, skipped: 0, failed: 1 };

function makeGetReq(opts: {
  authHeader?: string;
  query?: Record<string, string>;
} = {}): NextRequest {
  const url = new URL("http://localhost/api/internal/follow-up/run");
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
  const headers: Record<string, string> = {};
  if (opts.authHeader) headers["authorization"] = opts.authHeader;
  return new NextRequest(url.toString(), { method: "GET", headers });
}

function makePostReq(opts: {
  key?: string;
  body?: object;
} = {}): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.key) headers["x-internal-key"] = opts.key;
  return new NextRequest("http://localhost/api/internal/follow-up/run", {
    method: "POST",
    headers,
    body: JSON.stringify(opts.body ?? {}),
  });
}

// ---------------------------------------------------------------------------
// Env setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  process.env.CRON_SECRET = CRON_SECRET;
  process.env.INTERNAL_API_KEY = INTERNAL_KEY;
  mockRunFollowUpJob.mockResolvedValue(DEFAULT_RESULT);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  delete process.env.CRON_SECRET;
  delete process.env.INTERNAL_API_KEY;
});

// ---------------------------------------------------------------------------
// Autenticação — GET (Bearer CRON_SECRET)
// ---------------------------------------------------------------------------

describe("GET /api/internal/follow-up/run — autenticação", () => {
  it("200 com Bearer CRON_SECRET correto", async () => {
    const res = await GET(makeGetReq({ authHeader: `Bearer ${CRON_SECRET}` }));
    expect(res.status).toBe(200);
  });

  it("401 com Bearer incorreto", async () => {
    const res = await GET(makeGetReq({ authHeader: "Bearer wrong-secret" }));
    expect(res.status).toBe(401);
    expect(mockRunFollowUpJob).not.toHaveBeenCalled();
  });

  it("401 sem header Authorization", async () => {
    const res = await GET(makeGetReq());
    expect(res.status).toBe(401);
    expect(mockRunFollowUpJob).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Autenticação — POST (x-internal-key)
// ---------------------------------------------------------------------------

describe("POST /api/internal/follow-up/run — autenticação", () => {
  it("200 com x-internal-key correto", async () => {
    const res = await POST(makePostReq({ key: INTERNAL_KEY }));
    expect(res.status).toBe(200);
  });

  it("401 com x-internal-key incorreto", async () => {
    const res = await POST(makePostReq({ key: "wrong-key" }));
    expect(res.status).toBe(401);
    expect(mockRunFollowUpJob).not.toHaveBeenCalled();
  });

  it("401 sem x-internal-key", async () => {
    const res = await POST(makePostReq());
    expect(res.status).toBe(401);
    expect(mockRunFollowUpJob).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Resposta estruturada
// ---------------------------------------------------------------------------

describe("GET — resposta", () => {
  it("retorna { ok: true, result } com valores corretos", async () => {
    const res = await GET(makeGetReq({ authHeader: `Bearer ${CRON_SECRET}` }));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.result).toEqual(DEFAULT_RESULT);
  });
});

describe("POST — resposta", () => {
  it("retorna { ok: true, result } com valores corretos", async () => {
    const res = await POST(makePostReq({ key: INTERNAL_KEY }));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.result).toEqual(DEFAULT_RESULT);
  });
});

// ---------------------------------------------------------------------------
// Repasse de parâmetros
// ---------------------------------------------------------------------------

describe("GET — parâmetros via query string", () => {
  it("repassa storeId e limit ao runFollowUpJob", async () => {
    await GET(
      makeGetReq({
        authHeader: `Bearer ${CRON_SECRET}`,
        query: { storeId: "store-42", limit: "10" },
      })
    );
    expect(mockRunFollowUpJob).toHaveBeenCalledWith({ storeId: "store-42", limit: 10 });
  });

  it("chama runFollowUpJob sem opts quando query vazia", async () => {
    await GET(makeGetReq({ authHeader: `Bearer ${CRON_SECRET}` }));
    expect(mockRunFollowUpJob).toHaveBeenCalledWith({});
  });
});

describe("POST — parâmetros via body", () => {
  it("repassa storeId e limit ao runFollowUpJob", async () => {
    await POST(
      makePostReq({ key: INTERNAL_KEY, body: { storeId: "store-99", limit: 5 } })
    );
    expect(mockRunFollowUpJob).toHaveBeenCalledWith({ storeId: "store-99", limit: 5 });
  });

  it("chama runFollowUpJob sem opts quando body vazio", async () => {
    await POST(makePostReq({ key: INTERNAL_KEY }));
    expect(mockRunFollowUpJob).toHaveBeenCalledWith({});
  });
});

// ---------------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------------

describe("Erros de infraestrutura", () => {
  it("GET retorna 500 quando runFollowUpJob lança exceção", async () => {
    mockRunFollowUpJob.mockRejectedValue(new Error("DB offline"));
    const res = await GET(makeGetReq({ authHeader: `Bearer ${CRON_SECRET}` }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("POST retorna 500 quando runFollowUpJob lança exceção", async () => {
    mockRunFollowUpJob.mockRejectedValue(new Error("timeout"));
    const res = await POST(makePostReq({ key: INTERNAL_KEY }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});
