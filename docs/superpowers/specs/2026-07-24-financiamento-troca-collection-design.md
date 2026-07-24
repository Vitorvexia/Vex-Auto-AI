# Design: Coleta de Dados de Financiamento e Troca + Agenda Interna

Status: Approved
Date: 2026-07-24
Owner: Engineering

---

## Context

Leads da Speed Motos perguntam com frequência: qual o preço, quanto de entrada mínima, e se a loja aceita moto na troca. Hoje a IA só enxerga `preco` e `margem_minima` no catálogo (`lib/prompts.ts`, `lib/agent-context.ts`) — não tem nenhum fluxo pra financiamento ou troca, e essas perguntas ficam sem resposta útil.

Ponto crítico levantado pelo dono do produto: financiamento **não deve ser calculado pela IA**. Taxas e condições de entrada variam demais entre financeiras — a IA só coleta os dados do lead e aciona um vendedor humano, que testa em várias financeiras manualmente. Da mesma forma, avaliação de moto na troca depende de inspeção humana (documentação, estado do motor) — a IA não estima valor, só coleta informação e agenda.

## Explicitly Out of Scope

Esta sessão de brainstorm identificou 4 sub-projetos independentes. Só o primeiro é especificado aqui:

- **Recebimento de imagem via WhatsApp** — webhook hoje só processa `msg.type === "text"` (`app/api/whatsapp/webhook/route.ts:150`); mensagens de imagem são descartadas. Tratar `type=image`, baixar mídia via Graph API e persistir em storage é infraestrutura nova, sem overlap com este spec. Necessário antes de a IA poder receber fotos da moto de troca.
- **Recebimento e transcrição de áudio** — mesma limitação (`type=audio` descartado). Exige integração com serviço de speech-to-text externo e fallback quando a transcrição falha. Infraestrutura nova, spec própria.
- **Integração com Google Agenda** — cogitada para a página de agendamento, mas exige OAuth por loja, armazenamento de credencial e chamadas à Google Calendar API. Sem custo relevante e sem complexidade proibitiva, mas é um projeto à parte do fluxo de coleta de dados. A página `/agenda` interna (neste spec) cobre a necessidade imediata; a integração externa fica para spec futuro.
- **Agendamento de visita como feature genérica** (não ligada à troca) — o sinal `visita` já existe no lead scoring (`lib/lead-scoring.ts:104`) mas não aciona nenhum fluxo. Fora de escopo — este spec cobre apenas agendamento no contexto de troca de moto.

**Este spec cobre:** detecção determinística de intenção (financiamento/troca), coleta conversacional guiada por LLM, persistência estruturada, guardrail de handoff automático, e uma página interna simples de agenda por dia.

## Problem

1. IA não tem estrutura pra coletar dados de financiamento (nome, CPF, renda, entrada desejada) nem de troca (modelo, ano, km, histórico de motor, disponibilidade de visita).
2. Não existe mecanismo de handoff automático quando esses dados são coletados — hoje handoff só é acionado por violação de margem (`lib/actions.ts`).
3. Não existe lugar no sistema pra vendedor ver quem agendou pra trazer moto em qual dia.
4. CPF é dado sensível (LGPD) e o pipeline de log atual (`ai_logs.llm_output`) grava o JSON de resposta da LLM sem filtro — precisa de redação antes de logar.

## Architecture

### 1. Sinal determinístico de "troca" (`lib/lead-scoring.ts`)

Novo `SIGNAL_DEFS` entry, mesmo padrão do sinal `financiamento` já existente:

```ts
{
  id: "troca",
  phrases: [["troca"], ["moto", "troca"], ["dar", "moto"], ["moto", "usada"], ["aceita", "troca"]],
}
```

Soma `+15` no score determinístico (faixa equivalente a `veiculo_especifico`). `financiamento` (já existente, linha 80) é reaproveitado sem alteração.

### 2. Estado de coleta em `leads.contexto` (jsonb, sem migration nova para isso)

```jsonc
{
  "pending_topics": ["financiamento", "troca"],  // array — os dois podem estar pendentes ao mesmo tempo
  "financiamento": { "nome_completo": "...", "cpf": "...", "renda_aproximada": "...", "entrada_disposta": "..." },
  "troca_draft": { "modelo": "...", "ano": 2018, "km": null, "servico_recente": null, "agendamento_data": null, "agendamento_horario": null },
  "troca": { /* mesma shape que troca_draft, só populado quando completo */ }
}
```

Justificativa do array (`pending_topics`) em vez de valor único: é comum o lead dar a moto como entrada de financiamento na mesma conversa — os dois tópicos podem estar ativos e sendo coletados em paralelo.

`troca_draft` existe porque a coleta de troca é **incremental** (ver seção 4) — campos vão sendo preenchidos aos poucos, ao contrário de financiamento que é single-shot.

### 3. Migration 021 — colunas de agendamento

```sql
alter table leads add column agendamento_data date;
alter table leads add column agendamento_horario text;
create index leads_store_agendamento_idx on leads(store_id, agendamento_data)
  where agendamento_data is not null;
```

Só agendamento vira coluna própria — é o único dado que precisa ser filtrado/indexado (consulta da página `/agenda` por dia). Financiamento e troca ficam em `contexto` jsonb porque são só exibidos no dossiê/handoff, nunca filtrados.

### 4. Guardrails (`lib/guardrails.ts`)

`GuardrailResult` ganha campo novo:

```ts
collection: { ask: string[]; collect: string[] } | null
```

Computado sempre que `mode !== "human_handoff"` (não interfere nos modos existentes — `short_message`/`off_hours`/`reopen`/`normal` continuam funcionando igual, `collection` é um sinal ortogonal):

- `collect` = tópicos já em `contexto.pending_topics` (aguardando ou continuando resposta)
- `ask` = sinais novos (`financiamento`/`troca`) detectados na mensagem atual que ainda não estão em `pending_topics` nem já coletados (`contexto.financiamento`/`contexto.troca` ausentes)

`AgentContext.lead` precisa expor `contexto` (`lib/agent-context.ts`) — hoje a query não seleciona essa coluna.

Para troca especificamente, o guardrail também calcula os **campos faltantes** a partir de `contexto.troca_draft` (`modelo`, `ano`, `km`, `servico_recente`, `agendamento_data`+`agendamento_horario`) e injeta essa lista no prompt, pra IA saber exatamente o que ainda falta perguntar — sem precisar adivinhar ou repetir.

### 5. Prompt (`lib/prompts.ts`)

Novo bloco de instrução condicional, adicionado quando `guardrail.collection` não é `null`:

- **Perguntar financiamento** (tópico novo em `ask`): instrui a IA a fazer UMA pergunta única reunindo nome completo, CPF, renda aproximada, e "quanto você tá disposto a dar de entrada?".
- **Coletar financiamento** (tópico em `collect`): instrui a IA a extrair os 4 campos da resposta do lead pro campo `collected_data.financiamento` do JSON de saída, e sempre definir `should_handoff = true`.
- **Perguntar/coletar troca** (tópico em `ask` ou `collect`): fluxo incremental — a cada turno, a IA extrai o que conseguir da resposta atual pros campos parciais, e pergunta **apenas o próximo campo que falta** (um de cada vez, nunca a lista inteira). Instrução inclui uma regra de domínio: alguns modelo+ano têm variações relevantes (ex: Honda Titan 2010 pode ser partida elétrica ou pedal/kickstart) — a IA deve reconhecer isso pelo próprio conhecimento sobre motos (sem lista fixa no código) e perguntar a variação antes de considerar o campo `modelo` completo.
- Prompt ganha a **data atual** (não existia antes) — necessário pra IA converter "sábado"/"amanhã" em data absoluta pro campo `agendamento_data`.

`PromptPayload`/schema de resposta da LLM ganha campo novo opcional:

```jsonc
"collected_data": {
  "financiamento": { "nome_completo": "...", "cpf": "...", "renda_aproximada": "...", "entrada_disposta": "..." } | null,
  "troca": { "modelo": "...", "ano": 2018, "km": 32000, "servico_recente": "...", "agendamento_data": "2026-07-28", "agendamento_horario": "tarde" } | null
}
```

### 6. Pipeline (`lib/ai-pipeline.ts`)

Depois de `runAgent`:

- **Fase ask** (qualquer tópico em `guardrail.collection.ask`): persiste `contexto.pending_topics` com o(s) tópico(s) adicionado(s) — deterministicamente, independente do que a LLM respondeu.
- **Fase collect — financiamento**: se `collected_data.financiamento` veio preenchido, persiste em `contexto.financiamento`, remove `"financiamento"` de `pending_topics`, **força `should_handoff = true` no código** (não confia só na instrução do prompt — mesma filosofia do guardrail de margem: regra inegociável garantida por código).
- **Fase collect — troca**: faz merge de `collected_data.troca` (parcial) em `contexto.troca_draft` — regra de merge: só sobrescreve um campo do draft se a LLM devolveu valor não-nulo pra ele nesse turno; campo que a LLM devolveu `null` (porque a resposta atual não falou daquilo) mantém o valor já salvo no draft. Código checa se os 5 campos obrigatórios estão completos:
  - Se completo: move `troca_draft` → `contexto.troca`, limpa draft e remove `"troca"` de `pending_topics`, grava `leads.agendamento_data`/`agendamento_horario`, força `should_handoff = true`.
  - Se incompleto: mantém `"troca"` em `pending_topics`, salva o draft atualizado, não força handoff (IA continua a conversa normalmente).
- **Redação de CPF nos logs**: antes de chamar `logAi(...)`, remove a chave `cpf` do objeto passado como `output` (não mascara — remove). CPF nunca aparece em `ai_logs.llm_output` nem em `console.*`. Fica só em `leads.contexto` no banco, protegido por RLS/`store_id` como qualquer outro dado do lead.

### 7. Página `/agenda`

Server Component novo, segue o padrão de `/equipe` (RSC-first, mínimo client). `getServerStoreId()` pra isolamento multi-tenant. Query: `leads` onde `store_id = storeId` e `agendamento_data = <dia selecionado>` (parâmetro de URL, default hoje), ordenado por `agendamento_horario`. Lista nome do lead, telefone, modelo/ano da moto de troca, horário. Botão simples pra trocar de dia (sem calendário visual complexo, sem integração externa).

## Edge Cases

1. **Lead menciona financiamento e troca na mesma mensagem** — `guardrail.collection.ask` retorna os dois tópicos; a IA pergunta os dois assuntos combinados numa única resposta (financiamento continua single-shot; troca começa sua sequência incremental a partir daí).
2. **Lead responde troca pela metade e some da conversa** — `troca_draft` fica salvo em `contexto`; se ele voltar dias depois, a IA retoma de onde parou (campos faltantes recalculados a partir do draft existente, não perguntando de novo o que já foi respondido).
3. **Lead nega financiamento depois de já ter sido perguntado** ("não quero financiar mais") — sinal de negação já é tratado pelo `negation guard` existente em `detectSignals`; tópico é removido de `pending_topics` sem finalizar coleta nem acionar handoff.
4. **CPF inválido ou incompleto** — não há validação de formato nesta fase (fora de escopo); vendedor humano confere na negociação.
5. **`agendamento_data` não resolvível** (lead disse algo vago tipo "qualquer dia") — campo fica `null`, `troca` só é considerado completo quando IA conseguir uma data ou horário minimamente concreto; se o lead insistir em vago, IA registra o texto livre em `agendamento_horario` e segue sem bloquear indefinidamente (evita loop).
6. **Handoff já ativo quando tópico é detectado** — `guardrail.mode === "human_handoff"` tem prioridade e a pipeline já retorna antes de computar `collection` (nenhuma mudança no caminho existente).

## Testing

- `lead-scoring.test.ts`: novo sinal `troca` detecta frases esperadas e não é acionado por negação.
- `guardrails.test.ts`: `collection.ask` dispara em sinal novo; `collection.collect` dispara com `pending_topics` presente; `collection` é `null` em modo `human_handoff`; campos faltantes de troca calculados corretamente a partir de `troca_draft` parcial.
- `prompts.test.ts`: bloco de instrução correto por fase/tópico; data atual presente no prompt.
- `ai-pipeline.test.ts`: fase ask persiste `pending_topics`; fase collect financiamento persiste dado + força handoff; fase collect troca faz merge parcial sem finalizar até completar os 5 campos; CPF nunca aparece no objeto passado a `logAi`.
- `vehicle-actions`-style teste pra `/agenda`: query isolada por `store_id`, filtro por dia funciona, sem vazamento cross-store.

## Related

- `lib/prompts.ts`, `lib/agent-context.ts` — pipeline de prompt que este design estende
- `lib/guardrails.ts` — guardrail de margem (`docs/vex` root `CLAUDE.md`) é o precedente do "código força regra inegociável, não confia só na LLM"
- `lib/pii.ts` — padrão de mascaramento de telefone; CPF usa política mais restritiva (remoção total, não mascaramento)
- `lib/lead-scoring.ts` — sinais determinísticos existentes (`financiamento`, `visita`) que este spec reaproveita/estende
- Backlog futuro: recebimento de imagem, recebimento/transcrição de áudio, integração Google Agenda (ver "Explicitly Out of Scope")
