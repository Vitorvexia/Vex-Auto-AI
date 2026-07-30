import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted() — factories dos vi.mock()
// ---------------------------------------------------------------------------

const { mockFrom, mockRevalidate, mockGetServerStoreId, mockGetServerUserRole } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRevalidate: vi.fn(),
  mockGetServerStoreId: vi.fn(),
  mockGetServerUserRole: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
}));

vi.mock("@/lib/auth", () => ({
  getServerStoreId: mockGetServerStoreId,
  getServerUserRole: mockGetServerUserRole,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidate,
}));

// ---------------------------------------------------------------------------
// Import após mocks
// ---------------------------------------------------------------------------

import { assignLeadToUser, removeLeadAssignment } from "@/lib/actions";

// ---------------------------------------------------------------------------
// Helpers de mock
// ---------------------------------------------------------------------------

/** Select chain: supabaseAdmin.from("x").select().eq().eq().maybeSingle() */
function makeSelectChain(result: { data: unknown; error: null } | { data: null; error: null }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
}

/** Update chain: supabaseAdmin.from("x").update({}).eq().eq() — thenable */
function makeUpdateChain(result: { error: null } | { error: Error } = { error: null }) {
  const chain: any = {};
  chain.update = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.then = (resolve: (v: any) => any, reject?: (e: any) => any) =>
    Promise.resolve(result).then(resolve, reject);
  chain.catch = (reject: (e: any) => any) => Promise.resolve(result).catch(reject);
  chain.finally = (fn: () => void) => Promise.resolve(result).finally(fn);
  return chain;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockGetServerStoreId.mockResolvedValue("store-1");
  mockGetServerUserRole.mockResolvedValue("dono_loja");
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// assignLeadToUser
// ---------------------------------------------------------------------------

describe("assignLeadToUser", () => {
  it("A1: atribui vendedor ao lead quando lead e user pertencem à mesma store", async () => {
    mockFrom
      .mockReturnValueOnce(
        makeSelectChain({ data: { id: "lead-1", store_id: "store-1" }, error: null })
      )
      .mockReturnValueOnce(
        makeSelectChain({ data: { id: "user-1" }, error: null })
      )
      .mockReturnValueOnce(makeUpdateChain({ error: null }));

    await expect(assignLeadToUser("lead-1", "user-1")).resolves.toBeUndefined();
    expect(mockRevalidate).toHaveBeenCalledWith("/leads");
  });

  it("A2: lança erro quando lead não pertence à store do usuário autenticado (cross-tenant guard lead)", async () => {
    // Lead not found (store_id mismatch → .maybeSingle() returns null)
    mockFrom.mockReturnValueOnce(
      makeSelectChain({ data: null, error: null })
    );

    await expect(assignLeadToUser("lead-outra-store", "user-1")).rejects.toThrow();
    expect(mockRevalidate).not.toHaveBeenCalled();
  });

  it("A3: lança erro quando user pertence a outra store (cross-tenant guard user)", async () => {
    // Lead found (same store), user NOT found (different store)
    mockFrom
      .mockReturnValueOnce(
        makeSelectChain({ data: { id: "lead-1", store_id: "store-1" }, error: null })
      )
      .mockReturnValueOnce(
        makeSelectChain({ data: null, error: null })
      );

    await expect(assignLeadToUser("lead-1", "user-outra-store")).rejects.toThrow();
    expect(mockRevalidate).not.toHaveBeenCalled();
  });

  it("A4: não chama revalidatePath quando a atribuição falha", async () => {
    mockFrom.mockReturnValueOnce(
      makeSelectChain({ data: null, error: null })
    );

    await expect(assignLeadToUser("lead-x", "user-x")).rejects.toThrow();
    expect(mockRevalidate).not.toHaveBeenCalled();
  });

  it("A5: propaga erro do banco se o UPDATE falhar", async () => {
    const dbError = new Error("DB update failed");
    mockFrom
      .mockReturnValueOnce(
        makeSelectChain({ data: { id: "lead-1", store_id: "store-1" }, error: null })
      )
      .mockReturnValueOnce(
        makeSelectChain({ data: { id: "user-1" }, error: null })
      )
      .mockReturnValueOnce(makeUpdateChain({ error: dbError }));

    await expect(assignLeadToUser("lead-1", "user-1")).rejects.toThrow("DB update failed");
  });

  it("A6: vendedor não pode reatribuir lead — lança erro sem consultar o banco", async () => {
    mockGetServerUserRole.mockResolvedValue("vendedor");

    await expect(assignLeadToUser("lead-1", "user-1")).rejects.toThrow(
      "Apenas o dono da loja pode reatribuir leads"
    );
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRevalidate).not.toHaveBeenCalled();
  });

  it("A7: super_admin pode reatribuir lead normalmente", async () => {
    mockGetServerUserRole.mockResolvedValue("super_admin");
    mockFrom
      .mockReturnValueOnce(
        makeSelectChain({ data: { id: "lead-1", store_id: "store-1" }, error: null })
      )
      .mockReturnValueOnce(
        makeSelectChain({ data: { id: "user-1" }, error: null })
      )
      .mockReturnValueOnce(makeUpdateChain({ error: null }));

    await expect(assignLeadToUser("lead-1", "user-1")).resolves.toBeUndefined();
    expect(mockRevalidate).toHaveBeenCalledWith("/leads");
  });
});

// ---------------------------------------------------------------------------
// removeLeadAssignment
// ---------------------------------------------------------------------------

describe("removeLeadAssignment", () => {
  it("R1: remove responsável (assigned_to = null) quando lead pertence à store", async () => {
    mockFrom
      .mockReturnValueOnce(
        makeSelectChain({ data: { id: "lead-1", store_id: "store-1" }, error: null })
      )
      .mockReturnValueOnce(makeUpdateChain({ error: null }));

    await expect(removeLeadAssignment("lead-1")).resolves.toBeUndefined();
    expect(mockRevalidate).toHaveBeenCalledWith("/leads");
  });

  it("R2: lança erro quando lead não pertence à store (cross-tenant guard)", async () => {
    mockFrom.mockReturnValueOnce(
      makeSelectChain({ data: null, error: null })
    );

    await expect(removeLeadAssignment("lead-outra-store")).rejects.toThrow();
    expect(mockRevalidate).not.toHaveBeenCalled();
  });

  it("R3: não chama revalidatePath em caso de falha", async () => {
    mockFrom.mockReturnValueOnce(
      makeSelectChain({ data: null, error: null })
    );

    await expect(removeLeadAssignment("lead-x")).rejects.toThrow();
    expect(mockRevalidate).not.toHaveBeenCalled();
  });

  it("R4: propaga erro do banco se o UPDATE falhar", async () => {
    const dbError = new Error("DB update failed");
    mockFrom
      .mockReturnValueOnce(
        makeSelectChain({ data: { id: "lead-1", store_id: "store-1" }, error: null })
      )
      .mockReturnValueOnce(makeUpdateChain({ error: dbError }));

    await expect(removeLeadAssignment("lead-1")).rejects.toThrow("DB update failed");
    expect(mockRevalidate).not.toHaveBeenCalled();
  });

  it("R5: vendedor não pode remover atribuição — lança erro sem consultar o banco", async () => {
    mockGetServerUserRole.mockResolvedValue("vendedor");

    await expect(removeLeadAssignment("lead-1")).rejects.toThrow(
      "Apenas o dono da loja pode reatribuir leads"
    );
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRevalidate).not.toHaveBeenCalled();
  });

  it("R6: dono_loja pode remover atribuição normalmente", async () => {
    mockGetServerUserRole.mockResolvedValue("dono_loja");
    mockFrom
      .mockReturnValueOnce(
        makeSelectChain({ data: { id: "lead-1", store_id: "store-1" }, error: null })
      )
      .mockReturnValueOnce(makeUpdateChain({ error: null }));

    await expect(removeLeadAssignment("lead-1")).resolves.toBeUndefined();
    expect(mockRevalidate).toHaveBeenCalledWith("/leads");
  });
});
