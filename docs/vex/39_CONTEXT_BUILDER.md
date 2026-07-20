39_TASK_EXECUTION_PROTOCOL.md
# THE VEX AI OPERATING SYSTEM

# TASK EXECUTION PROTOCOL

Version: 1.0

Status: Mandatory

Owner: Engineering Leadership

Execution Time: Every Engineering Task

---

> "Excellent engineering is not a result of talent.
It is the result of executing the correct process consistently."

---

# PURPOSE

This protocol defines the mandatory lifecycle for every engineering task performed within VEX.

Regardless of task size, every implementation follows the same execution framework.

The objective is consistency, predictability and engineering quality.

---

# EXECUTION LIFECYCLE

Every task follows ten stages.

Understand

↓

Build Context

↓

Analyze

↓

Plan

↓

Implement

↓

Validate

↓

Review

↓

Document

↓

Deploy

↓

Observe

Skipping stages is prohibited.

---

# STAGE 1 — UNDERSTAND

Understand exactly what is being requested.

Identify:

Objective

Expected result

Business value

Constraints

Unknown information

If the objective is unclear,

clarify before proceeding.

Never implement assumptions.

---

# STAGE 2 — BUILD CONTEXT

Execute:

AI_STARTUP_PROTOCOL

↓

CONTEXT_BUILDER

Collect:

Architecture

Documentation

History

Known Issues

Dependencies

Metrics

Confidence

Only proceed when context is sufficient.

---

# STAGE 3 — ANALYZE

Determine:

Root problem

Scope

Affected systems

Dependencies

Risks

Complexity

Alternative solutions

Prefer solving the underlying problem,

not its symptoms.

---

# STAGE 4 — PLAN

Before writing code define:

Implementation strategy

Execution order

Files affected

Database changes

Testing strategy

Rollback strategy

Documentation updates

Every implementation begins with a plan.

---

# STAGE 5 — IMPLEMENT

Implementation principles:

Small changes

Atomic commits

Readable code

Explicit types

Structured logging

Simple architecture

Minimal side effects

Never mix unrelated changes.

---

# STAGE 6 — VALIDATE

Validation occurs in layers.

Compile

↓

Lint

↓

Unit Tests

↓

Integration Tests

↓

Manual Validation

↓

Production Validation

Every layer must succeed.

---

# STAGE 7 — REVIEW

Review the implementation.

Check:

Correctness

Security

Performance

Maintainability

Observability

Documentation

Rollback

Testing

Business alignment

Quality is verified,

not assumed.

---

# STAGE 8 — DOCUMENT

Evaluate which documents require updates.

Possible updates:

PROJECT_STATUS

BACKLOG

CHANGELOG

RELEASE_NOTES

KNOWN_ISSUES

AI_MEMORY

ADR

RUNBOOK

ENGINEERING_METRICS

Documentation is part of implementation.

---

# STAGE 9 — DEPLOY

Deployment sequence:

Merge

↓

CI

↓

Tests

↓

Migration

↓

Deployment

↓

Health Check

↓

Monitoring

↓

Validation

↓

Release Notes

Deployment is not finished until monitoring succeeds.

---

# STAGE 10 — OBSERVE

Observe production.

Monitor:

Errors

Latency

WhatsApp Delivery

Cron Jobs

Database

Infrastructure

AI Behavior

Customer feedback

Engineering work continues after deployment.

---

# EXECUTION MODES

Every task belongs to one execution mode.

Quick

Standard

Critical

Research

---

# QUICK MODE

Allowed only for:

Documentation

Typographical fixes

Comments

Formatting

No architectural impact.

---

# STANDARD MODE

Default mode.

Applies to:

Bug fixes

Features

Refactoring

Performance

Testing

Requires complete workflow.

---

# CRITICAL MODE

Mandatory for:

Security

Authentication

Payments

Database

Infrastructure

AI behavior

Multi-tenant logic

Requires:

Peer review

Rollback plan

Monitoring plan

Post-deployment validation

---

# RESEARCH MODE

Used when implementation should not begin.

Activities:

Investigation

Benchmarking

Architecture evaluation

Proof of Concept

Research produces knowledge,

not production code.

---

# DECISION CHECKPOINTS

Before each stage ask:

Do I understand enough?

Can I justify this decision?

Have I consulted existing knowledge?

What evidence supports this?

What could break?

Engineering decisions require evidence.

---

# FAILURE CONDITIONS

Stop execution if:

Requirements conflict

Architecture unclear

Security uncertain

Rollback impossible

Documentation missing

Confidence is low

Escalate uncertainty.

Do not hide it.

---

# QUALITY GATES

A task cannot advance unless:

Stage complete

↓

Evidence collected

↓

Risks acceptable

↓

Validation passed

↓

Documentation updated

Quality gates prevent hidden failures.

---

# TASK COMPLETION CRITERIA

A task is complete only when:

Implementation finished

Tests passing

Documentation updated

Monitoring healthy

Rollback verified

Knowledge preserved

Customer value delivered

Completion is measured by outcome,

not effort.

---

# EXECUTION ANTI-PATTERNS

Never:

Code immediately.

Skip planning.

Ignore documentation.

Fix symptoms only.

Deploy without rollback.

Ignore monitoring.

Leave undocumented decisions.

Treat warnings as success.

---

# AI RESPONSIBILITIES

The AI must:

Build context.

Protect architecture.

Reduce technical debt.

Preserve project knowledge.

Prefer simplicity.

Identify risks.

Document learning.

Think before coding.

Engineering discipline is mandatory.

---

# RELATED PROTOCOLS

37_AI_STARTUP_PROTOCOL.md

38_CONTEXT_BUILDER.md

40_REASONING_STANDARD.md

41_IMPLEMENTATION_STANDARD.md

42_CODE_REVIEW_STANDARD.md

43_DEBUGGING_STANDARD.md

44_AI_SELF_REVIEW.md

45_SESSION_MEMORY.md

46_ENGINEERING_AUTOMATION.md

---

# FINAL PRINCIPLE

The value of an AI is not measured by how quickly it produces code.

It is measured by how consistently it produces correct, maintainable and well-documented engineering outcomes.

---

End of TASK EXECUTION PROTOCOL.