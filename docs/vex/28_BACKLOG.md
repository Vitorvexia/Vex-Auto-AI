28_BACKLOG.md
# THE VEX OPERATING SYSTEM

# PRODUCT BACKLOG

Version: 1.0

Status: Living Document

Owner: Product & Engineering

Last Updated: 2026-07-24

---

> "A backlog is not a wish list. It is an investment portfolio."

---

# PURPOSE

This document contains every planned initiative for VEX.

It is the single source of truth for future work.

Every backlog item must represent a validated problem, not simply an idea.

The objective is maximizing customer value while minimizing unnecessary complexity.

---

# BACKLOG PHILOSOPHY

The backlog is ordered by value.

Not by excitement.

Not by novelty.

Not by engineering preference.

Every item competes for limited engineering capacity.

Adding a new item means delaying another.

---

# PRIORITIZATION FRAMEWORK

Every item is evaluated using the following dimensions.

Customer Impact

Revenue Impact

Operational Improvement

Risk Reduction

Engineering Enablement

Strategic Alignment

Engineering Effort

Complexity Introduced

Maintenance Cost

Long-Term Value

Priority is determined by the balance between value and complexity.

---

# STATUS DEFINITIONS

Each backlog item must have one status.

IDEA

Validated problem not yet analyzed.

---

RESEARCH

Currently under investigation.

---

READY

Fully specified.

Ready for implementation.

---

IN PROGRESS

Actively being developed.

---

BLOCKED

Cannot proceed due to dependency.

---

VALIDATION

Implemented.

Waiting for production validation.

---

DONE

Completed and validated.

---

REJECTED

Will never be implemented.

Reason must be documented.

---

# BACKLOG ITEM TEMPLATE

Every item follows this structure.

ID

Title

Problem

Business Value

Customer Value

Priority

Status

Owner

Estimated Complexity

Dependencies

Related ADR

Related RFC

Related Issue

Target Version

Success Metrics

Notes

No field should be omitted.

---

# PRIORITY LEVELS

P0

Critical.

Blocks production.

---

P1

High.

Strong customer value.

---

P2

Important.

Improves product quality.

---

P3

Useful.

Can wait.

---

P4

Future consideration.

---

# CURRENT PRIORITIES

## P0

Validate MVP in production.

Resolve production blockers.

Complete WhatsApp production rollout.

Finish operational validation.

---

## P1

Improve observability.

Improve monitoring.

Improve deployment confidence.

Reduce operational risks.

---

## P2

UX improvements.

Analytics enhancements.

Performance optimizations.

---

## P3

Feature expansion.

Integrations.

Automation improvements.

---

# ACTIVE BACKLOG ITEMS

ID

BL-0001

Title

WhatsApp Embedded Signup (self-serve tenant onboarding)

Problem

Every new store customer currently requires a fully manual Meta setup per tenant: create/verify Business Manager account, create System User, generate permanent token, manually migrate or register phone number. Validated directly during the Speed Motos pilot (2026-07-21) — took multiple days end-to-end (business verification alone: ~2 days), required an engineer walking a non-technical business owner through Meta's dashboards step by step. Does not scale past a handful of manual pilot customers.

Business Value

Removes engineering/founder time from every new customer's onboarding. Unlocks self-serve sales — a customer can go from "bought a plan" to "WhatsApp connected" without a human on the Vex side doing the Meta setup for them.

Customer Value

Store owner clicks "Conectar WhatsApp" inside Vex Auto, completes a Meta popup (login + business + phone confirmation), and is done — no Business Manager, System User, or token concepts exposed to them.

Priority

P3 (Fase 4 — Escala). Not blocking current single-tenant pilot; becomes blocking before onboarding a 2nd paying customer without manual engineering support.

Status

IDEA — on hold, blocked on founder opening MEI/CNPJ for Vex (not doing now, 2026-07-21)

Owner

Engineering

Estimated Complexity

Medium-High — requires registering Vex as a Meta Tech Provider/Business Partner, implementing Embedded Signup (Facebook Login for Business) flow, and handling the resulting WABA/phone_number_id/token via API instead of manual Business Manager entry. `stores.whatsapp_phone_number_id` (migration 017) already supports per-store phone IDs — this is the acquisition flow, not the storage model.

Dependencies

Meta Tech Provider approval. Existing multi-tenant WhatsApp-per-store architecture (already in place, migration 017). Requires Vex's own CNPJ or MEI to complete Vex's own Meta Business Verification (separate from Speed Motos' account) before Tech Provider application can even start — founder decided 2026-07-21 not to open a MEI yet, so this whole item is on hold until that changes.

Related ADR

None yet

Related RFC

None yet

Related Issue

None yet

Target Version

Fase 4 (Escala)

Success Metrics

Time from "plan purchased" to "WhatsApp connected" — target: minutes, not days. Zero engineering hours per new tenant's WhatsApp setup.

Notes

Surfaced during Speed Motos manual onboarding (2026-07-21) when the founder asked whether every future customer would need to manually create a Meta Business account — they should not. Standard pattern used by other WhatsApp-integrated SaaS CRMs (e.g., Zenvia, Take Blip). See also the broader self-serve onboarding experience being scoped in the same session (purchase → auto-provisioned login → first-run setup wizard) — Embedded Signup for WhatsApp is one step inside that wizard, not a separate flow.

Interim decision (2026-07-21): while this is on hold, the onboarding wizard's WhatsApp step ships as manual guided entry instead (written instructions inside the wizard + a form field to paste the Phone Number ID + token the customer generates themselves in their own Meta account — same manual process used for Speed Motos, just turned into in-app copy instead of a human walking them through it). Swap this step's content for the real Embedded Signup button once Tech Provider approval lands — no other part of the wizard needs to change.

---

ID

BL-0002

Title

Mascote / personagem visual da Vex Auto

Problem

Vex Auto has no visual brand personality yet — no mascot or character representing the product to end users (store owners, sellers).

Business Value

Brand recognition and differentiation. A mascot can anchor the product's tone across onboarding, empty states, error messages, and marketing — makes the product feel less like a generic dashboard.

Customer Value

Warmer, more memorable first impression — especially relevant for the onboarding wizard (BL discussed 2026-07-21) where a mascot could narrate the guided tour/spotlight steps.

Priority

P4 (future consideration) — brand/design work, not blocking any current engineering item.

Status

IDEA

Owner

Product (founder)

Estimated Complexity

Unknown — depends on whether it's illustrated, animated, AI-generated, or commissioned. Not scoped yet.

Dependencies

None technical. Could plug into the onboarding wizard's tour (Phase 2, spotlight/tooltips) once both exist.

Related ADR

None

Related RFC

None

Related Issue

None

Target Version

Unscheduled

Success Metrics

Not yet defined — would need to be tied to a qualitative goal (brand recall, onboarding completion rate, etc.) once scoped.

Notes

Requested by founder 2026-07-21 during the onboarding wizard brainstorm session, as a "someday" item — explicitly not to be worked on now, just not to be forgotten.

---

ID

BL-0003

Title

Recebimento de imagem via WhatsApp (fotos de moto na troca)

Problem

Webhook (`app/api/whatsapp/webhook/route.ts`) só processa `msg.type === "text"` — mensagens de imagem são descartadas sem download nem persistência. Surgiu durante o brainstorm da coleta de financiamento/troca (2026-07-24): o dono do produto queria que a IA recebesse fotos da moto de troca, mas isso foi conscientemente decomposto pra fora do escopo daquele spec por ser infraestrutura nova (download de mídia via Graph API, storage, link ao lead) sem overlap com o fluxo de coleta em texto.

Business Value

Vendedor avalia moto de troca com mais informação antes do lead chegar na loja — reduz visita perdida por moto fora do padrão esperado.

Customer Value

Lead manda foto direto no WhatsApp em vez de esperar até ir pessoalmente até a loja.

Priority

P3 — depende do fluxo de coleta de troca (já implementado, `147f1ef`) estar em produção primeiro.

Status

IDEA — spec própria ainda não escrita

Owner

Engineering

Estimated Complexity

Medium-High — tratar `type=image` no webhook, baixar mídia via Meta Graph API (media id → URL → download autenticado), persistir em Supabase Storage, linkar ao `lead_id`/`conversation_id`.

Dependencies

Fluxo de coleta de troca em texto (`lib/collection.ts`, `lib/guardrails.ts`) já implementado e em produção — este item estende o mesmo fluxo, não substitui.

Related ADR

None yet

Related RFC

None yet

Related Issue

None yet

Target Version

Fase 4 (Escala)

Success Metrics

Não definido ainda — depende de decisão sobre onde/como a foto é exibida pro vendedor (dossiê do lead? `/agenda`?).

Notes

Ver `docs/superpowers/specs/2026-07-24-financiamento-troca-collection-design.md`, seção "Explicitly Out of Scope".

---

ID

BL-0004

Title

Recebimento e transcrição de áudio via WhatsApp

Problem

Webhook não trata `type=audio` — mensagens de voz são descartadas. Alguns leads preferem mandar áudio em vez de texto; hoje a IA simplesmente ignora essas mensagens.

Business Value

Reduz atrito no atendimento — lead não precisa reescrever o que já falou em áudio.

Customer Value

Lead manda áudio normalmente e a IA entende, com fallback pedindo texto ou novo áudio se não conseguir transcrever.

Priority

P3 — mesma dependência de infraestrutura de mídia do BL-0003, mas exige também um serviço externo de speech-to-text (não decidido ainda: Whisper API, outro provedor).

Status

IDEA — spec própria ainda não escrita

Owner

Engineering

Estimated Complexity

Medium-High — tratar `type=audio` no webhook, baixar mídia, chamar serviço de transcrição externo, tratar falha de transcrição (pedir novo áudio ou texto ao lead).

Dependencies

Infraestrutura de recebimento de mídia (compartilhada com BL-0003 — mesmo ponto de entrada no webhook). Escolha de provedor de speech-to-text ainda em aberto.

Related ADR

None yet

Related RFC

None yet

Related Issue

None yet

Target Version

Fase 4 (Escala)

Success Metrics

Taxa de transcrição bem-sucedida na primeira tentativa; não definido formalmente ainda.

Notes

Requisito explícito do dono do produto durante o brainstorm de 2026-07-24 ("quero que a IA identifique o áudio"), decomposto pra spec futura junto com BL-0003 por ser infraestrutura nova e não ter overlap com a coleta em texto.

---

ID

BL-0005

Title

Integração com Google Agenda pro `/agenda`

Problem

A página `/agenda` (implementada em `147f1ef`) hoje é uma lista interna simples filtrada por dia — sem sincronização com nenhum app de calendário externo. O dono do produto considerou integrar com Google Agenda durante o brainstorm, mas isso foi conscientemente adiado por exigir OAuth por loja, armazenamento de credencial e chamadas à Google Calendar API — projeto à parte do fluxo de coleta de dados.

Business Value

Vendedor vê agendamentos de troca dentro do app de calendário que já usa no dia a dia (celular, notificações nativas), sem precisar abrir o Vex Auto pra conferir.

Customer Value

Menos fricção operacional — não depende de lembrar de checar `/agenda` manualmente.

Priority

P4 — API do Google Calendar é gratuita pro volume esperado e não é tecnicamente difícil, mas não é urgente com a página interna já cobrindo a necessidade imediata.

Status

IDEA — spec própria ainda não escrita

Owner

Engineering

Estimated Complexity

Medium — cada loja precisa autorizar acesso (fluxo OAuth tipo "permitir"), armazenar token com segurança, criar/atualizar eventos via API, tratar revogação de acesso.

Dependencies

Página `/agenda` interna já implementada e em produção (`147f1ef`) — este item substitui/complementa a visualização, não é pré-requisito de nada.

Related ADR

None yet

Related RFC

None yet

Related Issue

None yet

Target Version

Fase 5 (Monetização) ou posterior

Success Metrics

Não definido ainda.

Notes

Ver `docs/superpowers/specs/2026-07-24-financiamento-troca-collection-design.md`, seção "Explicitly Out of Scope".

---

ID

BL-0006

Title

`stores.whatsapp_waba_id` column (WABA ID per store)

Problem

WABA ID (WhatsApp Business Account ID) is not persisted anywhere in the codebase — confirmed via full-repo grep (2026-07-27), zero references. Meta's Graph API requires the WABA ID (not the phone_number_id) for template-management operations (`message_templates` endpoint), which the project does not implement yet but will need for structured outbound (follow-up/reactivation templates, HSM). Speed Motos' real WABA ID (`28099462022990346`) was obtained 2026-07-27 during Cloud API rollout and currently has nowhere to live.

Business Value

Unblocks future template-based sending (required for WhatsApp-initiated conversations outside the 24h session window — follow-up and reactivation depend on this at scale).

Customer Value

None directly yet — infrastructure prerequisite, not user-facing.

Priority

P3 — not blocking current send/receive flow, which only needs `phone_number_id`. Becomes relevant when template sending is implemented.

Status

IDEA — recommended, not implemented. Raised during Speed Motos Cloud API cutover (2026-07-27).

Owner

Engineering

Estimated Complexity

Low — single nullable `TEXT` column, same pattern as `whatsapp_phone_number_id` (migration 017: `ALTER TABLE stores ADD COLUMN IF NOT EXISTS ... TEXT`, no FK, no encryption — public Meta ID, not a token). Would need a companion getter in `lib/whatsapp-credentials.ts` (e.g. `getStoreWabaId`) when actually consumed.

Dependencies

None to add the column. Actual consumption depends on template-sending work, not yet scoped.

Related ADR

None yet

Related RFC

None yet

Related Issue

None yet

Target Version

Fase 4 (Escala)

Success Metrics

Not yet defined — would tie to template message delivery/approval rate once template-sending work is scoped.

Notes

Raised during Speed Motos Cloud API cutover (2026-07-27) while wiring `whatsapp_phone_number_id`/`whatsapp_numero` for the real number. WABA ID (`28099462022990346`) has no home in the schema yet — this item is the fix. Not urgent: current send/receive path only needs `phone_number_id`.

---

# FEATURE ACCEPTANCE RULES

Before implementation every feature must answer:

Which customer problem does it solve?

How often does that problem occur?

Why now?

Can it be solved more simply?

What is the operational cost?

What is the maintenance cost?

Can it be tested?

Can it be rolled back?

If these questions cannot be answered,

the feature should remain in the backlog.

---

# DEFINITION OF READY

A feature is READY only if:

Problem validated.

Requirements documented.

Architecture approved.

Dependencies known.

Tests planned.

Rollback possible.

Documentation planned.

Monitoring considered.

Ready means engineering can start immediately.

---

# DEFINITION OF DONE

A feature is DONE only if:

Implementation completed.

Tests passing.

Code reviewed.

Documentation updated.

Deployment completed.

Production validated.

Monitoring active.

Knowledge preserved.

Done means valuable to customers.

Not merely merged.

---

# BACKLOG RULES

Never implement directly from ideas.

Research before implementation.

Document before coding.

Measure after deployment.

Archive rejected ideas.

Avoid duplicate backlog items.

Small backlog.

High quality.

---

# REJECTED IDEAS

Rejected ideas remain documented.

Each rejection records:

Reason.

Date.

Decision owner.

Related ADR.

Rejected ideas prevent repeated discussions.

---

# ROADMAP ALIGNMENT

Every backlog item must support at least one roadmap objective.

If not,

it should not exist.

---

# MONTHLY REVIEW

Once every month:

Remove obsolete items.

Merge duplicates.

Review priorities.

Archive completed work.

Review rejected ideas.

The backlog is continuously curated.

---

# ENGINEERING PRINCIPLE

Engineering time is the most valuable resource in the company.

Protect it by prioritizing relentlessly.

---

# AI GUIDANCE

Before implementing any feature:

Read this backlog.

Confirm priority.

Check dependencies.

Search for existing ADRs.

Search for Known Issues.

Never implement work that is not represented here unless explicitly instructed.

---

# RELATED DOCUMENTS

26_INDEX.md

27_PROJECT_STATUS.md

29_DECISIONS_LOG.md

30_KNOWN_ISSUES.md

22_ARCHITECTURE_DECISION_RECORDS.md

25_PROJECT_EVOLUTION.md

---

End of PRODUCT BACKLOG.