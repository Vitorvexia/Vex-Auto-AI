import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted() — refs compartilhados nas factories dos vi.mock()
// ---------------------------------------------------------------------------

const { mockFrom, mockInvite, mockCreateUser, mockDeleteUser, mockAssertSuperAdmin, mockRevalidatePath, mockLogAudit } =
  vi.hoisted(() => ({
    mockFrom: vi.fn(),
    mockInvite: vi.fn(),
    mockCreateUser: vi.fn(),
    mockDeleteUser: vi.fn(),
    mockAssertSuperAdmin: vi.fn(),
    mockRevalidatePath: vi.fn(),
    mockLogAudit: vi.fn(),
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
        createUser: mockCreateUser,
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

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

// ---------------------------------------------------------------------------
// Import após mocks
// ---------------------------------------------------------------------------

import { createStore, updateStore, createStoreUser, createStoreUserDirect, type CreateStoreState } from "@/app/admin/actions";

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
  mockLogAudit.mockResolvedValue(undefined);
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
  const prev: CreateStoreState = null;

  it("assertSuperAdmin chamado antes do insert", async () => {
    mockFrom.mockReturnValue(chain({ insert: { data: null, error: null } }));

    await createStore(prev, makeForm({ nome: "Loja X", whatsapp_numero: "+5511999990001" }));

    expect(mockAssertSuperAdmin).toHaveBeenCalledTimes(1);
  });

  it("nome ausente → retorna error, sem insert", async () => {
    const result = await createStore(prev, makeForm({ whatsapp_numero: "+5511999990001" }));

    expect(result).toEqual({ error: "nome e whatsapp_numero são obrigatórios" });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("whatsapp_numero formato inválido → retorna error sem insert", async () => {
    const result = await createStore(
      prev,
      makeForm({ nome: "Loja X", whatsapp_numero: "11999990001" })
    );

    expect(result).toEqual({ error: expect.stringContaining("formato inválido") });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("DB error genérico → propaga error.message", async () => {
    mockFrom.mockReturnValue(
      chain({ insert: { data: null, error: { code: "42P01", message: "table not found" } } })
    );

    const result = await createStore(
      prev,
      makeForm({ nome: "Loja X", whatsapp_numero: "+5511999990001" })
    );

    expect(result).toEqual({ error: "table not found" });
  });

  it("23505 unique violation → mensagem amigável de WhatsApp duplicado", async () => {
    mockFrom.mockReturnValue(
      chain({ insert: { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } } })
    );

    const result = await createStore(
      prev,
      makeForm({ nome: "Loja X", whatsapp_numero: "+5511999990001" })
    );

    expect(result).toEqual({ error: "Já existe uma loja cadastrada com este WhatsApp." });
  });

  it("sucesso → revalidatePath('/admin') chamado e retorna { success: true }", async () => {
    mockFrom.mockReturnValue(chain({ insert: { data: null, error: null } }));

    const result = await createStore(prev, makeForm({ nome: "Loja X", whatsapp_numero: "+5511999990001" }));

    expect(result).toEqual({ success: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("assertSuperAdmin rejeita → erro propagado, sem insert", async () => {
    mockAssertSuperAdmin.mockRejectedValue(new Error("redirect:/leads"));

    await expect(
      createStore(prev, makeForm({ nome: "Loja X", whatsapp_numero: "+5511999990001" }))
    ).rejects.toThrow("redirect:/leads");
    expect(mockFrom).not.toHaveBeenCalled();
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

  it("DB error no update → propaga error.message", async () => {
    const c = chain({ eq: { data: null, error: { message: "update failed" } } });
    c.update.mockReturnValue(c);
    mockFrom.mockReturnValue(c);

    const result = await updateStore(
      "s-1",
      makeForm({ nome: "L", whatsapp_numero: "+5511999990001" })
    );

    expect(result).toEqual({ error: "update failed" });
  });

  it("assertSuperAdmin rejeita → erro propagado, sem update", async () => {
    mockAssertSuperAdmin.mockRejectedValue(new Error("redirect:/leads"));

    await expect(
      updateStore("s-1", makeForm({ nome: "L", whatsapp_numero: "+5511999990001" }))
    ).rejects.toThrow("redirect:/leads");
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
      makeForm({ email: "u@x.com", nome: "User", role: "dono_loja", store_id: "s-1" })
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
      makeForm({ email: "u@x.com", nome: "User", role: "dono_loja", store_id: "s-1" })
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
      makeForm({ email: "u@x.com", nome: "User", role: "dono_loja", store_id: "s-1" })
    );

    expect(result).toEqual({ error: "SMTP not configured" });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("invite retorna user.id null → 'invite_failed_no_user_id'", async () => {
    mockInvite.mockResolvedValue({ data: { user: null }, error: null });

    const result = await createStoreUser(
      makeForm({ email: "u@x.com", nome: "User", role: "dono_loja", store_id: "s-1" })
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
      makeForm({ email: "u@x.com", nome: "User", role: "dono_loja", store_id: "s-1" })
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
    const errorSpy = vi.spyOn(console, "error");

    const result = await createStoreUser(
      makeForm({ email: "u@x.com", nome: "User", role: "dono_loja", store_id: "s-1" })
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
      makeForm({ email: "u@x.com", nome: "User", role: "dono_loja", store_id: "s-1" })
    );

    expect(result).toMatchObject({ success: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("role inválido → retorna error sem invite", async () => {
    const result = await createStoreUser(
      makeForm({ email: "u@x.com", nome: "User", role: "superadmin", store_id: "s-1" })
    );

    expect(result).toEqual({ error: expect.stringContaining("role inválido") });
    expect(mockInvite).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("assertSuperAdmin rejeita → erro propagado, sem invite", async () => {
    mockAssertSuperAdmin.mockRejectedValue(new Error("redirect:/leads"));

    await expect(
      createStoreUser(
        makeForm({ email: "u@x.com", nome: "User", role: "dono_loja", store_id: "s-1" })
      )
    ).rejects.toThrow("redirect:/leads");
    expect(mockInvite).not.toHaveBeenCalled();
  });

  it("sucesso → chama logAudit com action user.created, resourceId do usuário criado, role em metadata", async () => {
    mockInvite.mockResolvedValue({
      data: { user: { id: "auth-id" } },
      error: null,
    });
    mockFrom.mockReturnValue(chain({ insert: { data: null, error: null } }));

    await createStoreUser(
      makeForm({ email: "u@x.com", nome: "User", role: "dono_loja", store_id: "s-1" })
    );

    expect(mockLogAudit).toHaveBeenCalledWith({
      storeId: "s-1",
      userId: "user-admin-id",
      action: "user.created",
      resourceType: "user",
      resourceId: "auth-id",
      metadata: { role: "dono_loja" },
    });
  });

  it("insert em users falha → logAudit não é chamado", async () => {
    mockInvite.mockResolvedValue({
      data: { user: { id: "auth-id" } },
      error: null,
    });
    mockFrom.mockReturnValue(
      chain({ insert: { data: null, error: { message: "FK violation" } } })
    );
    mockDeleteUser.mockResolvedValue({ data: null, error: null });

    await createStoreUser(
      makeForm({ email: "u@x.com", nome: "User", role: "dono_loja", store_id: "s-1" })
    );

    expect(mockLogAudit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// createStoreUserDirect
// ---------------------------------------------------------------------------

describe("createStoreUserDirect", () => {
  it("sucesso → retorna { success, email, password } e revalida /admin", async () => {
    mockCreateUser.mockResolvedValue({
      data: { user: { id: "auth-id" } },
      error: null,
    });
    mockFrom.mockReturnValue(chain({ insert: { data: null, error: null } }));

    const result = await createStoreUserDirect(
      "s-1",
      null,
      makeForm({ email: "u@x.com", nome: "User", role: "dono_loja" })
    );

    expect(result).toEqual({
      success: true,
      email: "u@x.com",
      password: expect.any(String),
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("createUser auth error → retorna error, sem insert nem rollback", async () => {
    mockCreateUser.mockResolvedValue({
      data: null,
      error: { message: "email already taken" },
    });

    const result = await createStoreUserDirect(
      "s-1",
      null,
      makeForm({ email: "u@x.com", nome: "User", role: "dono_loja" })
    );

    expect(result).toEqual({ error: "email already taken" });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("insert falha → rollback (deleteUser chamado), retorna error", async () => {
    mockCreateUser.mockResolvedValue({
      data: { user: { id: "auth-id" } },
      error: null,
    });
    mockFrom.mockReturnValue(
      chain({ insert: { data: null, error: { message: "FK violation" } } })
    );
    mockDeleteUser.mockResolvedValue({ data: null, error: null });

    const result = await createStoreUserDirect(
      "s-1",
      null,
      makeForm({ email: "u@x.com", nome: "User", role: "dono_loja" })
    );

    expect(result).toEqual({ error: "FK violation" });
    expect(mockDeleteUser).toHaveBeenCalledWith("auth-id");
  });

  it("sucesso → password não aparece em nenhum log de console", async () => {
    mockCreateUser.mockResolvedValue({
      data: { user: { id: "auth-id" } },
      error: null,
    });
    mockFrom.mockReturnValue(chain({ insert: { data: null, error: null } }));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await createStoreUserDirect(
      "s-1",
      null,
      makeForm({ email: "u@x.com", nome: "User", role: "dono_loja" })
    );

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("role inválido → retorna error sem createUser", async () => {
    const result = await createStoreUserDirect(
      "s-1",
      null,
      makeForm({ email: "u@x.com", nome: "User", role: "superadmin" })
    );

    expect(result).toEqual({ error: expect.stringContaining("role inválido") });
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("sucesso → chama logAudit com action user.created", async () => {
    mockCreateUser.mockResolvedValue({
      data: { user: { id: "auth-id-2" } },
      error: null,
    });
    mockFrom.mockReturnValue(chain({ insert: { data: null, error: null } }));

    await createStoreUserDirect(
      "s-1",
      null,
      makeForm({ email: "u2@x.com", nome: "User2", role: "vendedor" })
    );

    expect(mockLogAudit).toHaveBeenCalledWith({
      storeId: "s-1",
      userId: "user-admin-id",
      action: "user.created",
      resourceType: "user",
      resourceId: "auth-id-2",
      metadata: { role: "vendedor" },
    });
  });
});
