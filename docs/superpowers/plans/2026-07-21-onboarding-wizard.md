# Onboarding Wizard (Store Admin Self-Service) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a store admin (the person who bought Vex Auto) a first-run wizard that forces them to name their store, add a seller, optionally stock a vehicle, and connect WhatsApp — without any Vex engineer touching Meta Business Manager or the database on their behalf.

**Architecture:** A new `role: admin`-scoped self-service permission layer (three Server Actions parallel to the existing superadmin-only ones) plus a middleware-enforced `/onboarding` route gated by a single `stores.onboarding_completed_at` timestamp. Completion is derived from existing data (store has a name, ≥1 vendedor, a WhatsApp phone number ID) except for the one piece that can't be derived — whether the estoque step was explicitly deferred — which gets its own boolean column.

**Tech Stack:** Next.js 14 (App Router, Server Actions), Supabase (Postgres + Auth + RLS), Vitest.

## Global Constraints

- Every new mutation validates the caller's `store_id` server-side — never trust `store_id` from a form (spec: Edge Case 2).
- `stores.onboarding_completed_at`, once set, is never cleared automatically — only a superadmin can reset it manually (spec: Edge Case 5, 6).
- The WhatsApp step is manual guided entry (BL-0001 is on hold) — no Embedded Signup button in this plan.
- `role: vendedor` never sees the wizard steps, only a holding screen, while the store is incomplete (spec: Edge Case 4).
- Phase 2 (dismissible product tour) is explicitly **out of scope for this plan** — see "Scope Note" below.
- Follow existing repo conventions exactly: `"use server"` action files under `lib/`, `supabaseAdmin` (service role) for writes, session-respecting `createSupabaseServerClient()` for reads that should honor RLS, `vi.hoisted()` + `vi.mock()` test pattern, migrations as plain numbered `.sql` files under `supabase/migrations/`.

## Scope Note

The approved spec (`docs/superpowers/specs/2026-07-21-onboarding-wizard-design.md`) includes a Phase 2 "dismissible product tour" (spotlight overlay explaining Kanban/Leads/Analytics). This plan implements **Phase 1 only** — the mandatory setup gate, which is the part that unblocks self-serve onboarding. Phase 1 is independently shippable and valuable on its own (a store admin can already fully configure their store without a Vex engineer once this plan lands). Phase 2 is cosmetic polish with no functional dependency on Phase 1's internals beyond "onboarding_completed_at is now true" as its own trigger condition — it should be its own follow-up plan once Phase 1 has shipped and been used for real. Do not attempt to build Phase 2 as part of these tasks.

---

### Task 1: Migration — onboarding tracking columns

**Files:**
- Create: `supabase/migrations/021_onboarding_wizard.sql`

**Interfaces:**
- Produces: `public.stores.onboarding_completed_at` (timestamptz, nullable — `NULL` means the wizard still gates the store), `public.stores.estoque_wizard_skipped` (boolean, not null, default `false`)

- [ ] **Step 1: Write the migration file**

```sql
-- =============================================================================
-- Vex Auto  Migration 021 — Onboarding wizard tracking
-- =============================================================================
-- Adiciona rastreio de progresso do wizard de primeiro acesso (self-service).
--
-- onboarding_completed_at: NULL = wizard ainda travando a loja (middleware
-- redireciona pra /onboarding). Setado uma vez, nunca mais limpo automaticamente
-- (só reset manual por superadmin em /admin — ver lib/onboarding-actions.ts).
--
-- estoque_wizard_skipped: única parte do progresso que não dá pra derivar dos
-- dados existentes — zero veículos é ambíguo (nunca tentou vs. decidiu pular).
-- Os outros 3 passos (nome, vendedor, whatsapp) são derivados direto do estado
-- de `stores`/`users`/`vehicles` — ver lib/onboarding.ts.
-- =============================================================================

-- up

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS estoque_wizard_skipped boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.stores.onboarding_completed_at IS
  'NULL = wizard de primeiro acesso ainda pendente. Setado uma vez, permanente.';
COMMENT ON COLUMN public.stores.estoque_wizard_skipped IS
  'true = admin clicou "cadastrar depois" no passo de estoque do wizard.';

-- =============================================================================
-- down
-- =============================================================================
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS estoque_wizard_skipped;
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS onboarding_completed_at;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/021_onboarding_wizard.sql
git commit -m "feat(db): add stores.onboarding_completed_at + estoque_wizard_skipped (migration 021)"
```

Note: this migration needs to be applied to production via Supabase Dashboard or CLI after merge — same as migrations 017-020. Not automated in this repo (no automated migration-runner exists yet).

---

### Task 2: `assertStoreAdmin()` in `lib/auth.ts`

**Files:**
- Modify: `lib/auth.ts`
- Test: `tests/unit/auth.test.ts`

**Interfaces:**
- Consumes: `createSupabaseServerClient()` from `@/lib/supabase-server` (already imported in this file)
- Produces: `export class ForbiddenError extends Error`, `export async function assertStoreAdmin(): Promise<string>` — resolves to `store_id` of the caller if they are `role: admin` of that store; throws `AuthError` (no session), `StoreNotFoundError` (no `public.users` row), or `ForbiddenError` (row exists but `role !== "admin"`).

- [ ] **Step 1: Write the failing tests**

Add to the bottom of `tests/unit/auth.test.ts` (after the existing `getServerStoreId` describe block, same file, reusing the existing `mockCreateClient`/`mockGetUser`/`mockFrom` hoisted mocks — just extend the import line and add a new `mockUsersQueryWithRole` helper):

```typescript
// Replace the existing import line with:
import { getServerStoreId, assertStoreAdmin, AuthError, StoreNotFoundError, ForbiddenError } from "@/lib/auth";

// Add this helper near mockUsersQuery:
function mockUsersQueryWithRole(row: { store_id: string; role: string } | null) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ["select", "eq", "single"];
  for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: row, error: null });
  mockFrom.mockReturnValue(chain);
  return chain;
}

// Add this new describe block at the end of the file:
describe("assertStoreAdmin", () => {
  it("B1: usuário admin da loja → retorna store_id", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockUsersQueryWithRole({ store_id: "store-abc", role: "admin" });

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

  it("B6: consulta a tabela 'users' selecionando store_id e role", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const chain = mockUsersQueryWithRole({ store_id: "store-abc", role: "admin" });

    await assertStoreAdmin();

    expect(mockFrom).toHaveBeenCalledWith("users");
    expect(chain.select).toHaveBeenCalledWith("store_id, role");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- tests/unit/auth.test.ts`
Expected: FAIL — `assertStoreAdmin` and `ForbiddenError` are not exported from `@/lib/auth`.

- [ ] **Step 3: Implement `assertStoreAdmin` and `ForbiddenError`**

Modify `lib/auth.ts` — add after the existing `StoreNotFoundError` class and after the existing `getServerStoreId` function (append to end of file):

```typescript
export class ForbiddenError extends Error {
  constructor(message = "forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function assertStoreAdmin(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new AuthError();
  const { data } = await supabase
    .from("users")
    .select("store_id, role")
    .eq("id", user.id)
    .single();
  if (!data?.store_id) throw new StoreNotFoundError(user.id);
  if (data.role !== "admin") throw new ForbiddenError();
  return data.store_id as string;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- tests/unit/auth.test.ts`
Expected: PASS (all `getServerStoreId` tests plus the 6 new `assertStoreAdmin` tests, 15 total)

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts tests/unit/auth.test.ts
git commit -m "feat(auth): add assertStoreAdmin() for store-scoped self-service actions"
```

---

### Task 3: `lib/onboarding.ts` — pure step logic

**Files:**
- Create: `lib/onboarding.ts`
- Test: `tests/unit/onboarding.test.ts`

**Interfaces:**
- Produces: `export type OnboardingState = { nome: string | null; vendedorCount: number; vehicleCount: number; estoqueSkipped: boolean; whatsappPhoneNumberId: string | null }`, `export type OnboardingStep = "nome" | "vendedores" | "estoque" | "whatsapp" | "done"`, `export function nextOnboardingStep(state: OnboardingState): OnboardingStep`, `export function isOnboardingComplete(state: OnboardingState): boolean`
- Consumes (by later tasks): nothing — this is the leaf module.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/onboarding.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { nextOnboardingStep, isOnboardingComplete, type OnboardingState } from "@/lib/onboarding";

function state(overrides: Partial<OnboardingState> = {}): OnboardingState {
  return {
    nome: "Speed Motos",
    vendedorCount: 1,
    vehicleCount: 1,
    estoqueSkipped: false,
    whatsappPhoneNumberId: "123456",
    ...overrides,
  };
}

describe("nextOnboardingStep", () => {
  it("C1: sem nome → passo 'nome'", () => {
    expect(nextOnboardingStep(state({ nome: null }))).toBe("nome");
  });

  it("C2: nome vazio (whitespace) → passo 'nome'", () => {
    expect(nextOnboardingStep(state({ nome: "   " }))).toBe("nome");
  });

  it("C3: nome ok, zero vendedores → passo 'vendedores'", () => {
    expect(nextOnboardingStep(state({ vendedorCount: 0 }))).toBe("vendedores");
  });

  it("C4: nome + vendedor ok, zero veículos, não pulado → passo 'estoque'", () => {
    expect(nextOnboardingStep(state({ vehicleCount: 0, estoqueSkipped: false }))).toBe("estoque");
  });

  it("C5: zero veículos mas estoque pulado → avança pro whatsapp", () => {
    expect(
      nextOnboardingStep(state({ vehicleCount: 0, estoqueSkipped: true, whatsappPhoneNumberId: null }))
    ).toBe("whatsapp");
  });

  it("C6: tudo ok exceto whatsapp → passo 'whatsapp'", () => {
    expect(nextOnboardingStep(state({ whatsappPhoneNumberId: null }))).toBe("whatsapp");
  });

  it("C7: tudo completo → 'done'", () => {
    expect(nextOnboardingStep(state())).toBe("done");
  });

  it("C8: veículo existe mesmo sem ter sido pulado → conta como completo (passa pro whatsapp)", () => {
    expect(
      nextOnboardingStep(state({ vehicleCount: 3, estoqueSkipped: false, whatsappPhoneNumberId: null }))
    ).toBe("whatsapp");
  });
});

describe("isOnboardingComplete", () => {
  it("C9: retorna true quando nextOnboardingStep é 'done'", () => {
    expect(isOnboardingComplete(state())).toBe(true);
  });

  it("C10: retorna false quando falta qualquer passo", () => {
    expect(isOnboardingComplete(state({ nome: null }))).toBe(false);
    expect(isOnboardingComplete(state({ vendedorCount: 0 }))).toBe(false);
    expect(isOnboardingComplete(state({ vehicleCount: 0, estoqueSkipped: false }))).toBe(false);
    expect(isOnboardingComplete(state({ whatsappPhoneNumberId: null }))).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- tests/unit/onboarding.test.ts`
Expected: FAIL — `Cannot find module '@/lib/onboarding'`

- [ ] **Step 3: Implement `lib/onboarding.ts`**

```typescript
export type OnboardingState = {
  nome: string | null;
  vendedorCount: number;
  vehicleCount: number;
  estoqueSkipped: boolean;
  whatsappPhoneNumberId: string | null;
};

export type OnboardingStep = "nome" | "vendedores" | "estoque" | "whatsapp" | "done";

export function nextOnboardingStep(state: OnboardingState): OnboardingStep {
  if (!state.nome || state.nome.trim() === "") return "nome";
  if (state.vendedorCount < 1) return "vendedores";
  if (!state.estoqueSkipped && state.vehicleCount < 1) return "estoque";
  if (!state.whatsappPhoneNumberId) return "whatsapp";
  return "done";
}

export function isOnboardingComplete(state: OnboardingState): boolean {
  return nextOnboardingStep(state) === "done";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- tests/unit/onboarding.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/onboarding.ts tests/unit/onboarding.test.ts
git commit -m "feat(onboarding): add pure step-derivation logic (nextOnboardingStep)"
```

---

### Task 4: `lib/onboarding-actions.ts` — self-service Server Actions

**Files:**
- Create: `lib/onboarding-actions.ts`
- Test: `tests/unit/onboarding-actions.test.ts`

**Interfaces:**
- Consumes: `assertStoreAdmin` from `@/lib/auth` (Task 2), `nextOnboardingStep` from `@/lib/onboarding` (Task 3), `supabaseAdmin` from `@/lib/supabase`
- Produces: `export async function updateStoreNomeSelfService(formData: FormData): Promise<{ error: string } | { success: true }>`, `export async function createStoreVendedorSelfService(formData: FormData): Promise<{ error: string } | { success: true; email: string; password: string }>`, `export async function skipEstoqueOnboarding(): Promise<{ error: string } | { success: true }>`, `export async function updateStoreWhatsAppSelfService(formData: FormData): Promise<{ error: string } | { success: true }>`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/onboarding-actions.test.ts`:

```typescript
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
    const chain: Record<string, ReturnType<typeof vi.fn>> = {
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(cfg.select ?? { data: null, error: null }),
    };
    // update(...).eq(...) resolves directly (no .single() call in our actions)
    chain.eq = vi.fn().mockImplementation(() => {
      if (cfg.update !== undefined) return Promise.resolve(cfg.update);
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
        const chain: Record<string, ReturnType<typeof vi.fn>> = {
          update: vi.fn().mockImplementation((payload) => {
            capturedUpdate = payload;
            return chain;
          }),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation(() => {
            if (capturedUpdate) return Promise.resolve({ error: null });
            return Promise.resolve({
              data: { nome: "Speed Motos", whatsapp_phone_number_id: null, onboarding_completed_at: null, estoque_wizard_skipped: true },
              error: null,
            });
          }),
          single: vi.fn().mockResolvedValue({
            data: { nome: "Speed Motos", whatsapp_phone_number_id: null, onboarding_completed_at: null, estoque_wizard_skipped: true },
            error: null,
          }),
        };
        return chain;
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- tests/unit/onboarding-actions.test.ts`
Expected: FAIL — `Cannot find module '@/lib/onboarding-actions'`

- [ ] **Step 3: Implement `lib/onboarding-actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { assertStoreAdmin } from "@/lib/auth";
import { nextOnboardingStep } from "@/lib/onboarding";

const E164_REGEX = /^\+[1-9][0-9]{6,14}$/;

async function maybeStampOnboardingComplete(storeId: string): Promise<void> {
  const { data: store } = await supabaseAdmin
    .from("stores")
    .select("nome, whatsapp_phone_number_id, onboarding_completed_at, estoque_wizard_skipped")
    .eq("id", storeId)
    .single();

  if (!store || store.onboarding_completed_at) return;

  const { count: vendedorCount } = await supabaseAdmin
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("role", "vendedor");

  const { count: vehicleCount } = await supabaseAdmin
    .from("vehicles")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId);

  const step = nextOnboardingStep({
    nome: store.nome,
    vendedorCount: vendedorCount ?? 0,
    vehicleCount: vehicleCount ?? 0,
    estoqueSkipped: store.estoque_wizard_skipped,
    whatsappPhoneNumberId: store.whatsapp_phone_number_id,
  });

  if (step === "done") {
    await supabaseAdmin
      .from("stores")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("id", storeId);
  }
}

export async function updateStoreNomeSelfService(
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  const storeId = await assertStoreAdmin();
  const nome = ((formData.get("nome") as string | null) ?? "").trim();

  if (!nome) return { error: "Nome da loja é obrigatório" };

  const { error } = await supabaseAdmin.from("stores").update({ nome }).eq("id", storeId);
  if (error) return { error: error.message };

  await maybeStampOnboardingComplete(storeId);
  revalidatePath("/onboarding");
  return { success: true };
}

export async function createStoreVendedorSelfService(
  formData: FormData
): Promise<{ error: string } | { success: true; email: string; password: string }> {
  const storeId = await assertStoreAdmin();
  const email = ((formData.get("email") as string | null) ?? "").trim();
  const nome = ((formData.get("nome") as string | null) ?? "").trim();

  if (!email || !nome) return { error: "email e nome são obrigatórios" };

  const { randomBytes } = await import("crypto");
  const password = randomBytes(12).toString("base64url").slice(0, 16);

  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome },
  });

  if (authErr) return { error: authErr.message };
  if (!authData?.user?.id) return { error: "create_user_failed_no_id" };

  const { error: userErr } = await supabaseAdmin.from("users").insert({
    id: authData.user.id,
    store_id: storeId,
    nome,
    role: "vendedor",
  });

  if (userErr) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id).catch(() => {
      console.error("rollback_failed: orphan auth user", authData.user.id.slice(-8));
    });
    return { error: userErr.message };
  }

  await maybeStampOnboardingComplete(storeId);
  revalidatePath("/onboarding");
  return { success: true, email, password };
}

export async function skipEstoqueOnboarding(): Promise<{ error: string } | { success: true }> {
  const storeId = await assertStoreAdmin();

  const { error } = await supabaseAdmin
    .from("stores")
    .update({ estoque_wizard_skipped: true })
    .eq("id", storeId);

  if (error) return { error: error.message };

  await maybeStampOnboardingComplete(storeId);
  revalidatePath("/onboarding");
  return { success: true };
}

export async function updateStoreWhatsAppSelfService(
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  const storeId = await assertStoreAdmin();
  const phoneNumberId = ((formData.get("whatsapp_phone_number_id") as string | null) ?? "").trim();
  const whatsappNumero = ((formData.get("whatsapp_numero") as string | null) ?? "").trim();

  if (!phoneNumberId) return { error: "Phone Number ID é obrigatório" };
  if (!whatsappNumero) return { error: "Número de WhatsApp é obrigatório" };
  if (!E164_REGEX.test(whatsappNumero)) {
    return { error: "formato inválido: use +55DDD9XXXXXXXX (E.164)" };
  }

  const { error } = await supabaseAdmin
    .from("stores")
    .update({ whatsapp_phone_number_id: phoneNumberId, whatsapp_numero: whatsappNumero })
    .eq("id", storeId);

  if (error) return { error: error.message };

  await maybeStampOnboardingComplete(storeId);
  revalidatePath("/onboarding");
  return { success: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- tests/unit/onboarding-actions.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/onboarding-actions.ts tests/unit/onboarding-actions.test.ts
git commit -m "feat(onboarding): add store-admin self-service actions (nome, vendedor, estoque skip, whatsapp)"
```

---

### Task 5: Middleware — gate incomplete stores into `/onboarding`

**Files:**
- Modify: `middleware.ts`
- Test: `tests/unit/middleware.test.ts`

**Interfaces:**
- Consumes: nothing new (uses the same `createServerClient` from `@supabase/ssr` already used in this file)
- Produces: redirect behavior — any authenticated request to a matched route, from a user whose store has `onboarding_completed_at IS NULL`, is redirected to `/onboarding` (except admin routes and `/onboarding` itself).

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/middleware.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const { mockCreateServerClient, mockGetUser, mockFrom } = vi.hoisted(() => ({
  mockCreateServerClient: vi.fn(),
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mockCreateServerClient,
}));

import { middleware } from "@/middleware";

function req(path: string): NextRequest {
  return new NextRequest(new URL(`http://localhost${path}`));
}

function mockProfile(row: { store_id: string | null; stores: { onboarding_completed_at: string | null } | null } | null) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ["select", "eq", "single"];
  for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: row, error: null });
  mockFrom.mockReturnValue(chain);
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  process.env.ADMIN_EMAILS = "vex@vexauto.com.br";
  mockCreateServerClient.mockReturnValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  delete process.env.ADMIN_EMAILS;
});

describe("middleware — onboarding gate", () => {
  it("E1: sem usuário → redireciona pro /login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await middleware(req("/leads"));

    expect(res.headers.get("location")).toContain("/login");
  });

  it("E2: rota admin, email fora de ADMIN_EMAILS → redireciona /acesso-restrito, não checa onboarding", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "outro@x.com" } }, error: null });

    const res = await middleware(req("/admin"));

    expect(res.headers.get("location")).toContain("/acesso-restrito");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("E3: loja com onboarding pendente → redireciona pro /onboarding", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "dono@x.com" } }, error: null });
    mockProfile({ store_id: "store-1", stores: { onboarding_completed_at: null } });

    const res = await middleware(req("/leads"));

    expect(res.headers.get("location")).toContain("/onboarding");
  });

  it("E4: loja com onboarding completo → não redireciona", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "dono@x.com" } }, error: null });
    mockProfile({ store_id: "store-1", stores: { onboarding_completed_at: "2026-07-21T00:00:00Z" } });

    const res = await middleware(req("/leads"));

    expect(res.headers.get("location")).toBeNull();
  });

  it("E5: já está em /onboarding → não redireciona de novo (sem loop)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "dono@x.com" } }, error: null });

    const res = await middleware(req("/onboarding"));

    expect(res.headers.get("location")).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("E6: usuário sem linha em public.users (ex: superadmin puro) → não redireciona pro /onboarding", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "dono@x.com" } }, error: null });
    mockProfile(null);

    const res = await middleware(req("/leads"));

    expect(res.headers.get("location")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- tests/unit/middleware.test.ts`
Expected: FAIL — no onboarding redirect logic exists yet, tests E3/E5/E6 fail (E1/E2/E4 may already pass against the current middleware).

- [ ] **Step 3: Implement the onboarding gate in `middleware.ts`**

Replace the full contents of `middleware.ts` with:

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const path = request.nextUrl.pathname;
  const isAdminRoute = path === "/admin" || path.startsWith("/admin/");
  const isOnboardingRoute = path === "/onboarding";

  if (isAdminRoute) {
    // Inlined — cannot import lib/admin-auth.ts here (Edge Runtime, no Node.js APIs).
    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const userEmail = user.email?.toLowerCase() ?? "";
    if (!adminEmails.includes(userEmail)) {
      return NextResponse.redirect(new URL("/acesso-restrito", request.url));
    }
  } else if (!isOnboardingRoute) {
    const { data: profile } = await supabase
      .from("users")
      .select("store_id, stores(onboarding_completed_at)")
      .eq("id", user.id)
      .single();

    const storeRel = (profile as { stores?: unknown } | null)?.stores;
    const store = Array.isArray(storeRel) ? storeRel[0] : storeRel;
    const onboardingDone = (store as { onboarding_completed_at?: string | null } | undefined)
      ?.onboarding_completed_at != null;

    if (profile?.store_id && !onboardingDone) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/leads/:path*",
    "/conversations/:path*",
    "/estoque/:path*",
    "/equipe/:path*",
    "/analytics/:path*",
    "/inicio/:path*",
    "/onboarding",
    "/admin",
    "/admin/:path*",
  ],
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- tests/unit/middleware.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add middleware.ts tests/unit/middleware.test.ts
git commit -m "feat(middleware): redirect incomplete stores to /onboarding"
```

---

### Task 6: Superadmin reset control — `resetStoreOnboarding`

**Files:**
- Modify: `app/admin/actions.ts`
- Test: `tests/unit/admin-actions.test.ts`

**Interfaces:**
- Consumes: `assertSuperAdmin` (already imported in this file), `supabaseAdmin` (already imported)
- Produces: `export async function resetStoreOnboarding(storeId: string): Promise<{ error: string } | { success: true }>`

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/admin-actions.test.ts` (extend the existing import line and add a new describe block at the end of the file, reusing the existing `mockFrom`/`mockAssertSuperAdmin`/`mockRevalidatePath` hoisted mocks and `chain()` helper already defined in this file):

```typescript
// Replace the existing import line with:
import { createStore, updateStore, createStoreUser, createStoreUserDirect, resetStoreOnboarding, type CreateStoreState } from "@/app/admin/actions";

// Add at the end of the file:
describe("resetStoreOnboarding", () => {
  it("F1: superadmin reseta onboarding_completed_at pra null", async () => {
    mockAssertSuperAdmin.mockResolvedValue("admin-id");
    const c = chain({ update: { error: null } });

    const result = await resetStoreOnboarding("store-1");

    expect(result).toEqual({ success: true });
    expect(c.update).toHaveBeenCalledWith({ onboarding_completed_at: null });
    expect(c.eq).toHaveBeenCalledWith("id", "store-1");
  });

  it("F2: erro do banco → retorna { error }", async () => {
    mockAssertSuperAdmin.mockResolvedValue("admin-id");
    chain({ update: { error: { message: "db down" } } });

    const result = await resetStoreOnboarding("store-1");

    expect(result).toEqual({ error: "db down" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- tests/unit/admin-actions.test.ts`
Expected: FAIL — `resetStoreOnboarding` is not exported from `@/app/admin/actions`.

- [ ] **Step 3: Implement `resetStoreOnboarding`**

Add to the end of `app/admin/actions.ts`:

```typescript
export async function resetStoreOnboarding(
  storeId: string
): Promise<{ error: string } | { success: true }> {
  await assertSuperAdmin();

  const { error } = await supabaseAdmin
    .from("stores")
    .update({ onboarding_completed_at: null })
    .eq("id", storeId);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- tests/unit/admin-actions.test.ts`
Expected: PASS (all existing tests plus the 2 new ones)

- [ ] **Step 5: Commit**

```bash
git add app/admin/actions.ts tests/unit/admin-actions.test.ts
git commit -m "feat(admin): add resetStoreOnboarding for support use (unstick a store's wizard)"
```

---

### Task 7: `/onboarding` page — the wizard itself

**Files:**
- Create: `app/onboarding/page.tsx`
- Create: `app/onboarding/VendedorStepForm.tsx`
- Modify: `app/components/Header.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `updateStoreNomeSelfService`, `createStoreVendedorSelfService`, `skipEstoqueOnboarding`, `updateStoreWhatsAppSelfService` (Task 4), `createVehicle` from `@/lib/vehicle-actions` (already exists), `nextOnboardingStep`/`OnboardingState` from `@/lib/onboarding` (Task 3), `createSupabaseServerClient` from `@/lib/supabase-server`, `getServerStoreId` from `@/lib/auth`
- Produces: the `/onboarding` route. Nothing later depends on exports from this file — it is a leaf page.

This task is UI code with no automated test (matches the existing convention: `app/estoque/page.tsx` and `app/admin/page.tsx` have no direct page-level tests either — only the actions they call are unit-tested, which Tasks 2-6 already cover). Verify manually per Step 4 below.

- [ ] **Step 1: Add wizard CSS to `app/globals.css`**

Append to the end of `app/globals.css`:

```css
/* ─── Onboarding wizard ──────────────────────── */
.onboarding-shell {
  min-height: calc(100vh - 56px);
  display: flex; align-items: center; justify-content: center;
  padding: 32px 16px;
}
.onboarding-card {
  background: var(--panel); border: 1px solid var(--border); border-radius: 12px;
  box-shadow: 0 4px 24px rgba(28,43,58,.08);
  padding: 32px; width: 100%; max-width: 480px;
}
.onboarding-step-label {
  font-size: 11px; font-weight: 700; color: var(--muted);
  text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px;
}
.onboarding-title { font-size: 20px; font-weight: 800; font-style: italic; color: var(--text-strong); margin-bottom: 8px; }
.onboarding-desc { font-size: 13px; color: var(--muted); margin-bottom: 20px; line-height: 1.5; }
.onboarding-progress { display: flex; gap: 6px; margin-bottom: 24px; }
.onboarding-progress-dot { flex: 1; height: 4px; border-radius: 999px; background: var(--border); }
.onboarding-progress-dot.done { background: var(--accent); }
.onboarding-holding { text-align: center; padding: 40px 20px; color: var(--muted); font-size: 13.5px; }
```

- [ ] **Step 2: Hide the app Header on `/onboarding`**

Modify `app/components/Header.tsx` — add a pathname check right after the existing `const pathname = usePathname();` line (do not remove any existing hooks, since `dropRef`'s `useEffect` must still run unconditionally on every render per the Rules of Hooks — only the returned JSX is conditional):

```typescript
export function Header({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  async function handleLogout() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    router.push("/login");
  }

  useEffect(() => {
    if (!dropOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropOpen]);

  if (pathname === "/onboarding") return null;

  return (
```

(The rest of the function body — the `return (<header>...)` JSX — is unchanged.)

- [ ] **Step 3: Create `app/onboarding/VendedorStepForm.tsx`**

```typescript
"use client";

import { useFormState } from "react-dom";
import { createStoreVendedorSelfService } from "@/lib/onboarding-actions";

export function VendedorStepForm() {
  const [state, formAction] = useFormState(createStoreVendedorSelfService, null);

  if (state && "success" in state && state.success) {
    return (
      <div className="import-feedback success" style={{ display: "block", marginBottom: "16px" }}>
        <p style={{ fontWeight: 700, marginBottom: "4px" }}>Vendedor criado com sucesso</p>
        <p>Email: <code>{state.email}</code></p>
        <p>Senha temporária: <code style={{ fontWeight: 700 }}>{state.password}</code></p>
        <p style={{ fontSize: "11.5px", marginTop: "6px" }}>
          Copie a senha agora e envie pro vendedor — ela não aparece de novo.
        </p>
        <a href="/onboarding" className="card-cta" style={{ display: "inline-block", marginTop: "12px" }}>
          Continuar →
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="import-form">
      <div className="import-row">
        <div className="import-field">
          <label className="import-label">Nome do vendedor</label>
          <input name="nome" required className="import-input" placeholder="Ex: Maria Silva" />
        </div>
        <div className="import-field">
          <label className="import-label">Email</label>
          <input name="email" type="email" required className="import-input" placeholder="maria@speedmotos.com" />
        </div>
      </div>
      {state && "error" in state && (
        <div className="import-feedback error">{state.error}</div>
      )}
      <div className="import-actions">
        <button type="submit">Cadastrar vendedor</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Create `app/onboarding/page.tsx`**

```typescript
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getServerStoreId } from "@/lib/auth";
import { nextOnboardingStep } from "@/lib/onboarding";
import {
  updateStoreNomeSelfService,
  skipEstoqueOnboarding,
  updateStoreWhatsAppSelfService,
} from "@/lib/onboarding-actions";
import { createVehicle } from "@/lib/vehicle-actions";
import { VendedorStepForm } from "./VendedorStepForm";

type PageProps = { searchParams?: { erro?: string } };

const STEP_ORDER = ["nome", "vendedores", "estoque", "whatsapp"] as const;

async function handleNome(formData: FormData) {
  "use server";
  const result = await updateStoreNomeSelfService(formData);
  if ("error" in result) {
    redirect(`/onboarding?erro=${encodeURIComponent(result.error)}`);
  }
  redirect("/onboarding");
}

async function handleEstoqueCreate(formData: FormData) {
  "use server";
  try {
    await createVehicle(formData);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao cadastrar veículo";
    redirect(`/onboarding?erro=${encodeURIComponent(message)}`);
  }
  redirect("/onboarding");
}

async function handleEstoqueSkip() {
  "use server";
  await skipEstoqueOnboarding();
  redirect("/onboarding");
}

async function handleWhatsApp(formData: FormData) {
  "use server";
  const result = await updateStoreWhatsAppSelfService(formData);
  if ("error" in result) {
    redirect(`/onboarding?erro=${encodeURIComponent(result.error)}`);
  }
  redirect("/onboarding");
}

export default async function OnboardingPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const storeId = await getServerStoreId();

  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .single();

  const { data: store } = await supabase
    .from("stores")
    .select("nome, whatsapp_phone_number_id, onboarding_completed_at, estoque_wizard_skipped")
    .eq("id", storeId)
    .single();

  if (store?.onboarding_completed_at) {
    return (
      <main className="onboarding-shell">
        <div className="onboarding-card">
          <div className="onboarding-title">Tudo certo</div>
          <div className="onboarding-desc">A configuração da sua loja já está completa.</div>
          <a href="/leads" className="card-cta">Ir para o painel →</a>
        </div>
      </main>
    );
  }

  if (userRow?.role !== "admin") {
    return (
      <main className="onboarding-shell">
        <div className="onboarding-card">
          <div className="onboarding-holding">
            Aguardando o administrador da loja terminar a configuração inicial.
            <br />
            Você poderá acessar o sistema assim que essa etapa for concluída.
          </div>
        </div>
      </main>
    );
  }

  const { count: vendedorCount } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("role", "vendedor");

  const { count: vehicleCount } = await supabase
    .from("vehicles")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId);

  const step = nextOnboardingStep({
    nome: store?.nome ?? null,
    vendedorCount: vendedorCount ?? 0,
    vehicleCount: vehicleCount ?? 0,
    estoqueSkipped: store?.estoque_wizard_skipped ?? false,
    whatsappPhoneNumberId: store?.whatsapp_phone_number_id ?? null,
  });

  const stepIndex = STEP_ORDER.indexOf(step as (typeof STEP_ORDER)[number]);
  const erro = searchParams?.erro;

  return (
    <main className="onboarding-shell">
      <div className="onboarding-card">
        <div className="onboarding-progress">
          {STEP_ORDER.map((s, i) => (
            <div key={s} className={`onboarding-progress-dot${i < stepIndex ? " done" : ""}`} />
          ))}
        </div>

        {erro && <div className="import-feedback error" style={{ marginBottom: "16px" }}>{erro}</div>}

        {step === "nome" && (
          <>
            <div className="onboarding-step-label">Passo 1 de 4</div>
            <div className="onboarding-title">Como se chama sua loja?</div>
            <div className="onboarding-desc">
              Esse nome aparece pro seu time dentro do sistema. Você pode mudar depois.
            </div>
            <form action={handleNome} className="import-form">
              <div className="import-field">
                <input name="nome" required defaultValue={store?.nome ?? ""} className="import-input" placeholder="Ex: Speed Motos" />
              </div>
              <div className="import-actions">
                <button type="submit">Próximo</button>
              </div>
            </form>
          </>
        )}

        {step === "vendedores" && (
          <>
            <div className="onboarding-step-label">Passo 2 de 4</div>
            <div className="onboarding-title">Cadastre pelo menos um vendedor</div>
            <div className="onboarding-desc">
              Cada vendedor recebe login próprio e só vê os leads da sua loja.
            </div>
            <VendedorStepForm />
          </>
        )}

        {step === "estoque" && (
          <>
            <div className="onboarding-step-label">Passo 3 de 4</div>
            <div className="onboarding-title">Cadastre um veículo (opcional)</div>
            <div className="onboarding-desc">
              Pode fazer isso agora ou depois — o sistema funciona mesmo com o estoque vazio.
            </div>
            <form action={handleEstoqueCreate} className="import-form">
              <div className="import-row">
                <div className="import-field">
                  <label className="import-label">Marca</label>
                  <input name="marca" required className="import-input" placeholder="Ex: Honda" />
                </div>
                <div className="import-field">
                  <label className="import-label">Modelo</label>
                  <input name="modelo" required className="import-input" placeholder="Ex: Civic" />
                </div>
              </div>
              <div className="import-row">
                <div className="import-field">
                  <label className="import-label">Ano</label>
                  <input name="ano" type="number" required min={1900} max={2100} defaultValue={new Date().getFullYear()} className="import-input" />
                </div>
                <div className="import-field">
                  <label className="import-label">Preço</label>
                  <input name="preco" type="number" step="0.01" required className="import-input" placeholder="89000" />
                </div>
                <div className="import-field">
                  <label className="import-label">Custo</label>
                  <input name="custo" type="number" step="0.01" required className="import-input" placeholder="75000" />
                </div>
              </div>
              <div className="import-actions">
                <button type="submit">Cadastrar veículo</button>
              </div>
            </form>
            <form action={handleEstoqueSkip} style={{ marginTop: "12px" }}>
              <button type="submit" className="card-cta" style={{ background: "none", border: "1px solid var(--border)", cursor: "pointer" }}>
                Cadastrar depois
              </button>
            </form>
          </>
        )}

        {step === "whatsapp" && (
          <>
            <div className="onboarding-step-label">Passo 4 de 4</div>
            <div className="onboarding-title">Conecte o WhatsApp da loja</div>
            <div className="onboarding-desc">
              Vá em <a href="https://business.facebook.com/" target="_blank" rel="noreferrer">business.facebook.com</a>,
              verifique sua empresa, gere um token permanente e registre o número real da loja.
              Cole o Phone Number ID e o número abaixo quando terminar.
            </div>
            <form action={handleWhatsApp} className="import-form">
              <div className="import-field">
                <label className="import-label">Phone Number ID</label>
                <input name="whatsapp_phone_number_id" required className="import-input" placeholder="123456789012345" />
              </div>
              <div className="import-field">
                <label className="import-label">Número (E.164)</label>
                <input name="whatsapp_numero" required className="import-input" placeholder="+5511999999999" />
              </div>
              <div className="import-actions">
                <button type="submit">Concluir configuração</button>
              </div>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Manual verification**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run dev`, then as a store admin whose store has `onboarding_completed_at IS NULL`:
1. Visit `/leads` → confirm redirect to `/onboarding`, no Header visible.
2. Fill store name → confirm advance to vendedor step, progress dots update.
3. Add a vendedor → confirm password shown once, click "Continuar" → advance to estoque step.
4. Click "Cadastrar depois" on estoque → confirm advance to WhatsApp step (skipping estoque).
5. Fill WhatsApp fields → confirm redirect to `/leads` works afterward (onboarding now complete, Header visible again).
6. Log in as the vendedor created in step 3 before WhatsApp step is done → confirm holding screen, not the wizard.

- [ ] **Step 6: Commit**

```bash
git add app/onboarding/page.tsx app/onboarding/VendedorStepForm.tsx app/components/Header.tsx app/globals.css
git commit -m "feat(onboarding): add self-service first-run wizard UI"
```

---

### Task 8: Admin panel — show onboarding status + reset button per store

**Files:**
- Modify: `app/admin/page.tsx`

**Interfaces:**
- Consumes: `resetStoreOnboarding` from `./actions` (Task 6)

This task is UI code with no automated test, same rationale as Task 7 — `resetStoreOnboarding` itself is already unit-tested (Task 6). The file's real current structure (verified by reading `app/admin/page.tsx` during planning): a `Store` type at the top, a `supabaseAdmin.from("stores").select(...)` query, and a `.map((store) => ...)` loop rendering Tailwind-ish utility classNames (no Tailwind is actually configured in this project, so these classes render unstyled — a pre-existing cosmetic issue in this admin-only internal panel, out of scope to fix here; match the existing convention rather than introduce a different styling approach in the same file).

- [ ] **Step 1: Add the import and extend the `Store` type**

In `app/admin/page.tsx`, change line 3 from:

```typescript
import { updateStore, createStoreUser } from "./actions";
```

to:

```typescript
import { updateStore, createStoreUser, resetStoreOnboarding } from "./actions";
```

Change the `Store` type (currently lines 12-20):

```typescript
type Store = {
  id: string;
  nome: string;
  whatsapp_numero: string;
  whatsapp_phone_number_id: string | null;
  active: boolean;
  created_at: string;
  users: StoreUser[] | null;
};
```

to:

```typescript
type Store = {
  id: string;
  nome: string;
  whatsapp_numero: string;
  whatsapp_phone_number_id: string | null;
  active: boolean;
  created_at: string;
  onboarding_completed_at: string | null;
  users: StoreUser[] | null;
};
```

- [ ] **Step 2: Select the new column**

Change the query (currently lines 25-30):

```typescript
  const { data: stores } = await supabaseAdmin
    .from("stores")
    .select(
      "id, nome, whatsapp_numero, whatsapp_phone_number_id, active, created_at, users(id, nome, role)"
    )
    .order("nome");
```

to:

```typescript
  const { data: stores } = await supabaseAdmin
    .from("stores")
    .select(
      "id, nome, whatsapp_numero, whatsapp_phone_number_id, active, created_at, onboarding_completed_at, users(id, nome, role)"
    )
    .order("nome");
```

- [ ] **Step 3: Add the onboarding badge next to the existing badges**

The existing badge row (currently lines 59-90) ends with the "usuários" badge closing `</span>` right before the closing `</div>` of the `flex items-center gap-2 flex-wrap` row. Add a fourth badge immediately after that "usuários" `</span>` (still inside the same `flex items-center gap-2 flex-wrap` div, so it wraps onto the same badge row):

```typescript
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        s.onboarding_completed_at
                          ? "bg-green-100 text-green-800"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {s.onboarding_completed_at ? "Onboarding completo" : "Onboarding pendente"}
                    </span>
```

- [ ] **Step 4: Add the reset button**

Find this exact closing sequence (the end of the "Editar configurações" block, right after the `updateStore` form's "Salvar" button):

```typescript
                    <button
                      type="submit"
                      className="bg-black text-white rounded px-4 py-1.5 text-sm font-medium"
                    >
                      Salvar
                    </button>
                  </form>
                </div>
              </details>

              {/* Criar usuário com convite */}
```

Insert a new `<details>` block between the `</details>` and the `{/* Criar usuário com convite */}` comment, only rendered when onboarding is still pending:

```typescript
              {!s.onboarding_completed_at && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-orange-600 hover:underline list-none">
                    Resetar onboarding (suporte)
                  </summary>
                  <div className="mt-3 border-t pt-3">
                    <p className="text-xs text-gray-500 mb-2">
                      Loja ainda não terminou o wizard de primeiro acesso. Isso é normal
                      logo após a criação — só use o botão abaixo se o cliente relatou
                      estar travado e você confirmou o motivo.
                    </p>
                    <form action={resetStoreOnboarding.bind(null, s.id) as unknown as FormAction}>
                      <button
                        type="submit"
                        className="bg-orange-600 text-white rounded px-4 py-1.5 text-sm font-medium"
                      >
                        Resetar onboarding
                      </button>
                    </form>
                  </div>
                </details>
              )}
```

- [ ] **Step 5: Manual verification**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run dev`, log in as superadmin, visit `/admin`:
1. Confirm each store shows an onboarding status badge.
2. For a store with pending onboarding, click "Resetar onboarding" — confirm no error (harmless no-op if it was already `NULL`).
3. Manually set a test store's `onboarding_completed_at` via Supabase dashboard, reload `/admin`, confirm badge switches to "Onboarding completo", click reset, confirm it flips back to pending and that store's admin gets redirected to `/onboarding` again on next request.

- [ ] **Step 6: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat(admin): show onboarding status per store, allow superadmin reset"
```

---

### Task 9: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit test suite**

Run: `npm run test:unit`
Expected: all tests pass, including the 4 new/extended files from Tasks 2, 3, 4, 5, 6.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: zero warnings/errors (per `next lint --max-warnings 0`).

- [ ] **Step 4: Run the full test suite (unit + integration)**

Run: `npm run test`
Expected: all pass. (Integration tests hit a real Supabase instance per `tests/README.md` conventions already established in this repo — no new integration test is added by this plan; existing ones should be unaffected since no shared table/RLS policy used by them was touched.)

- [ ] **Step 5: Apply migration 021 to production**

This is a manual, non-automated step (same as migrations 017-020): apply `supabase/migrations/021_onboarding_wizard.sql` via Supabase Dashboard SQL editor or `supabase db push`, against the production project. Confirm via read-only query that `stores.onboarding_completed_at` and `stores.estoque_wizard_skipped` exist before considering this plan done.

- [ ] **Step 6: Update `docs/vex/27_PROJECT_STATUS.md` and `docs/vex/28_BACKLOG.md`**

Mark the onboarding wizard as shipped in `27_PROJECT_STATUS.md` (RECENT COMPLETED WORK section) and update the spec's status line in `docs/superpowers/specs/2026-07-21-onboarding-wizard-design.md` from `Approved` to `Implemented`.

- [ ] **Step 7: Final commit**

```bash
git add docs/vex/27_PROJECT_STATUS.md docs/superpowers/specs/2026-07-21-onboarding-wizard-design.md
git commit -m "docs(vex): mark onboarding wizard (Phase 1) as implemented"
```
