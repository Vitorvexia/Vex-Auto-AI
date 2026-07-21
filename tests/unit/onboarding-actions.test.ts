import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  mockFrom,
  mockCreateUser,
  mockDeleteUser,
  mockAssertStoreAdmin,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockCreateUser: vi.fn(),
  mockDeleteUser: vi.fn(),
  mockAssertStoreAdmin: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: mockFrom,
    auth: { admin: { createUser: mockCreateUser, deleteUser: mockDeleteUser } },
  },
}));

vi.mock("@/lib/auth", () => ({
  assertStoreAdmin: mockAssertStoreAdmin,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

import {
  updateStoreNomeSelfService,
  createStoreVendedorSelfService,
  skipEstoqueOnboarding,
  updateStoreWhatsAppSelfService,
} from "@/lib/onboarding-actions";

function fd(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return form;
}

// chain() builds one shared query-builder mock. `tables` maps a table name to
// the resolved value its terminal call (.single()/.update() etc.) should return.
function makeFrom(perTable: Record<string, { select?: unknown; update?: unknown }>) {
  mockFrom.mockImplementation((table: string) => {
    const cfg = perTable[table] ?? {};
    // Per-chain-instance flag: each supabaseAdmin.from(table) call gets its own
    // builder, matching real supabase-js. Only a chain that actually called
    // .update(...) short-circuits .eq(...) to the update result — a chain used
    // for .select(...).eq(...).single() (or a count query with multiple .eq()
    // calls) keeps returning `this` so those terminal calls resolve normally.
    let updateCalled = false;
    const chain: Record<string, ReturnType<typeof vi.fn>> = {
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockImplementation(() => {
        updateCalled = true;
        return chain;
      }),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(cfg.select ?? { data: null, error: null }),
    };
    // update(...).eq(...) resolves directly (no .single() call in our actions)
    chain.eq = vi.fn().mockImplementation(() => {
      if (updateCalled && cfg.update !== undefined) return Promise.resolve(cfg.update);
      return chain;
    });
    return chain;
  });
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockAssertStoreAdmin.mockResolvedValue("store-1");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("updateStoreNomeSelfService", () => {
  it("D1: nome vazio → retorna erro sem chamar o banco", async () => {
    const result = await updateStoreNomeSelfService(fd({ nome: "  " }));
    expect(result).toEqual({ error: "Nome da loja é obrigatório" });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("D2: nome válido → atualiza stores.nome e retorna success", async () => {
    makeFrom({
      stores: {
        update: { error: null },
        select: { data: { nome: "Speed Motos", whatsapp_phone_number_id: null, onboarding_completed_at: null, estoque_wizard_skipped: false }, error: null },
      },
      users: { select: { data: null, error: null, count: 0 } },
      vehicles: { select: { data: null, error: null, count: 0 } },
    });

    const result = await updateStoreNomeSelfService(fd({ nome: "Speed Motos" }));

    expect(result).toEqual({ success: true });
  });
});

describe("createStoreVendedorSelfService", () => {
  it("D3: campos ausentes → retorna erro sem criar usuário", async () => {
    const result = await createStoreVendedorSelfService(fd({ email: "", nome: "Maria" }));
    expect(result).toEqual({ error: "email e nome são obrigatórios" });
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("D4: sucesso → cria auth user + insere em users com role vendedor", async () => {
    mockCreateUser.mockResolvedValue({ data: { user: { id: "auth-1" } }, error: null });
    makeFrom({
      users: { update: { error: null } },
      stores: { select: { data: { nome: "Speed Motos", whatsapp_phone_number_id: null, onboarding_completed_at: null, estoque_wizard_skipped: false }, error: null } },
      vehicles: { select: { data: null, error: null, count: 0 } },
    });

    const result = await createStoreVendedorSelfService(fd({ email: "maria@x.com", nome: "Maria" }));

    expect(result).toMatchObject({ success: true, email: "maria@x.com" });
    expect("password" in result && result.password.length).toBeGreaterThan(0);
    expect(mockFrom).toHaveBeenCalledWith("users");
  });

  it("D5: insert em users falha → deleta auth user órfão e retorna erro", async () => {
    mockCreateUser.mockResolvedValue({ data: { user: { id: "auth-orphan" } }, error: null });
    mockDeleteUser.mockResolvedValue({ error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "users") {
        const chain: Record<string, ReturnType<typeof vi.fn>> = {
          insert: vi.fn().mockResolvedValue({ error: { message: "duplicate" } }),
        };
        return chain;
      }
      throw new Error(`unexpected table ${table}`);
    });

    const result = await createStoreVendedorSelfService(fd({ email: "x@x.com", nome: "X" }));

    expect(result).toEqual({ error: "duplicate" });
    expect(mockDeleteUser).toHaveBeenCalledWith("auth-orphan");
  });
});

describe("skipEstoqueOnboarding", () => {
  it("D6: marca estoque_wizard_skipped = true", async () => {
    let capturedUpdate: unknown;
    mockFrom.mockImplementation((table: string) => {
      if (table === "stores") {
        // Per-chain flag (see makeFrom comment above): only THIS chain's own
        // .update(...) call should make .eq(...) resolve directly. The later
        // .select(...).eq(...).single() chain from maybeStampOnboardingComplete
        // is a fresh supabaseAdmin.from("stores") call with its own chain, so
        // it must fall through to .single() instead of short-circuiting.
        let updateCalledOnThisChain = false;
        const chain: Record<string, ReturnType<typeof vi.fn>> = {
          update: vi.fn().mockImplementation((payload) => {
            capturedUpdate = payload;
            updateCalledOnThisChain = true;
            return chain;
          }),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation(() => {
            if (updateCalledOnThisChain) return Promise.resolve({ error: null });
            return chain;
          }),
          single: vi.fn().mockResolvedValue({
            data: { nome: "Speed Motos", whatsapp_phone_number_id: null, onboarding_completed_at: null, estoque_wizard_skipped: true },
            error: null,
          }),
        };
        return chain;
      }
      // users/vehicles count queries: some call .eq() once (vehicles), some
      // twice (users: store_id + role) — .mockReturnThis() supports either,
      // resolving to the object itself (count/error undefined → safe defaults).
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
    });

    const result = await skipEstoqueOnboarding();

    expect(result).toEqual({ success: true });
    expect(capturedUpdate).toEqual({ estoque_wizard_skipped: true });
  });
});

describe("updateStoreWhatsAppSelfService", () => {
  it("D7: phone_number_id ausente → retorna erro", async () => {
    const result = await updateStoreWhatsAppSelfService(
      fd({ whatsapp_phone_number_id: "", whatsapp_numero: "+5511999999999" })
    );
    expect(result).toEqual({ error: "Phone Number ID é obrigatório" });
  });

  it("D8: número fora do formato E.164 → retorna erro", async () => {
    const result = await updateStoreWhatsAppSelfService(
      fd({ whatsapp_phone_number_id: "123", whatsapp_numero: "11999999999" })
    );
    expect(result).toEqual({ error: "formato inválido: use +55DDD9XXXXXXXX (E.164)" });
  });

  it("D9: dados válidos → atualiza stores e retorna success", async () => {
    makeFrom({
      stores: {
        update: { error: null },
        select: { data: { nome: "Speed Motos", whatsapp_phone_number_id: "999", onboarding_completed_at: null, estoque_wizard_skipped: true }, error: null },
      },
      users: { select: { data: null, error: null, count: 1 } },
      vehicles: { select: { data: null, error: null, count: 0 } },
    });

    const result = await updateStoreWhatsAppSelfService(
      fd({ whatsapp_phone_number_id: "999", whatsapp_numero: "+5511999999999" })
    );

    expect(result).toEqual({ success: true });
  });
});
