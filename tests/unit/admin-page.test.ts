import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// ---------------------------------------------------------------------------
// vi.hoisted() — refs compartilhados nas factories dos vi.mock()
// ---------------------------------------------------------------------------

const { mockFrom, mockAssertSuperAdmin, mockRevalidatePath, mockLogAudit } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockAssertSuperAdmin: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockLogAudit: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
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

// Stubs — formulários client-side (useFormState) fora do escopo deste teste;
// SSR legado do react-dom não sabe renderizar esse hook.
vi.mock("@/app/admin/CreateStoreForm", () => ({ CreateStoreForm: () => null }));
vi.mock("@/app/admin/DirectUserForm", () => ({ DirectUserForm: () => null }));

// ---------------------------------------------------------------------------
// Import após mocks
// ---------------------------------------------------------------------------

import AdminPage from "@/app/admin/page";

function chain(orderResult: unknown) {
  const c: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    order: vi.fn(),
  };
  c.select.mockReturnValue(c);
  c.order.mockResolvedValue(orderResult);
  return c;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAssertSuperAdmin.mockResolvedValue("admin-user-id");
});

describe("AdminPage — listagem de lojas (BL: regressão coluna faltante em prod)", () => {
  it("erro na query (ex: coluna inexistente em prod) → mostra mensagem de erro, não 'Nenhuma loja cadastrada'", async () => {
    mockFrom.mockReturnValue(
      chain({ data: null, error: { message: "column stores.onboarding_completed_at does not exist" } })
    );

    const html = renderToStaticMarkup(await AdminPage());

    expect(html).not.toContain("Nenhuma loja cadastrada");
    expect(html).toMatch(/erro/i);
  });

  it("query ok, zero lojas de fato → mantém 'Nenhuma loja cadastrada'", async () => {
    mockFrom.mockReturnValue(chain({ data: [], error: null }));

    const html = renderToStaticMarkup(await AdminPage());

    expect(html).toContain("Nenhuma loja cadastrada");
  });
});
