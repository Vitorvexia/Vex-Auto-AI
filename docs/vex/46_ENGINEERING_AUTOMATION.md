46_ENGINEERING_AUTOMATION.md
# THE VEX AI OPERATING SYSTEM

# ENGINEERING AUTOMATION

Version: 1.0

Status: Mandatory

Owner: Engineering Leadership

Execution Time: Every Engineering Task

---

> **TOOLING NOTE (2026-07-20):** `gstack:ship` already automates version bump + root `CHANGELOG.md` update + tests + PR creation. The root `/CHANGELOG.md` is the canonical changelog for this repo — `docs/vex/32_CHANGELOG.md` is a supplementary engineering-detail log, not a second source of truth. Don't hand-maintain both independently; update 32_CHANGELOG.md from what gstack:ship already recorded, not in parallel.

---

> "A process that depends on memory will eventually fail.
A process that depends on automation becomes culture."

---

# PURPOSE

This protocol defines the engineering automations that every AI assistant must execute throughout the software development lifecycle.

The objective is ensuring consistency, preserving knowledge and reducing manual work.

Automation is not about replacing engineering judgment.

It is about guaranteeing that critical processes are never forgotten.

---

# AUTOMATION PHILOSOPHY

Every engineering action produces consequences.

Those consequences should automatically trigger the appropriate engineering processes.

Documentation should never depend on memory.

Quality should never depend on luck.

---

# AUTOMATION LIFECYCLE

Every engineering task follows this automation flow.

Task Starts

↓

Context Built

↓

Implementation

↓

Validation

↓

Documentation

↓

Deployment

↓

Observation

↓

Knowledge Preservation

---

# AUTOMATION PRINCIPLES

Automations must be:

Predictable

Deterministic

Transparent

Observable

Reversible

Idempotent

Minimal

Safe

Automation should simplify engineering,

not hide it.

---

# EVENT-DRIVEN ENGINEERING

Engineering events trigger engineering actions.

---

## EVENT

Task Started

Automatically execute:

Read PROJECT_STATUS

Read BACKLOG

Read AI_MEMORY

Read DECISIONS_LOG

Build execution context

Identify risks

Create execution plan

---

## EVENT

Architecture Changed

Automatically:

Suggest ADR update

Review affected modules

Review documentation

Evaluate migrations

Evaluate deployment impact

---

## EVENT

Database Changed

Automatically:

Review migration

Review indexes

Review RLS

Review rollback

Review performance

Update CHANGELOG

Evaluate RELEASE_NOTES

---

## EVENT

Security Logic Changed

Automatically:

Review authentication

Review authorization

Review tenant isolation

Review secrets

Review audit logs

Review observability

---

## EVENT

Business Rules Changed

Automatically:

Review documentation

Review tests

Review AI prompts

Review workflows

Review customer impact

Update PROJECT_STATUS

---

## EVENT

Bug Fixed

Automatically:

Review KNOWN_ISSUES

Determine root cause

Evaluate regression tests

Update CHANGELOG

Evaluate AI_MEMORY

Update RUNBOOK if recurring

---

## EVENT

Feature Implemented

Automatically:

Evaluate documentation updates

Review deployment impact

Review observability

Review testing

Review release notes

Review architecture consistency

---

## EVENT

Deployment Completed

Automatically:

Verify health

Verify logs

Verify metrics

Verify alerts

Monitor production

Prepare rollback if necessary

---

## EVENT

Incident Closed

Automatically:

Perform retrospective

Update RUNBOOK

Update KNOWN_ISSUES

Update AI_MEMORY

Evaluate process improvements

---

# DOCUMENT AUTOMATION MATRIX

Whenever specific events occur, evaluate updates.

| Event | Documents |
|--------|-----------|
| New Feature | CHANGELOG, RELEASE_NOTES, PROJECT_STATUS |
| Bug Fix | KNOWN_ISSUES, CHANGELOG |
| Architecture Decision | ADR, PROJECT_STATUS |
| New Engineering Pattern | AI_MEMORY |
| New Operational Procedure | RUNBOOK |
| Priority Change | BACKLOG |
| Deployment | RELEASE_NOTES |
| Incident | RUNBOOK, KNOWN_ISSUES |

Documentation should evolve together with the software.

---

# ENGINEERING CHECKPOINTS

Mandatory checkpoints:

Planning

↓

Implementation

↓

Code Review

↓

Testing

↓

Deployment

↓

Post Deployment

↓

Knowledge Preservation

Every checkpoint has validation responsibilities.

---

# AUTOMATIC QUALITY GATES

Before considering work complete verify:

Requirements satisfied

↓

Architecture respected

↓

Security reviewed

↓

Testing completed

↓

Observability verified

↓

Rollback possible

↓

Documentation updated

↓

Knowledge preserved

↓

Confidence acceptable

No gate should be skipped.

---

# KNOWLEDGE AUTOMATION

After every significant task ask:

Should AI_MEMORY change?

Should an ADR be created?

Should KNOWN_ISSUES grow?

Should CHANGELOG change?

Should PROJECT_STATUS evolve?

Should RELEASE_NOTES include this?

Knowledge should accumulate automatically.

---

# AI WORKFLOW

Every AI session should internally execute:

Startup Protocol

↓

Context Builder

↓

Reasoning Standard

↓

Task Execution

↓

Implementation

↓

Code Review

↓

Debugging (if necessary)

↓

Self Review

↓

Session Memory

↓

Engineering Automation

This is the official VEX execution pipeline.

---

# FAILURE CONDITIONS

Automation fails when:

Documentation becomes outdated

Knowledge is lost

Architecture drifts

Testing is skipped

Security review omitted

Rollback impossible

Production becomes unpredictable

Failures in automation create engineering debt.

---

# ENGINEERING METRICS

Track:

Documentation freshness

Review completion

Testing coverage

Deployment success

Incident recurrence

Knowledge growth

Automation compliance

Quality should be measurable.

---

# AI RESPONSIBILITIES

The AI must:

Trigger appropriate engineering processes

Recommend documentation updates

Protect engineering consistency

Prevent forgotten work

Explain automated actions

Maintain long-term project quality

Automation complements reasoning.

Never replaces it.

---

# RELATED PROTOCOLS

34_AI_MEMORY.md

37_AI_STARTUP_PROTOCOL.md

38_CONTEXT_BUILDER.md

39_TASK_EXECUTION_PROTOCOL.md

40_REASONING_STANDARD.md

41_IMPLEMENTATION_STANDARD.md

42_CODE_REVIEW_STANDARD.md

43_DEBUGGING_STANDARD.md

44_AI_SELF_REVIEW.md

45_SESSION_MEMORY.md

---

# FINAL PRINCIPLE

Engineering excellence is achieved when quality no longer depends on remembering what to do.

It becomes the natural consequence of following a well-designed system.

---

End of ENGINEERING AUTOMATION.