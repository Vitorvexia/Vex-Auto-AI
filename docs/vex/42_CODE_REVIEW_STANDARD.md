42_CODE_REVIEW_STANDARD.md
# THE VEX AI OPERATING SYSTEM

# CODE REVIEW STANDARD

Version: 1.0

Status: Mandatory

Owner: Engineering Leadership

Execution Time: Before Every Merge

---

> **TOOLING NOTE (2026-07-20):** `superpowers:requesting-code-review` and `gstack:review` are the enforced, tool-backed equivalents of this chapter (gstack:review runs against the actual diff pre-landing). Prefer invoking those. Read here only for VEX-specific review criteria not covered by the generic tools.

---

> "Code review is not a search for mistakes.
It is a validation that the solution improves the system."

---

# PURPOSE

This standard defines how every code review must be performed within VEX.

The goal is ensuring that every change improves the system in terms of correctness, maintainability, security, and long-term sustainability.

A review evaluates the solution—not only the code.

---

# REVIEW PHILOSOPHY

Every review should answer one question:

"Should this change become part of VEX for the next five years?"

If the answer is uncertain,

the review is incomplete.

---

# REVIEW ORDER

Always review in this sequence:

Business Value

↓

Architecture

↓

Correctness

↓

Security

↓

Data Integrity

↓

Maintainability

↓

Performance

↓

Observability

↓

Testing

↓

Documentation

↓

Deployment Impact

Never start with formatting.

---

# PHASE 1 — BUSINESS REVIEW

Confirm:

Problem understood

Customer value exists

Backlog alignment

Requirements satisfied

No unnecessary scope

A technically correct feature without business value should not be merged.

---

# PHASE 2 — ARCHITECTURE REVIEW

Evaluate:

Architecture consistency

Reuse of existing patterns

Boundary violations

Module responsibilities

Coupling

Cohesion

Future extensibility

Avoid architectural drift.

---

# PHASE 3 — CORRECTNESS

Verify:

Expected behavior

Edge cases

Null handling

Error handling

Input validation

Output consistency

Correctness is mandatory.

---

# PHASE 4 — SECURITY

Check:

Authentication

Authorization

RLS

Tenant isolation

Secret handling

Input sanitization

Permission validation

Logging of sensitive data

Security regressions are blockers.

---

# PHASE 5 — DATABASE

Review:

Queries

Indexes

Transactions

Migrations

Constraints

Rollback safety

Multi-tenant isolation

Never approve unsafe database changes.

---

# PHASE 6 — MAINTAINABILITY

Ask:

Can another engineer understand this quickly?

Are names meaningful?

Are functions focused?

Is complexity justified?

Is duplication avoided?

Readable code scales better than clever code.

---

# PHASE 7 — PERFORMANCE

Review:

Database efficiency

API calls

AI token usage

Caching

Loops

Memory usage

Network requests

Optimize only where evidence exists.

---

# PHASE 8 — OBSERVABILITY

Verify:

Logs

Metrics

Tracing

Error visibility

Operational diagnostics

Failures should never be silent.

---

# PHASE 9 — TESTING

Confirm:

Unit tests

Integration tests

Regression risk

Edge cases

Manual validation

Production validation plan

Untested code should not be merged.

---

# PHASE 10 — DOCUMENTATION

Determine whether updates are required for:

PROJECT_STATUS

CHANGELOG

RELEASE_NOTES

AI_MEMORY

KNOWN_ISSUES

ADR

RUNBOOK

BACKLOG

Documentation is part of the review.

---

# REVIEW CHECKLIST

□ Business value confirmed

□ Architecture respected

□ Security verified

□ Multi-tenant safety confirmed

□ Errors handled

□ Logs adequate

□ Tests passing

□ Rollback possible

□ Documentation updated

□ No hidden technical debt

---

# REVIEW OUTCOMES

Approve

Approved with Suggestions

Changes Requested

Rejected

Every rejection must include technical reasoning.

---

# BLOCKING CONDITIONS

Never approve if:

Security risk exists

Tenant isolation is compromised

Rollback impossible

Tests missing

Critical documentation omitted

Architecture violated

Production stability reduced

These are merge blockers.

---

# REVIEW ANTI-PATTERNS

Never approve because:

"It works."

"It is small."

"We need to ship."

"It can be fixed later."

Engineering quality is cumulative.

---

# AI REVIEW RESPONSIBILITIES

The AI reviewer must:

Explain findings

Prioritize critical issues

Separate mandatory fixes from suggestions

Highlight risks

Recommend simpler alternatives

Preserve architectural consistency

Never rewrite code unnecessarily.

---

# RELATED PROTOCOLS

37_AI_STARTUP_PROTOCOL.md

38_CONTEXT_BUILDER.md

39_TASK_EXECUTION_PROTOCOL.md

40_REASONING_STANDARD.md

41_IMPLEMENTATION_STANDARD.md

43_DEBUGGING_STANDARD.md

44_AI_SELF_REVIEW.md

15_TESTING_STANDARD.md

17_SECURITY.md

21_SRE_GUIDE.md

---

# FINAL PRINCIPLE

A merge is permanent.

Review every change as if you will maintain it yourself for years.

---

End of CODE REVIEW STANDARD.
