# RBAC (0.3) — Travar Reatribuição de Lead por Perfil — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Formalizar 3 níveis de perfil (`super_admin`, `dono_loja`, `vendedor`) e travar reatribuição de lead (`assignLeadToUser`/`removeLeadAssignment`) por role, fechando a dívida documentada em `docs/vex/27_PROJECT_STATUS.md` sem tocar em visibilidade de lead (fora de escopo, ver DL-0008).

**Architecture:** `users.role` já existe (migration 001) com valores `'admin'`/`'vendedor'` — renomeia-se `'admin'` → `'dono_loja'` (schema + dados). `super_admin` continua 100% via `ADMIN_EMAILS`/`isSuperAdmin()` (nenhuma linha em `users`). Novo helper `getServerUserRole()` (`lib/auth.ts`) é a fonte única de verdade: prioriza `isSuperAdmin(email)`, senão lê `users.role`. Guard em código (não UI) nas 2 Server Actions de reatribuição.

**Tech Stack:** Next.js Server Actions, Supabase (Postgres + `supabase-js`), Vitest + `@testing-library/react` (jsdom) para o componente.

## Global Constraints

- Migration `026_rename_admin_to_dono_loja.sql` **já foi executada manualmente em produção** (2026-07-29, confirmado via query read-only: 3 usuários `role='admin'` → `role='dono_loja'`, 2 `role='vendedor'` intocados). Task 1 só registra o arquivo no repo — não reaplicar via `supabase db push`.
- **Janela de risco já aberta enquanto este plano não for deployado:** o banco de produção já só aceita `role IN ('dono_loja','vendedor')` (constraint nova já ativa), mas o código ainda deployado hoje oferece `'admin'` como opção no onboarding (`app/admin/actions.ts`, `DirectUserForm.tsx`). Se alguém tentar cadastrar um novo dono_loja via `/admin` **antes** deste deploy, o insert falha (constraint rejeita `'admin'`) — erro visível na UI do onboarding, sem impacto em usuários existentes. Mitigação: nenhuma ação adicional necessária além de deployar esta mudança com prioridade normal (não é uma migration pendente — é o código que está atrasado em relação ao banco). Ver seção "Passos manuais" no final.
- **Direção inversa (código novo encontrando dado antigo) não é um risco real:** o guard novo usa deny-list (`role === "vendedor"` bloqueia, qualquer outro valor passa). Um valor legado `'admin'` (se existisse) passaria pelo guard exatamente como `'dono_loja'` passa — fail-open, não fail-closed. Não há cenário de usuário `admin` legado ficando incorretamente bloqueado.
- Toda a suíte (`npm run test`) deve continuar em 700+ testes verdes; `npm run lint` e `npm run typecheck` limpos antes de cada commit (mesmo hook de pre-push do projeto).
- Mensagens de erro voltadas ao usuário: português, mesmo tom do resto do projeto (ver `lib/actions.ts` existente).

---

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `supabase/migrations/026_rename_admin_to_dono_loja.sql` | Criar | Registro no repo do rename já aplicado em produção |
| `lib/auth.ts` | Modificar | Novo `UserRole` type + `getServerUserRole()` |
| `tests/unit/auth.test.ts` | Modificar | Testes de `getServerUserRole()` |
| `lib/actions.ts` | Modificar | Guard de role em `assignLeadToUser`/`removeLeadAssignment` |
| `tests/unit/assigned-to-actions.test.ts` | Modificar | Testes dos 3 níveis de role nas 2 actions |
| `app/admin/actions.ts` | Modificar | `'admin'` → `'dono_loja'` na validação de role |
| `app/admin/DirectUserForm.tsx` | Modificar | `'admin'` → `'dono_loja'` no `<option>` |
| `app/equipe/page.tsx` | Modificar | `'admin'` → `'dono_loja'` na exibição |
| `tests/unit/admin-actions.test.ts` | Modificar | `role: "admin"` → `role: "dono_loja"` nos fixtures |
| `app/leads/page.tsx` | Modificar | Calcula `canReassign` via `getServerUserRole()`, passa pro `LeadCard` |
| `app/components/LeadCard.tsx` | Modificar | Prop `canReassign`, repassa pro `LeadAssignmentSelect` |
| `app/components/LeadAssignmentSelect.tsx` | Modificar | Prop `canReassign` desabilita o `<select>` |
| `tests/unit/lead-assignment-select.test.ts` | Criar | Teste RTL: `canReassign=false` desabilita o select |
| `docs/vex/27_PROJECT_STATUS.md` | Modificar | Entrada de conclusão do 0.3 |
| `docs/vex/53_ROADMAP.md` | Modificar | 0.3 → ✔ CONCLUÍDO |
| `docs/vex/29_DECISIONS_LOG.md` | Modificar | Nova entrada DL-0008 |

---

### Task 1: Migration — registrar rename `'admin'` → `'dono_loja'` já aplicado

**Files:**
- Create: `supabase/migrations/026_rename_admin_to_dono_loja.sql`

**Interfaces:**
- Produces: nenhuma interface de código — só schema. Tasks seguintes assumem `users.role IN ('dono_loja', 'vendedor')`.

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- Migration 026: renomeia users.role 'admin' -> 'dono_loja'
--
-- 'admin' aqui sempre significou "dono/gerente da loja" (escopado por
-- store_id) — não tem relação com super_admin (Vitor, cross-store via
-- ADMIN_EMAILS/isSuperAdmin(), nunca uma linha em public.users). O rename
-- evita ambiguidade entre os dois conceitos agora que RBAC (0.3) formaliza
-- os 3 níveis de perfil.
--
-- JÁ EXECUTADA MANUALMENTE EM PRODUÇÃO em 2026-07-29 (SQL Editor do
-- Supabase Studio) — confirmado via query read-only pós-execução (3
-- usuários role='admin' -> role='dono_loja', 2 role='vendedor' intocados).
-- Este arquivo registra o schema real no repo; não reaplicar via
-- `supabase db push` no projeto de produção (idempotente-seguro se
-- aplicado do zero em qualquer OUTRO ambiente, ex: novo projeto Supabase
-- criado a partir do zero a partir destas migrations).
--
-- Constraint descoberta em runtime via pg_constraint em vez de assumir
-- nome fixo (users_role_check é o nome padrão do Postgres pra check
-- inline sem nome, mas `supabase db dump` pra confirmar exigia Docker,
-- indisponível no ambiente de dev no momento da escrita).
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.users'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%role%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

UPDATE public.users SET role = 'dono_loja' WHERE role = 'admin';

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (role IN ('dono_loja', 'vendedor'));
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/026_rename_admin_to_dono_loja.sql
git commit -m "chore(db): registra migration 026 (rename users.role admin->dono_loja, já aplicada em produção)"
```

---

### Task 2: `getServerUserRole()` — fonte única de verdade de perfil

**Files:**
- Modify: `lib/auth.ts`
- Test: `tests/unit/auth.test.ts`

**Interfaces:**
- Consumes: `createSupabaseServerClient()` (já importado em `lib/auth.ts`); `isSuperAdmin(email: string | undefined | null): boolean` de `@/lib/admin-auth`.
- Produces: `export type UserRole = "super_admin" | "dono_loja" | "vendedor"`; `export async function getServerUserRole(): Promise<UserRole>` — usado por Task 3 (`lib/actions.ts`) e Task 5 (`app/leads/page.tsx`).

- [ ] **Step 1: Escrever os testes falhando**

Adicionar ao final de `tests/unit/auth.test.ts` (depois do `describe("getServerStoreId", ...)`, mesmo arquivo). Primeiro, ajustar os mocks no topo do arquivo:

```ts
// Substituir o bloco vi.hoisted() existente (linhas 7-11) por:
const { mockCreateClient, mockGetUser, mockFrom, mockIsSuperAdmin } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockIsSuperAdmin: vi.fn(),
}));

// Adicionar depois do vi.mock("@/lib/supabase-server", ...) existente:
vi.mock("@/lib/admin-auth", () => ({
  isSuperAdmin: mockIsSuperAdmin,
}));

// Trocar o import existente (linha 25) por:
import { getServerStoreId, getServerUserRole, AuthError, StoreNotFoundError } from "@/lib/auth";
```

Adicionar helper e testes no final do arquivo:

```ts
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
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run tests/unit/auth.test.ts`
Expected: FAIL — `getServerUserRole is not a function` (ou erro de import), porque a função ainda não existe em `lib/auth.ts`.

- [ ] **Step 3: Implementar `getServerUserRole()`**

Em `lib/auth.ts`, adicionar o import de `isSuperAdmin` no topo e a função no final do arquivo:

```ts
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isSuperAdmin } from "@/lib/admin-auth";

// ... (AuthError, StoreNotFoundError, getServerStoreId, getServerUserId inalterados) ...

export type UserRole = "super_admin" | "dono_loja" | "vendedor";

export async function getServerUserRole(): Promise<UserRole> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new AuthError();

  if (isSuperAdmin(user.email)) return "super_admin";

  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!data?.role) throw new StoreNotFoundError(user.id);

  return data.role as UserRole;
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run tests/unit/auth.test.ts`
Expected: PASS — todos os testes de `getServerStoreId` (inalterados) e os 5 novos de `getServerUserRole`.

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts tests/unit/auth.test.ts
git commit -m "feat(auth): adiciona getServerUserRole() como fonte única de verdade de perfil"
```

---

### Task 3: Guard de role em `assignLeadToUser`/`removeLeadAssignment`

**Files:**
- Modify: `lib/actions.ts`
- Test: `tests/unit/assigned-to-actions.test.ts`

**Interfaces:**
- Consumes: `getServerUserRole(): Promise<UserRole>` (Task 2, de `@/lib/auth`).
- Produces: nenhuma interface nova — comportamento de `assignLeadToUser`/`removeLeadAssignment` muda (lançam erro se role `"vendedor"`).

- [ ] **Step 1: Escrever os testes falhando**

Em `tests/unit/assigned-to-actions.test.ts`, ajustar o topo do arquivo:

```ts
// Substituir o vi.hoisted() existente (linhas 7-11) por:
const { mockFrom, mockRevalidate, mockGetServerStoreId, mockGetServerUserRole } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRevalidate: vi.fn(),
  mockGetServerStoreId: vi.fn(),
  mockGetServerUserRole: vi.fn(),
}));

// Substituir o vi.mock("@/lib/auth", ...) existente (linhas 21-23) por:
vi.mock("@/lib/auth", () => ({
  getServerStoreId: mockGetServerStoreId,
  getServerUserRole: mockGetServerUserRole,
}));
```

No `beforeEach` (linha 64-68), adicionar o default de role permitido (pra não quebrar os testes A1-A5/R1-R4 já existentes, que exercitam o caminho "permitido"):

```ts
beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockGetServerStoreId.mockResolvedValue("store-1");
  mockGetServerUserRole.mockResolvedValue("dono_loja");
});
```

Adicionar novos testes ao final do `describe("assignLeadToUser", ...)` (antes do `});` de fechamento):

```ts
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
```

Adicionar novos testes ao final do `describe("removeLeadAssignment", ...)` (antes do `});` de fechamento):

```ts
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
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run tests/unit/assigned-to-actions.test.ts`
Expected: FAIL nos casos A6/R5 (guard ainda não existe — vendedor consegue reatribuir hoje, `mockFrom` É chamado, teste espera que NÃO seja). A7/R6 devem passar já (comportamento atual já permite).

- [ ] **Step 3: Implementar o guard**

Em `lib/actions.ts`, atualizar o import de `@/lib/auth` (linha 11) e as duas funções:

```ts
import { getServerStoreId, getServerUserId, getServerUserRole } from "@/lib/auth";
```

```ts
export async function assignLeadToUser(leadId: string, userId: string): Promise<void> {
  const storeId = await getServerStoreId();
  const role = await getServerUserRole();
  if (role === "vendedor") {
    throw new Error("Apenas o dono da loja pode reatribuir leads");
  }

  // Guard 1: verify lead belongs to this store
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!lead) throw new Error("Lead não encontrado");

  // Guard 2: verify user belongs to this store (cross-tenant guard)
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", userId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!user) throw new Error("Usuário inválido");

  const { error } = await supabaseAdmin
    .from("leads")
    .update({ assigned_to: userId })
    .eq("id", leadId)
    .eq("store_id", storeId);
  if (error) throw error;

  revalidatePath("/leads");
}

export async function removeLeadAssignment(leadId: string): Promise<void> {
  const storeId = await getServerStoreId();
  const role = await getServerUserRole();
  if (role === "vendedor") {
    throw new Error("Apenas o dono da loja pode reatribuir leads");
  }

  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!lead) throw new Error("Lead não encontrado");

  const { error } = await supabaseAdmin
    .from("leads")
    .update({ assigned_to: null })
    .eq("id", leadId)
    .eq("store_id", storeId);
  if (error) throw error;

  revalidatePath("/leads");
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run tests/unit/assigned-to-actions.test.ts`
Expected: PASS — todos os 11 testes (A1-A7, R1-R6).

- [ ] **Step 5: Rodar a suíte completa**

Run: `npm run test`
Expected: PASS — nenhuma regressão em outros arquivos que importam `@/lib/auth` ou `@/lib/actions` (ex: `tests/unit/actions.test.ts` mocka `@/lib/auth` só com `getServerStoreId`/`getServerUserId`, sem `getServerUserRole` — não é afetado, pois `assignLeadToUser`/`removeLeadAssignment` não são importados nesse arquivo).

- [ ] **Step 6: Commit**

```bash
git add lib/actions.ts tests/unit/assigned-to-actions.test.ts
git commit -m "feat(rbac): trava reatribuição de lead pra role vendedor (0.3)"
```

---

### Task 4: Renomear `'admin'` → `'dono_loja'` na aplicação

**Files:**
- Modify: `app/admin/actions.ts:81,87-88,128,133-134`
- Modify: `app/admin/DirectUserForm.tsx:52`
- Modify: `app/equipe/page.tsx:233`
- Modify: `tests/unit/admin-actions.test.ts` (17 ocorrências de `role: "admin"`)

**Interfaces:**
- Consumes: nenhuma (mudança de string literal, sem novo símbolo).
- Produces: nenhuma interface nova.

- [ ] **Step 1: Atualizar os testes (RED)**

Em `tests/unit/admin-actions.test.ts`, substituir todas as 15 ocorrências de `role: "admin"` por `role: "dono_loja"` (linhas 259, 274, 294, 305, 323, 342, 360, 382, 404, 424, 445, 465 — usar find-and-replace no editor, `role: "admin"` → `role: "dono_loja"`; **não tocar** nas 2 ocorrências de `role: "superadmin"`, linhas 369 e 477 — esses testam o caso de role inválido e devem continuar inválidos).

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run tests/unit/admin-actions.test.ts`
Expected: FAIL — os testes que esperam sucesso com `role: "dono_loja"` falham, porque `app/admin/actions.ts` ainda só aceita `["admin", "vendedor"]` (rejeita `"dono_loja"` como role inválido).

- [ ] **Step 3: Atualizar `app/admin/actions.ts`**

Linha 81: `const role = formData.get("role") as "admin" | "vendedor";` → `const role = formData.get("role") as "dono_loja" | "vendedor";`

Linhas 87-88:
```ts
  if (!["admin", "vendedor"].includes(role))
    return { error: "role inválido: use 'admin' ou 'vendedor'" };
```
→
```ts
  if (!["dono_loja", "vendedor"].includes(role))
    return { error: "role inválido: use 'dono_loja' ou 'vendedor'" };
```

Linha 128: mesma troca de `"admin" | "vendedor"` → `"dono_loja" | "vendedor"`.

Linhas 133-134: mesma troca do bloco de validação.

- [ ] **Step 4: Atualizar `app/admin/DirectUserForm.tsx`**

Linha 52: `<option value="admin">admin</option>` → `<option value="dono_loja">dono_loja</option>`

- [ ] **Step 5: Atualizar `app/equipe/page.tsx`**

Linha 233: `{s.role === "admin" ? "Admin" : "Vendedor"}` → `{s.role === "dono_loja" ? "Dono da loja" : "Vendedor"}`

- [ ] **Step 6: Rodar os testes e confirmar que passam**

Run: `npx vitest run tests/unit/admin-actions.test.ts`
Expected: PASS — todos os testes, incluindo os 2 casos de `role: "superadmin"` inválido (inalterados).

- [ ] **Step 7: Rodar lint e typecheck**

Run: `npm run lint && npm run typecheck`
Expected: sem erros/warnings (os literais `"admin" | "vendedor"` viram `"dono_loja" | "vendedor"` de forma consistente nos 2 arquivos de `app/admin/actions.ts`).

- [ ] **Step 8: Commit**

```bash
git add app/admin/actions.ts app/admin/DirectUserForm.tsx app/equipe/page.tsx tests/unit/admin-actions.test.ts
git commit -m "refactor(rbac): renomeia role 'admin' -> 'dono_loja' na aplicação (schema já migrado)"
```

---

### Task 5: UI — desabilitar reatribuição pra vendedor

**Files:**
- Modify: `app/leads/page.tsx`
- Modify: `app/components/LeadCard.tsx`
- Modify: `app/components/LeadAssignmentSelect.tsx`
- Test: `tests/unit/lead-assignment-select.test.ts` (criar)

**Interfaces:**
- Consumes: `getServerUserRole(): Promise<UserRole>` (Task 2, de `@/lib/auth`).
- Produces: `LeadAssignmentSelect` ganha prop `canReassign?: boolean` (default `true`); `LeadCard` ganha prop `canReassign?: boolean` (default `true`), repassada direto.

- [ ] **Step 1: Escrever o teste falhando pro `LeadAssignmentSelect`**

Criar `tests/unit/lead-assignment-select.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { createElement } from "react";
import { render, cleanup, screen } from "@testing-library/react";

vi.mock("@/lib/actions", () => ({
  assignLeadToUser: vi.fn(),
  removeLeadAssignment: vi.fn(),
}));

import { LeadAssignmentSelect } from "@/app/components/LeadAssignmentSelect";

afterEach(() => {
  cleanup();
});

describe("LeadAssignmentSelect — canReassign", () => {
  it("canReassign=false desabilita o select mesmo com vendedores disponíveis", () => {
    render(
      createElement(LeadAssignmentSelect, {
        leadId: "lead-1",
        assignedTo: null,
        vendedores: [{ id: "u1", nome: "Carlos" }],
        canReassign: false,
      })
    );

    const select = screen.getByLabelText("Atribuir vendedor") as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });

  it("canReassign=true (ou omitido) mantém o select habilitado", () => {
    render(
      createElement(LeadAssignmentSelect, {
        leadId: "lead-1",
        assignedTo: null,
        vendedores: [{ id: "u1", nome: "Carlos" }],
      })
    );

    const select = screen.getByLabelText("Atribuir vendedor") as HTMLSelectElement;
    expect(select.disabled).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run tests/unit/lead-assignment-select.test.ts`
Expected: FAIL no primeiro teste (`canReassign=false`) — TypeScript pode até barrar por prop desconhecida dependendo do modo de checagem do vitest, ou o teste roda e `select.disabled` é `false` (prop `canReassign` ainda não existe/não é usada). Qualquer uma das duas falhas é aceitável como RED — o segundo teste (comportamento atual) já passa.

- [ ] **Step 3: Implementar `canReassign` em `LeadAssignmentSelect.tsx`**

Atualizar o `type Props` (linhas 6-10):

```tsx
type Props = {
  leadId: string;
  assignedTo: string | null;
  vendedores: { id: string; nome: string }[];
  canReassign?: boolean;
};
```

Atualizar a assinatura da função (linha 12) e o `<select>` (linhas 56-62):

```tsx
export function LeadAssignmentSelect({ leadId, assignedTo, vendedores, canReassign = true }: Props) {
  // ... (corpo inalterado até o return) ...
  return (
    <div className="lead-assignment">
      {currentNome && (
        <span className="lead-assignment-current">{currentNome}</span>
      )}
      <select
        value={value}
        onChange={handleChange}
        disabled={isPending || !canReassign}
        className="lead-assignment-select"
        aria-label="Atribuir vendedor"
      >
        {/* ... options inalteradas ... */}
      </select>
      {errorMsg && (
        <span className="lead-assignment-error" role="alert">
          {errorMsg}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run tests/unit/lead-assignment-select.test.ts`
Expected: PASS — os 2 testes.

- [ ] **Step 5: Repassar `canReassign` em `LeadCard.tsx`**

Atualizar `type Props` (linhas 19-31), adicionando `canReassign?: boolean;` após `vendedores?`. Atualizar a assinatura da função (linhas 48-60), adicionando `canReassign` à desestruturação. Atualizar o bloco `{vendedores && (...)}` (linhas 102-108):

```tsx
      {vendedores && (
        <LeadAssignmentSelect
          leadId={id}
          assignedTo={assignedTo ?? null}
          vendedores={vendedores}
          canReassign={canReassign}
        />
      )}
```

- [ ] **Step 6: Calcular `canReassign` em `app/leads/page.tsx`**

Atualizar o import da linha 2:

```ts
import { AuthError, getServerUserRole } from "@/lib/auth";
```

Localizar onde `vendedores` é resolvido (por volta da linha 99, após o `usersResult`) e adicionar logo depois:

```ts
  const role = await getServerUserRole();
  const canReassign = role !== "vendedor";
```

Atualizar a chamada de `<LeadCard>` (linhas 264-271):

```tsx
                items.map((l) => (
                  <LeadCard
                    key={l.id}
                    {...l}
                    assignedTo={l.assigned_to}
                    vendedores={vendedores}
                    canReassign={canReassign}
                  />
                ))
```

- [ ] **Step 7: Rodar a suíte completa, lint e typecheck**

Run: `npm run test && npm run lint && npm run typecheck`
Expected: tudo verde — nenhum teste existente de `app/leads/page.tsx` quebra (a página não tem teste unitário dedicado hoje; a verificação real é lint+typecheck+os testes novos passando).

- [ ] **Step 8: Commit**

```bash
git add app/leads/page.tsx app/components/LeadCard.tsx app/components/LeadAssignmentSelect.tsx tests/unit/lead-assignment-select.test.ts
git commit -m "feat(rbac): desabilita reatribuição de lead na UI pra role vendedor (cosmético, guard real é em lib/actions.ts)"
```

---

### Task 6: Documentação — fechar 0.3 no roadmap

**Files:**
- Modify: `docs/vex/27_PROJECT_STATUS.md`
- Modify: `docs/vex/53_ROADMAP.md`
- Modify: `docs/vex/29_DECISIONS_LOG.md`

**Interfaces:**
- Consumes: nada de código — só texto.
- Produces: nada consumido por tasks futuras.

- [ ] **Step 1: Adicionar entrada em `docs/vex/27_PROJECT_STATUS.md`**

No topo da seção `# RECENT COMPLETED WORK` (mesmo padrão das entradas anteriores — inserir como primeira entrada, antes da entrada mais recente existente):

```
✅ Roadmap 0.3 — RBAC (3 níveis de perfil) fechado (2026-07-29). `users.role` (existia desde migration 001, nunca usado como guard) renomeado de 'admin' para 'dono_loja' (migration 026, já aplicada em produção — schema real: `dono_loja`/`vendedor`). `super_admin` continua via `ADMIN_EMAILS`/`isSuperAdmin()` (sem linha própria em `users`, sem impersonation). `getServerUserRole()` (`lib/auth.ts`) — fonte única de verdade, trata `super_admin` e `dono_loja` de forma idêntica no guard (`role !== "vendedor"` libera). Guard aplicado em `assignLeadToUser`/`removeLeadAssignment` (`lib/actions.ts`) — vendedor não pode mais reatribuir lead de/para outro vendedor. UI (`LeadAssignmentSelect`) desabilita o campo pra vendedor — cosmético, guard real é em código. Escopo de visibilidade de lead entre vendedores (qualquer vendedor ainda vê/responde qualquer lead da própria loja) permanece irrestrito por decisão explícita — DL-0008, revisar quando houver loja com 2+ vendedores ativos simultâneos. Spec: `docs/superpowers/specs/2026-07-29-rbac-lead-reassignment-design.md`. Suíte completa verde, lint/typecheck limpos.
```

- [ ] **Step 2: Atualizar `docs/vex/53_ROADMAP.md`**

Substituir a linha 34 exata (5 colunas: id | título | descrição | dependência | esforço — esforço original `M` mantido, mesmo padrão de itens fechados como 0.9):

De:
```
| 0.3 | **RBAC** | Zero hoje: qualquer usuário da loja reatribui ou altera qualquer lead. É critério de escolha declarado no mercado (LGPD, controle de acesso por perfil) e fonte previsível de conflito interno entre vendedores. | — | M |
```

Para:
```
| 0.3 | ✔ **CONCLUÍDO** (2026-07-29) — **RBAC (3 níveis de perfil)** | `users.role` renomeado 'admin'→'dono_loja' (migration 026). `super_admin` via `ADMIN_EMAILS` (sem impersonation). `getServerUserRole()` trava reatribuição de lead (`assignLeadToUser`/`removeLeadAssignment`) pra role `vendedor`. Visibilidade de lead entre vendedores fica irrestrita por decisão (DL-0008) — revisar com multi-vendedor real. | — | M |
```

- [ ] **Step 3: Adicionar entrada DL-0008 em `docs/vex/29_DECISIONS_LOG.md`**

Inserir no mesmo formato das entradas existentes (ver DL-0007 como referência de estrutura), como nova entrada no topo ou seguindo a ordem cronológica já usada no arquivo:

```
DL-0008

Title

Escopo reduzido de 0.3 (RBAC) — travar só reatribuição, visibilidade de lead entre vendedores fica para quando houver multi-vendedor real

Category

Technical

Context

Dívida documentada em `27_PROJECT_STATUS.md` é sobre reatribuição sem controle (`assignLeadToUser`/`removeLeadAssignment` só validavam `store_id`). Existe também gap maior (qualquer vendedor vê/responde lead de qualquer colega da mesma loja), mas hoje o piloto (Speed Motos) tem 1 vendedor só — não há caso real pra desenhar a regra de visibilidade restrita com informação de verdade (ex: dono da loja precisa ver tudo mesmo? vendedor cobre colega de férias?).

Decision

Implementar RBAC cobrindo só a reatribuição agora. Visibilidade de lead entre vendedores continua irrestrita dentro da loja.

Reasoning

Desenhar a regra de visibilidade sem uso real de multi-vendedor é apostar no desenho errado. Esperar por um cliente/loja com 2+ vendedores ativos dá dado real pra decidir a forma certa (visibilidade total pro dono, exceções de cobertura, etc.), em vez de suposição.

Alternatives Considered

Implementar visibilidade restrita (vendedor só vê/responde leads atribuídos a si + não-atribuídos) já nesta etapa — descartado por falta de caso de uso real pra validar o desenho.

Expected Impact

Fecha a dívida documentada (reatribuição sem controle) sem expandir escopo pra uma mudança maior (visibilidade) sem dado real.

Potential Risks

Se um segundo vendedor ativo entrar em produção antes da revisão, qualquer vendedor continua vendo/respondendo lead do colega — risco operacional baixo (não é falha de segurança entre lojas, é falta de segregação dentro da mesma loja), aceitável até o gatilho de revisão.

Owner

Founder

Related ADR

None

Related Issue

Roadmap item 0.3 (`53_ROADMAP.md`); dívida técnica em `27_PROJECT_STATUS.md`

Related Runbook

None

Review Date

Primeira loja (piloto ou cliente novo) operando com 2+ vendedores simultâneos e ativos — nesse ponto, reavaliar e desenhar a visibilidade restrita com base em uso real.

Status

Active

---
```

- [ ] **Step 4: Commit**

```bash
git add docs/vex/27_PROJECT_STATUS.md docs/vex/53_ROADMAP.md docs/vex/29_DECISIONS_LOG.md
git commit -m "docs(vex): fecha 0.3 (RBAC) — DL-0008 registra escopo reduzido de visibilidade"
```

---

## Passos manuais (só Vitor)

1. **Ordem migration → deploy (a pergunta de sequência que você levantou):** neste rollout específico a migration **já rodou antes** de qualquer linha de código novo existir — não há janela de "guard novo sem migration". A única janela real e já aberta é a inversa: banco já só aceita `dono_loja`/`vendedor`, código ainda em produção (até este plano ser deployado) ainda oferece `'admin'` no onboarding via `/admin`. Efeito se alguém tentar usar `/admin` pra criar um dono_loja novo nesse meio-tempo: erro de constraint na tela, nenhum dado corrompido, nenhum usuário existente afetado. Ação: nenhuma além de deployar este plano com prioridade normal — não é bloqueante, mas não adie sem necessidade.
2. Depois do deploy, confirmar em produção (query read-only, mesmo padrão usado durante a validação técnica) que `app/admin` consegue criar um usuário novo com `role=dono_loja` sem erro — fecha o loop da janela acima.
3. Nenhuma migration adicional pra rodar manualmente — Task 1 só registra o que já existe.

---

## Self-Review

**Spec coverage:** migration (Task 1) ✓, 3 níveis de permissão via `getServerUserRole` (Task 2) ✓, guard nas 2 Server Actions (Task 3) ✓, UI mínima (Task 5) ✓, migração de dados existentes já feita e registrada (Task 1) ✓, testes cobrindo os 3 níveis (Task 3) ✓, docs atualizadas (Task 6) ✓, DL-0008 (Task 6) ✓. Rename `'admin'`→`'dono_loja'` na aplicação (Task 4) cobre o achado da fase de brainstorming que não estava no pedido original mas é pré-requisito pro resto funcionar sem quebrar onboarding.

**Placeholder scan:** nenhum "TBD"/"implementar depois" — toda task tem código completo. Task 6 Step 2 tem uma instrução de "ajustar formato conforme linha original" em vez de um diff fixo porque a estrutura exata de colunas da tabela do roadmap varia por linha — é uma instrução de posicionamento, não um placeholder de conteúdo (o conteúdo da célula está completo).

**Type consistency:** `UserRole` (Task 2) usado identicamente em Task 3 (`role === "vendedor"`) e Task 5 (`role !== "vendedor"`) — mesma string literal `"vendedor"` em ambos. `getServerUserRole` importado de `@/lib/auth` em Task 3 e Task 5, mesma assinatura `(): Promise<UserRole>`. `canReassign?: boolean` consistente entre `LeadAssignmentSelect` e `LeadCard` (Task 5).
