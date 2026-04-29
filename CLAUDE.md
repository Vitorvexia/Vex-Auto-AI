# Vex Auto — CLAUDE.md

Contexto estratégico e operacional do produto. Fonte de verdade absoluta. Toda decisão técnica deve ser compatível com este documento.

---

## Definição do Produto

Vex Auto é uma **infraestrutura operacional AI-First** para o mercado automotivo.

Não é CRM, ERP ou ferramenta de gestão tradicional.

É o trilho por onde a economia da loja passa — orquestra a jornada de venda de ponta a ponta. Se o sistema cair, a operação comercial da loja é impactada diretamente.

---

## Princípio Central

O sistema não existe para organizar dados.

Existe para:
- gerar faturamento
- proteger margem
- aumentar conversão
- escalar operação

---

## Filosofia AI-First

| Princípio | Descrição |
|-----------|-----------|
| IA como Orquestradora | Executa o front office e coordena o fluxo operacional |
| Human in the Loop | Humano atua só em negociação, validação financeira e aprovação final |
| Capacidade de Ação | IA executa ações reais via APIs — não apenas responde |
| Contexto Profundo | Decisões baseadas em dados históricos e operacionais reais |
| Feedback Econômico | Sucesso medido por faturamento, margem, conversão e ROI |

---

## Problema que Resolvemos

Lojas automotivas hoje são:
- reativas, dependentes de humanos, limitadas em escala
- ineficientes: leads não respondidos, base inativa desperdiçada, follow-up inexistente, alto CAC, baixa conversão

---

## Tese do Produto

| Antes | Depois (Vex Auto) |
|-------|-------------------|
| CRM passivo | Sistema ativo |
| Venda como evento | Venda como processo contínuo |
| Lead parado | Lead sendo trabalhado constantemente |
| Atendimento manual | IA atende 24/7 |
| Follow-up inconsistente | IA executa follow-up contínuo |
| Base parada | IA reativa base automaticamente |
| Dependência do vendedor | Humano entra apenas no fechamento |

---

## Fluxo do Lead (Espinha Dorsal)

```
Entrada → Atendimento (IA) → Qualificação (score 0–100) → Nutrição →
Dossiê Transacional → Intervenção Humana → Conversão → Pós-venda → Reativação
```

Fluxo contínuo — não termina na venda.

**Entradas:** portais, WhatsApp, base inativa, canais digitais  
**Dossiê:** interesse, contexto, histórico, capacidade financeira  
**Conversão:** proposta, financiamento, negociação, contrato

> ✔ VALIDADO: atendimento automático via WhatsApp funcionando em ambiente real
> ✔ VALIDADO: IA respondendo leads via WhatsApp Cloud API em ambiente real

---

## Loop Econômico

```
Lead → Conversão → Cliente → Reativação → Nova venda → (loop infinito)
```

---

## Autonomia da IA

**IA executa sozinha:**
- atendimento inicial
- resposta em tempo real via WhatsApp
- follow-up automático (cadência 2h → 24h → 72h)
- reativação de leads (14d → 30d sem resposta)
- qualificação e lead scoring determinístico (0–100)
- comparação de opções

**IA orquestra com validação humana:**
- preço final
- negociação
- contratos
- crédito

---

## Guardrails — Regras Absolutas

A IA **nunca** pode:
- assinar contratos
- fechar venda abaixo da margem mínima sem aprovação humana

Regras críticas:
- controle de margem obrigatório
- aprovação humana em decisões financeiras
- automação com limites definidos

---

## Módulos (Nível Macro)

- gestão de leads
- gestão de estoque
- gestão de equipe
- comunicação (WhatsApp)
- funil de vendas (Kanban)
- simulação de financiamento
- automação de follow-up

---

## Integrações Ativas / Planejadas

| Integração | Status |
|------------|--------|
| WhatsApp Cloud API | ATIVO |
| Portais de veículos | Planejado |
| Financeiras | Planejado |
| FIPE | Planejado |
| Assinatura digital | Planejado |

> ✔ VALIDADO: envio e recebimento via WhatsApp funcionando ponta a ponta  
> ✔ VALIDADO: persistência de mensagens e contexto operacional integrada ao fluxo de IA  
> ✔ VALIDADO: pipeline real operando (webhook → IA → resposta → envio)
> ✔ VALIDADO: envio via WhatsApp Cloud API implementado em `lib/whatsapp-send.ts`
> ✔ VALIDADO: pipeline de IA extraída para `lib/ai-pipeline.ts` (testável independentemente)

---

## Contexto Técnico que a IA Deve Usar

**Leads:** histórico, interações, origem, intenção  
**Veículos:** custo, margem, tempo de estoque  
**Transações:** propostas, financiamentos, contratos  
**Operacional:** mensagens, agendamentos, ações

---

## Arquitetura

- sistema orientado a fluxo
- IA como camada central
- contexto como ativo principal
- execução via APIs
- estrutura modular

### Pipeline de IA (`lib/ai-pipeline.ts`)

Módulo central extraído do webhook. Fluxo:

```
buildAgentContext → runGuardrails → buildPrompt → runAgent
  → messages.insert (reply salvo) → sendWhatsAppMessage (não-fatal)
  → transitionConversationStatus (se handoff) → leads.update (score)
  → logAi
```

**`agent_status` possíveis:**

| Status | Significado |
|--------|-------------|
| `ok` | IA respondeu e enviou com sucesso |
| `ok_send_failed` | IA respondeu, reply salvo no banco, mas envio WA falhou |
| `skipped_handoff` | Conversa sob controle humano — IA não intervém |
| `skipped_duplicate` | Mensagem já processada (idempotência) |
| `timeout` | LLM não respondeu dentro do limite |
| `parse_error` | LLM retornou JSON inválido |
| `output_error` | LLM retornou JSON válido mas campo obrigatório ausente |
| `error` | Falha genérica no pipeline |

**Invariantes críticos:**
- Webhook **sempre retorna HTTP 200** à Meta — erros internos são logados, nunca expostos via status HTTP
- Reply é salvo no banco **antes** do envio WA — falha no envio nunca perde a mensagem
- Texto truncado a 4096 chars **antes** do insert — banco e WhatsApp sempre têm o mesmo conteúdo
- Telefones nos logs aparecem mascarados (últimos 4 dígitos) — LGPD

### Normalização de Telefone (`lib/phone.ts`)

Converte qualquer entrada para E.164. Regra especial Brasil:
- 12 dígitos `55 + DDD + 8` com primeiro dígito após DDD **≥ 6** → celular antigo → insere o 9 obrigatório
- Primeiro dígito após DDD **< 6** → fixo → não altera (evita criar número inválido)

### Follow-up Automático

Cadência: 2h → 24h → 72h. Tabela `follow_up_logs` com idempotência (UNIQUE). Cron via Vercel. Não envia se lead já respondeu ou se duplicado.

### Reativação de Leads

14 dias sem resposta → primeira tentativa. 30 dias → segunda. Exclui `FECHADO` e `PERDIDO`. Tabela `reactivation_logs`. LGPD-safe (sem spam contínuo).

### Lead Scoring Determinístico

Score 0–100 auditado via `lead_score_events`. Sinais detectados: intenção de compra, financiamento, preço, resposta pós-follow-up/reativação. Negation guard ativo ("não quero financiamento"). LLM **não** é fonte de verdade para score.

### Priorização Operacional

Classificação automática: `hot` (≥80 ou handoff), `warm` (40–79), `cold` (<40 ou null). Funções: `calculateLeadPriority`, `sortLeads`. Ordenação: prioridade → score → última atividade. Badge visual no Kanban.

### Dossiê do Lead

Função pura `buildLeadDossier`. Consolida `lead_score_events` + `follow_up_logs` + `reactivation_logs`. Conteúdo: resumo da conversa, sinais de intenção, warnings, ação recomendada. Componente `DossieCard`. Sem PII, fallback seguro.

### Ações do Vendedor

Server Actions: assumir conversa (IA → HUMANO), retornar para IA, atualizar `lead_status`. Status `AGUARDANDO_HUMANO` ao assumir. IA para quando em handoff. Validação server-side obrigatória.

### Kanban Operacional

Colunas baseadas em `lead_status`: NOVO → ENGAJADO → INTERESSADO → QUENTE → NEGOCIAÇÃO → FECHADO/PERDIDO. Mudança via dropdown (Server Action). Usa `transitionLeadStatus`. Validação dupla (UI + servidor). Sem drag-and-drop (MVP).

### Métricas Operacionais (`calculateOperationalMetrics`)

Função pura. Janela padrão: 30 dias. Métricas reais (sem mocks):

| Métrica | Descrição |
|---------|-----------|
| `total_leads` | Total de leads no período |
| `ai_handled_leads` | Leads atendidos pela IA |
| `human_handoff_count` | Handoffs para humano |
| `followups_sent` | Follow-ups enviados |
| `reactivations_sent` | Reativações enviadas |
| `negotiation_leads` | Leads em negociação |
| `closed_leads` | Leads fechados |
| `lost_leads` | Leads perdidos |
| `avg_first_response_minutes` | Tempo médio de primeira resposta |
| `followup_response_rate` | Taxa de resposta a follow-ups |
| `reactivation_response_rate` | Taxa de resposta a reativações |

Proteções: sem NaN, sem divisão por zero, sem PII.

### Padrões Consolidados

- Funções puras para lógica de domínio
- Server Actions (sem REST)
- RSC-first (mínimo client)
- Idempotência em todos os fluxos críticos
- Validação server-side obrigatória
- Concorrência tratada corretamente

### Dívidas Técnicas Conhecidas

- Sem isolamento por `store_id` (multi-tenant pendente)
- Query de mensagens sem limite
- Autenticação de usuários real ausente
- `assigned_to` ainda não utilizado

---

## Roadmap

| Fase | Status | Descrição |
|------|--------|-----------|
| Fase 1 | ✔ CONCLUÍDA | IA responde e acompanha |
| Fase 2 | ✔ CONCLUÍDA | IA prioriza, dá contexto ao vendedor, ações humanas, Kanban, métricas |
| Fase 3 | Próxima | IA orquestra toda a venda |

---

## Métricas de Sucesso

- taxa de conversão
- faturamento gerado
- margem real
- leads reativados
- ROI por canal

---

## Decisões de Arquitetura — Backlog Não-Bloqueante

| Decisão | Status | Contexto |
|---------|--------|---------|
| `DEFAULT_STORE_ID` via env | MVP aceitável | Server Actions leem store via `process.env.DEFAULT_STORE_ID`. Aceitável para single-store. Precisa entrar no backlog junto da issue #12 (multi-tenant / `store_id` por usuário autenticado) antes de suportar múltiplas lojas. |

---

## Regras para Claude neste Projeto

1. Tratar este documento como fonte de verdade absoluta
2. Toda feature deve servir ao loop econômico (lead → conversão → reativação)
3. Não simplificar a visão AI-First — IA é orquestradora, não assistente
4. Guardrails são inegociáveis — nunca propor código que os viole
5. Prioridade: faturamento e margem acima de qualquer outra métrica
6. Arquitetura sempre modular e orientada a fluxo

---

> O Vex Auto não organiza dados. O Vex Auto gera resultado.  
> Enquanto o lojista dorme, o sistema opera.
