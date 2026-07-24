# Coleta de Financiamento e Troca + Agenda Interna — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** IA coleta dados de financiamento (nome/CPF/renda/entrada, single-shot) e de troca de moto (modelo/ano/km/serviço/agendamento, incremental) via WhatsApp, aciona handoff automático pro vendedor humano quando a coleta termina, e expõe uma página interna (`/agenda`) pro vendedor ver quem agendou pra trazer moto em qual dia. A IA nunca calcula financiamento nem avalia valor de troca — só coleta e repassa.

**Architecture:** Detecção de intenção é determinística (novo sinal `troca` em `lib/lead-scoring.ts`, reaproveitando `financiamento` já existente). Estado de coleta (`pending_topics`, rascunho de troca) fica em `leads.contexto` (jsonb) e é controlado por código, nunca pela LLM — mesma filosofia do guardrail de margem já existente ("regra inegociável garantida por código"). A LLM só faz duas coisas: (1) formular a pergunta certa quando instruída, (2) extrair dados de texto livre pro campo `collected_data` do JSON de resposta. Um módulo puro novo (`lib/collection.ts`) decide merge/completude de forma testável sem mock de banco. Agendamento vira colunas próprias em `leads` (não jsonb) porque a página `/agenda` precisa filtrar por dia.

**Tech Stack:** Next.js 14 (App Router, RSC), Supabase (Postgres + RLS), Anthropic SDK, Vitest.

## Global Constraints

- Toda regra de negócio inegociável (forçar `should_handoff`, redigir CPF de logs) é garantida em código — nunca confiar só na instrução do prompt pra LLM.
- CPF nunca aparece em `ai_logs.llm_output` nem em `console.*` — removido antes de logar, não apenas mascarado.
- Nenhuma persistência nova é fatal para o pipeline — falha de escrita de `contexto`/`agendamento_*` não pode impedir o envio da resposta ao lead (mesmo padrão non-fatal já usado para score/reativação em `lib/ai-pipeline.ts`).
- Isolamento multi-tenant obrigatório: toda query nova filtra por `store_id` (via RLS quando o cliente é escopado por sessão, ou `.eq("store_id", ...)` quando via `supabaseAdmin`).
- Antes de qualquer `git push`: `npm run lint && npm run typecheck && npm run test` devem passar (hook Husky `pre-push`).
- Sem cálculo de financiamento nem estimativa de valor de troca em código nenhum — a IA só coleta e repassa pro vendedor.

---

### Task 1: Migration — colunas de agendamento em `leads`

**Files:**
- Create: `supabase/migrations/022_troca_agendamento.sql` (ver nota de numeração abaixo)

**Interfaces:**
- Produces: `public.leads.agendamento_data` (date, nullable), `public.leads.agendamento_horario` (text, nullable)

**Nota de numeração:** existe um plano paralelo (`docs/superpowers/plans/2026-07-21-onboarding-wizard.md`) que reserva o número `021` (`021_onboarding_wizard.sql`) mas ainda não foi executado — o arquivo não existe em `supabase/migrations/` hoje. Antes de criar o arquivo abaixo, rode `ls supabase/migrations/` e confirme que `021_onboarding_wizard.sql` ainda não existe. Se já existir (a outra plan rodou primeiro), use `022`; se por algum motivo `022` também já existir, use o próximo número livre e ajuste o nome do arquivo e todas as referências abaixo.

- [ ] **Step 1: Escrever a migration**

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

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/022_troca_agendamento.sql
git commit -m "feat(db): add leads.agendamento_data + agendamento_horario (migration 022)"
```

- [ ] **Step 3: Aplicar em produção (manual, não automatizado)**

Mesma rotina das migrations 017-021: aplicar via Supabase Dashboard SQL editor ou `supabase db push` contra o projeto de produção, depois de merge. Confirmar com query somente-leitura que `leads.agendamento_data` e `leads.agendamento_horario` existem antes de considerar este task concluído. Não é bloqueante para os próximos tasks (código local roda contra schema de teste/dev).

---

### Task 2: Sinal determinístico "troca" (`lib/lead-scoring.ts`)

**Files:**
- Modify: `lib/lead-scoring.ts` (array `SIGNAL_DEFS`, função `calculateLeadScore`)
- Test: `tests/unit/lead-scoring.test.ts`

**Interfaces:**
- Produces: sinal `"troca"` reconhecido por `detectSignals(text: string): string[]` (já exportada); `+15` de delta em `calculateLeadScore` quando presente.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final de `tests/unit/lead-scoring.test.ts` (antes do `describe("sinal: visita"` existente ou em qualquer ponto do arquivo, seguindo o padrão dos blocos já existentes):

```ts
describe("sinal: troca", () => {
  it("+15 para 'quero dar minha moto na troca'", () => {
    const r = calculateLeadScore(input({ messageText: "quero dar minha moto na troca" }));
    expect(r.delta).toBeGreaterThanOrEqual(15);
    expect(r.reasons).toContain("troca");
  });

  it("+15 para 'vocês aceitam troca?'", () => {
    const r = calculateLeadScore(input({ messageText: "vocês aceitam troca?" }));
    expect(r.reasons).toContain("troca");
  });

  it("+15 para 'tenho uma moto usada'", () => {
    const r = calculateLeadScore(input({ messageText: "tenho uma moto usada pra dar" }));
    expect(r.reasons).toContain("troca");
  });

  it("negação: 'não quero dar troca' não aciona o sinal", () => {
    const signals = detectSignals("não quero dar troca");
    expect(signals).not.toContain("troca");
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar falha**

Run: `npm run test:unit -- lead-scoring`
Expected: FAIL — `reasons` não contém `"troca"` (sinal ainda não existe).

- [ ] **Step 3: Implementar o sinal**

Em `lib/lead-scoring.ts`, adicionar ao array `SIGNAL_DEFS` (depois da entry `veiculo_especifico`, antes de `visita`):

```ts
  {
    id: "troca",
    phrases: [["troca"], ["moto", "troca"], ["dar", "moto"], ["moto", "usada"], ["aceita", "troca"]],
  },
```

E em `calculateLeadScore`, depois do bloco `if (signals.includes("veiculo_especifico")) { ... }` e antes do bloco `if (signals.includes("visita"))`:

```ts
  if (signals.includes("troca")) {
    rawDelta += 15;
    reasons.push("troca");
  }
```

- [ ] **Step 4: Rodar os testes e confirmar sucesso**

Run: `npm run test:unit -- lead-scoring`
Expected: PASS — todos os testes de `sinal: troca` passam, e os testes pré-existentes continuam passando (nenhuma regressão).

- [ ] **Step 5: Commit**

```bash
git add lib/lead-scoring.ts tests/unit/lead-scoring.test.ts
git commit -m "feat(scoring): add deterministic 'troca' signal"
```

---

### Task 3: Tipos de coleta + `contexto` exposto em `AgentContext` (`lib/agent-context.ts`)

**Files:**
- Modify: `lib/agent-context.ts`

**Interfaces:**
- Produces: tipos exportados `FinanciamentoData`, `TrocaData`, `LeadContexto`; `AgentContext.lead.contexto: LeadContexto` (novo campo, sempre presente — a coluna tem `default '{}'::jsonb`, nunca é `null`).
- Consumido por: Task 4 (`lib/guardrails.ts`), Task 5 (`lib/ai.ts`), Task 6 (`lib/collection.ts`), Task 8 (`lib/ai-pipeline.ts`).

- [ ] **Step 1: Adicionar os tipos de dados coletados**

No topo de `lib/agent-context.ts`, depois dos imports existentes, adicionar:

```ts
export interface FinanciamentoData {
  nome_completo: string | null;
  cpf: string | null;
  renda_aproximada: string | null;
  entrada_disposta: string | null;
}

export interface TrocaData {
  modelo: string | null;
  ano: number | null;
  km: number | null;
  servico_recente: string | null;
  agendamento_data: string | null;    // "YYYY-MM-DD" ou null se não resolvido
  agendamento_horario: string | null; // texto livre ("tarde", "sábado de manhã") ou null
}

export interface LeadContexto {
  pending_topics?: string[];
  financiamento?: FinanciamentoData | null;
  troca?: TrocaData | null;
  troca_draft?: Partial<TrocaData> | null;
  [key: string]: unknown; // outras chaves já usadas no jsonb (ex: veiculo_interesse) não devem quebrar o tipo
}
```

- [ ] **Step 2: Expor `contexto` em `AgentContext.lead`**

Modificar a interface `AgentContext` (dentro do bloco `lead: { ... }`):

```ts
  lead: {
    id: string;
    nome: string | null;
    phone_normalized: string;
    lead_status: LeadStatus;
    score: number;
    origem: Origem;
    contexto: LeadContexto;
  };
```

- [ ] **Step 3: Selecionar a coluna na query e ajustar o retorno**

Em `buildAgentContext`, no `select` de `leads`:

```ts
    supabaseAdmin
      .from("leads")
      .select("id, nome, phone_normalized, lead_status, score, origem, contexto")
      .eq("id", leadId)
      .single(),
```

E ajustar o retorno (a coluna `contexto` sempre vem preenchida pelo banco, mas o fallback `?? {}` protege contra dado inesperado em teste/mock):

```ts
    lead: {
      ...(leadRes.data as AgentContext["lead"]),
      contexto: (leadRes.data?.contexto ?? {}) as LeadContexto,
    },
```

- [ ] **Step 4: Rodar typecheck**

Run: `npm run typecheck`
Expected: PASS. Nenhum outro arquivo referencia `AgentContext.lead` de forma que quebre com o campo novo (campo adicionado, não removido/renomeado) — mas confirme que nenhum erro aparece, especialmente em `tests/unit/guardrails.test.ts` e `tests/unit/prompts.test.ts`, que constroem `AgentContext` manualmente (`makeCtx`). Se o typecheck reclamar de propriedade `contexto` ausente nesses `makeCtx()`, adicione `contexto: {}` ao objeto `lead` default em ambos os arquivos antes de prosseguir.

- [ ] **Step 5: Commit**

```bash
git add lib/agent-context.ts tests/unit/guardrails.test.ts tests/unit/prompts.test.ts
git commit -m "feat(context): expose leads.contexto in AgentContext + collection data types"
```

---

### Task 4: Guardrails — detecção de coleta (`lib/guardrails.ts`)

**Files:**
- Modify: `lib/guardrails.ts`
- Test: `tests/unit/guardrails.test.ts`

**Interfaces:**
- Consumes: `LeadContexto`, `TrocaData` de `@/lib/agent-context` (Task 3); `detectSignals` de `@/lib/lead-scoring` (Task 2).
- Produces: tipos exportados `CollectionTopic` (`"financiamento" | "troca"`), `CollectionState` (`{ ask: CollectionTopic[]; collect: CollectionTopic[]; missingTrocaFields: string[] }`); `GuardrailResult.collection: CollectionState | null` (novo campo, sempre presente no objeto retornado por `runGuardrails`, exceto quando `mode === "human_handoff"` onde é sempre `null`).
- Consumido por: Task 6 (`lib/collection.ts`), Task 7 (`lib/prompts.ts`), Task 8 (`lib/ai-pipeline.ts`).

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final de `tests/unit/guardrails.test.ts`:

```ts
describe("collection — detecção de financiamento/troca", () => {
  it("mensagem nova sobre financiamento => collection.ask contém 'financiamento'", () => {
    const ctx = makeCtx({ incoming_text: "vocês têm financiamento?" });
    const r = runGuardrails(ctx, { now: BUSINESS_NOW });
    expect(r.collection?.ask).toContain("financiamento");
    expect(r.collection?.collect).toEqual([]);
  });

  it("mensagem nova sobre troca => collection.ask contém 'troca'", () => {
    const ctx = makeCtx({ incoming_text: "aceita moto na troca?" });
    const r = runGuardrails(ctx, { now: BUSINESS_NOW });
    expect(r.collection?.ask).toContain("troca");
  });

  it("pending_topics já contém 'financiamento' => collection.collect contém 'financiamento', ask vazio pro mesmo tópico", () => {
    const ctx = makeCtx({
      incoming_text: "meu nome é João, CPF 123, renda 3000, entrada 2000",
      lead: { ...makeCtx().lead, contexto: { pending_topics: ["financiamento"] } },
    });
    const r = runGuardrails(ctx, { now: BUSINESS_NOW });
    expect(r.collection?.collect).toContain("financiamento");
    expect(r.collection?.ask).not.toContain("financiamento");
  });

  it("sem sinal e sem pending_topics => collection é null", () => {
    const ctx = makeCtx({ incoming_text: "quero saber mais sobre o carro" });
    const r = runGuardrails(ctx, { now: BUSINESS_NOW });
    expect(r.collection).toBeNull();
  });

  it("modo human_handoff => collection sempre null", () => {
    const ctx = makeCtx({
      incoming_text: "vocês têm financiamento?",
      conversation: {
        id: "conv-1",
        conversation_status: "AGUARDANDO_HUMANO",
        handoff_to: "HUMANO",
        summary: null,
        ultima_mensagem_em: new Date().toISOString(),
      },
    });
    const r = runGuardrails(ctx, { now: BUSINESS_NOW });
    expect(r.mode).toBe("human_handoff");
    expect(r.collection).toBeNull();
  });

  it("troca já coletada (contexto.troca preenchido) não reabre ask mesmo com sinal na mensagem", () => {
    const ctx = makeCtx({
      incoming_text: "e aquela troca que eu falei?",
      lead: {
        ...makeCtx().lead,
        contexto: {
          troca: {
            modelo: "Bros 160", ano: 2019, km: 20000,
            servico_recente: "não", agendamento_data: null, agendamento_horario: "sábado de manhã",
          },
        },
      },
    });
    const r = runGuardrails(ctx, { now: BUSINESS_NOW });
    expect(r.collection?.ask ?? []).not.toContain("troca");
  });

  it("collect de troca calcula missingTrocaFields a partir do draft parcial", () => {
    const ctx = makeCtx({
      incoming_text: "é uma Bros 160 2019",
      lead: {
        ...makeCtx().lead,
        contexto: { pending_topics: ["troca"], troca_draft: { modelo: null, ano: null } },
      },
    });
    const r = runGuardrails(ctx, { now: BUSINESS_NOW });
    expect(r.collection?.collect).toContain("troca");
    expect(r.collection?.missingTrocaFields.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar falha**

Run: `npm run test:unit -- guardrails`
Expected: FAIL — `r.collection` é `undefined` (propriedade ainda não existe).

- [ ] **Step 3: Implementar**

Em `lib/guardrails.ts`, adicionar os imports e tipos novos, e reescrever `GuardrailResult`/`runGuardrails`:

```ts
import type { AgentContext, LeadContexto, TrocaData } from "@/lib/agent-context";
import { detectSignals } from "@/lib/lead-scoring";

export type GuardrailMode =
  | "normal"
  | "short_message"
  | "off_hours"
  | "reopen"
  | "human_handoff";

export type CollectionTopic = "financiamento" | "troca";

export interface CollectionState {
  ask: CollectionTopic[];
  collect: CollectionTopic[];
  missingTrocaFields: string[];
}

export interface GuardrailResult {
  mode: GuardrailMode;
  reason: string;
  collection: CollectionState | null;
}
```

Adicionar, antes de `runGuardrails`, a lógica de detecção (funções auxiliares, não exportadas):

```ts
const TROCA_REQUIRED_FIELDS: Array<{ key: keyof TrocaData; label: string }> = [
  { key: "modelo", label: "modelo da moto" },
  { key: "ano", label: "ano da moto" },
  { key: "km", label: "quantos km rodados" },
  { key: "servico_recente", label: "se fez algum serviço recente, principalmente no motor" },
  { key: "agendamento_horario", label: "dia e horário que consegue vir até a loja" },
];

function isFilled(v: unknown): boolean {
  return v !== undefined && v !== null && v !== "";
}

function computeMissingTrocaFields(draft: Partial<TrocaData> | null | undefined): string[] {
  const d = draft ?? {};
  return TROCA_REQUIRED_FIELDS.filter(({ key }) => !isFilled(d[key])).map(({ label }) => label);
}

function detectCollection(ctx: AgentContext): CollectionState | null {
  const contexto: LeadContexto = ctx.lead.contexto ?? {};
  const pending = new Set(contexto.pending_topics ?? []);
  const collect: CollectionTopic[] = [];
  if (pending.has("financiamento")) collect.push("financiamento");
  if (pending.has("troca")) collect.push("troca");

  const signals = detectSignals(ctx.incoming_text);
  const ask: CollectionTopic[] = [];
  if (signals.includes("financiamento") && !pending.has("financiamento") && !contexto.financiamento) {
    ask.push("financiamento");
  }
  if (signals.includes("troca") && !pending.has("troca") && !contexto.troca) {
    ask.push("troca");
  }

  if (ask.length === 0 && collect.length === 0) return null;

  const missingTrocaFields = collect.includes("troca")
    ? computeMissingTrocaFields(contexto.troca_draft)
    : [];

  return { ask, collect, missingTrocaFields };
}
```

Reescrever `runGuardrails` pra computar `mode`/`reason` como antes, mas retornando `collection` no final (em vez de `return` antecipado em cada branch, exceto `human_handoff` que continua retornando cedo com `collection: null`):

```ts
export function runGuardrails(
  ctx: AgentContext,
  config?: GuardrailConfig
): GuardrailResult {
  const start = config?.businessHoursStart ?? 8;
  const end   = config?.businessHoursEnd   ?? 18;
  const tz    = config?.timezone           ?? "America/Sao_Paulo";
  const now   = config?.now                ?? new Date();

  // 1. Conversa encerrada → reavaliar contexto (prioridade máxima)
  if (ctx.conversation.conversation_status === "ENCERRADA") {
    return {
      mode: "reopen",
      reason: "conversa encerrada — tratar como novo contato",
      collection: detectCollection(ctx),
    };
  }

  // 2. Handoff humano ativo → IA não deve responder, coleta não se aplica
  if (
    ctx.conversation.handoff_to === "HUMANO" ||
    ctx.conversation.conversation_status === "AGUARDANDO_HUMANO"
  ) {
    return { mode: "human_handoff", reason: "conversa sob controle humano", collection: null };
  }

  // 3. Fora do horário comercial (engloba mensagem curta fora do horário)
  const hour = getHourInTimezone(now, tz);
  if (hour < start || hour >= end) {
    return {
      mode: "off_hours",
      reason: `fora do horário comercial (${hour}h, esperado ${start}h–${end}h BRT)`,
      collection: detectCollection(ctx),
    };
  }

  // 4. Mensagem muito curta
  if (ctx.incoming_text.trim().length < 10) {
    return {
      mode: "short_message",
      reason: "mensagem muito curta — estimular continuação",
      collection: detectCollection(ctx),
    };
  }

  return { mode: "normal", reason: "atendimento comercial padrão", collection: detectCollection(ctx) };
}
```

- [ ] **Step 4: Rodar os testes e confirmar sucesso**

Run: `npm run test:unit -- guardrails`
Expected: PASS — todos os testes novos e os pré-existentes (prioridades 1-4, `reason` nunca vazio etc).

- [ ] **Step 5: Rodar typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/guardrails.ts tests/unit/guardrails.test.ts
git commit -m "feat(guardrails): add deterministic collection state for financiamento/troca"
```

---

### Task 5: `AgentResult.collected_data` + validação (`lib/ai.ts`)

**Files:**
- Modify: `lib/ai.ts`
- Test: `tests/unit/ai-validation.test.ts`

**Interfaces:**
- Consumes: `FinanciamentoData`, `TrocaData` de `@/lib/agent-context` (Task 3).
- Produces: `AgentResult.collected_data?: { financiamento?: FinanciamentoData | null; troca?: TrocaData | null }`; `validateOutput` nunca lança erro por causa de `collected_data` malformado (sempre `undefined` nesse caso, resposta continua válida).
- Consumido por: Task 6 (`lib/collection.ts`), Task 7 (prompt/schema doc), Task 8 (`lib/ai-pipeline.ts`).

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final de `tests/unit/ai-validation.test.ts`:

```ts
describe("validateOutput — collected_data", () => {
  it("collected_data ausente → resultado sem a chave collected_data", () => {
    const result = validateOutput(base, 0);
    expect(result.collected_data).toBeUndefined();
  });

  it("collected_data.financiamento válido é extraído com todos os campos", () => {
    const raw = {
      ...base,
      collected_data: {
        financiamento: {
          nome_completo: "João Silva",
          cpf: "123.456.789-00",
          renda_aproximada: "3000",
          entrada_disposta: "2000",
        },
      },
    };
    const result = validateOutput(raw, 0);
    expect(result.collected_data?.financiamento).toEqual({
      nome_completo: "João Silva",
      cpf: "123.456.789-00",
      renda_aproximada: "3000",
      entrada_disposta: "2000",
    });
  });

  it("collected_data.troca parcial preenche campos ausentes com null", () => {
    const raw = {
      ...base,
      collected_data: { troca: { modelo: "Bros 160", ano: 2019 } },
    };
    const result = validateOutput(raw, 0);
    expect(result.collected_data?.troca).toEqual({
      modelo: "Bros 160",
      ano: 2019,
      km: null,
      servico_recente: null,
      agendamento_data: null,
      agendamento_horario: null,
    });
  });

  it("collected_data malformado (string em vez de objeto) não lança erro e resulta undefined", () => {
    const raw = { ...base, collected_data: "não sei" };
    expect(() => validateOutput(raw, 0)).not.toThrow();
    const result = validateOutput(raw, 0);
    expect(result.collected_data).toBeUndefined();
  });

  it("collected_data com financiamento e troca ambos null → collected_data undefined", () => {
    const raw = { ...base, collected_data: { financiamento: null, troca: null } };
    const result = validateOutput(raw, 0);
    expect(result.collected_data).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar falha**

Run: `npm run test:unit -- ai-validation`
Expected: FAIL — `collected_data` não existe em `AgentResult`.

- [ ] **Step 3: Implementar**

Em `lib/ai.ts`, adicionar o import e os tipos, e estender `AgentResult`:

```ts
import type { FinanciamentoData, TrocaData } from "@/lib/agent-context";
```

```ts
export interface CollectedData {
  financiamento?: FinanciamentoData | null;
  troca?: TrocaData | null;
}

export interface AgentResult {
  reply_text: string;
  should_handoff: boolean;
  score: number;
  intent_tags: string[];
  summary: string;
  collected_data?: CollectedData;
}
```

Adicionar as funções de validação (antes de `validateOutput`, depois de `truncate`):

```ts
function coerceStringOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function coerceNumberOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function validateFinanciamento(raw: unknown): FinanciamentoData | null {
  if (raw === null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    nome_completo: coerceStringOrNull(o.nome_completo),
    cpf: coerceStringOrNull(o.cpf),
    renda_aproximada: coerceStringOrNull(o.renda_aproximada),
    entrada_disposta: coerceStringOrNull(o.entrada_disposta),
  };
}

function validateTroca(raw: unknown): TrocaData | null {
  if (raw === null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    modelo: coerceStringOrNull(o.modelo),
    ano: coerceNumberOrNull(o.ano),
    km: coerceNumberOrNull(o.km),
    servico_recente: coerceStringOrNull(o.servico_recente),
    agendamento_data: coerceStringOrNull(o.agendamento_data),
    agendamento_horario: coerceStringOrNull(o.agendamento_horario),
  };
}

function validateCollectedData(raw: unknown): CollectedData | undefined {
  if (raw === null || raw === undefined || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const financiamento = validateFinanciamento(o.financiamento);
  const troca = validateTroca(o.troca);
  if (!financiamento && !troca) return undefined;
  return { financiamento, troca };
}
```

E no final de `validateOutput`, antes do `return`:

```ts
  const collected_data = validateCollectedData(obj?.collected_data);

  return {
    reply_text,
    should_handoff,
    score,
    intent_tags,
    summary,
    ...(collected_data ? { collected_data } : {}),
  };
```

- [ ] **Step 4: Rodar os testes e confirmar sucesso**

Run: `npm run test:unit -- ai-validation`
Expected: PASS.

- [ ] **Step 5: Rodar suíte completa de `lib/ai.ts`**

Run: `npm run test:unit -- ai-output-guardrails ai-timeout`
Expected: PASS — nenhuma regressão nos testes existentes de timeout/parse/output error.

- [ ] **Step 6: Commit**

```bash
git add lib/ai.ts tests/unit/ai-validation.test.ts
git commit -m "feat(ai): add collected_data field to AgentResult with lenient validation"
```

---

### Task 6: Módulo puro de merge/completude (`lib/collection.ts`)

**Files:**
- Create: `lib/collection.ts`
- Test: `tests/unit/collection.test.ts`

**Interfaces:**
- Consumes: `LeadContexto`, `TrocaData`, `FinanciamentoData` de `@/lib/agent-context` (Task 3); `CollectionState` de `@/lib/guardrails` (Task 4); `CollectedData` de `@/lib/ai` (Task 5).
- Produces: função pura `applyCollectionUpdate(contexto: LeadContexto, collection: CollectionState, collectedData: CollectedData | undefined): CollectionUpdate`, onde `CollectionUpdate = { contexto: LeadContexto; agendamento: { data: string | null; horario: string | null } | null; forceHandoff: boolean }`.
- Consumido por: Task 8 (`lib/ai-pipeline.ts`).

Este módulo não toca banco — só decide o que persistir. Isso permite testar toda a lógica de merge/completude sem mockar Supabase.

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/unit/collection.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { applyCollectionUpdate } from "@/lib/collection";
import type { CollectionState } from "@/lib/guardrails";
import type { LeadContexto } from "@/lib/agent-context";

function collectionState(overrides: Partial<CollectionState> = {}): CollectionState {
  return { ask: [], collect: [], missingTrocaFields: [], ...overrides };
}

describe("applyCollectionUpdate — fase ask", () => {
  it("adiciona tópico novo a pending_topics, sem forçar handoff", () => {
    const result = applyCollectionUpdate({}, collectionState({ ask: ["financiamento"] }), undefined);
    expect(result.contexto.pending_topics).toEqual(["financiamento"]);
    expect(result.forceHandoff).toBe(false);
    expect(result.agendamento).toBeNull();
  });

  it("ask com dois tópicos simultâneos — ambos entram em pending_topics", () => {
    const result = applyCollectionUpdate({}, collectionState({ ask: ["financiamento", "troca"] }), undefined);
    expect(result.contexto.pending_topics).toEqual(["financiamento", "troca"]);
  });
});

describe("applyCollectionUpdate — financiamento (single-shot)", () => {
  it("collect de financiamento persiste dados e força handoff, mesmo parcial", () => {
    const contexto: LeadContexto = { pending_topics: ["financiamento"] };
    const result = applyCollectionUpdate(
      contexto,
      collectionState({ collect: ["financiamento"] }),
      { financiamento: { nome_completo: "João", cpf: null, renda_aproximada: null, entrada_disposta: null } }
    );
    expect(result.contexto.financiamento).toEqual({
      nome_completo: "João", cpf: null, renda_aproximada: null, entrada_disposta: null,
    });
    expect(result.contexto.pending_topics).toEqual([]);
    expect(result.forceHandoff).toBe(true);
  });

  it("collect de financiamento sem collected_data ainda assim força handoff (resposta veio, mesmo vazia)", () => {
    const contexto: LeadContexto = { pending_topics: ["financiamento"] };
    const result = applyCollectionUpdate(contexto, collectionState({ collect: ["financiamento"] }), undefined);
    expect(result.forceHandoff).toBe(true);
    expect(result.contexto.pending_topics).toEqual([]);
  });
});

describe("applyCollectionUpdate — troca (incremental)", () => {
  it("merge parcial: campo null da LLM não sobrescreve valor já conhecido no draft", () => {
    const contexto: LeadContexto = {
      pending_topics: ["troca"],
      troca_draft: { modelo: "Bros 160", ano: 2019 },
    };
    const result = applyCollectionUpdate(
      contexto,
      collectionState({ collect: ["troca"] }),
      { troca: { modelo: null, ano: null, km: 32000, servico_recente: null, agendamento_data: null, agendamento_horario: null } }
    );
    expect(result.contexto.troca_draft).toMatchObject({ modelo: "Bros 160", ano: 2019, km: 32000 });
    expect(result.forceHandoff).toBe(false);
  });

  it("troca incompleta não finaliza nem força handoff", () => {
    const contexto: LeadContexto = { pending_topics: ["troca"], troca_draft: { modelo: "Bros 160" } };
    const result = applyCollectionUpdate(contexto, collectionState({ collect: ["troca"] }), undefined);
    expect(result.contexto.troca).toBeUndefined();
    expect(result.contexto.pending_topics).toEqual(["troca"]);
    expect(result.forceHandoff).toBe(false);
    expect(result.agendamento).toBeNull();
  });

  it("troca completa (5 campos) finaliza, limpa draft, remove de pending, força handoff e retorna agendamento", () => {
    const contexto: LeadContexto = { pending_topics: ["troca"], troca_draft: { modelo: "Bros 160", ano: 2019, km: 32000, servico_recente: "não" } };
    const result = applyCollectionUpdate(
      contexto,
      collectionState({ collect: ["troca"] }),
      { troca: { modelo: null, ano: null, km: null, servico_recente: null, agendamento_data: "2026-07-28", agendamento_horario: "tarde" } }
    );
    expect(result.contexto.troca).toEqual({
      modelo: "Bros 160", ano: 2019, km: 32000, servico_recente: "não",
      agendamento_data: "2026-07-28", agendamento_horario: "tarde",
    });
    expect(result.contexto.troca_draft).toBeNull();
    expect(result.contexto.pending_topics).toEqual([]);
    expect(result.forceHandoff).toBe(true);
    expect(result.agendamento).toEqual({ data: "2026-07-28", horario: "tarde" });
  });

  it("troca completa sem agendamento_data (só horário) ainda finaliza — data é opcional", () => {
    const contexto: LeadContexto = {
      pending_topics: ["troca"],
      troca_draft: { modelo: "Bros 160", ano: 2019, km: 32000, servico_recente: "não", agendamento_horario: "sábado de manhã" },
    };
    const result = applyCollectionUpdate(contexto, collectionState({ collect: ["troca"] }), undefined);
    expect(result.contexto.troca).not.toBeNull();
    expect(result.agendamento).toEqual({ data: null, horario: "sábado de manhã" });
  });
});

describe("applyCollectionUpdate — financiamento e troca simultâneos", () => {
  it("processa collect de financiamento e ask de troca no mesmo turno sem interferência", () => {
    const contexto: LeadContexto = { pending_topics: ["financiamento"] };
    const result = applyCollectionUpdate(
      contexto,
      collectionState({ ask: ["troca"], collect: ["financiamento"] }),
      { financiamento: { nome_completo: "Maria", cpf: "111", renda_aproximada: "4000", entrada_disposta: "3000" } }
    );
    expect(result.contexto.financiamento?.nome_completo).toBe("Maria");
    expect(result.contexto.pending_topics).toEqual(["troca"]);
    expect(result.forceHandoff).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar falha**

Run: `npm run test:unit -- collection`
Expected: FAIL — `Cannot find module '@/lib/collection'`.

- [ ] **Step 3: Implementar**

Criar `lib/collection.ts`:

```ts
import type { LeadContexto, TrocaData } from "@/lib/agent-context";
import type { CollectionState } from "@/lib/guardrails";
import type { CollectedData } from "@/lib/ai";

export interface CollectionUpdate {
  contexto: LeadContexto;
  agendamento: { data: string | null; horario: string | null } | null;
  forceHandoff: boolean;
}

const TROCA_REQUIRED_KEYS: (keyof TrocaData)[] = [
  "modelo",
  "ano",
  "km",
  "servico_recente",
  "agendamento_horario",
];

function isFilled(v: unknown): boolean {
  return v !== undefined && v !== null && v !== "";
}

function trocaComplete(draft: Partial<TrocaData>): boolean {
  return TROCA_REQUIRED_KEYS.every((k) => isFilled(draft[k]));
}

function mergeTrocaDraft(
  existing: Partial<TrocaData> | null | undefined,
  incoming: Partial<TrocaData> | null | undefined
): Partial<TrocaData> {
  const base: Partial<TrocaData> = { ...(existing ?? {}) };
  if (!incoming) return base;
  (Object.keys(incoming) as (keyof TrocaData)[]).forEach((key) => {
    const value = incoming[key];
    if (isFilled(value)) {
      (base as Record<string, unknown>)[key] = value;
    }
  });
  return base;
}

export function applyCollectionUpdate(
  contexto: LeadContexto,
  collection: CollectionState,
  collectedData: CollectedData | undefined
): CollectionUpdate {
  const next: LeadContexto = { ...contexto };
  const pendingTopics = new Set(next.pending_topics ?? []);
  let forceHandoff = false;
  let agendamento: { data: string | null; horario: string | null } | null = null;

  for (const topic of collection.ask) {
    pendingTopics.add(topic);
  }

  if (collection.collect.includes("financiamento")) {
    const data = collectedData?.financiamento;
    next.financiamento = {
      nome_completo: data?.nome_completo ?? null,
      cpf: data?.cpf ?? null,
      renda_aproximada: data?.renda_aproximada ?? null,
      entrada_disposta: data?.entrada_disposta ?? null,
    };
    pendingTopics.delete("financiamento");
    forceHandoff = true;
  }

  if (collection.collect.includes("troca")) {
    const merged = mergeTrocaDraft(next.troca_draft, collectedData?.troca);
    if (trocaComplete(merged)) {
      next.troca = merged as TrocaData;
      next.troca_draft = null;
      pendingTopics.delete("troca");
      forceHandoff = true;
      agendamento = {
        data: merged.agendamento_data ?? null,
        horario: merged.agendamento_horario ?? null,
      };
    } else {
      next.troca_draft = merged;
    }
  }

  next.pending_topics = Array.from(pendingTopics);
  return { contexto: next, agendamento, forceHandoff };
}
```

- [ ] **Step 4: Rodar os testes e confirmar sucesso**

Run: `npm run test:unit -- collection`
Expected: PASS — todos os casos (ask, financiamento single-shot, troca incremental com merge parcial, completude, ambos simultâneos).

- [ ] **Step 5: Rodar typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/collection.ts tests/unit/collection.test.ts
git commit -m "feat(collection): add pure merge/completeness logic for financiamento/troca"
```

---

### Task 7: Prompt — instruções de coleta + data atual (`lib/prompts.ts`)

**Files:**
- Modify: `lib/prompts.ts`
- Test: `tests/unit/prompts.test.ts`

**Interfaces:**
- Consumes: `CollectionState`, `CollectionTopic` de `@/lib/guardrails` (Task 4).
- Produces: `buildPrompt(ctx: AgentContext, guardrail: GuardrailResult, now?: Date): PromptPayload` (novo 3º parâmetro opcional, default `new Date()`); bloco `[COLETA DE DADOS]` e `[DATA ATUAL]` no `system` prompt quando aplicável; documentação do campo `collected_data` no template JSON.
- Consumido por: Task 8 (`lib/ai-pipeline.ts`).

- [ ] **Step 1: Escrever os testes que falham**

Primeiro, corrigir a fixture existente em `tests/unit/prompts.test.ts` (linha 38) que hoje quebra o typecheck por faltar `collection`:

```ts
const guardrailNormal: GuardrailResult = { mode: "normal", reason: "padrão", collection: null };
```

E a chamada na linha ~98 (`modo off_hours refletido no system`):

```ts
    const { system } = buildPrompt(makeCtx(), { mode: "off_hours", reason: "tarde", collection: null });
```

Depois, adicionar ao final do arquivo:

```ts
describe("buildPrompt — coleta de financiamento/troca", () => {
  it("sem collection: bloco [COLETA DE DADOS] não aparece", () => {
    const { system } = buildPrompt(makeCtx(), guardrailNormal);
    expect(system).not.toContain("[COLETA DE DADOS]");
  });

  it("ask financiamento: instrui pergunta única com nome/CPF/renda/entrada", () => {
    const guardrail: GuardrailResult = {
      mode: "normal", reason: "padrão",
      collection: { ask: ["financiamento"], collect: [], missingTrocaFields: [] },
    };
    const { system } = buildPrompt(makeCtx(), guardrail);
    expect(system).toContain("[COLETA DE DADOS]");
    expect(system).toContain("CPF");
    expect(system).toContain("entrada");
  });

  it("collect financiamento: instrui should_handoff=true e menciona collected_data", () => {
    const guardrail: GuardrailResult = {
      mode: "normal", reason: "padrão",
      collection: { ask: [], collect: ["financiamento"], missingTrocaFields: [] },
    };
    const { system } = buildPrompt(makeCtx(), guardrail);
    expect(system).toContain("should_handoff=true");
    expect(system).toContain("collected_data");
  });

  it("ask troca: instrui pergunta única por vez, começando por modelo/ano", () => {
    const guardrail: GuardrailResult = {
      mode: "normal", reason: "padrão",
      collection: { ask: ["troca"], collect: [], missingTrocaFields: [] },
    };
    const { system } = buildPrompt(makeCtx(), guardrail);
    expect(system).toContain("modelo");
  });

  it("collect troca: lista campos faltantes quando presentes", () => {
    const guardrail: GuardrailResult = {
      mode: "normal", reason: "padrão",
      collection: { ask: [], collect: ["troca"], missingTrocaFields: ["quantos km rodados"] },
    };
    const { system } = buildPrompt(makeCtx(), guardrail);
    expect(system).toContain("quantos km rodados");
  });

  it("json schema documenta collected_data", () => {
    const { system } = buildPrompt(makeCtx(), guardrailNormal);
    expect(system).toContain("collected_data");
  });

  it("[DATA ATUAL] presente no system com a data injetada", () => {
    const fixedNow = new Date("2026-07-24T15:00:00.000Z");
    const { system } = buildPrompt(makeCtx(), guardrailNormal, fixedNow);
    expect(system).toContain("[DATA ATUAL]");
    expect(system).toContain("2026-07-24");
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar falha**

Run: `npm run test:unit -- prompts`
Expected: FAIL — typecheck falha nas fixtures antigas (campo `collection` ausente) até o Step 1 estar aplicado; depois disso, os testes novos falham por `[COLETA DE DADOS]`/`[DATA ATUAL]` não existirem ainda.

- [ ] **Step 3: Implementar**

Em `lib/prompts.ts`, importar o tipo novo:

```ts
import type { GuardrailResult, GuardrailMode, CollectionTopic } from "@/lib/guardrails";
```

Adicionar, depois de `MODE_INSTRUCTIONS`:

```ts
const ASK_INSTRUCTIONS: Record<CollectionTopic, string> = {
  financiamento:
    'O lead demonstrou interesse em financiamento. Nesta resposta, faça UMA única pergunta reunindo, numa mensagem só: nome completo, CPF, renda aproximada, e "quanto você tá disposto a dar de entrada?". Não calcule parcela, taxa ou condição nenhuma — só colete os dados. Um vendedor vai testar em várias financeiras depois.',
  troca:
    "O lead mencionou moto na troca. Pergunte apenas UM dado por vez — nunca junte tudo numa mensagem só. Você ainda não sabe nada sobre a moto dele: comece perguntando o modelo e o ano.",
};

const COLLECT_INSTRUCTIONS: Record<CollectionTopic, string> = {
  financiamento:
    "O lead está respondendo à pergunta de financiamento feita anteriormente. Extraia nome completo, CPF, renda aproximada e quanto ele tá disposto a dar de entrada da resposta, preenchendo collected_data.financiamento (use null pro que não conseguir identificar). Sempre defina should_handoff=true nesta resposta e avise o lead que um vendedor vai continuar o atendimento.",
  troca:
    "O lead está no meio da coleta de dados da moto de troca. Extraia da resposta atual o que conseguir pros campos de collected_data.troca (modelo, ano, km, servico_recente, agendamento_data, agendamento_horario — use null pro que ainda não souber). Alguns modelo+ano têm variações relevantes (ex: Honda Titan 2010 pode ser partida elétrica ou pedal/kickstart) — se reconhecer isso pelo seu conhecimento sobre motos, só considere o campo modelo completo depois de perguntar a variação. Quando tiver os 5 campos, avise que um vendedor vai confirmar e defina should_handoff=true.",
};

function buildCollectionSection(guardrail: GuardrailResult): string {
  const c = guardrail.collection;
  if (!c || (c.ask.length === 0 && c.collect.length === 0)) return "";

  const lines: string[] = ["[COLETA DE DADOS]"];
  for (const topic of c.ask) lines.push(ASK_INSTRUCTIONS[topic]);
  for (const topic of c.collect) {
    lines.push(COLLECT_INSTRUCTIONS[topic]);
    if (topic === "troca" && c.missingTrocaFields.length > 0) {
      lines.push(`Campos que ainda faltam: ${c.missingTrocaFields.join(", ")}. Pergunte apenas o próximo campo que falta.`);
    }
  }
  return lines.join("\n");
}

function formatToday(now: Date): string {
  const iso = now.toISOString().slice(0, 10);
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "America/Sao_Paulo" }).format(now);
  return `${iso} (${weekday})`;
}
```

Modificar `buildSystem` pra aceitar `now` e injetar as novas seções:

```ts
function buildSystem(ctx: AgentContext, guardrail: GuardrailResult, now: Date): string {
  const summary =
    ctx.conversation.summary ?? "Primeiro contato ou sem resumo disponível.";

  const collectionSection = buildCollectionSection(guardrail);

  return `[IDENTIDADE]
Você é o atendente virtual da ${ctx.store_name}.
Atende leads via WhatsApp com foco em venda de veículos.

[TOM DE VOZ]
- Seja direto, natural e profissional
- Evite respostas longas demais — máximo 3 a 4 frases por mensagem
- Foque em avançar a conversa para a venda
- Não seja robótico nem use linguagem corporativa

[DATA ATUAL]
${formatToday(now)} — horário de Brasília. Use isso pra converter dias relativos ("amanhã", "sábado") em data absoluta quando o lead falar de agendamento.

[CONTEXTO DO LEAD]
Nome: ${ctx.lead.nome ?? "não informado"}
Origem: ${ctx.lead.origem}
Status: ${ctx.lead.lead_status}
Score atual: ${ctx.lead.score}/100

[RESUMO DA CONVERSA]
${summary}

[CATÁLOGO DISPONÍVEL — até 6 veículos]
${formatVehicles(ctx.vehicles)}

[MODO ATUAL: ${guardrail.mode}]
${MODE_INSTRUCTIONS[guardrail.mode]}
${collectionSection ? "\n" + collectionSection + "\n" : ""}
[FORMATO DE RESPOSTA]
Responda EXCLUSIVAMENTE em JSON válido, sem texto fora do JSON:
{
  "reply_text": "string com resposta ao lead",
  "should_handoff": false,
  "score": 0,
  "intent_tags": [],
  "summary": "resumo atualizado da conversa",
  "collected_data": { "financiamento": null, "troca": null }
}
collected_data só deve ser preenchido quando houver instrução de coleta ativa na seção [COLETA DE DADOS] acima; caso contrário, deixe os dois campos null.

[REGRAS FIXAS]
- Nunca invente informações sobre veículos
- Nunca prometa condições fora do catálogo
- Se não souber, diga que vai verificar
- Responda sempre em português
- Respostas curtas e objetivas — máximo 3 a 4 frases
- Nunca aceite, confirme ou sugira preço abaixo da margem mínima do veículo
- Se o lead insistir em desconto que resulte em preço abaixo da margem mínima, defina should_handoff=true e informe que precisa validar com o time
- Nunca calcule financiamento (parcela, taxa, valor final) nem estime valor de moto na troca — apenas colete dados e informe que um vendedor vai continuar`;
}
```

E atualizar `buildPrompt`:

```ts
export function buildPrompt(
  ctx: AgentContext,
  guardrail: GuardrailResult,
  now: Date = new Date()
): PromptPayload {
  const system = buildSystem(ctx, guardrail, now);

  const history = ctx.last_messages.map((m) => ({
    role: (m.direcao === "entrada" ? "user" : "assistant") as
      | "user"
      | "assistant",
    content: m.mensagem,
  }));

  const messages = [
    ...history,
    { role: "user" as const, content: ctx.incoming_text },
  ];

  return { system, messages };
}
```

- [ ] **Step 4: Rodar os testes e confirmar sucesso**

Run: `npm run test:unit -- prompts`
Expected: PASS — todos os testes novos e os pré-existentes (nenhuma regressão nas seções `[TOM DE VOZ]`, catálogo, JSON schema básico etc).

- [ ] **Step 5: Rodar typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/prompts.ts tests/unit/prompts.test.ts
git commit -m "feat(prompts): add collection instructions block + current date context"
```

---

### Task 8: Pipeline — persistência, handoff forçado, redação de CPF (`lib/ai-pipeline.ts`)

**Files:**
- Modify: `lib/ai-pipeline.ts`
- Test: `tests/unit/ai-pipeline.test.ts`

**Interfaces:**
- Consumes: `applyCollectionUpdate` de `@/lib/collection` (Task 6); `GuardrailResult.collection` (Task 4); `AgentResult.collected_data` (Task 5); `buildPrompt(ctx, guardrail, now)` (Task 7).
- Produces: comportamento novo em `runAiPipeline` — persiste `leads.contexto`/`agendamento_*`, força `should_handoff`, redige CPF antes de `logAi`.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final de `tests/unit/ai-pipeline.test.ts` (reaproveitando `BASE_PARAMS`, `BASE_CTX`, `BASE_RESULT`, `supabaseAdmin` já mockados no topo do arquivo):

```ts
describe("runAiPipeline — coleta de financiamento/troca", () => {
  it("fase ask: persiste pending_topics em leads.contexto", async () => {
    vi.mocked(runGuardrails).mockReturnValue({
      mode: "normal", reason: "normal",
      collection: { ask: ["financiamento"], collect: [], missingTrocaFields: [] },
    } as any);

    await runAiPipeline(BASE_PARAMS);

    // "leads" também recebe update de score no fluxo base — não basta checar
    // que .from("leads") foi chamado, tem que achar a chamada de update que
    // carrega especificamente o pending_topics novo.
    const leadsChains = vi.mocked(supabaseAdmin.from).mock.calls
      .map((call, i) => ({ table: call[0], chain: vi.mocked(supabaseAdmin.from).mock.results[i].value }))
      .filter((c) => c.table === "leads");
    const contextoUpdateCall = leadsChains
      .flatMap((c) => c.chain.update.mock.calls)
      .find((args: any[]) => args[0]?.contexto?.pending_topics?.includes("financiamento"));
    expect(contextoUpdateCall).toBeDefined();
  });

  it("fase collect financiamento: força should_handoff=true mesmo que a LLM tenha retornado false", async () => {
    vi.mocked(runGuardrails).mockReturnValue({
      mode: "normal", reason: "normal",
      collection: { ask: [], collect: ["financiamento"], missingTrocaFields: [] },
    } as any);
    vi.mocked(runAgent).mockResolvedValueOnce({
      ...BASE_RESULT,
      should_handoff: false,
      collected_data: { financiamento: { nome_completo: "João", cpf: "111.222.333-44", renda_aproximada: "3000", entrada_disposta: "2000" } },
    } as any);

    await runAiPipeline(BASE_PARAMS);

    expect(transitionConversationStatus).toHaveBeenCalledWith(
      BASE_PARAMS.conversationId,
      "AGUARDANDO_HUMANO",
      { handoff_to: "HUMANO" }
    );
  });

  it("CPF nunca aparece no objeto passado a ai_logs.llm_output", async () => {
    vi.mocked(runGuardrails).mockReturnValue({
      mode: "normal", reason: "normal",
      collection: { ask: [], collect: ["financiamento"], missingTrocaFields: [] },
    } as any);
    vi.mocked(runAgent).mockResolvedValueOnce({
      ...BASE_RESULT,
      collected_data: { financiamento: { nome_completo: "João", cpf: "111.222.333-44", renda_aproximada: "3000", entrada_disposta: "2000" } },
    } as any);

    await runAiPipeline(BASE_PARAMS);

    const aiLogsInsertCall = vi.mocked(supabaseAdmin.from).mock.calls
      .map((call, i) => ({ table: call[0], result: vi.mocked(supabaseAdmin.from).mock.results[i].value }))
      .find((c) => c.table === "ai_logs");
    expect(aiLogsInsertCall).toBeDefined();
    const insertedPayload = aiLogsInsertCall!.result.insert.mock.calls[0][0];
    const loggedOutput = JSON.stringify(insertedPayload.llm_output);
    expect(loggedOutput).not.toContain("111.222.333-44");
  });

  it("fase collect troca incompleta: não força should_handoff", async () => {
    vi.mocked(runGuardrails).mockReturnValue({
      mode: "normal", reason: "normal",
      collection: { ask: [], collect: ["troca"], missingTrocaFields: ["quantos km rodados"] },
    } as any);
    vi.mocked(buildAgentContext).mockResolvedValue({
      ...BASE_CTX,
      lead: { ...BASE_CTX.lead, contexto: { pending_topics: ["troca"], troca_draft: { modelo: "Bros 160", ano: 2019 } } },
    } as any);
    vi.mocked(runAgent).mockResolvedValueOnce({
      ...BASE_RESULT,
      should_handoff: false,
      collected_data: { troca: { modelo: null, ano: null, km: 32000, servico_recente: null, agendamento_data: null, agendamento_horario: null } },
    } as any);

    const result = await runAiPipeline(BASE_PARAMS);

    expect(result.agent_status).toBe("ok");
    expect(transitionConversationStatus).not.toHaveBeenCalled();
  });

  it("sem collection (guardrail.collection null): comportamento idêntico ao caso normal, sem updates extras de contexto", async () => {
    vi.mocked(runGuardrails).mockReturnValue({ mode: "normal", reason: "normal", collection: null } as any);

    const result = await runAiPipeline(BASE_PARAMS);

    expect(result.agent_status).toBe("ok");
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar falha**

Run: `npm run test:unit -- ai-pipeline`
Expected: FAIL — `should_handoff` não é forçado, `contexto` não é persistido, CPF ainda aparece no log.

- [ ] **Step 3: Implementar**

Em `lib/ai-pipeline.ts`, adicionar o import novo:

```ts
import { applyCollectionUpdate } from "@/lib/collection";
```

E estender o import já existente de `@/lib/ai` (hoje `import { runAgent, AgentTimeoutError, AgentParseError, AgentOutputError } from "@/lib/ai";`) pra incluir o tipo `AgentResult`:

```ts
import {
  runAgent,
  AgentTimeoutError,
  AgentParseError,
  AgentOutputError,
  type AgentResult,
} from "@/lib/ai";
```

Modificar a chamada de `buildPrompt` pra passar `now` consistente com o `runGuardrails` (logo acima, onde `guardrail` é calculado):

```ts
    const now = new Date();
    const parsedStart = parseInt(process.env.BUSINESS_HOURS_START ?? "8", 10);
    const parsedEnd = parseInt(process.env.BUSINESS_HOURS_END ?? "18", 10);
    const guardrail = runGuardrails(ctx, {
      businessHoursStart: Number.isFinite(parsedStart) ? parsedStart : 8,
      businessHoursEnd: Number.isFinite(parsedEnd) ? parsedEnd : 18,
      now,
    });
```

```ts
    const payload = buildPrompt(ctx, guardrail, now);
    const result = await runAgent(payload, ctx);
```

Logo depois de `const result = await runAgent(payload, ctx);`, adicionar o bloco de coleta (antes do cálculo de `replyText`):

```ts
    // --- Coleta determinística de financiamento/troca ---
    const collection = guardrail.collection ?? null;
    if (collection && (collection.ask.length > 0 || collection.collect.length > 0)) {
      const update = applyCollectionUpdate(ctx.lead.contexto ?? {}, collection, result.collected_data);
      try {
        await supabaseAdmin
          .from("leads")
          .update({
            contexto: update.contexto,
            ...(update.agendamento
              ? {
                  agendamento_data: update.agendamento.data,
                  agendamento_horario: update.agendamento.horario,
                }
              : {}),
          })
          .eq("id", params.leadId);
      } catch {
        // non-fatal: reply já foi gerado, persistência de coleta não bloqueia resposta
      }
      if (update.forceHandoff) {
        result.should_handoff = true;
      }
    }
```

Adicionar a função de redação de CPF (perto do topo do arquivo, depois dos imports, antes de `logAi`):

```ts
function redactCpfFromLog(result: AgentResult): unknown {
  const fin = result.collected_data?.financiamento;
  if (!fin || fin.cpf === null || fin.cpf === undefined) return result;
  const { cpf: _cpf, ...finRest } = fin;
  return { ...result, collected_data: { ...result.collected_data, financiamento: finRest } };
}
```

E no `logAi` da branch de sucesso (final da função, `output: result`), trocar por:

```ts
    await logAi({
      storeId: params.storeId,
      conversationId: params.conversationId,
      leadId: params.leadId,
      status: finalStatus,
      latencyMs: Date.now() - start,
      model,
      output: redactCpfFromLog(result),
      messageId,
      sendCategory,
    });
```

- [ ] **Step 4: Rodar os testes e confirmar sucesso**

Run: `npm run test:unit -- ai-pipeline`
Expected: PASS — inclusive todos os testes pré-existentes do arquivo (nenhuma regressão nos ~30 testes já existentes de envio WA/timeout/parse/score).

- [ ] **Step 5: Rodar typecheck e suíte completa**

Run: `npm run typecheck && npm run test`
Expected: PASS em ambos.

- [ ] **Step 6: Commit**

```bash
git add lib/ai-pipeline.ts tests/unit/ai-pipeline.test.ts
git commit -m "feat(pipeline): persist financiamento/troca collection, force handoff, redact CPF from logs"
```

---

### Task 9: Página `/agenda` + link no Header

**Files:**
- Create: `app/agenda/page.tsx`
- Modify: `app/components/Header.tsx`

**Interfaces:**
- Consumes: `leads.agendamento_data`, `leads.agendamento_horario`, `leads.contexto.troca` (Task 1, Task 6/8).
- Produces: rota `/agenda?dia=YYYY-MM-DD` (Server Component, RSC-first, sem client-side além do link de navegação de dia).

- [ ] **Step 1: Criar a página**

Criar `app/agenda/page.tsx`:

```tsx
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AuthError } from "@/lib/auth";

type AgendaLead = {
  id: string;
  nome: string | null;
  phone_normalized: string;
  agendamento_data: string | null;
  agendamento_horario: string | null;
  contexto: { troca?: { modelo: string | null; ano: number | null } | null } | null;
};

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

function formatDiaLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

type PageProps = {
  searchParams?: { dia?: string };
};

export default async function AgendaPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AuthError();

  const hoje = toISODate(new Date());
  const dia = searchParams?.dia && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.dia) ? searchParams.dia : hoje;

  const { data, error } = await supabase
    .from("leads")
    .select("id, nome, phone_normalized, agendamento_data, agendamento_horario, contexto")
    .eq("agendamento_data", dia)
    .order("agendamento_horario", { ascending: true });

  const leads = (data ?? []) as AgendaLead[];

  return (
    <main className="container">
      <div className="page-header">
        <div>
          <h1>Agenda</h1>
          <div className="subtitle">Motos de troca agendadas para trazer na loja</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
        <Link href={`/agenda?dia=${addDays(dia, -1)}`} className="header-nav-link">← Dia anterior</Link>
        <strong style={{ textTransform: "capitalize" }}>{formatDiaLabel(dia)}</strong>
        <Link href={`/agenda?dia=${addDays(dia, 1)}`} className="header-nav-link">Próximo dia →</Link>
      </div>

      {error && (
        <div className="alert-item warn" style={{ marginBottom: "16px" }}>
          <span className="alert-icon">⚠</span>
          <span>Erro ao carregar agenda: {error.message}</span>
        </div>
      )}

      {!error && leads.length === 0 ? (
        <div className="alert-item info">
          <span className="alert-icon">ℹ</span>
          <span>Nenhum agendamento para este dia.</span>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Horário</th>
              <th>Lead</th>
              <th>Telefone</th>
              <th>Moto de troca</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <td>{l.agendamento_horario ?? "—"}</td>
                <td>{l.nome ?? "não informado"}</td>
                <td>{l.phone_normalized}</td>
                <td>
                  {l.contexto?.troca?.modelo
                    ? `${l.contexto.troca.modelo}${l.contexto.troca.ano ? " " + l.contexto.troca.ano : ""}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
```

Nota: consulta usa `createSupabaseServerClient()` (cliente escopado pela sessão do usuário) sem `.eq("store_id", ...)` explícito — isolamento multi-tenant vem da RLS (`my_store_id()`), mesmo padrão de `app/estoque/page.tsx` e `app/equipe/page.tsx`. Telefone aparece em texto puro na tela (não é log), consistente com o resto do produto (mascaramento é regra de log, não de UI).

- [ ] **Step 2: Adicionar link no Header**

Em `app/components/Header.tsx`, adicionar depois do link `/equipe` (linha ~106) e antes de `/analytics`:

```tsx
          <Link
            href="/agenda"
            className={`header-nav-link${pathname.startsWith("/agenda") ? " active" : ""}`}
          >
            Agenda
          </Link>
```

- [ ] **Step 3: Rodar typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Verificação manual (sem teste automatizado — página RSC, mesmo padrão de `/estoque`/`/equipe` que também não têm teste unitário dedicado)**

Rodar `npm run dev`, logar como usuário de uma loja de teste, navegar pra `/agenda`, confirmar:
- Página carrega sem erro com 0 agendamentos ("Nenhum agendamento para este dia")
- Navegação "Dia anterior"/"Próximo dia" muda a URL (`?dia=...`) e a lista corretamente
- Link "Agenda" aparece no Header e fica ativo (classe `active`) na rota `/agenda`

- [ ] **Step 5: Commit**

```bash
git add app/agenda/page.tsx app/components/Header.tsx
git commit -m "feat(agenda): add internal calendar page for scheduled trade-in visits"
```

---

### Task 10: Verificação final e atualização de documentação

**Files:**
- Modify: `CLAUDE.md` (raiz do projeto, seção "Estado Atual do Sistema" / "Dívidas Técnicas Conhecidas")

**Interfaces:** nenhuma nova — task de fechamento.

- [ ] **Step 1: Rodar a suíte completa**

Run: `npm run lint && npm run typecheck && npm run test`
Expected: todos os três passam sem warning/erro (mesmo gate do hook `pre-push`).

- [ ] **Step 2: Atualizar `CLAUDE.md`**

Adicionar uma entrada nova na seção de módulos/dívidas técnicas descrevendo o que foi implementado (financiamento/troca collection + `/agenda`), e registrar como pendências futuras (não implementadas neste plano): recebimento de imagem via WhatsApp, recebimento/transcrição de áudio, integração Google Agenda — linkando para o spec (`docs/superpowers/specs/2026-07-24-financiamento-troca-collection-design.md`) como referência.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document financiamento/troca collection + agenda page in CLAUDE.md"
```

---

## Spec Coverage Check

- Sinal determinístico "troca" → Task 2
- `contexto`/tipos de dados coletados → Task 3
- Guardrail de 2 fases (ask/collect) determinístico → Task 4
- `collected_data` no output da LLM, validação tolerante → Task 5
- Merge parcial + completude de troca (5 campos), single-shot de financiamento → Task 6
- Instruções de prompt (pergunta única financiamento, incremental troca, inteligência de variação de modelo, data atual) → Task 7
- Persistência determinística, handoff forçado por código, redação de CPF nos logs → Task 8
- Página `/agenda` + navegação → Task 9
- Migration de colunas de agendamento → Task 1
- Fora de escopo (spec): imagem, áudio, Google Agenda — não têm task neste plano, conforme "Explicitly Out of Scope" do spec.
