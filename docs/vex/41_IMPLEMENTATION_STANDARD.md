41_IMPLEMENTATION_STANDARD.md
# THE VEX AI OPERATING SYSTEM

# IMPLEMENTATION STANDARD

Version: 1.0

Status: Mandatory

Owner: Engineering Leadership

Execution Time: Every Code Change

---

> **TOOLING NOTE (2026-07-20):** `superpowers:test-driven-development` is the enforced, hook-triggered version of this chapter. Prefer invoking it. Read here only for VEX-specific implementation rules (naming, module boundaries) not covered by the generic skill.

---

> "Every line of code becomes tomorrow's maintenance."

---

# PURPOSE

This standard defines how software must be implemented within VEX.

The objective is producing code that is correct, maintainable, observable and easy to evolve.

Implementation quality is measured over years, not minutes.

---

# IMPLEMENTATION PRINCIPLES

Every implementation should prioritize:

Correctness

↓

Readability

↓

Maintainability

↓

Reliability

↓

Security

↓

Observability

↓

Performance

↓

Development Speed

Never sacrifice higher priorities for lower ones without explicit justification.

---

# GENERAL RULES

Code should be:

Small

Explicit

Deterministic

Predictable

Composable

Testable

Documented when necessary

Avoid surprising behavior.

---

# BEFORE WRITING CODE

Confirm:

Objective understood

Architecture reviewed

Existing implementation analyzed

Relevant documentation consulted

Known Issues checked

Rollback possible

Testing strategy defined

Never write code without understanding the surrounding system.

---

# CODE ORGANIZATION

Functions

Single responsibility.

Prefer small functions.

Avoid deep nesting.

Early returns when appropriate.

---

Modules

One clear purpose.

Strong cohesion.

Low coupling.

---

Files

Avoid oversized files.

Group related functionality.

Separate business logic from infrastructure.

---

# TYPESCRIPT STANDARD

Mandatory:

Strict typing

No implicit any

Explicit return types for public APIs

Meaningful interfaces

Reusable types

Avoid unnecessary type assertions.

Types are documentation.

---

# ERROR HANDLING

Never ignore errors.

Errors should be:

Typed

Logged

Actionable

Contextual

Safe for users

Useful for engineers

Unexpected failures must leave evidence.

---

# LOGGING STANDARD

Logs must answer:

What happened?

Where?

Why?

Which entity?

Correlation ID?

Severity?

Avoid generic logs such as:

"Error"

"Failed"

"Something went wrong"

Every log should accelerate debugging.

---

# DATABASE STANDARD

Every database interaction should:

Use RLS

Avoid unnecessary queries

Prefer indexed access

Handle missing data safely

Avoid N+1 patterns

Document migrations

Protect tenant isolation.

---

# API STANDARD

Endpoints should:

Validate inputs

Return consistent responses

Use appropriate status codes

Handle failures gracefully

Avoid leaking implementation details

Document breaking changes

---

# SERVER ACTIONS

Prefer Server Actions whenever appropriate.

Use API routes only when technically justified.

Keep business rules close to the execution layer.

Avoid duplicating logic across interfaces.

---

# SECURITY STANDARD

Always validate:

Authentication

Authorization

Tenant ownership

Input data

Secrets

Sensitive outputs

Security is mandatory.

Never optional.

---

# PERFORMANCE STANDARD

Measure before optimizing.

Prefer:

Efficient queries

Lazy loading

Caching where appropriate

Minimal token usage

Minimal API calls

Avoid premature optimization.

---

# AI STANDARD

Every AI interaction should define:

Prompt source

Context source

Fallback behavior

Timeout strategy

Retry policy

Observability

Cost awareness

Never treat AI as deterministic.

---

# CONFIGURATION STANDARD

Configuration belongs in configuration.

Never hardcode:

Secrets

URLs

Limits

Timeouts

Feature flags

Business rules likely to change

---

# TESTABILITY

Every implementation should be testable.

Prefer:

Dependency injection where appropriate

Pure functions

Small interfaces

Deterministic outputs

Minimal hidden state

Testing should be easy.

Not an afterthought.

---

# OBSERVABILITY

Every important operation should expose:

Logs

Metrics

Tracing when applicable

Operational visibility

Silent failures are unacceptable.

---

# DOCUMENTATION TRIGGERS

After implementation evaluate whether updates are required for:

PROJECT_STATUS

CHANGELOG

RELEASE_NOTES

AI_MEMORY

KNOWN_ISSUES

ADR

RUNBOOK

BACKLOG

Documentation is part of implementation.

---

# IMPLEMENTATION CHECKLIST

Before considering work complete:

□ Requirements satisfied

□ Code readable

□ Types explicit

□ Errors handled

□ Logs meaningful

□ Tests passing

□ Security verified

□ Performance acceptable

□ Rollback possible

□ Documentation updated

---

# COMMON ANTI-PATTERNS

Never:

Duplicate logic

Hardcode values

Ignore lint warnings

Silence exceptions

Create oversized functions

Over-abstract simple code

Introduce hidden side effects

Optimize without evidence

Mix unrelated responsibilities

---

# EXCEPTIONS

Breaking these standards requires:

Technical justification

Documented trade-off

Review approval

Follow-up plan if technical debt is introduced

Standards may be bent.

Never ignored.

---

# AI RESPONSIBILITIES

The AI must:

Prefer existing patterns over inventing new ones

Reuse abstractions before creating new ones

Highlight technical debt introduced

Recommend simpler implementations when possible

Explain significant design decisions

Produce code that another engineer can understand quickly

---

# RELATED PROTOCOLS

37_AI_STARTUP_PROTOCOL.md

38_CONTEXT_BUILDER.md

39_TASK_EXECUTION_PROTOCOL.md

40_REASONING_STANDARD.md

42_CODE_REVIEW_STANDARD.md

43_DEBUGGING_STANDARD.md

44_AI_SELF_REVIEW.md

15_TESTING_STANDARD.md

17_SECURITY.md

16_OBSERVABILITY.md

---

# FINAL PRINCIPLE

The best implementation is not the most clever.

It is the one that remains understandable, reliable and safe years after it was written.

---

End of IMPLEMENTATION STANDARD.