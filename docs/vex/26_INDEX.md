26_INDEX.md
# THE VEX OPERATING SYSTEM

# MASTER INDEX

Version: 1.0

Status: Living Document

Owner: Engineering

Last Updated: 2026-07-20

---

> "Everything has a place. Everything has one source of truth."

---

# PURPOSE

This document is the primary entry point for the VEX knowledge base.

Every engineer.

Every AI.

Every contributor.

Every future maintainer.

Must start here.

This file explains where every piece of knowledge belongs.

It is the navigation system of the entire project.

---

# READING ORDER

New contributors should follow this order.

1. Constitution

2. Engineering Principles

3. Architecture

4. Security

5. AI System

6. Operations

7. Current Project Status

Only then should code exploration begin.

---

# DOCUMENT AUTHORITY

The documentation hierarchy is:

Level 1

Constitution

↓

Level 2

Architecture

↓

Level 3

Engineering Standards

↓

Level 4

Operational Standards

↓

Level 5

Runbooks

↓

Level 6

Living Documents

↓

Level 7

Code

If documentation and implementation disagree,

investigate before changing either.

---

# CORE BOOKS

Entry points (read first, outside the numbered sequence):

00_CONSTITUTION.md — highest authority, immutable foundation

PROJECT_BRAIN.md — executive brain, strategic context (PT-BR)

## Foundation (01-10)

01_IDENTITY.md

02_PHILOSOPHY.md

03_FIRST_PRINCIPLES.md

04_DECISION_ENGINE.md

05_COMPANY_VOCABULARY.md

06_ENGINEERING_MINDSET.md

07_PRODUCT_PRINCIPLES.md

08_ARCHITECTURE_PRINCIPLES.md

09_SYSTEM_DESIGN.md

10_CODING_STANDARD.md

---

## Engineering (11-25)

11_BACKEND_GUIDELINES.md

12_DATABASE_STANDARDS.md

13_FRONTEND_GUIDELINES.md

14_AI_ENGINEERING.md

15_TESTING_STANDARD.md

16_OBSERVABILITY.md

17_SECURITY.md

18_DEPLOYMENT.md

19_OPERATIONS.md

20_INCIDENT_RESPONSE.md

21_SRE_GUIDE.md

22_ARCHITECTURE_DECISION_RECORDS.md

23_RUNBOOKS_STANDARD.md

24_KNOWLEDGE_MANAGEMENT.md

25_PROJECT_EVOLUTION.md

---

# LIVING DOCUMENTS (26-36)

These documents evolve continuously.

26_INDEX.md

27_PROJECT_STATUS.md

28_BACKLOG.md

29_DECISIONS_LOG.md

30_KNOWN_ISSUES.md

31_RELEASE_NOTES.md

32_CHANGELOG.md

33_ENGINEERING_METRICS.md

34_AI_MEMORY.md

35_GLOSSARY.md

36_ENGINEERING_PLAYBOOK.md

---

# AI OPERATING SYSTEM (37-46) / AI RUNTIME (47-52)

See AI_NAVIGATION_GUIDE.md for the full list and task-based routing.

> **TOOLING PRECEDENCE (2026-07-20):** This repo's Claude Code agent runs with `superpowers` and `gstack` plugins — enforced, hook-triggered skills that already implement most of chapters 40-46 and parts of 18-21 (planning, TDD, code review, debugging, self-review, changelog automation, deployment, incident monitoring). Where a chapter carries a TOOLING NOTE pointing to an equivalent skill, prefer invoking that skill — it's tool-backed and actually runs; the doc chapter is prose only and enforces nothing by itself. Read the doc chapter for VEX-specific deltas the generic skill can't know, not as a parallel process to run in full alongside the skill.

---

# ADR / RUNBOOK / RFC / RESEARCH / INCIDENT / TEMPLATE DIRECTORIES

Status: NOT YET CREATED.

22_ARCHITECTURE_DECISION_RECORDS.md, 23_RUNBOOKS_STANDARD.md and 24_KNOWLEDGE_MANAGEMENT.md define the *standards* these directories must follow once they exist. No `docs/vex/adr/`, `docs/vex/runbooks/`, `docs/vex/rfc/`, `docs/vex/research/`, `docs/vex/incidents/` or `docs/vex/templates/` directory exists on disk yet.

Do not reference documents inside these directories as if they exist. Create the directory the first time it is actually needed (first ADR, first runbook, etc.) and update this section.

---

# CURRENT PROJECT STATE

The following documents always represent the latest project state.

27_PROJECT_STATUS.md

28_BACKLOG.md

30_KNOWN_ISSUES.md

31_RELEASE_NOTES.md

33_ENGINEERING_METRICS.md

34_AI_MEMORY.md

Read these before starting any task.

---

# AI STARTUP CHECKLIST

Every AI agent joining the project should execute this sequence.

Step 1

Read:

00_CONSTITUTION.md

↓

Step 2

Read:

08_ARCHITECTURE_PRINCIPLES.md and 09_SYSTEM_DESIGN.md

↓

Step 3

Read:

14_AI_ENGINEERING.md

↓

Step 4

Read:

27_PROJECT_STATUS.md

↓

Step 5

Read:

28_BACKLOG.md

↓

Step 6

Read:

30_KNOWN_ISSUES.md

↓

Step 7

Read:

34_AI_MEMORY.md

↓

Step 8

Only now inspect the codebase.

Never skip this sequence.

---

# WHEN TO UPDATE EACH DOCUMENT

Constitution

Almost never.

Architecture

Only when architecture changes.

ADR

Every architectural decision.

Runbook

After operational changes.

Project Status

Whenever the project state changes.

Backlog

Whenever priorities change.

Known Issues

Whenever a new bug is identified.

Release Notes

Every release.

Engineering Metrics

Weekly.

AI Memory

Whenever an important lesson is learned.

Glossary

Whenever a new business concept appears.

---

# QUICK NAVIGATION

I need project vision

→ PROJECT_BRAIN.md, 07_PRODUCT_PRINCIPLES.md

I need architecture

→ 08_ARCHITECTURE_PRINCIPLES.md, 09_SYSTEM_DESIGN.md

I need database rules

→ 12_DATABASE_STANDARDS.md

I need AI behavior

→ 14_AI_ENGINEERING.md

I need deployment

→ 18_DEPLOYMENT.md

I need incident procedures

→ 20_INCIDENT_RESPONSE.md

I need project status

→ 27_PROJECT_STATUS.md

I need roadmap

→ 28_BACKLOG.md

I need known bugs

→ 30_KNOWN_ISSUES.md

I need latest decisions

→ 29_DECISIONS_LOG.md

I need AI memory

→ 34_AI_MEMORY.md

---

# MAINTENANCE RULES

This file must always remain accurate.

Every new document added to the repository must be referenced here.

Broken references must be corrected immediately.

This document is the map of the project.

If the map is wrong,

the entire knowledge system becomes unreliable.

---

# FINAL PRINCIPLE

Documentation should make finding information effortless.

The best documentation is not the largest.

It is the easiest to navigate.

---

End of MASTER INDEX.