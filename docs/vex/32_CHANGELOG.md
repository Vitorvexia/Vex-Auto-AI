32_CHANGELOG.md
# THE VEX OPERATING SYSTEM

# CHANGE LOG

Version: 1.0

Status: Living Document

Owner: Engineering

Last Updated: 2026-07-20

---

> "History is one of the most valuable debugging tools."

---

> **CANONICAL SOURCE:** `/CHANGELOG.md` (repo root, Keep a Changelog format) is the canonical changelog, updated by `gstack:ship` on every release. This file is a supplementary engineering-detail log — do not treat entries here as authoritative if they conflict with root CHANGELOG.md.

---

# PURPOSE

This document records the complete technical evolution of VEX.

Unlike Release Notes,

this document is intended primarily for engineers and AI agents.

Every meaningful change should be traceable.

Nothing important should disappear into Git history.

---

# PHILOSOPHY

Git records what changed.

The Change Log records why the change matters.

A commit is a technical action.

A Change Log entry is engineering knowledge.

---

# CHANGE TYPES

Every entry belongs to one or more categories.

Architecture

Backend

Frontend

Database

Infrastructure

Security

AI

Performance

Observability

Operations

Testing

Documentation

Business Rules

Dependencies

Configuration

Other

---

# CHANGE TEMPLATE

Every entry follows this structure.

Date

Version

Branch

Commit

Author

Category

Summary

Technical Description

Reason

Affected Components

Database Changes

Configuration Changes

Migration Required

Rollback Available

Related ADR

Related Issue

Related Release

Related Runbook

Validation

Status

Consistency is mandatory.

---

# CHANGE STATUS

Planned

Implemented

Validated

Rolled Back

Deprecated

Archived

Never remove historical entries.

---

# CHANGE SEVERITY

Low

Medium

High

Critical

Severity reflects engineering impact,

not customer visibility.

---

# DATABASE CHANGES

Every database modification must record:

Migration ID

Tables affected

Columns added

Columns removed

Indexes

Constraints

RLS changes

Rollback availability

Database history should always be reconstructable.

---

# INFRASTRUCTURE CHANGES

Document changes involving:

Vercel

Supabase

Anthropic

Meta

Storage

Authentication

Secrets

Cron Jobs

Networking

Infrastructure evolution must be visible.

---

# AI CHANGES

Every AI modification should include:

Prompt version

Model version

Guardrail changes

Context builder changes

Retry policy

Timeout changes

Evaluation impact

Regression risk

AI behavior changes deserve dedicated history.

---

# PERFORMANCE CHANGES

Record measurable improvements.

Examples:

Latency reduced.

Memory reduced.

Token usage reduced.

API calls reduced.

Database queries optimized.

Engineering improvements should be measurable.

---

# CONFIGURATION CHANGES

Track modifications to:

Environment Variables

Feature Flags

Limits

Thresholds

Business Hours

Retry Policies

Configuration changes often explain production behavior.

---

# DEPENDENCY UPDATES

Record:

Package

Old Version

New Version

Reason

Breaking Changes

Security Impact

Validation

Dependency history matters.

---

# VALIDATION

Every significant change should specify:

Tests executed.

Manual validation.

Production validation.

Observed metrics.

Success criteria.

---

# RECENT ENTRIES (real, from git log)

Date

2026-07-20 (commit date per git log)

Commit

4505933

Category

Backend, Data Integrity

Summary

Added isNaN guards for preco/custo in updateVehicle.

Affected Components

vehicle update action

Status

Implemented.

---

Commit

e61a7cf

Category

Backend, Security

Summary

MVP hardening — sales guardrails, PII masking, inventory fixes, audit repairs.

Status

Implemented.

---

Commit

4682fd5

Category

Frontend, Backend

Summary

Added unarchive vehicle action and button (estoque).

Status

Implemented.

---

Commit

d4c9a99

Category

Backend, AI

Summary

Implemented real inventory CRUD and AI vehicle context.

Status

Implemented.

---

Commit

a06035c (PR #24)

Category

Infrastructure, Security

Summary

Vercel Cron GET requests now accepted when CRON_SECRET is absent.

Status

Implemented.

---

Note: entries above were backfilled from `git log` in this pass because this document had never been populated. Future entries should be added at commit/PR time, not reconstructed later — reconstruction loses the "Reason"/"Validation" detail that only the author has.

---

# EXAMPLE ENTRY (template illustration — not a real change)

Date

2026-06-24

Version

0.8.1

Branch

fix/follow-up-order

Category

Backend

Summary

Changed follow-up persistence order.

Reason

Guarantee message persistence before WhatsApp delivery.

Affected Components

follow-up.ts

Validation

597 tests passing.

Production validated.

Status

Validated.

---

# COMMON ANTI-PATTERNS

❌ Copying Git commits.

❌ Missing reasons.

❌ No rollback information.

❌ Missing validation.

❌ Unknown configuration changes.

❌ Database modifications without migration reference.

❌ AI changes without prompt version.

---

# SEARCHABILITY

Every entry should be searchable by:

Version

Date

Category

Component

Migration

ADR

Issue

Branch

Author

Knowledge should be discoverable.

---

# MONTHLY REVIEW

Review:

Large changes.

Repeated modifications.

Architecture evolution.

Dependency accumulation.

Configuration drift.

Technical debt growth.

Patterns are more important than isolated changes.

---

# AI GUIDANCE

Before modifying existing code:

Read recent Change Log entries.

Recent technical history explains many implementation decisions.

Never revert historical improvements without understanding them.

Search before changing.

---

# RELATED DOCUMENTS

31_RELEASE_NOTES.md

29_DECISIONS_LOG.md

30_KNOWN_ISSUES.md

22_ARCHITECTURE_DECISION_RECORDS.md

24_KNOWLEDGE_MANAGEMENT.md

33_ENGINEERING_METRICS.md

---

# FINAL PRINCIPLE

Engineering history is an asset.

Protect it.

Future engineers should understand not only what exists,

but how it became what it is.

---

End of CHANGE LOG.