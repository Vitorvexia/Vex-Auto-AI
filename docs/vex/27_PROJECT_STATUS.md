27_PROJECT_STATUS.md
# THE VEX OPERATING SYSTEM

# PROJECT STATUS

Version: 1.0

Status: Living Document

Owner: Engineering

Last Updated: 2026-07-27

---

> "Before changing the system, understand the current system."

---

# PURPOSE

This document represents the current operational state of VEX.

Unlike architecture documents,

this file changes frequently.

Every engineer.

Every AI.

Every contributor.

Must read this document before starting any task.

It answers one question:

"What is the current state of the project?"

---

# PROJECT SNAPSHOT

Project Name

VEX AUTO

Current Phase

MVP Validation

Current Version

0.0.2.0 (package.json)

Overall Status

🟡 In Validation

Production Status

Internal Validation

Development Status

Active

---

# CURRENT OBJECTIVES

Primary Goal

Validate the MVP in production.

Current Focus

Reliability.

Bug fixing.

Operational validation.

Infrastructure stabilization.

NOT feature expansion.

Until MVP validation is complete,

new features should only be implemented when explicitly approved.

---

# CURRENT PRIORITIES

Priority 1

Fix blocking bugs.

Priority 2

Validate production environment.

Priority 3

Complete operational testing.

Priority 4

Improve observability.

Priority 5

Only then begin new feature development.

Exception rule

Any conscious exception to this priority order (e.g. shipping a new feature before validation is complete) requires an entry in `29_DECISIONS_LOG.md` in the same PR/commit that implements the exception — not after. No entry means the change should not have been merged.

Phase sequencing source

`docs/vex/53_ROADMAP.md` is the source of truth for phase priority (Fase 0–3, dependencies, effort) once MVP validation above is complete. This document (`27_PROJECT_STATUS.md`) still decides what can be touched *today* — in case of conflict between the two, this document wins (same hierarchy as `CLAUDE.md`, see DL-0002 in `29_DECISIONS_LOG.md`).

---

# MVP STATUS

Core Authentication

Status

✅ Stable

---

Multi-tenant

Status

✅ Stable

---

Lead Management

Status

✅ Stable

---

Kanban Pipeline

Status

✅ Stable

---

WhatsApp Integration

Status

🟡 Waiting Production Validation

Não é mais "sandbox / aguardando número real" — isso foi resolvido (B001, ver `ACTIVE BLOCKERS`). É "número real ativo em produção desde 27/07, acumulando validação": a janela inicial de ~4h com mensagens reais e `agent_status: ok` (27/07, 18:31–22:44) é começo da validação, não conclusão. Não inflar pra ✅ até rodar mais tempo.

---

AI Pipeline

Status

🟡 Waiting Production Validation

---

Follow-up Automation

Status

🟡 Waiting Production Validation

---

Lead Reactivation

Status

🟡 Waiting Production Validation

---

Analytics

Status

🟡 Functional

ROI metrics pending.

---

Deployment

Status

🟡 Production validation pending.

---

# ACTIVE BLOCKERS

Critical blockers should always remain here. Source: CLAUDE.md (2026-07-20 audit), all operational/config — no code work pending.

B001 — RESOLVIDO (evidência de 27/07/2026, documentado 28/07)

O envio de WhatsApp resolve o número por LOJA: `lib/whatsapp-credentials.ts` usa `stores.whatsapp_phone_number_id ?? env WHATSAPP_PHONE_NUMBER_ID (fallback) ?? null`. Todos os call sites de envio passam por `getStoreWhatsAppPhoneId(storeId)` — nenhum lê a env var direto. A Speed Motos tem `stores.whatsapp_phone_number_id = 1238597592667311` (número dedicado real, WABA `28099462022990346`, +55 32 98366-528). Ou seja: pra essa loja o banco resolve o número real independente do valor da env var — a env global virou irrelevante pra Speed Motos (só importaria se o campo da loja fosse nulo). Isso é a arquitetura per-tenant do DL-0002 funcionando como projetada.

Evidência:
- Causa (direta): `stores.whatsapp_phone_number_id` da Speed Motos = número real, confirmado por query. É o campo que o código lê em runtime.
- Efeito (direto): mensagens de entrada reais com WAMID em 27/07 entre 18:31 e 22:44, pipeline processando, envios de volta com `agent_status: ok`. 2 `parse_error` (LLM) e alguns `skipped_handoff` (handoff ativo, esperado).

Ressalva de evidência: não há prova ao nível do payload de qual `phone_number_id` recebeu os eventos, porque o webhook nunca captura `metadata.phone_number_id` (só `display_phone_number`, usado pra achar a loja por `stores.whatsapp_numero`). Esse dado nunca foi persistido — ausência real na base (ver `BL-0012`, `28_BACKLOG.md`). Mas como a resolução do número é por `stores.*` e não pelo payload, o payload é irrelevante pra conclusão: a cadeia código→banco→envios-ok está comprovada onde importa.

Consequência: aviso de IA (0.7 parte 2) ATIVO em produção. 0.2 (templates) a um passo — falta aprovação Meta dos 9 templates + ligar `WHATSAPP_TEMPLATE_SEND_ENABLED`.

Owner

Business Owner

Status

Resolved (evidência 2026-07-27, documentado 2026-07-28)

---

B002

~~Permanent WhatsApp Token pending.~~ RESOLVED (2026-07-23) — System User `vex-auto-api` created with full access to app + WABA, permanent (never-expires) token generated and in use.

Owner

Business Owner

Status

Resolved (2026-07-23)

---

B003

~~`CRON_SECRET` not configured on Vercel.~~ RESOLVED — verified 2026-07-21: `vercel env ls production` shows `CRON_SECRET` set (Preview + Production, since ~40 days prior). Code (`route.ts:47-52`) only falls back to the insecure any-Bearer path when the var is absent — not the case in production.

Owner

Engineering

Status

Resolved (2026-07-21)

---

B004

~~Migration 020 not yet applied in production.~~ RESOLVED — verified 2026-07-21 via direct read-only query against production Supabase (`leads` table returns `vehicle_id`/`valor_final` columns, no PGRST error).

Owner

Engineering

Status

Resolved (2026-07-21)

---

B005

MVP end-to-end acceptance test (real WhatsApp number → AI pipeline → close with margin guardrail) blocked until B001-B002 clear.

Owner

Engineering

Status

Blocked by B001 (B002 resolved)

---

B006

`lib/follow-up.ts` and `lib/reactivation.ts` send free-form text via `sendWhatsAppMessage`, not approved WhatsApp templates. Business-initiated messages (follow-up, reactivation) outside the 24h customer-service window require pre-approved templates with `{{1}}`-style placeholders — free text will be rejected by Meta in production once real business-initiated sends are attempted. Discovered 2026-07-23 while creating the first template (`follow_up`, Marketing category) for B001. Only 1 of ~9 needed templates (3 follow-up + 6 reactivation with/without vehicle) exists so far, and it's still in review.

Owner

Engineering

Status

Open — NOT resolved. Send path implemented (2026-07-27): `sendWhatsAppTemplateMessage` in `lib/whatsapp-send.ts`, wired into `follow-up.ts`/`reactivation.ts` behind `WHATSAPP_TEMPLATE_SEND_ENABLED` (default `false`/off — current free-text behavior unchanged). Covered by mocked unit tests only (`tests/unit/follow-up-template-send.test.ts`, `tests/unit/reactivation-template-send.test.ts`, `tests/unit/whatsapp-send.test.ts`) — **no real send has been attempted or confirmed**. This is implementation, not delivery.

Still blocked on: all 9 templates (`follow_up_1/2/3`, `reactivation_vehicle_1/2/3`, `reactivation_no_vehicle_1/2/3`) submitted to Meta for approval, pending. B006 does not close until: templates approved in Meta + `WHATSAPP_TEMPLATE_SEND_ENABLED=true` + a real business-initiated send (outside the 24h session window) confirmed arriving on a real device.

---

# RECENT COMPLETED WORK

Most recent accomplishments (source: git log, most recent first).

✅ Roadmap 0.7 — Política de Privacidade + aviso de IA — CONCLUÍDO (`795e7fc`, `be2aae3`, `5bf4196`, 2026-07-28). Parte 1: página `/privacidade` reescrita com conteúdo real (loja = controladora LGPD, VEX Auto = operador — DL-0006), no ar, sem exigir login, canal de titular = WhatsApp do atendimento (genérico, sem e-mail fictício nem número hardcoded — `5bf4196`). Parte 2: aviso de IA determinístico por código na 1ª mensagem de toda conversa nova (`lib/ai-pipeline.ts`, gatilho `is_new_conversation` do RPC `webhook_ingest_message`), `autor="sistema"`, idempotência via `messages.meta->>kind`, rastro `meta.sent` reflete se o envio WA teve sucesso — ATIVO em produção (B001 resolvido, ver `ACTIVE BLOCKERS`). 672 testes unitários cobrindo ambos os fluxos. **Pendência remanescente (não-bloqueante):** revisão jurídica profissional do texto (página + aviso) antes de onboardar cliente pagante — dívida consciente, registrada em DL-0006 (mesmo padrão do DL-0003).

✅ Inbox em tempo real (roadmap 0.8, `815e5b1`, 2026-07-27) — `app/components/ConversationMessages.tsx` isola a área de mensagens em Client Component, assina `postgres_changes` filtrado por `conversation_id`, banner de reconexão. Isolamento multi-tenant validado contra Supabase real (`tests/integration/realtime-isolation.test.ts`). Migration 023 (publication `supabase_realtime`). Achado: `realtime.setAuth()` explícito é obrigatório — DL-0004 (`29_DECISIONS_LOG.md`). Investigação de flakiness residual em teste de isolamento fechada sem bug de produto — DL-0005 + `30_KNOWN_ISSUES.md` KI-0004.

✅ Coleta de financiamento/troca + agenda interna — IA coleta dados (nome/CPF/renda/entrada em pergunta única; modelo/ano/km/serviço/agendamento em fluxo incremental) via guardrail determinístico (`lib/guardrails.ts` + `lib/collection.ts`), nunca calcula financiamento nem avalia valor de troca, força handoff por código (não confia na LLM), CPF nunca aparece em `ai_logs` (removido, não só mascarado). Página `/agenda` nova pro vendedor ver agendamentos por dia. Migration 022 (`147f1ef`, 2026-07-24). Spec: `docs/superpowers/specs/2026-07-24-financiamento-troca-collection-design.md`. Fora de escopo (backlog): recebimento de imagem/áudio via WhatsApp, integração Google Agenda.

✅ Public `/privacidade` page for Meta app publish requirement (PR #28, 2026-07-23)

✅ isNaN guards for preco/custo in updateVehicle (4505933)

✅ MVP hardening — sales guardrails, PII masking, inventory fixes, audit repairs (e61a7cf)

✅ Unarchive vehicle action and button (4682fd5)

✅ Real inventory CRUD and AI vehicle context (d4c9a99)

✅ Vercel Cron GET accepted when CRON_SECRET absent (a06035c, PR #24)

✅ Mina de Ouro Core — reactivation template enrichment + result metrics (8b1927e, PR #23)

✅ Equipe (team) page — real data, team-metrics, operational dashboard (4285a93, PR #20)

✅ Assigned To + initial salesperson management (7204bf4, PR #19)

Update this section continuously — do not let it silently rot like it did before this pass.

---

# CURRENT KNOWN RISKS

LLM timeout under heavy load.

Cron execution time.

Meta API availability.

WhatsApp rate limits.

Infrastructure dependency on Supabase.

Every active risk belongs here.

---

# CURRENT TECHNICAL DEBT

Only active debt. Source: CLAUDE.md 2026-07-20 audit.

RBAC absent — any store user can reassign any lead (`assignLeadToUser`/`removeLeadAssignment` only check `store_id`). Blocks reliable commission attribution.

Message query has no limit.

`error_category`/`error_message` missing in `reactivation_logs`/`follow_up_logs` — WhatsApp send failures in cron jobs are silent (observability gap).

Lead assignment has no history — only current `assigned_to` is stored. Needed before commission/ROI auditing.

`calculateOperationalMetrics()` does not use `leads.valor_final` (exists since migration 020) — no revenue, margin-per-sale, or CAC in analytics yet.

Document every intentional debt.

---

# CURRENT ENVIRONMENT

Frontend

Production

Backend

Production

Database

Supabase

Hosting

Vercel

AI Provider

Anthropic

Messaging

WhatsApp Cloud API

Update whenever infrastructure changes.

---

# CURRENT RELEASE

Current Branch

fix/cron-no-secret-fallback (working branch; main is the stable branch)

Current Stable Release

0.0.2.0

Latest Deployment

Unknown — not tracked here. Check Vercel deployment history directly.

Deployment Status

Healthy

Rollback Available

Yes

---

# CURRENT QUALITY METRICS

Automated Tests

CLOSED (2026-07-27): the "603 vs 635" discrepancy seen in earlier sessions was never a bug — it was two different npm scripts covering different scope, both correct for what they measured. Do not reopen this investigation.

- `npm run test` — unit only (`tests/unit/`), what the Husky pre-push hook runs. 38 files / 612 tests passing.
- `npm run test:integration` — hits real Supabase, run deliberately (never in the push hook). 6 files / 35 tests passing.
- `npm run test:all` — both combined. 44 files / 647 tests passing.

Script separation (2026-07-27, item 0.8 review): `test` used to alias `vitest run` (unit+integration combined), which meant every `git push` silently depended on live Supabase reachability. Split so the push-blocking path (`test`) is unit-only, fast, offline, deterministic — integration is opt-in via `test:integration`/`test:all`.

Failing Tests

0 — see counts above

TypeScript

Passing

Lint

Passing

Critical Bugs

0

High Priority Bugs

Update continuously.

---

# CURRENT TEAM FOCUS

Current Sprint Goal

Validate MVP.

Engineering Rule

Do not increase complexity unnecessarily.

Current Philosophy

Stability over speed.

---

# WHAT IS NOT BEING DONE

To avoid scope creep:

No CRM expansion.

No marketplace.

No mobile app.

No unnecessary integrations.

No AI experiments outside roadmap.

No architecture rewrites.

Focus remains validation.

---

# NEXT MILESTONES

1

Production validation complete.

↓

2

Internal pilot.

↓

3

First real dealership.

↓

4

Collect feedback.

↓

5

Iterate.

↓

6

Public launch.

---

# DECISION LOG

Latest important decisions.

YYYY-MM-DD

Decision

Description

Reference

ADR-XXXX

This section is chronological.

Newest first.

---

# RECENT INCIDENTS

None

or

List latest production incidents.

Reference Postmortems.

---

# ENGINEERING NOTES

Temporary information useful during current development.

Should be cleaned periodically.

This section is intentionally mutable.

---

# AI CONTEXT

Any AI starting work should understand:

The MVP is feature-complete.

Current work is validation.

Stability has priority over velocity.

Avoid architectural changes unless explicitly requested.

Respect the Constitution.

Read Known Issues before debugging.

Read Backlog before implementing.

Read AI Memory before making assumptions.

Never start coding without understanding current project status.

---

# EXIT CRITERIA FOR MVP VALIDATION

The MVP is considered validated only when:

□ Production environment configured.

□ WhatsApp production number operational.

□ Token permanent.

□ Migration applied.

□ CRON validated.

□ End-to-end tests completed.

□ No critical bugs.

□ Operational logs healthy.

□ Internal pilot completed.

Only after every checkbox is complete may the project move to the next phase.

---

# RELATED DOCUMENTS

26_INDEX.md

28_BACKLOG.md

29_DECISIONS_LOG.md

30_KNOWN_ISSUES.md

31_RELEASE_NOTES.md

33_ENGINEERING_METRICS.md

34_AI_MEMORY.md

---

End of PROJECT STATUS.