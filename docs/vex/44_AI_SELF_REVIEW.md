44_AI_SELF_REVIEW.md
# THE VEX AI OPERATING SYSTEM

# AI SELF REVIEW

Version: 1.0

Status: Mandatory

Owner: Engineering Leadership

Execution Time: Before Every Final Response or Code Submission

---

> **TOOLING NOTE (2026-07-20):** `superpowers:verification-before-completion` is the enforced equivalent of this chapter — it requires running actual verification commands before claiming success, not just prose self-checking. Prefer invoking it.

---

> "The first reviewer of every change should be the engineer who created it."

---

# PURPOSE

This protocol defines the mandatory self-review process for every AI-generated engineering output.

Before presenting code, recommendations, architecture or documentation, the AI must critically evaluate its own work.

The objective is reducing errors, omissions and unnecessary rework.

---

# PHILOSOPHY

Implementation is not the end of engineering.

Reflection is.

The AI should behave as both:

Engineer

↓

Reviewer

↓

Customer

↓

Operator

Each perspective reveals different risks.

---

# SELF REVIEW LIFECYCLE

Every review follows nine phases.

Completeness

↓

Correctness

↓

Architecture

↓

Security

↓

Reliability

↓

Testing

↓

Documentation

↓

Operational Impact

↓

Reflection

Never skip phases.

---

# PHASE 1 — COMPLETENESS

Verify:

Was every requested objective addressed?

Are deliverables complete?

Were all acceptance criteria considered?

Was any requested functionality ignored?

If the answer is uncertain,

the task is incomplete.

---

# PHASE 2 — CORRECTNESS

Verify:

Business logic

Edge cases

Null handling

Validation

Error handling

Consistency

Expected outputs

The solution should solve the problem,

not merely compile.

---

# PHASE 3 — ARCHITECTURE

Confirm:

Existing patterns respected

No duplicated abstractions

Responsibilities remain clear

Coupling minimized

Architecture preserved

Never improve one module by degrading another.

---

# PHASE 4 — SECURITY

Check:

Authentication

Authorization

Tenant isolation

Secrets

Sensitive data

Input validation

Output safety

Security review is mandatory.

---

# PHASE 5 — RELIABILITY

Ask:

What could fail?

What assumptions exist?

What happens under timeout?

Network failure?

Database failure?

External API failure?

Unexpected input?

Design for failure.

---

# PHASE 6 — TESTING

Verify:

Unit tests

Integration tests

Regression risks

Manual validation

Production validation plan

Every important change should be verifiable.

---

# PHASE 7 — DOCUMENTATION

Determine whether updates are required for:

PROJECT_STATUS

CHANGELOG

RELEASE_NOTES

KNOWN_ISSUES

AI_MEMORY

ADR

RUNBOOK

BACKLOG

Knowledge preservation is part of delivery.

---

# PHASE 8 — OPERATIONAL IMPACT

Evaluate:

Deployment complexity

Rollback

Monitoring

Logs

Metrics

Alerts

Operational burden

Engineering work continues after deployment.

---

# PHASE 9 — REFLECTION

Ask:

Is this the simplest correct solution?

Would another engineer understand this quickly?

Can existing functionality be reused?

Did I introduce unnecessary complexity?

Would I approve this during code review?

Reflection prevents overengineering.

---

# CONFIDENCE ASSESSMENT

Before delivery assign one confidence level.

High

Evidence complete.

Medium

Minor uncertainty remains.

Low

Important assumptions exist.

Unknown

Additional investigation required.

Never present low confidence as certainty.

---

# SELF REVIEW CHECKLIST

□ Requirements satisfied

□ Architecture respected

□ Security verified

□ Errors handled

□ Tests identified

□ Rollback possible

□ Documentation updated

□ Monitoring considered

□ Simplicity verified

□ Confidence assessed

---

# DELIVERY DECISION

Deliver only if:

Quality acceptable

↓

Confidence sufficient

↓

Risks explained

↓

Documentation updated

↓

Validation planned

Otherwise continue improving.

---

# COMMON ANTI-PATTERNS

Never:

Assume implementation is correct because it compiles

Ignore edge cases

Hide uncertainty

Overlook documentation

Optimize prematurely

Duplicate existing solutions

Skip rollback planning

Ignore operational impact

---

# AI RESPONSIBILITIES

The AI must:

Challenge its own assumptions

Identify weaknesses

Highlight trade-offs

Explain limitations

Recommend future improvements

Separate facts from assumptions

Improve clarity before delivery

The AI is responsible for the quality of its own output.

---

# REVIEW QUESTIONS

Before finalizing ask:

Did I truly solve the user's problem?

Did I preserve architectural consistency?

Did I introduce technical debt?

Did I create unnecessary complexity?

Did I explain important trade-offs?

Would I confidently approve this in production?

Would this still be a good solution one year from now?

---

# RELATED PROTOCOLS

37_AI_STARTUP_PROTOCOL.md

38_CONTEXT_BUILDER.md

39_TASK_EXECUTION_PROTOCOL.md

40_REASONING_STANDARD.md

41_IMPLEMENTATION_STANDARD.md

42_CODE_REVIEW_STANDARD.md

43_DEBUGGING_STANDARD.md

45_SESSION_MEMORY.md

46_ENGINEERING_AUTOMATION.md

---

# FINAL PRINCIPLE

The best engineers improve their own work before asking others to review it.

Self-review is not an optional quality check.

It is part of engineering itself.

---

End of AI SELF REVIEW.