34_AI_MEMORY.md
# THE VEX OPERATING SYSTEM

# AI MEMORY

Version: 1.0

Status: Living Document

Owner: Engineering

Last Updated: 2026-07-20

---

> "The intelligence of an AI is limited by the quality of the memory it can access."

---

# PURPOSE

This document is the long-term operational memory of AI assistants working on VEX.

Unlike technical documentation, AI Memory stores project knowledge that influences engineering decisions but does not naturally belong in ADRs, Runbooks, Specifications or Release Notes.

Its goal is preserving continuity across months and years of development.

---

# PHILOSOPHY

AI should not rediscover the same conclusions repeatedly.

Every important lesson learned should become permanent organizational knowledge.

Memory reduces:

Repeated mistakes.

Repeated discussions.

Repeated investigations.

Repeated experimentation.

Every completed project teaches something.

Capture it.

---

# WHAT BELONGS HERE

Document knowledge that changes how the AI works.

Examples:

Successful engineering patterns.

Failed approaches.

Business preferences.

Architecture preferences.

Prompt improvements.

Customer feedback patterns.

Development conventions.

Operational lessons.

Recurring review comments.

AI-specific observations.

---

# WHAT DOES NOT BELONG HERE

Do not store:

Passwords.

Secrets.

API Keys.

Customer personal data.

Temporary bugs.

Meeting notes.

Git history.

Daily progress.

Private conversations.

Anything already documented elsewhere.

Memory complements documentation.

It does not replace it.

---

# MEMORY ENTRY TEMPLATE

Every memory follows this structure.

Memory ID

Date

Category

Title

Observation

Context

Impact

Confidence

Source

Related Documents

Review Date

Status

---

# MEMORY CATEGORIES

Architecture

Backend

Frontend

Database

AI

Security

Operations

Infrastructure

Product

Business

Testing

Observability

Performance

Developer Experience

Customer Feedback

Engineering Practices

Lessons Learned

Other

---

# CONFIDENCE LEVEL

High

Validated repeatedly.

Medium

Observed multiple times.

Low

Initial observation.

Hypothesis

Requires validation.

Confidence prevents assumptions from becoming facts.

---

# STATUS

Active

Under Review

Superseded

Deprecated

Archived

Knowledge evolves.

Do not delete historical memory.

---

# EXAMPLE MEMORY

Memory ID

MEM-0001

Category

AI

Title

Limit Context to Recent Conversations

Observation

Sending the complete conversation history significantly increases latency and token usage.

Context

Observed during production testing with long WhatsApp conversations.

Impact

Reduced average response time by more than 50%.

Confidence

High

Related Documents

AI Engineering

SRE Guide

Performance

Status

Active

---

# ENGINEERING PREFERENCES

Document recurring engineering preferences.

Examples:

Prefer Server Actions over REST endpoints.

Prefer explicit types.

Prefer simple SQL.

Avoid unnecessary abstractions.

Favor deterministic code.

Favor readability.

Prefer composition over inheritance.

Avoid premature optimization.

These preferences help maintain consistency.

---

# BUSINESS PREFERENCES

Document recurring product decisions.

Examples:

VEX is not a CRM.

Automation before dashboards.

WhatsApp first.

Human override always available.

MVP before expansion.

Operational simplicity over feature quantity.

---

# AI LEARNING

Whenever AI makes an incorrect assumption:

Record:

What happened.

Why it happened.

Correct behavior.

Future prevention.

Mistakes become learning.

---

# SUCCESSFUL PATTERNS

Record engineering patterns that repeatedly succeed.

Examples:

Smaller PRs reduce review time.

Server Actions simplify architecture.

RLS prevents security mistakes.

Prompt modularization improves maintainability.

Background retries increase delivery reliability.

Successful patterns should become standards.

---

# FAILED EXPERIMENTS

Never hide failed ideas.

Document:

Objective.

Approach.

Why it failed.

Lessons learned.

Possible future reconsideration.

Failure is valuable knowledge.

---

# RECURRING CUSTOMER FEEDBACK

Track repeated feedback.

Examples:

Customers request faster financing simulation.

Dealerships value WhatsApp integration.

Lead history is frequently requested.

Users prefer fewer clicks.

Recurring feedback should influence roadmap priorities.

---

# AI BEHAVIOR

Record improvements related to AI itself.

Prompt evolution.

Context strategy.

Reasoning improvements.

Tool usage.

Retry strategy.

Fallback logic.

Safety improvements.

These entries improve future AI performance.

---

# SEARCHABILITY

Memory IDs follow:

MEM-0001

MEM-0002

MEM-0003

...

Entries should be searchable by:

Category

Component

Feature

Date

Confidence

Status

Knowledge should never become difficult to find.

---

# REVIEW POLICY

Every quarter:

Archive obsolete memories.

Increase confidence when validated.

Deprecate invalid assumptions.

Merge duplicate memories.

Promote recurring memories into official standards when appropriate.

---

# COMMON ANTI-PATTERNS

❌ Treating opinions as facts.

❌ Storing secrets.

❌ Recording temporary events.

❌ Duplicating ADR content.

❌ Forgetting confidence level.

❌ Never reviewing old memories.

❌ Using memory instead of documentation.

---

# AI STARTUP CHECKLIST

Before starting work:

Read PROJECT_STATUS.

Read DECISIONS_LOG.

Read AI_MEMORY.

Read BACKLOG.

Read KNOWN_ISSUES.

Then begin implementation.

Memory should influence reasoning before code is written.

---

# RELATED DOCUMENTS

14_AI_ENGINEERING.md

22_ARCHITECTURE_DECISION_RECORDS.md

24_KNOWLEDGE_MANAGEMENT.md

27_PROJECT_STATUS.md

28_BACKLOG.md

29_DECISIONS_LOG.md

30_KNOWN_ISSUES.md

33_ENGINEERING_METRICS.md

---

# FINAL PRINCIPLE

The value of AI is not only its reasoning ability.

Its greatest advantage is the ability to preserve and reuse organizational knowledge indefinitely.

Every lesson learned today should make tomorrow's engineering better.

---

End of AI MEMORY.