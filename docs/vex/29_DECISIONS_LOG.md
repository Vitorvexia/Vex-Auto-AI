29_DECISIONS_LOG.md
# THE VEX OPERATING SYSTEM

# DECISIONS LOG

Version: 1.0

Status: Living Document

Owner: Engineering Leadership

Last Updated: 2026-07-20

---

> "A forgotten decision becomes tomorrow's repeated discussion."

---

# PURPOSE

This document records significant project decisions that do not require a full Architecture Decision Record (ADR).

Its objective is preserving engineering context.

Every important decision should be documented somewhere.

Major decisions belong in ADRs.

Smaller operational decisions belong here.

This document is chronological.

Newest entries always appear first.

---

# PHILOSOPHY

Every decision has a cost.

Every undocumented decision creates future uncertainty.

This document exists to answer one simple question:

"Why did we choose this?"

---

# WHEN TO CREATE AN ENTRY

Create an entry whenever a decision:

Changes development direction.

Changes priorities.

Rejects a feature.

Introduces a temporary workaround.

Accepts technical debt.

Changes operational procedures.

Changes deployment strategy.

Changes AI behavior.

Changes infrastructure.

Changes business rules.

If future engineers may ask "why",

record it here.

---

# WHEN NOT TO USE THIS DOCUMENT

Do NOT use this document for:

Architecture changes requiring ADRs.

Bug reports.

Meeting notes.

Daily progress.

Git commit history.

Personal opinions.

Use the correct document for each purpose.

---

# ENTRY TEMPLATE

Every decision follows the same structure.

Date

Decision ID

Title

Category

Context

Decision

Reasoning

Alternatives Considered

Expected Impact

Potential Risks

Owner

Related ADR

Related Issue

Related Runbook

Review Date

Status

Consistency is mandatory.

---

# CATEGORIES

Engineering

Architecture

Operations

Infrastructure

AI

Security

Business

Product

Deployment

Documentation

Testing

Monitoring

Performance

Customer Success

Other

---

# STATUS

Active

Superseded

Deprecated

Reverted

Archived

A decision never disappears.

Its status changes.

---

# EXAMPLE ENTRY

Date

2026-06-23

Decision ID

DL-001

Title

Pause Feature Development Until MVP Validation

Category

Engineering

Context

The MVP reached feature completeness.

Multiple production validations remain pending.

Decision

Suspend implementation of non-essential features until operational validation is complete.

Reasoning

Shipping additional functionality before validation increases operational risk and debugging complexity.

Alternatives Considered

Continue feature development in parallel.

Expected Impact

Higher software stability.

Lower development velocity.

Better production confidence.

Potential Risks

Delayed roadmap execution.

Owner

Engineering

Related ADR

ADR-004

Status

Active

---

# REAL DECISIONS

Date

2026-07-24 (commit date). Log entry written retroactively on 2026-07-24 during a later session — not recorded at merge time. This entry itself is the fix for that gap.

Decision ID

DL-0001

Title

Priorizar Coleta de Financiamento/Troca Antes da Validação de Produção do MVP Terminar

Category

Product

Context

`27_PROJECT_STATUS.md` define a fase atual como "MVP Validation", com regra explícita: prioridade 1-4 é resolver blockers de produção (WhatsApp sandbox, B001-B005) e só prioridade 5 é "begin new feature development". Commit `147f1ef` (2026-07-24, mesmo dia), mergeou a feature de coleta de financiamento/troca — capacidade nova e independente do guardrail de margem existente e dos blockers de validação em aberto — antes de qualquer um dos blockers B001-B005 ter sido resolvido.

Decision

Priorizar e mergear a feature de coleta de financiamento/troca (`lib/collection.ts`, `lib/guardrails.ts`, migration 022, página `/agenda`) fora de ordem em relação à regra de prioridade documentada em `27_PROJECT_STATUS.md`.

Reasoning

Demanda real de cliente (Speed Motos) — leads já perguntando sobre financiamento e condições de troca em produção, sem fluxo pra IA responder ou coletar esses dados. Aprovado pelo founder.

Alternatives Considered

Esperar B001-B005 (desbloqueio WhatsApp real) resolverem antes de tocar em feature nova, conforme regra original.

Expected Impact

Feature entregue e funcional (635/635 testes passando, lint/typecheck limpos). Regra de prioridade de `27_PROJECT_STATUS.md` furada sem registro no momento do merge — motivou a criação da regra de processo em `27_PROJECT_STATUS.md` (exceção exige entrada no Decisions Log no mesmo PR/commit).

Potential Risks

Precedente de exceção não documentada no momento em que acontece — mitigado retroativamente por esta entrada e pela nova regra de processo.

Owner

Founder (aprovação) / Engineering (implementação)

Related ADR

None

Related Issue

Ver `27_PROJECT_STATUS.md` — RECENT COMPLETED WORK (coleta financiamento/troca) e ACTIVE BLOCKERS (B001-B005)

Related Runbook

None

Review Date

N/A — decisão pontual, não recorrente

Status

Active

---

Date

2026-07-26

Decision ID

DL-0002

Title

Credencial de WhatsApp é por Tenant (Loja), Não Global

Category

Architecture

Context

Migração B001 (sandbox → Cloud API real) confirmou que WABA "#1 Isadora", App "Vex Auto" e System User `vex-auto-api` estão registrados sob o CNPJ da CMOV MOBILIDADE URBANA LTDA (dona da Speed Motos) — não sob CNPJ do Vex Auto. Business Verification, forma de pagamento e templates pertencem à loja. Vex Auto se conecta como integrador via token do System User, não como dono do número/WABA. Ver `project_whatsapp_migration_b001` (memória).

Decision

Modelo de credencial WhatsApp é por tenant: cada loja cliente registra seu próprio WABA/número sob seu próprio CNPJ. Vex Auto nunca é dono do número nem do WABA — apenas consome via token per-loja. `stores.whatsapp_phone_number_id` (migration 017) já reflete isso no schema. Nenhum token global de WhatsApp deve ser introduzido como atalho — `WHATSAPP_ACCESS_TOKEN` global hoje é dívida técnica temporária (roadmap B2+ per-loja), não o modelo alvo.

Reasoning

Onboarding self-serve de clientes futuros exige que cada loja tenha WABA verificado com CNPJ próprio — é como a Meta exige para negócios reais (BSP/self-managed). Um WABA único do Vex Auto compartilhado entre lojas criaria dependência de relacionamento comercial com uma única loja como "dona" do canal, risco de perda de ativo se a relação azedar, e não escala para múltiplos clientes com CNPJs distintos.

Alternatives Considered

Registrar WABA único sob CNPJ do Vex Auto e sub-alocar números por loja — rejeitado: exige Vex Auto ser provedor verificado na Meta (Business Solution Provider), o que depende de CNPJ próprio do Vex Auto (ainda não existe, ver BL-0001) e não é caminho crítico para o primeiro cliente.

Expected Impact

Arquitetura de credencial (WABA + número + token) permanece por tenant desde o primeiro cliente — sem retrabalho quando o segundo cliente for onboardado. Mesmo raciocínio se aplica a credenciais futuras por loja (ex: RENAVE, quando chegar).

Potential Risks

`WHATSAPP_ACCESS_TOKEN` ainda global no código hoje (dívida técnica documentada em `CLAUDE.md` — Dívidas Técnicas Conhecidas) — se não migrado para per-loja antes do segundo cliente, cria acoplamento indevido. Mitigação: token per-loja já é item de roadmap explícito (Fase 2/B2+).

Owner

Founder (decisão de arquitetura) / Engineering (implementação já parcialmente feita — `phone_number_id` per-loja via migration 017)

Related ADR

None

Related Issue

BL-0001 (CNPJ próprio Vex Auto — necessário para onboarding self-serve e provedor verificado Meta), B001-B002 (migração WhatsApp Speed Motos)

Related Runbook

None

Review Date

Quando segundo cliente entrar em onboarding — validar que `WHATSAPP_ACCESS_TOKEN` per-loja foi implementado antes de repetir o fluxo

Status

Active

---

Date

2026-07-26

Decision ID

DL-0003

Title

Manter Infraestrutura Meta (App/System User/Token) no Business Manager da Speed Motos Durante o Piloto

Category

Infrastructure

Context

Verificação direta no Meta Business Settings (founder, 2026-07-26) confirmou: existe um único Business Manager na conta — "Speed Motos" (3 ativos de negócio), nenhum BM próprio do Vex. WABA "#1 Atendimento" (ID `456613541838969`) é propriedade da Speed Motos, Verificação da empresa: Verificado, Status da conta: Aprovada. O app Meta (ID `731158340085674`), o System User e o token global `WHATSAPP_ACCESS_TOKEN` estão todos dentro desse mesmo BM da Speed Motos — hospedados no CNPJ da loja cliente, não em CNPJ do Vex. Método de pagamento vinculado é cartão da própria loja. Isso corrige/substitui a inferência anterior (não verificada) registrada em [[project_whatsapp_migration_b001]] (memória) e discutida em sessão anterior a esta.

Decision

Manter, durante o piloto, toda a infraestrutura Meta (app, System User, token) dentro do Business Manager da Speed Motos. Aceito conscientemente como dívida: o ativo de distribuição do produto (app Meta que hospeda a integração) está hoje no CNPJ de terceiro, não do Vex.

Reasoning

Viabiliza o piloto imediatamente sem esperar abertura do CNPJ próprio do Vex (SLU), que ainda não existe. Blast radius atual = 1 loja conectada (Speed Motos) — custo de migrar depois ainda é baixo. Esperar CNPJ próprio antes de rodar o piloto adiaria validação real sem ganho proporcional no estágio atual (1 cliente).

Alternatives Considered

Adiar piloto até abertura de CNPJ próprio do Vex e criação de BM separado — rejeitado: bloquearia validação de produto por tempo indeterminado sem benefício até existir 2º cliente.

Expected Impact

Piloto Speed Motos roda sem bloqueio administrativo adicional. Dívida de arquitetura explícita e rastreável (esta entrada + BL-0001) em vez de assumida tacitamente.

Potential Risks

Token global é escopado ao BM que autorizou o System User — cliente 2 com WABA em BM separado NÃO autentica com o token atual (`lib/whatsapp-send.ts:68`, `lib/whatsapp-signature.ts:15`, `app/api/whatsapp/webhook/route.ts:23`). Migração para BM próprio do Vex é pré-requisito técnico do segundo cliente, não apenas questão administrativa/comercial. Se a relação com a Speed Motos azedar antes da migração, o ativo de distribuição (app Meta) está sob controle de CNPJ de terceiro.

Plano de saída: quando o Vex tiver BM próprio, usar o mecanismo "Atribuir parceiro" na tela do WABA — o BM da loja compartilha o WABA com o BM do Vex; o WABA continua propriedade da loja (consistente com DL-0002 — credencial de WABA é por tenant). Do lado do código, a migração é troca de 3 env vars (`lib/whatsapp-send.ts:68`, `lib/whatsapp-signature.ts:15`, `app/api/whatsapp/webhook/route.ts:23`) + redeploy — sem mudança estrutural.

Owner

Founder (decisão de aceitar a dívida) / Engineering (plano de saída documentado)

Related ADR

None

Related Issue

BL-0001 (WhatsApp Embedded Signup, bloqueado por CNPJ próprio do Vex — mesma dependência raiz: Vex precisa ser Meta Tech Provider/Business Partner, o que exige CNPJ próprio)

Related Runbook

None

Review Date

Antes de onboardar o 2º cliente — migração de BM é pré-requisito técnico, não pode ficar pendente além desse ponto

Status

Active

---

Date

2026-07-27

Decision ID

DL-0004

Title

Client Realtime Não Herda JWT da Sessão — `setAuth()` Explícito É Obrigatório em Todo Client Component com Postgres Changes

Category

Engineering

Context

Implementação do item 0.8 (Inbox em tempo real, `app/components/ConversationMessages.tsx`). RLS de `messages` (migration 005) e a tabela na publication `supabase_realtime` (migration 023) estavam corretas, e os testes de `lib/realtime-messages.ts` (mocks) passavam — mas um teste de integração real (`tests/integration/realtime-isolation.test.ts`, RT-1) mostrou que o usuário autenticado não recebia NENHUM evento `postgres_changes`, nem da própria loja. Diagnóstico isolado (service role vs anon+login) confirmou: o client `@supabase/supabase-js` não repassa o JWT da sessão pro socket do Realtime automaticamente após `signInWithPassword`/restauração de sessão via cookie — sem `client.realtime.setAuth(access_token)` explícito, a policy de RLS nunca resolve `auth.uid()` no contexto do Realtime, e o canal fica mudo pra qualquer store, incluindo a do próprio usuário. Testes de lib pura (mocks) não capturam esse tipo de falha porque simulam o canal, não a autenticação real do transporte.

Decision

Todo Client Component que assina `postgres_changes` deve chamar `supabase.realtime.setAuth(session.access_token)` explicitamente antes de `channel().subscribe()`, e reaplicar em todo evento de `onAuthStateChange` (token refresh) — não confiar em wiring automático entre auth e realtime. Padrão implementado em `app/components/ConversationMessages.tsx` (busca sessão via `getSession()`, seta auth, assina `onAuthStateChange` pro resto da vida do componente).

Reasoning

Sem esse passo, o bug é silencioso da pior forma possível: a UI carrega normalmente, o histórico inicial aparece (veio via Server Component/SSR, não via Realtime), e só falta o comportamento "ao vivo" — que é justamente o que ninguém nota testando manualmente uma vez, mas quebra o propósito inteiro do item 0.8 (vendedor não vê mensagem nova chegar). Testes unitários com mock de canal não pegam isso porque o mock não modela a ausência do JWT no transporte real.

Alternatives Considered

Confiar no wiring automático do `@supabase/ssr`/`supabase-js` entre sessão e Realtime — rejeitado: testado empiricamente (script de diagnóstico isolado) e confirmado que não propaga o token sozinho nesta versão instalada (`@supabase/supabase-js` 2.103.0). Pode mudar em versão futura, mas não dá pra assumir sem validar de novo.

Expected Impact

`ConversationMessages.tsx` funciona corretamente em produção (validado por `tests/integration/realtime-isolation.test.ts`, RT-1/RT-2a/RT-2b contra Supabase real). Todo Client Component futuro que precisar de Realtime com RLS deve seguir o mesmo padrão.

Potential Risks

Risco de regressão real: qualquer novo Client Component que assine `postgres_changes` e esqueça o `setAuth()` vai "funcionar" nos testes de lib (mock não pega) e falhar silenciosamente em produção do mesmo jeito que aconteceu aqui — sem erro visível, só ausência de comportamento. Mitigação: este registro + comentário no código-fonte (`ConversationMessages.tsx` e `tests/integration/realtime-isolation.test.ts`) explicando o porquê; revisão de código deve checar esse padrão especificamente em qualquer PR que adicione `channel().subscribe()` num Client Component novo.

Owner

Engineering (achado durante implementação, revisão exigiu prova empírica antes de aceitar como resolvido)

Related ADR

None

Related Issue

Roadmap item 0.8 (`53_ROADMAP.md`) — Inbox em tempo real

Related Runbook

None

Review Date

Quando a versão de `@supabase/supabase-js` for atualizada — revalidar se o wiring automático mudou antes de remover o `setAuth()` explícito

Status

Active

---

# DECISION QUALITY RULES

Every decision should answer:

What changed?

Why?

Why now?

What alternatives existed?

What are the consequences?

Who approved it?

If these questions are unanswered,

the decision is incomplete.

---

# SUPERSEDED DECISIONS

When replacing a decision:

Never delete the original.

Mark it as Superseded.

Reference the replacement.

Preserve historical context.

---

# REVIEW POLICY

Operational decisions

Review every 6 months.

Strategic decisions

Review annually.

Temporary workarounds

Review within 30 days.

Expired decisions should either be removed through replacement or archived.

---

# COMMON ANTI-PATTERNS

❌ Decisions only inside chat conversations.

❌ "Everyone knows why."

❌ Decisions only inside Git commits.

❌ Verbal agreements.

❌ Missing ownership.

❌ Missing rationale.

❌ Deleting old decisions.

---

# SEARCH GUIDELINES

Decision IDs follow:

DL-0001

DL-0002

DL-0003

...

Use sequential numbering.

Titles should be short and descriptive.

Search should always be easy.

---

# AI GUIDANCE

Before making assumptions:

Read this document.

Search for previous decisions.

Avoid reversing historical choices without justification.

If a previous decision is no longer valid,

create a new entry instead of silently changing direction.

Engineering consistency is more valuable than short-term convenience.

---

# MAINTENANCE

Update immediately after important decisions.

Never postpone documentation.

The longer you wait,

the less accurate the reasoning becomes.

---

# RELATED DOCUMENTS

22_ARCHITECTURE_DECISION_RECORDS.md

24_KNOWLEDGE_MANAGEMENT.md

25_PROJECT_EVOLUTION.md

27_PROJECT_STATUS.md

28_BACKLOG.md

30_KNOWN_ISSUES.md

---

# FINAL PRINCIPLE

Software changes every day.

The reasons behind those changes should never be lost.

Future engineers should understand not only what was decided,

but why it was decided.

---

End of DECISIONS LOG.