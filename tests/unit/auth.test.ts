import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted() — refs compartilhados nas factories dos vi.mock()
// ---------------------------------------------------------------------------

const { mockCreateClient, mockGetUser, mockFrom } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase-server", () => ({
  createSupabaseServerClient: mockCreateClient,
}));

// ---------------------------------------------------------------------------
// Import após mocks
// ---------------------------------------------------------------------------

import { getServerStoreId, AuthError, StoreNotFoundError } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockUsersQuery(storeId: string | null) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ["select", "eq", "single"];
  for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({
    data: storeId ? { store_id: storeId } : null,
    error: null,
  });
  mockFrom.mockReturnValue(chain);
  return chain;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockCreateClient.mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// A1 — happy path
// ---------------------------------------------------------------------------

describe("getServerStoreId", () => {
  it("A1: usuário autenticado com store_id → retorna store_id", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockUsersQuery("store-abc");

    const result = await getServerStoreId();

    expect(result).toBe("store-abc");
  });

  // -------------------------------------------------------------------------
  // A2 — sem sessão (user null, sem error)
  // -------------------------------------------------------------------------

  it("A2: auth.getUser() retorna user null → throw AuthError", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(getServerStoreId()).rejects.toThrow(AuthError);
  });

  // -------------------------------------------------------------------------
  // A3 — sessão expirada (error presente)
  // -------------------------------------------------------------------------

  it("A3: auth.getUser() retorna error → throw AuthError", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("session expired"),
    });

    await expect(getServerStoreId()).rejects.toThrow(AuthError);
  });

  // -------------------------------------------------------------------------
  // A4 — usuário sem linha em public.users
  // -------------------------------------------------------------------------

  it("A4: usuário autenticado mas sem linha em public.users → throw StoreNotFoundError", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-orphan" } },
      error: null,
    });
    mockUsersQuery(null);

    await expect(getServerStoreId()).rejects.toThrow(StoreNotFoundError);
  });

  // -------------------------------------------------------------------------
  // A5 — StoreNotFoundError contém o user_id
  // -------------------------------------------------------------------------

  it("A5: StoreNotFoundError inclui user_id na mensagem", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-42" } },
      error: null,
    });
    mockUsersQuery(null);

    const err = await getServerStoreId().catch((e: unknown) => e);

    expect(err).toBeInstanceOf(StoreNotFoundError);
    expect((err as Error).message).toContain("user-42");
  });

  // -------------------------------------------------------------------------
  // A6 — AuthError é instância de Error
  // -------------------------------------------------------------------------

  it("A6: AuthError é instância de Error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const err = await getServerStoreId().catch((e: unknown) => e);

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AuthError);
  });

  // -------------------------------------------------------------------------
  // A7 — StoreNotFoundError é instância de Error
  // -------------------------------------------------------------------------

  it("A7: StoreNotFoundError é instância de Error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u-1" } },
      error: null,
    });
    mockUsersQuery(null);

    const err = await getServerStoreId().catch((e: unknown) => e);

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(StoreNotFoundError);
  });

  // -------------------------------------------------------------------------
  // A8 — query sempre busca da tabela 'users'
  // -------------------------------------------------------------------------

  it("A8: consulta a tabela 'users' para resolver store_id", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockUsersQuery("store-x");

    await getServerStoreId();

    expect(mockFrom).toHaveBeenCalledWith("users");
  });
});
