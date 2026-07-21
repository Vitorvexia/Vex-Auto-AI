28_BACKLOG.md
# THE VEX OPERATING SYSTEM

# PRODUCT BACKLOG

Version: 1.0

Status: Living Document

Owner: Product & Engineering

Last Updated: 2026-07-21

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