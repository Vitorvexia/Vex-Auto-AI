import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// vi.hoisted() — refs compartilhados nas factories dos vi.mock()
// ---------------------------------------------------------------------------

const {
  mockRunFollowUpJob,
  mockRunReactivationJob,
  mockRunRetryFailedJob,
  mockFrom,
} = vi.hoisted(() => ({
  mockRunFollowUpJob: vi.fn(),
  mockRunReactivationJob: vi.fn(),
  mockRunRetryFailedJob: vi.fn(),
  mockFrom: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/follow-up", () => ({
  runFollowUpJob: mockRunFollowUpJob,
}));

vi.mock("@/lib/reactivation", () => ({
  runReactivationJob: mockRunReactivationJob,
}));

vi.mock("@/lib/retry-failed", () => ({
  runRetryFailedJob: mockRunRetryFailedJob,
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
}));

// ---------------------------------------------------------------------------
// Import após mocks
// ---------------------------------------------------------------------------

import { POST } from "@/app/api/internal/daily-run/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body?: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/internal/daily-run", {
    method: "POST",
    headers: {
      "x-internal-key": "test-key",
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function mockStores(stores: { id: string; nome: string }[]) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ["select", "eq", "order", "limit"];
  for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockResolvedValue({ data: stores, error: null });
  mockFrom.mockReturnValue(chain);
  return chain;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.env.INTERNAL_API_KEY = "test-key";

  mockRunFollowUpJob.mockResolvedValue({ sent: 0 });
  mockRunReactivationJob.mockResolvedValue({ sent: 0 });
  mockRunRetryFailedJob.mockResolvedValue({ retried: 0 });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  delete process.env.INTERNAL_API_KEY;
});

// ---------------------------------------------------------------------------
// D1 — itera todas as stores ativas
// ---------------------------------------------------------------------------

describe("daily-run multi-store iteration", () => {
  it("D1: busca stores onde active=true via supabaseAdmin", async () => {
    mockStores([{ id: "store-a", nome: "Loja A" }]);

    await POST(makeRequest());

    expect(mockFrom).toHaveBeenCalledWith("stores");
  });

  it("D2: chama runFollowUpJob para cada store ativa", async () => {
    mockStores([
      { id: "store-a", nome: "Loja A" },
      { id: "store-b", nome: "Loja B" },
    ]);

    await POST(makeRequest());

    expect(mockRunFollowUpJob).toHaveBeenCalledTimes(2);
    expect(mockRunFollowUpJob).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: "store-a" })
    );
    expect(mockRunFollowUpJob).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: "store-b" })
    );
  });

  it("D3: chama runReactivationJob para cada store ativa", async () => {
    mockStores([
      { id: "store-a", nome: "Loja A" },
      { id: "store-b", nome: "Loja B" },
    ]);

    await POST(makeRequest());

    expect(mockRunReactivationJob).toHaveBeenCalledTimes(2);
    expect(mockRunReactivationJob).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: "store-b" })
    );
  });

  it("D4: runRetryFailedJob chamado exatamente 1 vez (global, sem storeId por store)", async () => {
    mockStores([
      { id: "store-a", nome: "Loja A" },
      { id: "store-b", nome: "Loja B" },
    ]);

    await POST(makeRequest());

    expect(mockRunRetryFailedJob).toHaveBeenCalledTimes(1);
  });

  it("D5: falha em store A não bloqueia execução de store B", async () => {
    mockStores([
      { id: "store-a", nome: "Loja A" },
      { id: "store-b", nome: "Loja B" },
    ]);
    mockRunFollowUpJob
      .mockRejectedValueOnce(new Error("store-a timeout"))
      .mockResolvedValueOnce({ sent: 2 });

    const res = await POST(makeRequest());
    const body = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(200);
    // store B foi processada mesmo com store A falhando
    expect(mockRunFollowUpJob).toHaveBeenCalledTimes(2);
    expect(body.ok).toBe(true);
  });

  it("D6: response inclui resultado por store_id", async () => {
    mockStores([{ id: "store-a", nome: "Loja A" }]);
    mockRunFollowUpJob.mockResolvedValue({ sent: 3 });
    mockRunReactivationJob.mockResolvedValue({ sent: 1 });

    const res = await POST(makeRequest());
    const body = await res.json() as Record<string, unknown>;

    expect(body.ok).toBe(true);
    expect(body.stores).toBeDefined();
  });

  it("D7: sem stores ativas → responde 200 sem chamar nenhum job", async () => {
    mockStores([]);

    const res = await POST(makeRequest());
    const body = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(mockRunFollowUpJob).not.toHaveBeenCalled();
    expect(mockRunReactivationJob).not.toHaveBeenCalled();
    expect(mockRunRetryFailedJob).not.toHaveBeenCalled();
    expect(body.ok).toBe(true);
  });
});
