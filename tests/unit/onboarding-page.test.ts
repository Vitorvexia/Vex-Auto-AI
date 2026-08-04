import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted() — refs compartilhados nas factories dos vi.mock()
// ---------------------------------------------------------------------------

const { mockGetUser, mockFrom, mockRedirect } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockRedirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/supabase-server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("@/app/components/OnboardingWizard", () => ({
  OnboardingWizard: () => null,
}));

process.env.ADMIN_EMAILS = "vex@vexauto.com.br";

// ---------------------------------------------------------------------------
// Import após mocks
// ---------------------------------------------------------------------------

import OnboardingPage from "@/app/onboarding/page";

const STORE_ROW = {
  nome: "Speed Motos",
  whatsapp_phone_number_id: null,
  onboarding_completed_at: null,
  estoque_wizard_skipped: false,
};

function delayed<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// Simula o query builder do supabase-js: .select().eq().single() (single row)
// ou .select().eq().eq() sem .single() (count:exact,head:true — thenable direto).
function chainResolving(result: unknown, delayMs = 0) {
  const promise = delayMs > 0 ? delayed(result, delayMs) : Promise.resolve(result);
  const c: Record<string, unknown> = {
    select: vi.fn(() => c),
    eq: vi.fn(() => c),
    single: vi.fn(() => promise),
    then: promise.then.bind(promise),
  };
  return c;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "dono@x.com" } } });
});

describe("OnboardingPage — resolução consolidada de role/store_id + paralelização", () => {
  it("super_admin: redireciona /inicio SEM consultar public.users (mesmo atalho por e-mail de antes)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "vex@vexauto.com.br" } } });

    await expect(OnboardingPage()).rejects.toThrow("REDIRECT:/inicio");

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("dono_loja: role+store_id resolvidos numa ÚNICA query combinada (select conjunto, não 2 selects separados)", async () => {
    const usersSelectCalls: unknown[][] = [];

    mockFrom.mockImplementation((table: string) => {
      if (table === "users") {
        const c = chainResolving({ data: { role: "dono_loja", store_id: "store-1" }, error: null });
        const originalSelect = c.select as ReturnType<typeof vi.fn>;
        c.select = vi.fn((...args: unknown[]) => {
          usersSelectCalls.push(args);
          return originalSelect(...args);
        });
        return c;
      }
      if (table === "stores") {
        return chainResolving({ data: STORE_ROW, error: null });
      }
      return chainResolving({ count: 0, error: null });
    });

    await OnboardingPage();

    // Exatamente 1 select que traz role+store_id JUNTOS — padrão antigo fazia
    // 2 chamadas separadas (uma só "role", outra só "store_id"), cada uma com
    // seu próprio auth.getUser() por trás (getServerUserRole + getServerStoreId).
    const combined = usersSelectCalls.filter(
      (args) => typeof args[0] === "string" && args[0].includes("role") && args[0].includes("store_id")
    );
    expect(combined.length).toBe(1);
  });

  it("vendedor: redireciona /inicio (comportamento preservado)", async () => {
    mockFrom.mockImplementation(() =>
      chainResolving({ data: { role: "vendedor", store_id: "store-1" }, error: null })
    );

    await expect(OnboardingPage()).rejects.toThrow("REDIRECT:/inicio");
  });

  it("as 3 queries independentes (stores, vendedorCount, vehicleCount) rodam em paralelo, não em série", async () => {
    let usersCalls = 0;

    mockFrom.mockImplementation((table: string) => {
      if (table === "users") {
        usersCalls += 1;
        if (usersCalls === 1) {
          // profile — resolução obrigatoriamente sequencial (precisa do
          // store_id antes de disparar o resto), por isso sem delay
          return chainResolving({ data: { role: "dono_loja", store_id: "store-1" }, error: null });
        }
        // vendedorCount
        return chainResolving({ count: 0, error: null }, 60);
      }
      if (table === "stores") {
        return chainResolving({ data: STORE_ROW, error: null }, 60);
      }
      // vehicles (vehicleCount)
      return chainResolving({ count: 0, error: null }, 60);
    });

    const start = Date.now();
    await OnboardingPage();
    const elapsed = Date.now() - start;

    // Sequencial seria >= 180ms (3 x 60ms); paralelo (Promise.all) fica perto
    // de 60-90ms — margem generosa pra não ser flaky em CI mais lento.
    expect(elapsed).toBeLessThan(150);
  });
});
