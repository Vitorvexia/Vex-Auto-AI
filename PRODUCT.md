# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: vendedor/atendente da loja automotiva — uso diário, chão de loja/desktop. Trabalha leads, kanban de funil, conversas WhatsApp (assume/retorna pra IA), fecha venda (seleciona veículo + valor).

Secondary: dono/gestor da loja — métricas, equipe, ROI, onboarding de vendedores. Menos operação lead-a-lead, mais visão de time e resultado (`/equipe`, `/analytics`).

Also: super-admin Vex (interno, nunca visível a clientes) — provisiona lojas via `/admin`, protegido 3 camadas.

## Product Purpose

Infraestrutura operacional AI-First pro mercado automotivo. Não organiza dado — gera faturamento, protege margem, aumenta conversão, escala operação. Trilho por onde a economia da loja passa: atendimento inicial, follow-up, reativação de base inativa e qualificação rodam por IA 24/7; humano entra só em negociação, validação financeira e fechamento.

Fluxo: Entrada → Atendimento (IA) → Qualificação (score 0–100) → Nutrição → Dossiê → Intervenção Humana → Conversão → Pós-venda → Reativação (loop contínuo, não termina na venda).

## Positioning

Diferencial varia por categoria de concorrente (não um pitch único):

- **vs. CRM automotivo tradicional** (AutoPilot, Azul360): orquestração ativa por IA vs. organização passiva de dado. Lead não fica parado esperando vendedor puxar.
- **vs. atendimento de IA isolado** (Thera): IA plugada na camada operacional real do negócio (estoque com custo/margem, RENAVE, site) — decide com contexto de negócio, não é chatbot solto sem dado.
- **vs. full-ERP / agência de growth** (Revenda Mais, Autoconf, AEG Media): fronteira consciente de não-competição (decisão DL-0007, posicionamento "B+"). Não substitui gestão completa da loja nem mídia paga — foca no trilho lead→conversão→reativação.

## Operating Context

- Entrada de lead via WhatsApp Cloud API (Meta), por loja (`whatsapp_phone_number_id` per-tenant).
- Vendedor trabalha em `/leads`, `/conversations` (inbox), kanban por `lead_status` (NOVO → ENGAJADO → INTERESSADO → QUENTE → NEGOCIAÇÃO → FECHADO/PERDIDO).
- IA atende, qualifica (score determinístico 0–100), roda follow-up (2h→24h→72h) e reativação de base inativa (14d→30d→30d, 3 tentativas máx).
- Fechamento de venda exige seleção de veículo + valor; sistema bloqueia abaixo de custo+margem_mínima (guardrail de margem obrigatório).
- Coleta assistida de financiamento e troca de veículo por texto (IA nunca calcula taxa nem avalia veículo — só coleta e aciona humano).
- `/agenda` lista agendamentos do dia (troca de moto). `/equipe` distribui leads a vendedores e mostra métricas por vendedor. `/estoque` é CRUD real de veículos (custo, margem_mínima, disponibilidade).
- `/site/[slug]` é vitrine pública da loja (storefront por veículo) — única superfície voltada a lead/comprador final, não a operador interno.
- Onboarding de nova loja é interno (super-admin, `/admin`): cria loja, credencial WhatsApp própria, convite de usuário.

## Capabilities and Constraints

- Multi-tenant real: isolamento por `store_id` em toda tabela relevante, RLS + `getServerStoreId()`.
- Credencial de integração externa (WhatsApp hoje, RENAVE futuramente) é por tenant — Vex é integrador, nunca dono do ativo.
- Guardrails inegociáveis, garantidos em código (não só prompt): IA nunca fecha venda abaixo da margem mínima sem validação; aprovação humana obrigatória em decisões financeiras (preço final, negociação, contrato, crédito).
- LGPD: telefone mascarado em log (últimos 4 dígitos), CPF nunca logado (só em `contexto` protegido por RLS), reativação limitada a 3 tentativas/lead.
- `WHATSAPP_ACCESS_TOKEN` ainda global (não per-loja) — dívida técnica conhecida, roadmap B2+.
- Terminologia de domínio: `lead_status` (funil), `conversation_status`/`handoff_to` (IA vs humano), `agent_status` (resultado do turno de IA), score determinístico (não é a LLM que decide).

## Brand Commitments

Nome: **Vex Auto**. Não é CRM, não é ferramenta de gestão passiva, não é chatbot de atendimento — recusar enquadramento que reduza a isso. IA é agente operacional, não assistente.

## Evidence on Hand

**Speed Motos** — loja piloto real em produção (WhatsApp/IA/handoff/guardrail validados tecnicamente, confirmado 2026-07-31). Citável como "operação real ativa" / "primeira operação rodando em produção". **NÃO citável** como resultado ou case de sucesso: sem métrica de negócio (conversão, leads recuperados) e sem depoimento coletado do dono ainda. Copy futura não deve inventar número ou depoimento pra acompanhar esse case — tratar ausência de prova social como parte honesta do discurso (ex: painel "sinal ao vivo" em vez de depoimento fabricado), não como buraco a preencher.

## Product Principles

1. Toda feature responde: "isso aumenta faturamento, margem ou conversão?" — se não, não é prioridade.
2. IA é orquestradora do fluxo, não assistente passivo — capacidade de ação real via API, não só resposta.
3. Guardrails financeiros são código, não convenção — nunca confiar só em instrução de prompt pra regra inegociável.
4. Credencial de terceiro é sempre por loja — Vex nunca é dono do ativo do cliente.
5. Prova social honesta: nunca inflar piloto técnico em case de sucesso sem dado real por trás.

## Accessibility & Inclusion

Nenhum requisito específico de acessibilidade confirmado ainda além de padrão web razoável — não estabelecido com o usuário.
