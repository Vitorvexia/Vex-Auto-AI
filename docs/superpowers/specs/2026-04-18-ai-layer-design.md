# AI Layer Design — Vex Auto
**Data:** 2026-04-18
**Escopo:** Primeira camada de IA integrada ao webhook WhatsApp

---

## Objetivo

Adicionar resposta automática via Claude (Anthropic) ao fluxo de webhook existente, com guardrails como modificadores de comportamento, contrato estável de saída e integração síncrona com timeout explícito. Sem follow-up automático. Sem tool use. Sem multi-agente.

---

## Arquitetura

```
webhook POST
    │
    ▼
ingestMessage()              ← sem mudanças
    │
    ▼
montar AgentContext          ← lead + conversa + 10 msgs (cronológico) + catálogo resumido
    │
    ▼
runGuardrails(ctx, config?)  ← lib/guardrails.ts — retorna { mode, reason }
    │
    ├── mode === "human_handoff" → pular IA → status: "skipped_handoff"
    │
    ▼
buildPrompt(ctx, guardrail)  ← lib/prompts.ts — retorna { system, messages[] }
    │
    ▼
runAgent(payload, ctx)       ← lib/ai.ts — timeout explícito, valida saída
    │
    ▼
gravar reply em messages (direcao: saida, autor: ia)
    │
    ├── should_handoff = true → gravar reply como última msg → transição AGUARDANDO_HUMANO
    │                          sem resposta automática adicional após transição
    ▼
atualizar lead.score se mudou
gravar ai_logs (model, latency_ms, status, error_code?, tokens?)
    │
    ▼
webhook retorna 200 OK
```

---

## AgentContext

```ts
interface AgentContext {
  store_id: string
  lead: {
    id: string
    nome: string | null
    phone_normalized: string
    lead_status: LeadStatus
    score: number
    origem: Origem
  }
  conversation: {
    id: string
    conversation_status: ConversationStatus
    handoff_to: HandoffTo
    summary: string | null
    ultima_mensagem_em: string
  }
  last_messages: {        // últimas 10, ordem cronológica (mais antiga → mais recente)
    direcao: Direcao
    autor: Autor
    mensagem: string
  }[]
  vehicles: {             // catálogo resumido, máx 6, apenas disponíveis
    marca: string
    modelo: string
    ano: number
    preco: number
  }[]
  incoming_text: string
}
```

---

## lib/guardrails.ts

**Responsabilidade:** classificar o contexto e retornar um mode. Função pura, sem I/O, sem async.

```ts
type GuardrailMode = "normal" | "short_message" | "off_hours" | "reopen" | "human_handoff"

interface GuardrailResult {
  mode: GuardrailMode
  reason: string
}

interface GuardrailConfig {
  businessHoursStart?: number   // default: 8
  businessHoursEnd?: number     // default: 18
  timezone?: string             // default: "America/Sao_Paulo"
}

export function runGuardrails(ctx: AgentContext, config?: GuardrailConfig): GuardrailResult
```

**Prioridade de avaliação:**

| # | Condição | Mode |
|---|---|---|
| 1 | `conversation_status === 'ENCERRADA'` | `reopen` |
| 2 | `handoff_to === 'HUMANO'` ou `conversation_status === 'AGUARDANDO_HUMANO'` | `human_handoff` |
| 3 | Fora do horário configurado | `off_hours` (engloba mensagem curta fora do horário) |
| 4 | `incoming_text.trim().length < 10` | `short_message` |
| 5 | Nenhuma | `normal` |

---

## lib/prompts.ts

**Responsabilidade:** montar payload para Anthropic dado contexto e guardrail.

```ts
interface PromptPayload {
  system: string
  messages: { role: "user" | "assistant"; content: string }[]
}

export function buildPrompt(ctx: AgentContext, guardrail: GuardrailResult): PromptPayload
```

**Estrutura do system prompt:**

```
[IDENTIDADE]
Você é o atendente virtual da {store.nome}.
Atende leads via WhatsApp com foco em venda de veículos.

[CONTEXTO DO LEAD]
Nome: {lead.nome ?? "não informado"}
Origem: {lead.origem}
Status: {lead.lead_status}
Score atual: {lead.score}/100

[RESUMO DA CONVERSA]
{conversation.summary ?? "Primeiro contato ou sem resumo disponível."}

[CATÁLOGO DISPONÍVEL — até 6 veículos]
Hyundai HB20 2022 — R$ 74.900
...

[MODO ATUAL: {guardrail.mode}]
{instrução por mode — ver abaixo}

[FORMATO DE RESPOSTA]
Responda EXCLUSIVAMENTE em JSON válido, sem texto fora do JSON:
{
  "reply_text": "string",
  "should_handoff": boolean,
  "score": number,
  "intent_tags": string[],
  "summary": "string"
}

[REGRAS FIXAS]
- Nunca invente informações sobre veículos
- Nunca prometa condições fora do catálogo
- Se não souber, diga que vai verificar
- Responda sempre em português
```

**Instruções por mode:**

| Mode | Instrução |
|---|---|
| `normal` | Atendimento comercial completo. Qualifique interesse, apresente opções relevantes. |
| `short_message` | Mensagem curta recebida. Resposta simples e aberta. Estimule o lead a continuar. |
| `off_hours` | Fora do horário. Confirme recebimento, informe quando retorna, tom acolhedor. |
| `reopen` | Conversa anterior encerrada. Trate como novo contato, resgate contexto com cuidado. |
| `human_handoff` | *(não chega aqui — webhook interrompe antes)* |

**Montagem de `messages[]`:**
- Últimas 10 da conversa, ordem cronológica (mais antiga primeiro)
- `direcao === 'entrada'` → `role: "user"`, `direcao === 'saida'` → `role: "assistant"`
- Mensagem atual do lead adicionada como último `role: "user"`
- Sem duplicar última mensagem no system prompt

---

## lib/ai.ts

**Responsabilidade:** chamar Anthropic com timeout, extrair texto, parsear JSON, validar saída.

```ts
interface AgentResult {
  reply_text: string
  should_handoff: boolean
  score: number
  intent_tags: string[]
  summary: string
}

export async function runAgent(
  payload: PromptPayload,
  ctx: AgentContext,
  options?: { timeoutMs?: number }
): Promise<AgentResult>
```

**Etapas internas separadas conceitualmente:**
1. `callAnthropic()` — chama API com AbortSignal + timeout
2. `extractText()` — extrai string do response content
3. `parseOutput()` — JSON.parse com try/catch
4. `validateOutput()` — valida campos, aplica fallbacks

**Modelo:** `process.env.ANTHROPIC_MODEL` (obrigatório em runtime). Sem hardcode.

**Timeout:** `process.env.AGENT_TIMEOUT_MS` (default 8000ms).

**Validação de saída:**

| Campo | Validação | Ação se inválido |
|---|---|---|
| `reply_text` | string não vazia | lança `AgentOutputError` (fatal) |
| `should_handoff` | boolean | fallback: `false` |
| `score` | number 0–100 | fallback: `ctx.lead.score` |
| `intent_tags` | string[] | fallback: `[]` |
| `summary` | string | fallback: `""` |

**Erros tipados:**
- `AgentTimeoutError` — excedeu timeout
- `AgentParseError` — JSON inválido
- `AgentOutputError` — reply_text ausente

---

## Mudanças no Webhook (`route.ts`)

- Sem tocar HMAC, parsing, batch ou lógica de ingest
- Após `ingestMessage()` com `status: "ok"`:
  1. Buscar lead, conversa, mensagens, veículos → montar `AgentContext`
  2. `runGuardrails()` → se `human_handoff`, retornar `skipped_handoff`
  3. `buildPrompt()` → `runAgent()`
  4. Gravar reply em `messages` (saida/ia)
  5. Se `should_handoff = true` → reply gravado como última msg, então transição para `AGUARDANDO_HUMANO`. **Nenhuma resposta adicional após transição.**
  6. Atualizar `lead.score` se mudou
  7. Gravar `ai_logs`

**`ai_logs` — campos obrigatórios:**
- `model` — sempre
- `latency_ms` — sempre
- `status` — `"ok"` | `"timeout"` | `"parse_error"` | `"output_error"` | `"skipped_handoff"`
- `error_code` — quando houver erro
- `tokens_input` / `tokens_output` — opcionais (quando disponíveis na resposta)

---

## Variáveis de Ambiente

```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-haiku-3-5-20241022
AGENT_TIMEOUT_MS=8000
BUSINESS_HOURS_START=8
BUSINESS_HOURS_END=18
```

---

## Testes

| Arquivo | Cobertura |
|---|---|
| `unit/guardrails.test.ts` | cada mode, prioridade correta, handoff bloqueado, off_hours config |
| `unit/prompts.test.ts` | system gerado por mode, catálogo limitado (máx 6), summary injetado |
| `unit/ai-validation.test.ts` | validateOutput — campos válidos, fallbacks, erros fatais |
| `integration/agent.test.ts` | chamada real Anthropic; skip sem key; timeout curto (5s); validar contrato mínimo retornado |

---

## Fora do Escopo (esta etapa)

- Follow-up automático
- Tool use / function calling
- Múltiplos agentes
- Envio de mensagem de volta ao WhatsApp (só grava no banco)
- RLS policies
