/**
 * Testes de isolamento multi-tenant — contrato de Store A vs Store B.
 *
 * Nível: unit (mock-based). Valida o contrato da camada de aplicação:
 *   - getServerStoreId() retorna apenas o store do usuário autenticado
 *   - store_id não pode ser injetado pelo caller
 *   - usuário sem vínculo com store não obtém dados de outra store
 *
 * LIMITAÇÃO CONHECIDA: estes testes verificam o contrato da aplicação,
 * mas NÃO validam o RLS no banco. Para validação real, executar as queries
 * de aceitação do design doc contra o Supabase (Studio ou supabase db test):
 *
 *   SET LOCAL role TO 'authenticated';
 *   SET LOCAL request.jwt.claims TO '{"sub": "<user_id_store_A>"}';
 *   SELECT count(*) FROM follow_up_logs;  -- deve retornar 0 para store B
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted()
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

function buildSessionForStore(userId: string, storeId: string) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ["select", "eq", "single"];
  for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({
    data: { store_id: storeId },
    error: null,
  });

  mockGetUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
  mockFrom.mockReturnValue(chain);
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
// I1–I2: isolamento de identidade
// ---------------------------------------------------------------------------

describe("isolamento multi-tenant — store_id por sessão", () => {
  it("I1: user de loja A → getServerStoreId() retorna store-a (nunca store-b)", async () => {
    buildSessionForStore("user-a", "store-a");

    const storeId = await getServerStoreId();

    expect(storeId).toBe("store-a");
    expect(storeId).not.toBe("store-b");
  });

  it("I2: user de loja B → getServerStoreId() retorna store-b (nunca store-a)", async () => {
    buildSessionForStore("user-b", "store-b");

    const storeId = await getServerStoreId();

    expect(storeId).toBe("store-b");
    expect(storeId).not.toBe("store-a");
  });

  it("I3: getServerStoreId() não aceita store_id por parâmetro — lookup obrigatório via DB", async () => {
    buildSessionForStore("user-a", "store-a");

    await getServerStoreId();

    // Invariante: auth.getUser() chamado antes de qualquer query
    expect(mockGetUser).toHaveBeenCalledOnce();
    // store_id lido da tabela 'users', não de argumento externo
    expect(mockFrom).toHaveBeenCalledWith("users");
  });

  // -------------------------------------------------------------------------
  // I4: cross-store — user-a tentando acessar store-b
  // Simula o que RLS faria: usuário de store-a não encontra linha em store-b
  // -------------------------------------------------------------------------

  it("I4: user de loja A com DB simulando ausência de linha de loja B → StoreNotFoundError (cross-store bloqueado)", async () => {
    // user-a-with-b-id: usuário autenticado como user-a, mas tentando resolver
    // store_id de outro usuário. A query `.eq("id", user.id)` garante que
    // somente a linha do próprio usuário é lida — não há como injetar outro user.id.
    // Se a linha retornar null (loja diferente / RLS bloqueou), StoreNotFoundError.
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    const methods = ["select", "eq", "single"];
    for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain);
    // Simula RLS bloqueando: query retorna null (sem dados da store-b)
    chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    await expect(getServerStoreId()).rejects.toThrow(StoreNotFoundError);
  });

  // -------------------------------------------------------------------------
  // I5: usuário sem sessão não obtém store_id de outra loja
  // -------------------------------------------------------------------------

  it("I5: usuário sem sessão → AuthError (sem acesso a nenhuma store)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(getServerStoreId()).rejects.toThrow(AuthError);
    // Nunca consulta o banco sem sessão válida
    expect(mockFrom).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // I6: query usa user.id da sessão, não parâmetro — não pode ser forjado
  // -------------------------------------------------------------------------

  it("I6: query de users usa .eq('id', user.id) — store_id não pode ser forjado", async () => {
    buildSessionForStore("user-a", "store-a");

    await getServerStoreId();

    const chain = mockFrom.mock.results[0].value as Record<string, ReturnType<typeof vi.fn>>;
    // .eq() foi chamado com "id" e o user.id da sessão — não com parâmetro externo
    expect(chain.eq).toHaveBeenCalledWith("id", "user-a");
  });
});
