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