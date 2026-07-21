import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted() — refs compartilhados nas factories dos vi.mock()
// ---------------------------------------------------------------------------

const { mockCreateClient, mockGetUser, mockFrom, mockIsSuperAdmin } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockIsSuperAdmin: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase-server", () => ({
  createSupabaseServerClient: mockCreateClient,
}));

vi.mock("@/lib/admin-auth", () => ({
  isSuperAdmin: mockIsSuperAdmin,
}));

// ---------------------------------------------------------------------------
// Import após mocks
// ---------------------------------------------------------------------------

import {
  getServerStoreId,
  getServerUserRole,
  assertStoreAdmin,
  AuthError,
  StoreNotFoundError,
  ForbiddenError,
} from "@/lib/auth";

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

function mockUsersQueryWithRole(row: { store_id: string; role: string } | null) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ["select", "eq", "single"];
  for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: row, error: null });
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

// ---------------------------------------------------------------------------
// getServerUserRole
// ---------------------------------------------------------------------------

function mockUsersRoleQuery(role: string | null) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ["select", "eq", "single"];
  for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({
    data: role ? { role } : null,
    error: null,
  });
  mockFrom.mockReturnValue(chain);
  return chain;
}

describe("getServerUserRole", () => {
  it("R1: email na lista de super-admin -> retorna 'super_admin' sem consultar users", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "vitor@vex.com" } },
      error: null,
    });
    mockIsSuperAdmin.mockReturnValue(true);

    const result = await getServerUserRole();

    expect(result).toBe("super_admin");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("R2: não super-admin, users.role='dono_loja' -> retorna 'dono_loja'", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-2", email: "dono@loja.com" } },
      error: null,
    });
    mockIsSuperAdmin.mockReturnValue(false);
    mockUsersRoleQuery("dono_loja");

    const result = await getServerUserRole();

    expect(result).toBe("dono_loja");
  });

  it("R3: não super-admin, users.role='vendedor' -> retorna 'vendedor'", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-3", email: "vendedor@loja.com" } },
      error: null,
    });
    mockIsSuperAdmin.mockReturnValue(false);
    mockUsersRoleQuery("vendedor");

    const result = await getServerUserRole();

    expect(result).toBe("vendedor");
  });

  it("R4: sem sessão -> throw AuthError", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(getServerUserRole()).rejects.toThrow(AuthError);
  });

  it("R5: autenticado, sem linha em public.users, não super-admin -> throw StoreNotFoundError", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-orphan", email: "ninguem@x.com" } },
      error: null,
    });
    mockIsSuperAdmin.mockReturnValue(false);
    mockUsersRoleQuery(null);

    await expect(getServerUserRole()).rejects.toThrow(StoreNotFoundError);
  });
});

describe("assertStoreAdmin", () => {
  it("B1: usuário dono_loja da loja → retorna store_id", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockUsersQueryWithRole({ store_id: "store-abc", role: "dono_loja" });

    const result = await assertStoreAdmin();

    expect(result).toBe("store-abc");
  });

  it("B2: sem sessão → throw AuthError", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(assertStoreAdmin()).rejects.toThrow(AuthError);
  });

  it("B3: usuário sem linha em public.users → throw StoreNotFoundError", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-orphan" } },
      error: null,
    });
    mockUsersQueryWithRole(null);

    await expect(assertStoreAdmin()).rejects.toThrow(StoreNotFoundError);
  });

  it("B4: usuário é vendedor, não admin → throw ForbiddenError", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-2" } },
      error: null,
    });
    mockUsersQueryWithRole({ store_id: "store-abc", role: "vendedor" });

    await expect(assertStoreAdmin()).rejects.toThrow(ForbiddenError);
  });

  it("B5: ForbiddenError é instância de Error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-2" } },
      error: null,
    });
    mockUsersQueryWithRole({ store_id: "store-abc", role: "vendedor" });

    const err = await assertStoreAdmin().catch((e: unknown) => e);

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ForbiddenError);
  });

  it("B6: consulta a tabela 'users' via getServerUserRole (role) + getServerStoreId (store_id)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const chain = mockUsersQueryWithRole({ store_id: "store-abc", role: "dono_loja" });

    await assertStoreAdmin();

    expect(mockFrom).toHaveBeenCalledWith("users");
    expect(chain.select).toHaveBeenCalledWith("role");
    expect(chain.select).toHaveBeenCalledWith("store_id");
  });
});
