# Vex Auto — CLAUDE.md

Contexto estratégico e operacional do produto. Fonte de verdade absoluta. Toda decisão técnica deve ser compatível com este documento.

---

## Definição do Produto

Vex Auto é uma **infraestrutura operacional AI-First** para o mercado automotivo.

Não é CRM, ERP ou ferramenta de gestão tradicional.

É o trilho por onde a economia da loja passa — orquestra a jornada de venda de ponta a ponta. Se o sistema cair, a operação comercial da loja é impactada diretamente.

O Vex Auto é projetado para se tornar infraestrutura crítica — a operação da loja deve depender dele para funcionar.

---

## O que o Vex Auto NÃO é

- não é CRM tradicional
- não é ferramenta de gestão passiva
- não é chatbot de atendimento

---

## Princípio Central

O sistema não existe para organizar dados.

Existe para:
- gerar faturamento
- proteger margem
- aumentar conversão
- escalar operação

---

## IA como Agente Operacional

A IA do Vex Auto não é um chatbot passivo.

Ela atua como agente operacional, executando ações com impacto direto no fluxo de vendas.

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
- reativação de leads — 3 tentativas (14d → 30d → 30d), templates enriquecidos com nome + veículo + tentativa
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
  → markReactivationResponded (non-fatal) → logAi
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

### Reativação de Leads — Mina de Ouro (`lib/reactivation.ts`, migration 018–019)

Reativa base inativa com templates enriquecidos e rastreio de resultado ponta a ponta.

**Cadência:** 14d sem resposta → tentativa 1. 30d após última reativação → tentativa 2. 30d → tentativa 3. Máximo 3 tentativas por lead.

**Elegibilidade:** `lead_status NOT IN ('FECHADO', 'PERDIDO')`, `conversation_status IN ('ATIVA', 'PAUSADA', 'ENCERRADA')`. Conversas ENCERRADA são elegíveis (reativação dispensa `handoff_to = 'IA'`).

**Templates enriquecidos:** `buildReactivationText(attempt, nome, { veiculo_interesse })` — 6 templates (3 tentativas × com/sem veículo). Fallback: `"você"` se nome nulo; sem veículo se `veiculo_interesse` nulo.

**Métricas de resultado:**
- `responded_at` — quando lead respondeu após reativação (janela 30d). Atualizado por `markReactivationResponded` em toda msg entrante processada pelo pipeline (non-fatal).
- `converted_at` — quando lead foi marcado FECHADO após ter respondido. Atualizado por `markReactivationConverted` em `updateLeadStatus` e `moveLeadStatus` (non-fatal). Requer `responded_at` preenchido.

**Invariante de ordem:** `reactivation_logs.insert` (claim atômico) → `messages.insert` → `sendWhatsAppMessage`. Falha de envio nunca perde o histórico.

**Idempotência:** `23505` no insert = concurrent claim → skip. `.is("responded_at", null)` e `.is("converted_at", null)` previnem double-update.

**RPC `get_reactivation_eligible_leads`:** `DISTINCT ON (lead_id)` — 1 lead = 1 linha. Prioridade de conversa: ATIVA > PAUSADA > ENCERRADA. Retorna `veiculo_interesse` de `leads.contexto` (JSONB).

Exclui `FECHADO` e `PERDIDO`. LGPD-safe (máx 3 tentativas por lead).

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

### Multi-tenant B1 (`lib/auth.ts`, migration 016)

Isolamento completo por `store_id`. Concluído em PR #16.

`getServerStoreId()` — obtém `store_id` do usuário autenticado:
- Busca usuário via `supabase.auth.getUser()`
- Consulta `public.users` → retorna `store_id`
- Lança `AuthError` (redirect `/login`) se não autenticado
- Lança `StoreNotFoundError` se usuário não tem loja vinculada

RLS ativo em 11+ tabelas via função helper `public.my_store_id()`. Isolamento duplo: `getServerStoreId()` nas Server Actions + RLS no banco.

### Super-admin / Painel Administrativo (`lib/admin-auth.ts`)

`/admin` é painel interno da Vex — **nunca visível para clientes ou lojistas**.

Proteção em 3 camadas:
1. **Middleware** — verifica `ADMIN_EMAILS`, redireciona para `/acesso-restrito` se não autorizado
2. **Server Component** — `assertSuperAdmin()` no topo de `/app/admin/page.tsx`
3. **Server Actions** — cada action chama `assertSuperAdmin()` individualmente

Funções:
- `isSuperAdmin(email)` — boolean puro, case-insensitive
- `assertSuperAdmin()` — async, redireciona se não autorizado, retorna `user.id`
- `getAdminEmails()` — lê `ADMIN_EMAILS` env var (CSV, trim automático)

`/acesso-restrito` — página de acesso negado com link para `/leads`.

Header mostra link "Admin" apenas para super-admins (calculado server-side em `app/layout.tsx`).

### WhatsApp por Loja (`lib/whatsapp-credentials.ts`, migration 017)

`stores.whatsapp_phone_number_id` (TEXT, nullable) — Phone Number ID da Meta por loja.

`getStoreWhatsAppPhoneId(storeId: string)`:
1. Consulta `stores.whatsapp_phone_number_id`
2. Fallback: env var `WHATSAPP_PHONE_NUMBER_ID` (compatibilidade single-tenant)
3. Erro permanente (`auth_error`, não retryable) se nenhum configurado

`sendWhatsAppMessage(to, text, phoneNumberId)` — aceita `phoneNumberId` explícito. Token `WHATSAPP_ACCESS_TOKEN` ainda global (roadmap: per-loja).

Classificação de erro: `rate_limited`, `invalid_recipient` (permanente), `service_error` (retryable), `auth_error` (permanente), `unknown` (retryable).

### Gestão de Equipe (`leads.assigned_to`, migration 018)

Atribuição manual de leads a vendedores com métricas por usuário.

**Campo:** `leads.assigned_to` (UUID, nullable) — responsável atual pelo lead. Sem histórico de trocas (MVP).

**Server Actions:** `assignLeadToUser(leadId, userId)` — guard duplo (lead pertence à loja + usuário pertence à loja). `removeLeadAssignment(leadId)` — remove atribuição.

**Métricas por vendedor (`calculateSellerMetrics`):** `total_leads`, `active_leads`, `closed_leads`, `lost_leads`, `avg_score` — calculadas por `assigned_to`. Página `/equipe` com tabela de performance.

**UX:** filtro por vendedor em `/leads`, badge "Aguardando Atendimento" acionável, KPI de leads sem atribuição no painel de equipe.

**Dívidas:** RBAC pendente (qualquer usuário da loja pode reatribuir qualquer lead). Histórico de atribuição pendente (necessário para comissões/ROI futuro).

### Onboarding Operacional (`app/admin/actions.ts`)

Fluxo para provisionar nova loja:

1. `createStore()` — cria loja com nome, `whatsapp_numero`, `whatsapp_phone_number_id`
2. `createStoreUser()` — convite por email (Supabase Auth `inviteUserByEmail`)
3. `createStoreUserDirect()` — cria usuário com senha temporária (16 chars, base64url)
   - Rollback automático: se insert em `public.users` falhar, deleta auth user
   - Senha exibida uma única vez na UI (aviso explícito no componente)
   - Usuário vinculado a `store_id` diretamente no insert

Todas as actions protegidas por `assertSuperAdmin()`.

### Dívidas Técnicas Conhecidas

- ~~Sem isolamento por `store_id`~~ — ✔ Multi-tenant B1 concluído (`getServerStoreId()` + RLS)
- ~~Autenticação de usuários real ausente~~ — ✔ Supabase Auth integrada ao `store_id`
- Query de mensagens sem limite — **pendente**
- ~~`assigned_to` ainda não utilizado~~ — ✔ feature/assigned-to (leads.assigned_to + atribuição manual + métricas por vendedor)
- `WHATSAPP_ACCESS_TOKEN` global — por loja é roadmap B2+ — **pendente**
- **`WHATSAPP_PHONE_NUMBER_ID` aponta para sandbox** — `1150232648165177` (`+1 555-629-2868`). Número real Speed Motos (`1233441783176942`) é `ON_PREMISE`, incompatível com Cloud API. Envios de follow-up e reativação falham em produção. Resolução: registrar número Cloud API real na Meta e atualizar env na Vercel — **BLOQUEIO OPERACIONAL**
- `error_category` ausente em `reactivation_logs` e `error_message` nunca populado em `follow_up_logs` — falhas de envio WA são silenciosas nos jobs — **pendente** (observabilidade)
- Masking de PII em logs — `lib/logger.ts` genérico não mascara telefone/email — **pendente** (LGPD)
- `leads.assigned_to` guarda apenas responsável atual (sem histórico) — **pendente para ROI/comissões**: avaliar `lead_assignment_history` ou event sourcing quando comissão/ROI avançado/auditoria forem implementados
- **Atribuição sem RBAC** — `assignLeadToUser`/`removeLeadAssignment` só validam `store_id` (modelo de auth atual, consistente com `updateLeadStatus`/`moveLeadStatus`). Qualquer usuário da loja reatribui qualquer lead. RBAC por papel (vendedor só toca os próprios leads) é decisão de produto futura — **pendente** (bloqueia atribuição confiável de comissões)
- **Store-move de usuário não revalida `leads.assigned_to`** — trigger `check_lead_assigned_to_store` guarda escrita em `leads`, não `UPDATE users SET store_id`. Sem UI para mover user entre lojas hoje; se criar, revalidar leads atribuídos — **pendente**

---

## Roadmap

> Detalhamento por fase em **Roadmap Atualizado** ao final do documento.

| Fase | Status | Descrição |
|------|--------|-----------|
| Fase 1 | ✔ CONCLUÍDA | IA responde, acompanha, deploy em produção |
| Fase 2 | Em andamento | Multi-tenant, autenticação real, equipe |
| Fase 3 | Planejada | UX operacional (inbox, kanban avançado, dashboard) |
| Fase 4 | Planejada | Escala (CSV, portais, reativação em massa) |
| Fase 5 | Planejada | Monetização (planos, ROI, relatórios) |

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
| `DEFAULT_STORE_ID` via env | ✔ RESOLVIDO | Multi-tenant B1 implementado. `getServerStoreId()` obtém `store_id` via Supabase Auth. `DEFAULT_STORE_ID` não está mais em código produtivo. |
| `WHATSAPP_ACCESS_TOKEN` global | Em andamento | Token ainda global por env. `phone_number_id` já é per-loja (migration 017). Token per-loja é roadmap B2+. |

---

## Fluxo Obrigatório antes de Push

Todo `git push` executa automaticamente via **Husky v9** (`pre-push` hook):

```sh
npm run lint        # ESLint — zero warnings/errors
npm run typecheck   # tsc --noEmit
npm run test        # vitest run (unit + integration)
```

Push é bloqueado se qualquer comando falhar.

### Setup para novo dev

```sh
git clone <repo>
npm install   # prepare script roda `husky` automaticamente
# hooks ativos — nenhum passo extra
```

### CI (GitHub Actions)

`npm ci` detecta `CI=true` → Husky não instala hooks → sem conflito. CI roda `npm run test:unit` separadamente no workflow.

---

## Regras para Claude neste Projeto

1. Tratar este documento como fonte de verdade absoluta
2. Toda feature deve servir ao loop econômico (lead → conversão → reativação)
3. Não simplificar a visão AI-First — IA é orquestradora, não assistente
4. Guardrails são inegociáveis — nunca propor código que os viole
5. Prioridade: faturamento e margem acima de qualquer outra métrica
6. Arquitetura sempre modular e orientada a fluxo
7. Antes de qualquer push: lint + typecheck + vitest run devem passar (hook automático via Husky)

---

> O Vex Auto não organiza dados. O Vex Auto gera resultado.  
> Enquanto o lojista dorme, o sistema opera.

---

## Estado Atual do Sistema (Produção)

> Última atualização: 2026-06-10

### Infraestrutura

- Deploy ativo na Vercel (plano Hobby)
- Domínio configurado e operacional
- Variáveis de ambiente configuradas: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `INTERNAL_API_KEY`, `ADMIN_EMAILS`
- ~~`DEFAULT_STORE_ID`~~ removido — substituído por `getServerStoreId()` (multi-tenant B1)
- Banco Supabase com todas as migrations aplicadas em produção (001–019)

### WhatsApp

- Webhook Meta configurado e respondendo (`/api/whatsapp/webhook`)
- Pipeline de IA integrado ao fluxo de entrada/saída de mensagens
- Validação HMAC ativa em todos os requests do webhook
- ⚠️ **BLOQUEIO ATIVO**: `WHATSAPP_PHONE_NUMBER_ID` aponta para sandbox Meta (`1150232648165177`, `+1 555-629-2868`). Envios falham para todos os leads — Meta bloqueia entrega fora de números homologados. Sistema encontra leads, cria mensagens e chama API corretamente; bloqueio é exclusivamente de infraestrutura Meta. Número real da Speed Motos (`1233441783176942`) é plataforma `ON_PREMISE` — incompatível com Cloud API. **Resolução pendente:** registrar número Cloud API real e atualizar `WHATSAPP_PHONE_NUMBER_ID` na Vercel.

### Pipeline de IA

Fluxo em produção:

```
webhook → buildAgentContext → runGuardrails → buildPrompt → runAgent
  → messages.insert → sendWhatsAppMessage → transitionConversationStatus → leads.update
  → markReactivationResponded (non-fatal) → logAi
```

Garantias operacionais:
- Persistência no banco **antes** do envio WA — falha de envio não perde mensagem
- Idempotência via `skipped_duplicate` — reprocessamento seguro
- Tolerância a falha de envio — `ok_send_failed` registrado, retry possível
- Webhook sempre retorna HTTP 200 à Meta — erros internos nunca expostos

### Sistema de Retry (PR 15)

- Campo `message_id` (WhatsApp Message ID) salvo na tabela `messages` — previne double-send
- Classificação de erro: `retryable` (timeout, 5xx, rede) vs `permanent` (4xx, token inválido)
- Staleness recovery: mensagens com `ok_send_failed` há mais de X minutos são reprocessadas
- `agent_status` estendido:

| Status | Significado |
|--------|-------------|
| `ok_send_failed` | Falha no envio, elegível para retry |
| `ok_send_failed_retrying` | Retry em andamento |
| `ok_send_failed_permanent` | Erro permanente, sem novo retry |

### Automação

- Follow-up automático operacional — cadência 2h → 24h → 72h
- Reativação de leads operacional (Mina de Ouro) — 3 tentativas, templates enriquecidos, ENCERRADA elegível, métricas responded_at/converted_at
- Cron consolidado em `/api/internal/daily-run` — PR #24 corrigiu bug crítico: Vercel Cron envia GET, endpoint só tinha POST → 405 em toda execução. GET handler adicionado com dual-auth (`Authorization: Bearer <CRON_SECRET>` + `x-internal-key`). Cron operacional a partir de 2026-06-10.
- Proteção por `INTERNAL_API_KEY` em todos os endpoints internos

### Segurança

- Validação HMAC em todos os requests do webhook Meta
- Telefones mascarados nos logs — ⚠️ implementação pendente em `lib/logger.ts` (pipeline afirma masking, verificação necessária)
- Logs sem PII — parcial (tokens Meta não logados; masking de número não universal)
- Endpoints internos protegidos por `INTERNAL_API_KEY`

### Multi-tenant B1

- `getServerStoreId()` ativo em todas as Server Actions
- RLS validado em 11+ tabelas via `public.my_store_id()`
- Migrations 016–019 aplicadas em produção
- `DEFAULT_STORE_ID` removido do código produtivo

### Admin / Super-admin

- `/admin` operacional com proteção 3 camadas (middleware + page + actions)
- `ADMIN_EMAILS` configurado em produção
- `/acesso-restrito` ativo
- Lojista não vê link "Admin" no Header

### WhatsApp por Loja

- `stores.whatsapp_phone_number_id` ativo (migration 017)
- `getStoreWhatsAppPhoneId()` resolvendo per-loja com fallback env
- Token `WHATSAPP_ACCESS_TOKEN` ainda global — per-loja é roadmap

### Gestão de Equipe

- `leads.assigned_to` ativo — atribuição manual de leads a vendedores
- `/equipe` operacional — métricas por vendedor (total, ativos, fechados, score médio)
- Filtro por vendedor em `/leads`
- Badge "Aguardando Atendimento" acionável no painel de equipe
- RBAC pendente (qualquer usuário da loja pode reatribuir)

### Mina de Ouro

- `runReactivationJob` operacional em produção
- Templates enriquecidos ativos: nome + veículo de interesse + tentativa (1/2/3)
- `responded_at` e `converted_at` rastreando resultado ponta a ponta
- 5 leads elegíveis identificados no primeiro run pós-deploy
- RPC `get_reactivation_eligible_leads` com DISTINCT ON + ENCERRADA + veiculo_interesse
- ⚠️ Envios WhatsApp falhando por bloqueio de sandbox Meta (ver seção WhatsApp)

### Frontend

- Login funcional (autenticação via Supabase Auth)
- Páginas operacionais: leads, conversations, kanban, analytics, equipe
- Observação: UX ainda não está em versão final — fluxos funcionam, design em refinamento

---

## Roadmap Atualizado

> Substitui a tabela de roadmap anterior. Detalhamento por fase.

### Fase 1 — Validação Real ✔ CONCLUÍDA

- WhatsApp real integrado e validado via Meta Cloud API
- Fluxo completo testado e confirmado: lead entra → IA responde → mensagem enviada
- Deploy em produção com env vars reais

### Fase 2 — Base Estrutural (Parcialmente concluída)

- ✔ Multi-tenant B1: isolamento por `store_id` em todas as queries (PR #16, migration 016)
- ✔ Autenticação real: Supabase Auth integrada ao `store_id` via `getServerStoreId()`
- ✔ WhatsApp por loja: `stores.whatsapp_phone_number_id` (migration 017)
- ✔ Admin/super-admin: painel interno com proteção 3 camadas + onboarding de lojas
- ✔ Equipe: `assigned_to` funcional, métricas por vendedor, filtro e UX operacional (PR #20/#22, migration 018)
- ✔ Mina de Ouro: reativação com templates enriquecidos + métricas responded_at/converted_at + 3 tentativas (PR #23, migration 019)
- Masking PII universal em logs — **pendente** (LGPD)
- `WHATSAPP_ACCESS_TOKEN` per-loja (B2+) — **pendente**

### Fase 3 — UX Operacional

- Inbox estilo WhatsApp (conversa em tempo real, histórico completo)
- Kanban com drag-and-drop e filtros avançados
- Dashboard operacional com métricas em tempo real

### Fase 4 — Escala

- Importação de base via CSV (leads e veículos)
- Integrações com portais de veículos (OLX Autos, WebMotors, iCarros)
- Reativação em massa com controle de cadência e limites LGPD

### Fase 5 — Monetização

- Planos e cobrança por loja (Stripe ou equivalente)
- Métricas de ROI por loja: faturamento gerado, conversão, CAC
- Relatórios exportáveis para gestão

---

## Status do Produto

O Vex Auto já está operando em produção com:

- envio e recebimento real via WhatsApp (Meta Cloud API)
- pipeline de IA ativo (Claude via Anthropic API)
- automação de follow-up e reativação operacional
- sistema de retry com classificação de erro e prevenção de double-send
- infraestrutura estável (Vercel + Supabase)
- login funcional e páginas principais operacionais
- multi-tenant B1 ativo — isolamento por `store_id` + RLS em todas as tabelas
- WhatsApp por loja — `phone_number_id` per-store com fallback env
- painel admin com onboarding de lojas e usuários (super-admin only)
- gestão de equipe — `assigned_to`, métricas por vendedor, filtro e UX operacional
- Mina de Ouro ativa — templates enriquecidos, 3 tentativas, responded_at/converted_at em produção

O sistema já executa partes reais da operação comercial, reduzindo dependência humana e aumentando velocidade de resposta e conversão.

---

## Princípio de Execução

Toda nova feature deve responder:

> "Isso aumenta faturamento, margem ou conversão?"

Se não aumentar, não é prioridade.

---

## Objetivo Final

O objetivo final do sistema é se tornar indispensável — a operação comercial da loja deve depender dele para funcionar.
