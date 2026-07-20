43_DEBUGGING_STANDARD.md
# THE VEX AI OPERATING SYSTEM

# DEBUGGING STANDARD

Version: 1.0

Status: Mandatory

Owner: Engineering Leadership

Execution Time: Every Bug Investigation

---

> **TOOLING NOTE (2026-07-20):** `superpowers:systematic-debugging` and `gstack:investigate` are the enforced equivalents of this chapter. Prefer invoking those. Read here only for VEX-specific debugging context (WhatsApp/Meta/Supabase quirks) not covered by the generic tools.

---

> "Do not fix bugs. Understand systems."

---

# PURPOSE

This standard defines the official debugging methodology for VEX.

The objective is identifying the true root cause of problems rather than masking symptoms.

Every investigation should produce reusable engineering knowledge.

---

# DEBUGGING PHILOSOPHY

Debugging is an investigation.

Not experimentation.

Every hypothesis requires evidence.

Every conclusion must be validated.

The first explanation is rarely the correct one.

---

# THE DEBUGGING LIFECYCLE

Every investigation follows ten phases.

Detect

↓

Reproduce

↓

Observe

↓

Hypothesize

↓

Investigate

↓

Confirm Root Cause

↓

Design Fix

↓

Validate Fix

↓

Document

↓

Learn

Skipping phases is prohibited.

---

# PHASE 1 — DETECT

Clearly identify:

Observed behavior

Expected behavior

Affected users

Environment

Frequency

Severity

Unknown behavior cannot be debugged.

---

# PHASE 2 — REPRODUCE

Reproduce the issue consistently.

Document:

Inputs

Conditions

Sequence

Environment

Timing

If reproduction is impossible,

collect additional evidence before changing code.

---

# PHASE 3 — OBSERVE

Gather evidence from:

Logs

Metrics

Database

API responses

Frontend state

Background jobs

Infrastructure

Monitoring

Avoid interpreting observations prematurely.

---

# PHASE 4 — HYPOTHESIZE

Generate multiple possible causes.

Never assume the first hypothesis is correct.

For each hypothesis define:

Supporting evidence

Contradicting evidence

Validation method

Confidence level

---

# PHASE 5 — INVESTIGATE

Trace the complete execution path.

Request

↓

Validation

↓

Business Logic

↓

Database

↓

External Services

↓

Response

↓

Logs

↓

Metrics

Every transition is a possible failure point.

---

# PHASE 6 — CONFIRM ROOT CAUSE

A root cause is confirmed only when:

Evidence explains the behavior.

The issue can be reproduced.

The proposed fix eliminates the issue.

No contradictory evidence remains.

Do not confuse correlation with causation.

---

# PHASE 7 — DESIGN FIX

Design the smallest safe correction.

Evaluate:

Correctness

Regression risk

Security impact

Performance impact

Operational impact

Rollback strategy

Fix causes.

Not symptoms.

---

# PHASE 8 — VALIDATE FIX

Validation sequence:

Unit Tests

↓

Integration Tests

↓

Manual Validation

↓

Production Validation

↓

Monitoring

The bug is fixed only after production confirms expected behavior.

---

# PHASE 9 — DOCUMENT

Evaluate updates for:

KNOWN_ISSUES

CHANGELOG

RELEASE_NOTES

AI_MEMORY

RUNBOOK

PROJECT_STATUS

Documentation preserves debugging knowledge.

---

# PHASE 10 — LEARN

Record:

Why the bug occurred

Why it escaped earlier

How recurrence can be prevented

What process improvements are needed

Every bug should improve engineering maturity.

---

# ROOT CAUSE ANALYSIS

Always ask:

Why?

Repeat until no deeper engineering cause exists.

Examples:

Incorrect input

↓

Missing validation

↓

Incomplete business rule

↓

Architecture limitation

↓

Process failure

The deepest actionable cause should be addressed.

---

# INVESTIGATION SOURCES

Consult in this order:

Known Issues

↓

Recent Release Notes

↓

Recent Change Log

↓

AI Memory

↓

Logs

↓

Metrics

↓

Database

↓

Source Code

↓

External Dependencies

Never ignore historical knowledge.

---

# CONFIDENCE LEVEL

Every investigation receives:

Confirmed

High

Medium

Low

Unknown

Never present hypotheses as facts.

---

# DEBUGGING CHECKLIST

□ Issue reproduced

□ Evidence collected

□ Root cause identified

□ Alternative hypotheses evaluated

□ Fix designed

□ Regression risk assessed

□ Tests executed

□ Monitoring planned

□ Documentation updated

□ Lessons recorded

---

# COMMON DEBUGGING ANTI-PATTERNS

Never:

Guess the cause

Edit code before reproducing

Ignore logs

Ignore metrics

Apply multiple fixes simultaneously

Hide uncertainty

Ignore previous incidents

Delete debugging evidence

Change unrelated code during investigation

---

# SPECIAL CASES

## Intermittent Bugs

Increase observability.

Collect more evidence.

Avoid speculative fixes.

---

## Production Bugs

Protect stability first.

Mitigate.

Then investigate.

Never prioritize elegance over recovery.

---

## AI Bugs

Verify:

Prompt

Context

Memory

Tool calls

Fallback logic

Retry policy

Model version

AI behavior should be reproducible whenever possible.

---

## Database Bugs

Verify:

Migration history

Constraints

Indexes

Transactions

RLS

Isolation

Never modify production data without understanding consequences.

---

# AI RESPONSIBILITIES

The AI must:

Explain reasoning

Separate facts from hypotheses

Expose uncertainty

Recommend additional evidence

Protect production stability

Prefer investigation over speculation

Preserve debugging knowledge

---

# RELATED PROTOCOLS

37_AI_STARTUP_PROTOCOL.md

38_CONTEXT_BUILDER.md

39_TASK_EXECUTION_PROTOCOL.md

40_REASONING_STANDARD.md

41_IMPLEMENTATION_STANDARD.md

42_CODE_REVIEW_STANDARD.md

44_AI_SELF_REVIEW.md

30_KNOWN_ISSUES.md

20_INCIDENT_RESPONSE.md

16_OBSERVABILITY.md

---

# FINAL PRINCIPLE

Every bug has a cause.

Great engineers do not stop when the bug disappears.

They stop when they understand why it existed.

---

End of DEBUGGING STANDARD.