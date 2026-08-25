# /inicio → /dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename `/inicio` to `/dashboard`, remove 2 redundant cards, and add a global period selector (Hoje/7d/30d/Todo período + custom range) driving 4 new cards (Leads, Visitas agendadas, Leads por origem, Leads por vendedor) — without touching the Funil de Temperatura, the alert rail, or the Ranking de Vendedores table.

**Architecture:** Server Component (`app/dashboard/page.tsx`) fetches raw leads/sellers once (no per-period query — same pattern already used by `LeadsFunnel`/`buildFunnelPeriods`) and passes them to a new client component (`DashboardPeriodCards`) that owns the period-selection state and recomputes all 4 new cards client-side via pure functions in `lib/dashboard-period.ts`. A new generic `DonutChart` presentational component renders the 2 donut cards.

**Tech Stack:** Next.js 14 (App Router), React Server + Client Components, Supabase JS, Vitest.

**Spec:** User-provided spec, 2026-08-25 (chat message "REDESIGN — /inicio vira /dashboard (BL-0037, continuação)") — reproduced in full below since there is no separate spec file.

```
1. RENOMEAR ROTA E LABEL
   - Mover app/inicio/ → app/dashboard/ (rota real muda).
   - Adicionar redirect de /inicio → /dashboard (Next.js redirects em
     next.config ou route handler — quem acessar o link antigo não
     recebe 404).
   - Atualizar label da sidebar de "Início" pra "Dashboard", href
     apontando pra /dashboard.
   - Atualizar qualquer link interno hardcoded que aponte pra /inicio
     (ex: redirect pós-login, breadcrumbs) pra /dashboard.

2. REMOVER
   - Card "IA vs Humano" — remover completamente (componente e uso).
   - Card de tempo médio de resposta — remover.

3. MANTER SEM MUDANÇA
   - Funil de Temperatura — intocado, continua com o próprio seletor
     de período (7/30/90 dias/Todo período) já implementado,
     independente do seletor global novo (item 4).
   - Alerta de "leads sem resposta/atrasados" — mantém formato
     discreto atual (não virar card grande).
   - Tabela "Ranking de Vendedores" — mantém como está hoje, sem
     alteração nesta tarefa (será redesenhada em sessão futura,
     separada do donut novo do item 5).

4. SELETOR DE PERÍODO GLOBAL (novo)
   - Pills: Hoje / 7 dias / 30 dias / Todo período.
   - Ícone de calendário separado, visualmente afastado das pills
     (margem maior à direita), que abre um date range picker permitindo
     selecionar data inicial e final personalizadas, ponta a ponta.
   - Este seletor global controla APENAS os cards do item 5 (Leads,
     Visitas agendadas, Leads por origem, Leads por vendedor) — NÃO
     afeta o Funil de Temperatura, que mantém seu próprio controle.
   - Default: Hoje.

5. NOVOS CARDS (controlados pelo seletor de período global)
   a. "Leads [período]" — card numérico simples (estilo flat, número
      grande + rótulo dinâmico refletindo o período selecionado, ex:
      "Leads hoje" / "Leads 7 dias" / "Leads 12 mar - 20 mar").
      Contagem de leads criados no período.
   b. "Visitas agendadas [período]" — mesmo estilo flat do item (a).
      Fonte: leads.agendamento_data/agendamento_horario (migration 022
      — ver item 6, dependência de dado real). Até a migration rodar,
      mostra 0 (não quebrar a tela, não é erro).
   c. "Leads por origem" — donut chart com legenda, segmentado por
      leads.origem (campo já existe no schema), contagem por origem
      dentro do período selecionado.
   d. "Leads por vendedor" — donut chart com legenda, segmentado por
      vendedor responsável (assigned_to), contagem de leads por
      vendedor dentro do período selecionado. É um card NOVO, adicional
      à tabela Ranking de Vendedores existente (item 3) — não a
      substitui nesta tarefa.

6. DEPENDÊNCIA — MIGRATION 022
   Antes de implementar o card "Visitas agendadas": exibir no terminal
   o conteúdo exato do arquivo da migration 022 (agendamento_data/
   agendamento_horario em leads) pra Vitor revisar. Ela foi documentada
   como aplicada mas nunca rodou de fato nesta instância Supabase — é
   aditiva (ADD COLUMN), risco baixo, mas a decisão de rodar em
   produção via Supabase Studio é do Vitor, não automática.

Regras do projeto:
- Não alterar lógica de negócio, RLS ou queries fora do necessário pra
  essas mudanças — camada de apresentação + queries novas pros cards
  novos, sem tocar no que já funciona (funil, ranking, alerta).
- TDD com lint/typecheck a cada push.
- Commits separados por peça (rename de rota / remoção dos 2 cards /
  seletor de período global / cada card novo) — não tudo junto.
- Não commitar docs de status junto — separado, só se Vitor pedir.
- Validação manual em produção antes de considerar concluído.
- Registrar a mudança de rota (/inicio → /dashboard) em
  29_DECISIONS_LOG.md no mesmo commit, já que afeta navegação e
  qualquer bookmark/link salvo.
```

**Migration 022 gate (item 6) — already satisfied before this plan was written.** Full content of `supabase/migrations/022_troca_agendamento.sql` was printed to Vitor in chat for review before Task 6 was designed:

```sql
-- Agendamento estruturado pra troca de moto — página /agenda filtra por dia.
-- Financiamento e troca (nome, CPF, km, modelo etc) ficam em leads.contexto (jsonb),
-- só agendamento vira coluna própria por precisar de índice/filtro por data.
ALTER TABLE public.leads
  ADD COLUMN agendamento_data    date NULL,
  ADD COLUMN agendamento_horario text NULL;

CREATE INDEX leads_store_agendamento_idx ON public.leads(store_id, agendamento_data)
  WHERE agendamento_data IS NOT NULL;
```

Task 6 below implements "Visitas agendadas" defensively (query the two columns in isolation from the rest of the leads query; on error, `data` comes back `null`/empty and the card shows 0) so it works correctly whether or not Vitor has run this migration in Supabase Studio yet. Running it in production remains Vitor's call, not something this plan automates.

## Global Constraints

- Server Component page (`app/dashboard/page.tsx`) does the data fetching; all period-recomputation happens client-side over one already-fetched dataset (same pattern as `buildFunnelPeriods` — no new query per period change).
- No new npm dependency (no date-picker library) — custom range uses two native `<input type="date">` in a small popover.
- Reuse existing CSS where the look already matches: `.leads-funnel-toggle` for pills, `.metric-card`/`.metrics-grid` for the flat KPI cards.
- `agendamento_data`/`agendamento_horario` columns may not exist yet in production — any query touching them must degrade to empty/0, never throw.
- Every commit must pass `npm run lint && npm run typecheck && npm run test` (Husky pre-push hook) before pushing.
- One commit per task below — do not squash tasks together.
- Do not touch `LeadsFunnel.tsx`, `lib/lead-funnel.ts`, `AlertsWidget.tsx`, or the Ranking de Vendedores block in `page.tsx` beyond moving them to the new file path.

---

## File Structure

**New files:**
- `lib/dashboard-period.ts` — pure functions: period→date-range resolution, in-range filtering, leads/visitas counting, origem/vendedor breakdowns with percentages. Fully unit-tested (this is where all the real logic lives).
- `tests/unit/dashboard-period.test.ts` — tests for the above.
- `app/components/DonutChart.tsx` — generic presentational donut+legend, no app-specific knowledge (takes `{label,value,color}[]`).
- `app/components/DashboardPeriodSelector.tsx` — controlled pills + calendar-icon popover with 2 date inputs. Owns no data, just emits `PeriodSelection` via `onChange`.
- `app/components/DashboardPeriodCards.tsx` — client component: owns `PeriodSelection` state, calls `lib/dashboard-period.ts` functions, renders the selector + the 4 new cards.

**Moved:**
- `app/inicio/page.tsx` → `app/dashboard/page.tsx` (renamed function `InicioPage` → `DashboardPage`).

**Modified:**
- `next.config.mjs` — redirect `/inicio` → `/dashboard`; existing `/analytics` redirect destination updated to `/dashboard` too (avoids a double-hop redirect chain).
- `app/components/Sidebar.tsx` — nav item href/label/match.
- `app/page.tsx`, `app/login/page.tsx`, `app/auth/callback/route.ts`, `app/onboarding/page.tsx`, `app/estoque/page.tsx`, `middleware.ts` — internal `/inicio` references → `/dashboard`.
- `tests/unit/login-page.test.ts`, `tests/unit/onboarding-page.test.ts` — assertions updated to `/dashboard`.
- `docs/vex/29_DECISIONS_LOG.md` — new `DL-0019` entry (route rename), same commit as the rename.
- `app/globals.css` — new CSS for the period selector, donut chart, donut card wrapper.

**Deleted:**
- `app/components/BarChart.tsx` — becomes fully unused once the "IA vs Humano" card is removed (verified: its only other caller is the page being edited).

---

### Task 1: Rota `/inicio` → `/dashboard`

**Files:**
- Rename: `app/inicio/page.tsx` → `app/dashboard/page.tsx`
- Modify: `next.config.mjs`
- Modify: `app/components/Sidebar.tsx:136-144`
- Modify: `app/page.tsx`
- Modify: `app/login/page.tsx:11-12`
- Modify: `app/auth/callback/route.ts:7`
- Modify: `app/onboarding/page.tsx:33,45,68,80`
- Modify: `app/estoque/page.tsx:234`
- Modify: `middleware.ts:24`
- Modify (comments only): `lib/metrics.ts:177`, `lib/lead-priority.ts:89`, `lib/vehicle-margin.ts:1`, `app/components/DelayedLeadsBadge.tsx:12`
- Modify: `tests/unit/login-page.test.ts:53`
- Modify: `tests/unit/onboarding-page.test.ts:68,71,106,111`
- Modify: `docs/vex/29_DECISIONS_LOG.md` (insert new `DL-0019` block right after the `# REAL DECISIONS` heading, before the existing `DL-0018` block)

**Interfaces:**
- Produces: route `/dashboard` (was `/inicio`); the exported page component is renamed `DashboardPage` (was `InicioPage`) — no other file imports this component by name, so this rename is invisible outside the file.

- [ ] **Step 1: Move the page file**

```bash
git mv "app/inicio/page.tsx" "app/dashboard/page.tsx"
```

- [ ] **Step 2: Rename the component and fix the one internal comment referencing the old route**

In `app/dashboard/page.tsx`, change:

```typescript
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24h — alerta de /inicio (distinto do chip de 2h em /leads)
```
to:
```typescript
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24h — alerta de /dashboard (distinto do chip de 2h em /leads)
```

And change:
```typescript
export default async function InicioPage() {
```
to:
```typescript
export default async function DashboardPage() {
```

- [ ] **Step 3: Update `next.config.mjs`**

Replace the whole `redirects()` block:

```javascript
  // /analytics foi consolidada em /inicio — preserva link salvo/bookmark antigo.
  async redirects() {
    return [{ source: "/analytics", destination: "/inicio", permanent: true }];
  },
```
with:
```javascript
  // /analytics foi consolidada em /dashboard (era /inicio) — preserva link
  // salvo/bookmark antigo. /inicio também redireciona direto pra /dashboard
  // (rota renomeada, BL-0037/DL-0019) — os dois apontam pro mesmo destino
  // final, sem encadear um redirect no outro.
  async redirects() {
    return [
      { source: "/analytics", destination: "/dashboard", permanent: true },
      { source: "/inicio", destination: "/dashboard", permanent: true },
    ];
  },
```

- [ ] **Step 4: Update the sidebar nav item**

In `app/components/Sidebar.tsx`, change:
```typescript
  { href: "/inicio", label: "Início", icon: IconHome, match: (p: string) => p === "/inicio" || p === "/" },
```
to:
```typescript
  { href: "/dashboard", label: "Dashboard", icon: IconHome, match: (p: string) => p === "/dashboard" || p === "/" },
```

- [ ] **Step 5: Update every remaining hardcoded `/inicio` reference**

`app/page.tsx` — change `redirect("/inicio");` to `redirect("/dashboard");`

`app/login/page.tsx` lines 11-12 — change:
```typescript
  const raw = searchParams.get("redirectTo") ?? "/inicio";
  const redirectTo = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/inicio";
```
to:
```typescript
  const raw = searchParams.get("redirectTo") ?? "/dashboard";
  const redirectTo = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
```

`app/auth/callback/route.ts` line 7 — change `const next = searchParams.get("next") ?? "/inicio";` to `const next = searchParams.get("next") ?? "/dashboard";`

`app/onboarding/page.tsx` — change all 4 occurrences of `redirect("/inicio");` (lines 33, 45, 68, 80) to `redirect("/dashboard");`

`app/estoque/page.tsx` line 234 — change `<Link href="/inicio" ...>` to `<Link href="/dashboard" ...>`

`middleware.ts` line 24 — in `PROTECTED_PATH_PREFIXES`, change `"/inicio",` to `"/dashboard",`

`lib/metrics.ts` line 177 — change the comment `// fazia o card de /inicio mostrar "—" ...` to `// fazia o card de /dashboard mostrar "—" ...`

`lib/lead-priority.ts` line 89 — change the comment `// de "/inicio" (24h) sem duplicar a comparação.` to `// de "/dashboard" (24h) sem duplicar a comparação.`

`lib/vehicle-margin.ts` line 1 — change the comment `// Extraído de app/estoque/page.tsx — reusado em /inicio pro alerta de` to `// Extraído de app/estoque/page.tsx — reusado em /dashboard pro alerta de`

`app/components/DelayedLeadsBadge.tsx` line 12 — change the comment `* Badge flutuante fixo (mesmo padrão visual de AlertsWidget em /inicio) —` to `* Badge flutuante fixo (mesmo padrão visual de AlertsWidget em /dashboard) —`

- [ ] **Step 6: Update the two tests that assert the old redirect target**

`tests/unit/login-page.test.ts` line 53 — change `expect(mockPush).toHaveBeenCalledWith("/inicio");` to `expect(mockPush).toHaveBeenCalledWith("/dashboard");`

`tests/unit/onboarding-page.test.ts` — change lines 68/71 and 106/111:
```typescript
  it("super_admin: redireciona /inicio SEM consultar public.users (mesmo atalho por e-mail de antes)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "vex@vexauto.com.br" } } });

    await expect(OnboardingPage()).rejects.toThrow("REDIRECT:/inicio");
```
to:
```typescript
  it("super_admin: redireciona /dashboard SEM consultar public.users (mesmo atalho por e-mail de antes)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "vex@vexauto.com.br" } } });

    await expect(OnboardingPage()).rejects.toThrow("REDIRECT:/dashboard");
```
and:
```typescript
  it("vendedor: redireciona /inicio (comportamento preservado)", async () => {
    mockFrom.mockImplementation(() =>
      chainResolving({ data: { role: "vendedor", store_id: "store-1" }, error: null })
    );

    await expect(OnboardingPage()).rejects.toThrow("REDIRECT:/inicio");
```
to:
```typescript
  it("vendedor: redireciona /dashboard (comportamento preservado)", async () => {
    mockFrom.mockImplementation(() =>
      chainResolving({ data: { role: "vendedor", store_id: "store-1" }, error: null })
    );

    await expect(OnboardingPage()).rejects.toThrow("REDIRECT:/dashboard");
```

- [ ] **Step 7: Run the full unit suite**

Run: `npm run test`
Expected: all tests pass, including the two edited files.

- [ ] **Step 8: Run lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: no errors.

- [ ] **Step 9: Add the `DL-0019` decision log entry**

In `docs/vex/29_DECISIONS_LOG.md`, insert immediately after the `# REAL DECISIONS` heading (before the existing `Date` / `2026-08-19` / `Decision ID` / `DL-0018` block that currently follows it):

```
Date

2026-08-25

Decision ID

DL-0019

Title

Rota `/inicio` renomeada pra `/dashboard`

Category

Engineering

Context

`/inicio` era o nome da rota do dashboard operacional desde a Fase 1 — nome herdado da primeira versão do produto, não reflete mais o que a página é (painel operacional central, não uma "página inicial" genérica). BL-0037 (redesign visual, continuação) pediu o rename direto do founder, junto com a remoção de 2 cards redundantes e a adição de um seletor de período global com 4 cards novos.

Decision

`app/inicio/` virou `app/dashboard/`. Redirect permanente `/inicio` → `/dashboard` adicionado em `next.config.mjs` (mesmo padrão já usado pelo redirect `/analytics` → dashboard, que teve o destino atualizado junto pra não encadear um redirect no outro). Todo link/redirect hardcoded pra `/inicio` no código (sidebar, pós-login, callback de OAuth, onboarding, alerta de estoque, middleware) atualizado pra `/dashboard`.

Reasoning

Bookmark e link salvo de quem já usa o sistema não pode virar 404 — o redirect permanente cobre isso sem exigir nenhuma ação do usuário. Atualizar os links internos (em vez de deixar todos dependerem do redirect) evita um hop de rede extra em todo o navegação principal do app.

Alternatives Considered

Manter `/inicio` como rota real e só mudar o label da sidebar pra "Dashboard" — descartado porque o pedido explícito era renomear a rota de verdade (BL-0037), não só o texto exibido; deixaria a URL e o label dessincronizados.

Expected Impact

Nenhuma mudança de comportamento pro usuário final (mesmo conteúdo, nova URL) além de quem tinha `/inicio` salvo como favorito — esse caso é coberto pelo redirect permanente, sem 404.

Potential Risks

Baixo — mudança de rota + redirect é um padrão já usado no projeto (`/analytics` → dashboard já funcionava assim). Risco residual: algum serviço externo (ex: link em campanha de WhatsApp) apontando pra `/inicio` continua funcionando via redirect, só com um hop a mais.

Owner

Engineering (implementação) / Founder (pedido)

Related ADR

None

Related Issue

BL-0037 (Fase 1, continuação)

Related Runbook

None

Review Date

N/A

Status

Active

---

```

- [ ] **Step 10: Commit**

```bash
git add app/dashboard app/inicio next.config.mjs app/components/Sidebar.tsx app/page.tsx app/login/page.tsx app/auth/callback/route.ts app/onboarding/page.tsx app/estoque/page.tsx middleware.ts lib/metrics.ts lib/lead-priority.ts lib/vehicle-margin.ts app/components/DelayedLeadsBadge.tsx tests/unit/login-page.test.ts tests/unit/onboarding-page.test.ts docs/vex/29_DECISIONS_LOG.md
git commit -m "refactor(dashboard): renomeia rota /inicio para /dashboard (DL-0019)"
```

---

### Task 2: Remover cards "IA vs Humano" e "Resposta Média da IA"

**Files:**
- Modify: `app/dashboard/page.tsx`
- Delete: `app/components/BarChart.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — pure removal. Confirms `BarChart` has no other callers before deleting the file.

- [ ] **Step 1: Confirm `BarChart` has no other callers**

Run: `grep -rn "BarChart" app --include=*.tsx`
Expected: only `app/dashboard/page.tsx` (the file being edited) and `app/components/BarChart.tsx` itself.

- [ ] **Step 2: Remove the "IA vs Humano" card and its data**

In `app/dashboard/page.tsx`, remove the import:
```typescript
import { BarChart } from "@/app/components/BarChart";
```

Remove the `aiVsHumanBars` variable:
```typescript
  const aiVsHumanBars = [
    { label: "Atendidos pela IA", value: m.ai_handled_leads, color: "var(--accent)" },
    { label: "Intervenção Humana", value: m.human_handoff_count, color: "var(--muted)" },
  ];
```

Remove the whole section:
```typescript
      <div className="section-card">
        <div className="section-card-head">
          <span className="section-card-title">IA vs Humano</span>
          <span className="kpi-delta">últimos {WINDOW_DAYS} dias</span>
        </div>
        <div className="section-card-body">
          <BarChart bars={aiVsHumanBars} />
        </div>
      </div>
```

- [ ] **Step 3: Remove the "Resposta Média da IA" metric card and the now-unused `mins()` helper**

Remove the array entry:
```typescript
    { label: "Resposta Média da IA", value: mins(m.avg_first_response_minutes), sub: "1ª resposta após contato", tier: "info" },
```
from `operationalCards`.

Remove the now-unused function:
```typescript
function mins(avg: number | null): string {
  if (avg === null) return "—";
  return avg < 1 ? `${Math.round(avg * 60)}s` : `${avg.toFixed(1)} min`;
}
```

- [ ] **Step 4: Delete the now-fully-unused `BarChart` component**

```bash
git rm app/components/BarChart.tsx
```

- [ ] **Step 5: Run lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: no errors, no unused-import warnings.

- [ ] **Step 6: Run the unit suite**

Run: `npm run test`
Expected: all tests pass (no test referenced `BarChart` or `mins`).

- [ ] **Step 7: Commit**

```bash
git add app/dashboard/page.tsx
git rm app/components/BarChart.tsx
git commit -m "refactor(dashboard): remove cards IA vs Humano e Resposta Média da IA"
```

---

### Task 3: `lib/dashboard-period.ts` — funções puras de período

**Files:**
- Create: `lib/dashboard-period.ts`
- Test: `tests/unit/dashboard-period.test.ts`

**Interfaces:**
- Consumes: `Origem` from `@/types/domain`.
- Produces (used by Tasks 5-8):
  - `type PeriodPreset = "hoje" | "7d" | "30d" | "todo"`
  - `type PeriodSelection = { kind: "preset"; preset: PeriodPreset } | { kind: "custom"; since: string; until: string }`
  - `type DateRange = { since: string | null; until: string }`
  - `type BreakdownEntry<K extends string> = { key: K; label: string; count: number; percent: number }`
  - `resolveRange(selection: PeriodSelection, now?: Date): DateRange`
  - `periodLabel(selection: PeriodSelection): string`
  - `countLeadsInRange(leads: Array<{created_at: string | null}>, range: DateRange): number`
  - `countVisitasAgendadasInRange(leads: Array<{agendamento_data?: string | null}>, range: DateRange): number`
  - `breakdownByOrigem(leads: Array<{created_at: string | null; origem: Origem}>, range: DateRange): BreakdownEntry<Origem>[]`
  - `breakdownByVendedor(leads: Array<{created_at: string | null; assigned_to: string | null}>, sellers: Array<{id: string; nome: string}>, range: DateRange): BreakdownEntry<string>[]`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/dashboard-period.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  presetRange,
  customRange,
  resolveRange,
  inRange,
  periodLabel,
  countLeadsInRange,
  countVisitasAgendadasInRange,
  breakdownByOrigem,
  breakdownByVendedor,
  type PeriodSelection,
} from "@/lib/dashboard-period";

const NOW = new Date("2026-08-25T15:00:00.000Z");

describe("presetRange", () => {
  it("hoje: since === until === hoje", () => {
    expect(presetRange("hoje", NOW)).toEqual({ since: "2026-08-25", until: "2026-08-25" });
  });

  it("7d: janela de 7 dias incluindo hoje", () => {
    expect(presetRange("7d", NOW)).toEqual({ since: "2026-08-19", until: "2026-08-25" });
  });

  it("30d: janela de 30 dias incluindo hoje", () => {
    expect(presetRange("30d", NOW)).toEqual({ since: "2026-07-27", until: "2026-08-25" });
  });

  it("todo: sem limite inferior", () => {
    expect(presetRange("todo", NOW)).toEqual({ since: null, until: "2026-08-25" });
  });
});

describe("customRange", () => {
  it("mantém a ordem quando since <= until", () => {
    expect(customRange("2026-08-01", "2026-08-10")).toEqual({ since: "2026-08-01", until: "2026-08-10" });
  });

  it("inverte quando o usuário digita until antes de since", () => {
    expect(customRange("2026-08-10", "2026-08-01")).toEqual({ since: "2026-08-01", until: "2026-08-10" });
  });
});

describe("resolveRange", () => {
  it("preset delega pra presetRange", () => {
    const sel: PeriodSelection = { kind: "preset", preset: "hoje" };
    expect(resolveRange(sel, NOW)).toEqual({ since: "2026-08-25", until: "2026-08-25" });
  });

  it("custom delega pra customRange", () => {
    const sel: PeriodSelection = { kind: "custom", since: "2026-08-01", until: "2026-08-10" };
    expect(resolveRange(sel, NOW)).toEqual({ since: "2026-08-01", until: "2026-08-10" });
  });
});

describe("inRange", () => {
  const range = { since: "2026-08-10", until: "2026-08-20" };

  it("dentro do intervalo (inclusive nas duas pontas)", () => {
    expect(inRange("2026-08-10", range)).toBe(true);
    expect(inRange("2026-08-20", range)).toBe(true);
    expect(inRange("2026-08-15", range)).toBe(true);
  });

  it("fora do intervalo", () => {
    expect(inRange("2026-08-09", range)).toBe(false);
    expect(inRange("2026-08-21", range)).toBe(false);
  });

  it("null/undefined nunca está no intervalo", () => {
    expect(inRange(null, range)).toBe(false);
    expect(inRange(undefined, range)).toBe(false);
  });

  it("since null (todo período): só o teto importa", () => {
    expect(inRange("2020-01-01", { since: null, until: "2026-08-20" })).toBe(true);
    expect(inRange("2026-08-21", { since: null, until: "2026-08-20" })).toBe(false);
  });
});

describe("periodLabel", () => {
  it("presets têm rótulo fixo", () => {
    expect(periodLabel({ kind: "preset", preset: "hoje" })).toBe("hoje");
    expect(periodLabel({ kind: "preset", preset: "7d" })).toBe("7 dias");
    expect(periodLabel({ kind: "preset", preset: "30d" })).toBe("30 dias");
    expect(periodLabel({ kind: "preset", preset: "todo" })).toBe("todo período");
  });

  it("custom com since === until: uma data só", () => {
    expect(periodLabel({ kind: "custom", since: "2026-03-12", until: "2026-03-12" })).toBe("12 mar");
  });

  it("custom com intervalo: 'de - até'", () => {
    expect(periodLabel({ kind: "custom", since: "2026-03-12", until: "2026-03-20" })).toBe("12 mar - 20 mar");
  });
});

describe("countLeadsInRange", () => {
  const range = { since: "2026-08-10", until: "2026-08-20" };

  it("conta só leads criados dentro do período", () => {
    const leads = [
      { created_at: "2026-08-15T10:00:00.000Z" },
      { created_at: "2026-08-05T10:00:00.000Z" },
      { created_at: "2026-08-20T23:59:59.000Z" },
    ];
    expect(countLeadsInRange(leads, range)).toBe(2);
  });

  it("created_at null não conta", () => {
    expect(countLeadsInRange([{ created_at: null }], range)).toBe(0);
  });
});

describe("countVisitasAgendadasInRange", () => {
  const range = { since: "2026-08-10", until: "2026-08-20" };

  it("conta leads com agendamento_data dentro do período", () => {
    const leads = [
      { agendamento_data: "2026-08-15" },
      { agendamento_data: "2026-08-01" },
      { agendamento_data: null },
    ];
    expect(countVisitasAgendadasInRange(leads, range)).toBe(1);
  });

  it("agendamento_data undefined (migration não rodou) conta 0, não quebra", () => {
    expect(countVisitasAgendadasInRange([{}, {}], range)).toBe(0);
  });
});

describe("breakdownByOrigem", () => {
  it("agrupa por origem dentro do período, percentuais somam 100, zera entradas sem lead", () => {
    const range = { since: "2026-08-01", until: "2026-08-31" };
    const leads = [
      { created_at: "2026-08-05T00:00:00.000Z", origem: "whatsapp" as const },
      { created_at: "2026-08-06T00:00:00.000Z", origem: "whatsapp" as const },
      { created_at: "2026-08-07T00:00:00.000Z", origem: "site" as const },
      { created_at: "2026-01-01T00:00:00.000Z", origem: "manual" as const }, // fora do período
    ];
    const result = breakdownByOrigem(leads, range);
    expect(result.find((e) => e.key === "manual")).toBeUndefined();
    expect(result.find((e) => e.key === "whatsapp")).toEqual({ key: "whatsapp", label: "WhatsApp", count: 2, percent: 67 });
    expect(result.find((e) => e.key === "site")).toEqual({ key: "site", label: "Site", count: 1, percent: 33 });
    expect(result.reduce((s, e) => s + e.percent, 0)).toBe(100);
  });

  it("período sem leads retorna lista vazia", () => {
    const range = { since: "2020-01-01", until: "2020-01-31" };
    expect(breakdownByOrigem([{ created_at: "2026-08-05T00:00:00.000Z", origem: "whatsapp" as const }], range)).toEqual([]);
  });
});

describe("breakdownByVendedor", () => {
  const sellers = [
    { id: "u1", nome: "Ana" },
    { id: "u2", nome: "Beto" },
  ];
  const range = { since: "2026-08-01", until: "2026-08-31" };

  it("agrupa por vendedor + bucket 'Sem vendedor' pra assigned_to nulo", () => {
    const leads = [
      { created_at: "2026-08-05T00:00:00.000Z", assigned_to: "u1" },
      { created_at: "2026-08-06T00:00:00.000Z", assigned_to: "u1" },
      { created_at: "2026-08-07T00:00:00.000Z", assigned_to: "u2" },
      { created_at: "2026-08-08T00:00:00.000Z", assigned_to: null },
    ];
    const result = breakdownByVendedor(leads, sellers, range);
    expect(result.find((e) => e.key === "u1")).toEqual({ key: "u1", label: "Ana", count: 2, percent: 50 });
    expect(result.find((e) => e.key === "u2")).toEqual({ key: "u2", label: "Beto", count: 1, percent: 25 });
    expect(result.find((e) => e.key === "sem_vendedor")).toEqual({ key: "sem_vendedor", label: "Sem vendedor", count: 1, percent: 25 });
  });

  it("vendedor sem leads no período não aparece", () => {
    const leads = [{ created_at: "2026-08-05T00:00:00.000Z", assigned_to: "u1" }];
    const result = breakdownByVendedor(leads, sellers, range);
    expect(result.find((e) => e.key === "u2")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/dashboard-period.test.ts`
Expected: FAIL — `Cannot find module '@/lib/dashboard-period'`.

- [ ] **Step 3: Implement `lib/dashboard-period.ts`**

```typescript
import type { Origem } from "@/types/domain";

export type PeriodPreset = "hoje" | "7d" | "30d" | "todo";

export type PeriodSelection =
  | { kind: "preset"; preset: PeriodPreset }
  | { kind: "custom"; since: string; until: string };

export type DateRange = { since: string | null; until: string };

const PRESET_LABELS: Record<PeriodPreset, string> = {
  hoje: "hoje",
  "7d": "7 dias",
  "30d": "30 dias",
  todo: "todo período",
};

const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Dia calendário UTC — mesma convenção de lib/metrics.ts (countLeadsToday,
// buildDailyTrend): servidor roda em UTC, timestamps ISO UTC; comparar por
// dia local do processo seria ambíguo entre ambientes.
export function presetRange(preset: PeriodPreset, now: Date = new Date()): DateRange {
  const untilKey = now.toISOString().slice(0, 10);
  if (preset === "todo") return { since: null, until: untilKey };
  const daysBack = preset === "hoje" ? 0 : preset === "7d" ? 6 : 29;
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - daysBack);
  return { since: d.toISOString().slice(0, 10), until: untilKey };
}

// since/until vêm como YYYY-MM-DD de <input type="date">, sem ordem garantida
// (usuário pode digitar a data final antes da inicial) — normaliza.
export function customRange(since: string, until: string): DateRange {
  return since <= until ? { since, until } : { since: until, until: since };
}

export function resolveRange(selection: PeriodSelection, now: Date = new Date()): DateRange {
  return selection.kind === "preset"
    ? presetRange(selection.preset, now)
    : customRange(selection.since, selection.until);
}

export function inRange(dateKey: string | null | undefined, range: DateRange): boolean {
  if (!dateKey) return false;
  if (dateKey > range.until) return false;
  if (range.since !== null && dateKey < range.since) return false;
  return true;
}

function formatShortDatePt(dateKey: string): string {
  const [, month, day] = dateKey.split("-");
  return `${day} ${MONTHS_PT[Number(month) - 1]}`;
}

export function periodLabel(selection: PeriodSelection): string {
  if (selection.kind === "preset") return PRESET_LABELS[selection.preset];
  const range = customRange(selection.since, selection.until);
  const sinceLabel = formatShortDatePt(range.since as string);
  if (range.since === range.until) return sinceLabel;
  return `${sinceLabel} - ${formatShortDatePt(range.until)}`;
}

export function countLeadsInRange(
  leads: Array<{ created_at: string | null }>,
  range: DateRange
): number {
  return leads.filter((l) => inRange(l.created_at?.slice(0, 10), range)).length;
}

export function countVisitasAgendadasInRange(
  leads: Array<{ agendamento_data?: string | null }>,
  range: DateRange
): number {
  return leads.filter((l) => inRange(l.agendamento_data, range)).length;
}

export type BreakdownEntry<K extends string> = { key: K; label: string; count: number; percent: number };

// Método do maior resto (mesmo de lib/lead-funnel.ts calculateStageBreakdown)
// — garante que os percentuais somem exatamente 100 quando total > 0.
function distributePercent(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return counts.map(() => 0);
  const exact = counts.map((c) => (c / total) * 100);
  const base = exact.map(Math.floor);
  const remaining = 100 - base.reduce((a, b) => a + b, 0);
  const byRemainder = exact
    .map((v, i) => ({ i, frac: v - base[i] }))
    .sort((a, b) => b.frac - a.frac);
  const percents = [...base];
  for (let k = 0; k < remaining; k++) {
    percents[byRemainder[k % byRemainder.length].i] += 1;
  }
  return percents;
}

const ORIGEM_ORDER: Origem[] = ["whatsapp", "portal", "base_inativa", "manual", "site"];
const ORIGEM_LABELS: Record<Origem, string> = {
  whatsapp: "WhatsApp",
  portal: "Portal",
  base_inativa: "Base Inativa",
  manual: "Manual",
  site: "Site",
};

export function breakdownByOrigem(
  leads: Array<{ created_at: string | null; origem: Origem }>,
  range: DateRange
): BreakdownEntry<Origem>[] {
  const inWindow = leads.filter((l) => inRange(l.created_at?.slice(0, 10), range));
  const counts = ORIGEM_ORDER.map((o) => inWindow.filter((l) => l.origem === o).length);
  const percents = distributePercent(counts);
  return ORIGEM_ORDER.map((origem, i) => ({
    key: origem,
    label: ORIGEM_LABELS[origem],
    count: counts[i],
    percent: percents[i],
  })).filter((e) => e.count > 0);
}

export function breakdownByVendedor(
  leads: Array<{ created_at: string | null; assigned_to: string | null }>,
  sellers: Array<{ id: string; nome: string }>,
  range: DateRange
): BreakdownEntry<string>[] {
  const inWindow = leads.filter((l) => inRange(l.created_at?.slice(0, 10), range));
  const sellerIds = sellers.map((s) => s.id);
  const keys = [...sellerIds, "sem_vendedor"];
  const labelOf = (key: string) => sellers.find((s) => s.id === key)?.nome ?? "Sem vendedor";
  const counts = keys.map((key) =>
    key === "sem_vendedor"
      ? inWindow.filter((l) => l.assigned_to === null || !sellerIds.includes(l.assigned_to)).length
      : inWindow.filter((l) => l.assigned_to === key).length
  );
  const percents = distributePercent(counts);
  return keys
    .map((key, i) => ({ key, label: labelOf(key), count: counts[i], percent: percents[i] }))
    .filter((e) => e.count > 0);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/dashboard-period.test.ts`
Expected: PASS — all describe blocks green.

- [ ] **Step 5: Run lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/dashboard-period.ts tests/unit/dashboard-period.test.ts
git commit -m "feat(dashboard): lib/dashboard-period com funções puras de período"
```

---

### Task 4: `DonutChart` — componente genérico

**Files:**
- Create: `app/components/DonutChart.tsx`
- Modify: `app/globals.css` (append)

**Interfaces:**
- Consumes: nothing from earlier tasks (pure presentational component).
- Produces: `DonutChart({ segments, emptyLabel? }: { segments: {label:string; value:number; color:string}[]; emptyLabel?: string })` — used by Tasks 7 and 8.

- [ ] **Step 1: Create the component**

```typescript
type DonutSegment = { label: string; value: number; color: string };

const RADIUS = 40;
const STROKE = 16;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function DonutChart({
  segments,
  emptyLabel = "Sem dados no período",
}: {
  segments: DonutSegment[];
  emptyLabel?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  let offset = 0;

  return (
    <div className="donut-chart">
      <div className="donut-chart-ring">
        <svg viewBox="0 0 100 100" className="donut-chart-svg">
          <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="var(--panel-2)" strokeWidth={STROKE} />
          {total > 0 &&
            segments.map((s) => {
              const dash = (s.value / total) * CIRCUMFERENCE;
              const el = (
                <circle
                  key={s.label}
                  cx="50"
                  cy="50"
                  r={RADIUS}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={STROKE}
                  strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 50 50)"
                />
              );
              offset += dash;
              return el;
            })}
        </svg>
        <div className="donut-chart-total">{total}</div>
      </div>
      <ul className="donut-chart-legend">
        {segments.length === 0 && <li className="donut-chart-empty">{emptyLabel}</li>}
        {segments.map((s) => (
          <li key={s.label}>
            <span className="donut-chart-swatch" style={{ background: s.color }} />
            <span className="donut-chart-legend-label">{s.label}</span>
            <span className="donut-chart-legend-count">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Append the CSS**

Append to `app/globals.css`:

```css
/* ─── Donut chart (dashboard) ────────────────────── */
.donut-chart { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.donut-chart-ring { position: relative; width: 100px; height: 100px; flex-shrink: 0; }
.donut-chart-svg { width: 100%; height: 100%; }
.donut-chart-total {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: 18px; font-weight: 700; color: var(--text-strong);
}
.donut-chart-legend { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 140px; }
.donut-chart-legend li { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); }
.donut-chart-swatch { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
.donut-chart-legend-label { flex: 1; }
.donut-chart-legend-count { font-weight: 700; color: var(--text-strong); }
.donut-chart-empty { font-style: italic; }

.donut-card { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }
.donut-card-title { font-size: 13px; font-weight: 700; color: var(--text-strong); margin-bottom: 12px; display: block; }
.dashboard-donut-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin: 0 16px 16px; }
```

- [ ] **Step 3: Run lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: no errors. (No dedicated component test — same convention as the existing untested `BarChart`/`TrendChart` presentational components; verified visually in Tasks 7-8.)

- [ ] **Step 4: Commit**

```bash
git add app/components/DonutChart.tsx app/globals.css
git commit -m "feat(dashboard): componente DonutChart genérico"
```

---

### Task 5: Seletor de período global + card "Leads [período]"

**Files:**
- Create: `app/components/DashboardPeriodSelector.tsx`
- Create: `app/components/DashboardPeriodCards.tsx`
- Modify: `app/dashboard/page.tsx`
- Modify: `app/globals.css` (append)

**Interfaces:**
- Consumes: `PeriodSelection`, `resolveRange`, `periodLabel`, `countLeadsInRange` from `@/lib/dashboard-period` (Task 3); `Origem` from `@/types/domain`.
- Produces: `DashboardPeriodCards({ leads, sellers }: { leads: DashboardLead[]; sellers: {id:string;nome:string}[] })` — extended by Tasks 6-8. `DashboardLead = { id: string; created_at: string | null; origem: Origem; assigned_to: string | null; agendamento_data?: string | null }` (exported from `DashboardPeriodCards.tsx`, consumed by `page.tsx` and by Task 6's data-fetching code).

- [ ] **Step 1: Create the period selector**

```typescript
"use client";

import { useState } from "react";
import type { PeriodPreset, PeriodSelection } from "@/lib/dashboard-period";

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "todo", label: "Todo período" },
];

function IconCalendarSmall() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9.5h18" />
      <path d="M8 3v4M16 3v4" />
    </svg>
  );
}

export function DashboardPeriodSelector({
  value,
  onChange,
}: {
  value: PeriodSelection;
  onChange: (selection: PeriodSelection) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftSince, setDraftSince] = useState("");
  const [draftUntil, setDraftUntil] = useState("");

  const activePreset = value.kind === "preset" ? value.preset : null;

  function applyCustomRange() {
    if (!draftSince || !draftUntil) return;
    onChange({ kind: "custom", since: draftSince, until: draftUntil });
    setPickerOpen(false);
  }

  return (
    <div className="dashboard-period-bar">
      <div className="leads-funnel-toggle" role="group" aria-label="Período do dashboard">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            className={activePreset === p.value ? "active" : ""}
            onClick={() => onChange({ kind: "preset", preset: p.value })}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="dashboard-period-calendar">
        <button
          type="button"
          className={`dashboard-period-calendar-btn${value.kind === "custom" ? " active" : ""}`}
          aria-label="Escolher período personalizado"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((v) => !v)}
        >
          <IconCalendarSmall />
        </button>

        {pickerOpen && (
          <div className="dashboard-period-popover" role="dialog" aria-label="Período personalizado">
            <label>
              De
              <input type="date" value={draftSince} onChange={(e) => setDraftSince(e.target.value)} />
            </label>
            <label>
              Até
              <input type="date" value={draftUntil} onChange={(e) => setDraftUntil(e.target.value)} />
            </label>
            <button type="button" className="dashboard-period-popover-apply" onClick={applyCustomRange}>
              Aplicar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `DashboardPeriodCards` with the first card**

```typescript
"use client";

import { useMemo, useState } from "react";
import { DashboardPeriodSelector } from "@/app/components/DashboardPeriodSelector";
import { resolveRange, periodLabel, countLeadsInRange, type PeriodSelection } from "@/lib/dashboard-period";
import type { Origem } from "@/types/domain";

export type DashboardLead = {
  id: string;
  created_at: string | null;
  origem: Origem;
  assigned_to: string | null;
  agendamento_data?: string | null;
};

export function DashboardPeriodCards({
  leads,
  sellers,
}: {
  leads: DashboardLead[];
  sellers: { id: string; nome: string }[];
}) {
  const [selection, setSelection] = useState<PeriodSelection>({ kind: "preset", preset: "hoje" });
  const range = useMemo(() => resolveRange(selection), [selection]);
  const label = periodLabel(selection);
  const leadsCount = useMemo(() => countLeadsInRange(leads, range), [leads, range]);

  return (
    <div className="section-card">
      <div className="section-card-head">
        <span className="section-card-title">Painel por Período</span>
      </div>

      <div style={{ padding: "0 16px 12px" }}>
        <DashboardPeriodSelector value={selection} onChange={setSelection} />
      </div>

      <div className="metrics-grid" style={{ margin: "0 16px 16px" }}>
        <div className="metric-card">
          <div className="metric-label">Leads {label}</div>
          <div className="metric-value">{leadsCount}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire it into `app/dashboard/page.tsx`**

Add the import:
```typescript
import { DashboardPeriodCards, type DashboardLead } from "@/app/components/DashboardPeriodCards";
```

Add a fetch function (near `fetchSellerRanking`):
```typescript
async function fetchDashboardPeriodData(supabase: SupabaseServerClient): Promise<{ leads: DashboardLead[]; sellers: { id: string; nome: string }[] }> {
  const [leadsRes, sellersRes] = await Promise.all([
    supabase.from("leads").select("id, created_at, origem, assigned_to"),
    supabase.from("users").select("id, nome").eq("role", "vendedor"),
  ]);
  return {
    leads: leadsRes.data ?? [],
    sellers: sellersRes.data ?? [],
  };
}
```

In `DashboardPage`, add the fetch to the `Promise.all` call:
```typescript
  const [
    { metrics: m, leadsToday, trend, funnelPeriods, reactivationRevenue },
    staleCount,
    lowMarginCount,
    sellerRanking,
    dashboardPeriodData,
  ] = await Promise.all([
    fetchOperationalMetrics(supabase),
    fetchStaleCount(supabase),
    fetchLowMarginVehicleCount(supabase),
    fetchSellerRanking(supabase),
    fetchDashboardPeriodData(supabase),
  ]);
```

Render it right before the Funil de Temperatura section:
```typescript
      <DashboardPeriodCards leads={dashboardPeriodData.leads} sellers={dashboardPeriodData.sellers} />

      <div className="section-card">
        <LeadsFunnel periods={funnelPeriods} defaultLabel={`${WINDOW_DAYS} dias`} />
      </div>
```

- [ ] **Step 4: Append the period-selector CSS**

Append to `app/globals.css`:

```css
/* ─── Seletor de período global (dashboard) ──────── */
.dashboard-period-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.dashboard-period-calendar { position: relative; margin-left: 20px; }
.dashboard-period-calendar-btn {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border: 1px solid var(--border); border-radius: 7px;
  background: var(--panel-2); color: var(--muted); cursor: pointer;
}
.dashboard-period-calendar-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.dashboard-period-popover {
  position: absolute; top: calc(100% + 6px); right: 0; z-index: 20;
  display: flex; flex-direction: column; gap: 8px;
  background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
  padding: 12px; box-shadow: 0 4px 16px rgba(0,0,0,.25); min-width: 180px;
}
.dashboard-period-popover label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: var(--muted); }
.dashboard-period-popover input[type="date"] {
  border: 1px solid var(--border); border-radius: 6px; padding: 5px 6px;
  background: var(--panel-2); color: var(--text-strong); font-size: 12px;
}
.dashboard-period-popover-apply {
  background: var(--accent); color: #fff; border: none; border-radius: 6px;
  padding: 7px 12px; font-size: 12px; font-weight: 700; cursor: pointer; margin-top: 2px;
}
```

- [ ] **Step 5: Run lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Run the unit suite**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add app/components/DashboardPeriodSelector.tsx app/components/DashboardPeriodCards.tsx app/dashboard/page.tsx app/globals.css
git commit -m "feat(dashboard): seletor de período global + card Leads [período]"
```

---

### Task 6: Card "Visitas agendadas [período]"

**Files:**
- Modify: `app/dashboard/page.tsx`
- Modify: `app/components/DashboardPeriodCards.tsx`

**Interfaces:**
- Consumes: `countVisitasAgendadasInRange` from `@/lib/dashboard-period` (Task 3); `DashboardLead` (Task 5, gains the already-optional `agendamento_data` field populated for real here).
- Produces: nothing new consumed by later tasks.

Migration 022 gate already handled — see the plan header. This task queries `agendamento_data` defensively: if the column doesn't exist yet in production, `data` comes back empty and the card shows 0, exactly per spec.

- [ ] **Step 1: Add the defensive agendamento fetch in `app/dashboard/page.tsx`**

Add near `fetchDashboardPeriodData`:
```typescript
// migration 022 (agendamento_data/agendamento_horario em leads) documentada
// como aplicada mas nunca rodou nesta instância Supabase — se a coluna não
// existir, o select abaixo volta com "data" vazio/nulo; o fallback (Map
// vazio) faz o card "Visitas agendadas" mostrar 0 em vez de quebrar a
// página. Rodar a migration em produção é decisão do Vitor, não automática.
async function fetchAgendamentoMap(supabase: SupabaseServerClient): Promise<Map<string, string | null>> {
  const { data } = await supabase.from("leads").select("id, agendamento_data");
  return new Map((data ?? []).map((l) => [l.id, l.agendamento_data as string | null]));
}
```

- [ ] **Step 2: Merge it into `fetchDashboardPeriodData`**

```typescript
async function fetchDashboardPeriodData(supabase: SupabaseServerClient): Promise<{ leads: DashboardLead[]; sellers: { id: string; nome: string }[] }> {
  const [leadsRes, sellersRes, agendamentoMap] = await Promise.all([
    supabase.from("leads").select("id, created_at, origem, assigned_to"),
    supabase.from("users").select("id, nome").eq("role", "vendedor"),
    fetchAgendamentoMap(supabase),
  ]);
  const leads: DashboardLead[] = (leadsRes.data ?? []).map((l) => ({
    ...l,
    agendamento_data: agendamentoMap.get(l.id) ?? null,
  }));
  return { leads, sellers: sellersRes.data ?? [] };
}
```

- [ ] **Step 3: Add the card in `DashboardPeriodCards.tsx`**

Add the import:
```typescript
import { resolveRange, periodLabel, countLeadsInRange, countVisitasAgendadasInRange, type PeriodSelection } from "@/lib/dashboard-period";
```

Add the computed value and the card:
```typescript
  const visitasCount = useMemo(() => countVisitasAgendadasInRange(leads, range), [leads, range]);
```

```typescript
      <div className="metrics-grid" style={{ margin: "0 16px 16px" }}>
        <div className="metric-card">
          <div className="metric-label">Leads {label}</div>
          <div className="metric-value">{leadsCount}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Visitas agendadas {label}</div>
          <div className="metric-value">{visitasCount}</div>
        </div>
      </div>
```

- [ ] **Step 4: Run lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Run the unit suite**

Run: `npm run test`
Expected: all tests pass (`countVisitasAgendadasInRange` already covered in Task 3's tests).

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/page.tsx app/components/DashboardPeriodCards.tsx
git commit -m "feat(dashboard): card Visitas agendadas [período] (migration 022, defensivo)"
```

---

### Task 7: Card "Leads por origem" (donut)

**Files:**
- Modify: `app/components/DashboardPeriodCards.tsx`
- Modify: `app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `breakdownByOrigem` from `@/lib/dashboard-period` (Task 3); `DonutChart` from `@/app/components/DonutChart` (Task 4).
- Produces: nothing new consumed by later tasks.

- [ ] **Step 1: Add the import and color map in `DashboardPeriodCards.tsx`**

```typescript
import { DonutChart } from "@/app/components/DonutChart";
import {
  resolveRange,
  periodLabel,
  countLeadsInRange,
  countVisitasAgendadasInRange,
  breakdownByOrigem,
  type PeriodSelection,
} from "@/lib/dashboard-period";

const ORIGEM_COLORS: Record<string, string> = {
  whatsapp: "#10B981",
  portal: "#005BFE",
  base_inativa: "#F59E0B",
  manual: "#8B5CF6",
  site: "#06B6D4",
};
```

- [ ] **Step 2: Compute the breakdown and render the donut**

```typescript
  const origemBreakdown = useMemo(() => breakdownByOrigem(leads, range), [leads, range]);
```

```typescript
      <div className="dashboard-donut-grid">
        <div className="donut-card">
          <span className="donut-card-title">Leads por Origem</span>
          <DonutChart
            segments={origemBreakdown.map((e) => ({
              label: e.label,
              value: e.count,
              color: ORIGEM_COLORS[e.key] ?? "#94A3B8",
            }))}
          />
        </div>
      </div>
```

Place this block right after the `metrics-grid` div, still inside the same `section-card`.

- [ ] **Step 3: Run lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Run the unit suite**

Run: `npm run test`
Expected: all tests pass (`breakdownByOrigem` already covered in Task 3's tests).

- [ ] **Step 5: Commit**

```bash
git add app/components/DashboardPeriodCards.tsx
git commit -m "feat(dashboard): card Leads por Origem (donut)"
```

---

### Task 8: Card "Leads por vendedor" (donut)

**Files:**
- Modify: `app/components/DashboardPeriodCards.tsx`

**Interfaces:**
- Consumes: `breakdownByVendedor` from `@/lib/dashboard-period` (Task 3); `DonutChart` from `@/app/components/DonutChart` (Task 4).
- Produces: nothing new — last task in this plan.

- [ ] **Step 1: Add the import and palette**

```typescript
import {
  resolveRange,
  periodLabel,
  countLeadsInRange,
  countVisitasAgendadasInRange,
  breakdownByOrigem,
  breakdownByVendedor,
  type PeriodSelection,
} from "@/lib/dashboard-period";

const VENDEDOR_PALETTE = ["#005BFE", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#94A3B8"];
```

- [ ] **Step 2: Compute the breakdown and render the second donut**

```typescript
  const vendedorBreakdown = useMemo(() => breakdownByVendedor(leads, sellers, range), [leads, sellers, range]);
```

Extend the `dashboard-donut-grid` block from Task 7:
```typescript
      <div className="dashboard-donut-grid">
        <div className="donut-card">
          <span className="donut-card-title">Leads por Origem</span>
          <DonutChart
            segments={origemBreakdown.map((e) => ({
              label: e.label,
              value: e.count,
              color: ORIGEM_COLORS[e.key] ?? "#94A3B8",
            }))}
          />
        </div>
        <div className="donut-card">
          <span className="donut-card-title">Leads por Vendedor</span>
          <DonutChart
            segments={vendedorBreakdown.map((e, i) => ({
              label: e.label,
              value: e.count,
              color: VENDEDOR_PALETTE[i % VENDEDOR_PALETTE.length],
            }))}
          />
        </div>
      </div>
```

- [ ] **Step 3: Run lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Run the unit suite**

Run: `npm run test`
Expected: all tests pass (`breakdownByVendedor` already covered in Task 3's tests).

- [ ] **Step 5: Commit**

```bash
git add app/components/DashboardPeriodCards.tsx
git commit -m "feat(dashboard): card Leads por Vendedor (donut)"
```

---

## Final Manual Validation (required before considering this done)

Per project rule, this redesign is not "done" until validated live:

1. `npm run dev`, log in, confirm `/dashboard` renders with all sections (ops-strip, Métricas Operacionais sem os 2 cards removidos, Tendência Diária, Painel por Período novo, Funil de Temperatura intocado, Ranking de Vendedores intocado).
2. Visit `/inicio` directly — confirm it redirects to `/dashboard`, no 404.
3. Click each pill (Hoje/7 dias/30 dias/Todo período) — confirm the 4 new cards recompute and the Funil de Temperatura does NOT change.
4. Open the calendar icon, pick a custom range spanning multiple months, apply — confirm the label and counts update correctly.
5. Confirm "Leads por Origem" and "Leads por Vendedor" donuts show correct counts against what `/leads` shows for the same window.
6. Confirm "Visitas agendadas" shows `0` if migration 022 hasn't run yet in this environment, without any error on the page.
7. Push to the branch, confirm the Husky pre-push hook (lint+typecheck+test) passes.
8. Validate on the Vercel preview / production per the project's usual rule (founder validates visually before merge).
