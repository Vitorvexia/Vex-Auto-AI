import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted() — refs compartilhados nas factories dos vi.mock()
// ---------------------------------------------------------------------------

const { mockFrom, mockInvite, mockDeleteUser, mockAssertSuperAdmin, mockRevalidatePath } =
  vi.hoisted(() => ({
    mockFrom: vi.fn(),
    mockInvite: vi.fn(),
    mockDeleteUser: vi.fn(),
    mockAssertSuperAdmin: vi.fn(),
    mockRevalidatePath: vi.fn(),
  }));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: mockFrom,
    auth: {
      admin: {
        inviteUserByEmail: mockInvite,
        deleteUser: mockDeleteUser,
      },
    },
  },
}));

vi.mock("@/lib/admin-auth", () => ({
  assertSuperAdmin: mockAssertSuperAdmin,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

// ---------------------------------------------------------------------------
// Import após mocks
// ---------------------------------------------------------------------------

import { createStore, updateStore, createStoreUser } from "@/app/admin/actions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeForm(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.append(k, v);
  return fd;
}

function chain(overrides: Record<string, unknown> = {}) {
  const c: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    match: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  };
  for (const k of Object.keys(c)) c[k].mockReturnValue(c);
  for (const [k, v] of Object.entries(overrides)) c[k].mockResolvedValue(v);
  return c;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockAssertSuperAdmin.mockResolvedValue("user-admin-id");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// createStore
// ---------------------------------------------------------------------------

describe("createStore", () => {
  it("assertSuperAdmin chamado antes do insert", async () => {
    mockFrom.mockReturnValue(chain({ insert: { data: null, error: null } }));

    await createStore(makeForm({ nome: "Loja X", whatsapp_numero: "+5511999990001" }));

    expect(mockAssertSuperAdmin).toHaveBeenCalledTimes(1);
  });

  it("nome ausente → retorna error, sem insert", async () => {
    const result = await createStore(makeForm({ whatsapp_numero: "+5511999990001" }));

    expect(result).toEqual({ error: "nome e whatsapp_numero são obrigatórios" });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("whatsapp_numero formato inválido → retorna error sem insert", async () => {
    const result = await createStore(
      makeForm({ nome: "Loja X", whatsapp_numero: "11999990001" })
    );

    expect(result).toEqual({ error: expect.stringContaining("formato inválido") });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("DB error → propaga error.message", async () => {
    mockFrom.mockReturnValue(
      chain({ insert: { data: null, error: { message: "duplicate key" } } })
    );

    const result = await createStore(
      makeForm({ nome: "Loja X", whatsapp_numero: "+5511999990001" })
    );

    expect(result).toEqual({ error: "duplicate key" });
  });

  it("sucesso → revalidatePath('/admin') chamado", async () => {
    mockFrom.mockReturnValue(chain({ insert: { data: null, error: null } }));

    await createStore(makeForm({ nome: "Loja X", whatsapp_numero: "+5511999990001" }));

    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin");
  });
});

// ---------------------------------------------------------------------------
// updateStore
// ---------------------------------------------------------------------------

describe("updateStore", () => {
  it("assertSuperAdmin chamado antes do update", async () => {
    const c = chain({ eq: { data: null, error: null } });
    c.update.mockReturnValue(c);
    mockFrom.mockReturnValue(c);

    await updateStore("s-1", makeForm({ nome: "L", whatsapp_numero: "+5511999990001" }));

    expect(mockAssertSuperAdmin).toHaveBeenCalledTimes(1);
  });

  it("checkbox 'on' → active=true no update", async () => {
    const c = chain({ eq: { data: null, error: null } });
    c.update.mockReturnValue(c);
    mockFrom.mockReturnValue(c);

    await updateStore(
      "s-1",
      makeForm({ nome: "L", whatsapp_numero: "+5511999990001", active: "on" })
    );

    expect(c.update).toHaveBeenCalledWith(
      expect.objectContaining({ active: true })
    );
  });

  it("checkbox ausente → active=false no update", async () => {
    const c = chain({ eq: { data: null, error: null } });
    c.update.mockReturnValue(c);
    mockFrom.mockReturnValue(c);

    await updateStore(
      "s-1",
      makeForm({ nome: "L", whatsapp_numero: "+5511999990001" })
    );

    expect(c.update).toHaveBeenCalledWith(
      expect.objectContaining({ active: false })
    );
  });

  it("whatsapp_numero formato inválido → retorna error sem update", async () => {
    const result = await updateStore(
      "s-1",
      makeForm({ nome: "L", whatsapp_numero: "11999990001" })
    );

    expect(result).toEqual({ error: expect.stringContaining("formato inválido") });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// createStoreUser
// ---------------------------------------------------------------------------

describe("createStoreUser", () => {
  it("assertSuperAdmin chamado antes do invite", async () => {
    mockInvite.mockResolvedValue({
      data: { user: { id: "auth-id" } },
      error: null,
    });
    mockFrom.mockReturnValue(chain({ insert: { data: null, error: null } }));

    await createStoreUser(
      makeForm({ email: "u@x.com", nome: "User", role: "admin", store_id: "s-1" })
    );

    expect(mockAssertSuperAdmin).toHaveBeenCalledTimes(1);
  });

  it("invite ok → insere em public.users com store_id", async () => {
    mockInvite.mockResolvedValue({
      data: { user: { id: "auth-id" } },
      error: null,
    });
    const usersChain = chain({ insert: { data: null, error: null } });
    mockFrom.mockReturnValue(usersChain);

    const result = await createStoreUser(
      makeForm({ email: "u@x.com", nome: "User", role: "admin", store_id: "s-1" })
    );

    expect(result).toEqual({
      success: true,
      message: expect.stringContaining("u@x.com"),
    });
    expect(mockFrom).toHaveBeenCalledWith("users");
    expect(usersChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: "auth-id", store_id: "s-1" })
    );
  });

  it("invite falha → retorna error, não insere em users", async () => {
    mockInvite.mockResolvedValue({
      data: null,
      error: { message: "SMTP not configured" },
    });

    const result = await createStoreUser(
      makeForm({ email: "u@x.com", nome: "User", role: "admin", store_id: "s-1" })
    );

    expect(result).toEqual({ error: "SMTP not configured" });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("invite retorna user.id null → 'invite_failed_no_user_id'", async () => {
    mockInvite.mockResolvedValue({ data: { user: null }, error: null });

    const result = await createStoreUser(
      makeForm({ email: "u@x.com", nome: "User", role: "admin", store_id: "s-1" })
    );

    expect(result).toEqual({ error: "invite_failed_no_user_id" });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("invite ok, public.users insert falha → deleteUser chamado (rollback)", async () => {
    mockInvite.mockResolvedValue({
      data: { user: { id: "auth-id" } },
      error: null,
    });
    mockFrom.mockReturnValue(
      chain({ insert: { data: null, error: { message: "FK violation" } } })
    );
    mockDeleteUser.mockResolvedValue({ data: null, error: null });

    const result = await createStoreUser(
      makeForm({ email: "u@x.com", nome: "User", role: "admin", store_id: "s-1" })
    );

    expect(result).toEqual({ error: "FK violation" });
    expect(mockDeleteUser).toHaveBeenCalledWith("auth-id");
  });

  it("rollback deleteUser falha → erro original retornado, console.error logado", async () => {
    mockInvite.mockResolvedValue({
      data: { user: { id: "auth-id" } },
      error: null,
    });
    mockFrom.mockReturnValue(
      chain({ insert: { data: null, error: { message: "FK violation" } } })
    );
    mockDeleteUser.mockRejectedValue(new Error("network error"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await createStoreUser(
      makeForm({ email: "u@x.com", nome: "User", role: "admin", store_id: "s-1" })
    );

    expect(result).toEqual({ error: "FK violation" });
    expect(errorSpy).toHaveBeenCalledWith(
      "rollback_failed: orphan auth user",
      "auth-id"
    );
  });

  it("sucesso → retorna { success: true, message } e revalida /admin", async () => {
    mockInvite.mockResolvedValue({
      data: { user: { id: "auth-id" } },
      error: null,
    });
    mockFrom.mockReturnValue(chain({ insert: { data: null, error: null } }));

    const result = await createStoreUser(
      makeForm({ email: "u@x.com", nome: "User", role: "admin", store_id: "s-1" })
    );

    expect(result).toMatchObject({ success: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin");
  });
});
