40_REASONING_STANDARD.md
# THE VEX AI OPERATING SYSTEM

# REASONING STANDARD

Version: 1.0

Status: Mandatory

Owner: Engineering Leadership

Execution Time: Before Every Technical Decision

---

> **TOOLING NOTE (2026-07-20):** The Claude Code agent working this repo has `superpowers:writing-plans` and `superpowers:brainstorming` as enforced, hook-triggered skills covering this same ground. Prefer invoking those — they're tool-backed, this file is prose only. Read this chapter for VEX-specific reasoning rules the generic skill doesn't know (business context, guardrails), not as a replacement process.

---

> "Fast reasoning creates quick answers.
Structured reasoning creates correct answers."

---

# PURPOSE

This standard defines how every AI assistant should reason before making technical decisions within VEX.

Reasoning is a structured engineering process.

Never a sequence of guesses.

The objective is producing decisions that are explainable, evidence-based and consistent.

---

# REASONING PRINCIPLES

Always prefer:

Evidence over intuition.

Understanding over speed.

Simplicity over cleverness.

Systems thinking over isolated optimization.

Long-term maintainability over short-term convenience.

Customer value over technical elegance.

---

# THE REASONING CYCLE

Every engineering decision follows seven phases.

Understand

↓

Observe

↓

Analyze

↓

Evaluate

↓

Decide

↓

Validate

↓

Reflect

Skipping phases is prohibited.

---

# PHASE 1 — UNDERSTAND

Determine:

What problem is actually being solved?

What outcome is expected?

Who is affected?

Why is this work necessary now?

Separate the requested solution from the underlying problem.

Never assume they are the same.

---

# PHASE 2 — OBSERVE

Collect evidence.

Read documentation.

Inspect architecture.

Inspect source code.

Inspect historical decisions.

Inspect known issues.

Inspect metrics.

Inspect production behavior.

Reasoning without observation is speculation.

---

# PHASE 3 — ANALYZE

Break the problem into smaller parts.

Identify:

Root cause.

Dependencies.

Constraints.

Risks.

Trade-offs.

Unknowns.

If the problem appears simple,

verify that it actually is.

---

# PHASE 4 — EVALUATE

Generate multiple approaches.

For every approach evaluate:

Correctness.

Security.

Reliability.

Maintainability.

Operational complexity.

Performance.

Scalability.

Business impact.

Documentation impact.

Testing effort.

Never stop at the first acceptable solution.

---

# PHASE 5 — DECIDE

Select the solution with the best overall balance.

A decision must be explainable.

Document why alternatives were rejected.

Every decision should survive future review.

---

# PHASE 6 — VALIDATE

Before implementation ask:

Can this break production?

Can this affect another tenant?

Can rollback be performed safely?

Can this be tested?

Can this be monitored?

Can success be measured?

If the answer is "No",

the solution is incomplete.

---

# PHASE 7 — REFLECT

After implementation evaluate:

Did the solution solve the problem?

Did unexpected effects occur?

Should AI Memory be updated?

Should an ADR be created?

Should Known Issues be updated?

Engineering improves through reflection.

---

# DECISION HIERARCHY

When trade-offs exist prioritize in this order:

Correctness

↓

Security

↓

Reliability

↓

Maintainability

↓

Operational Simplicity

↓

Observability

↓

Performance

↓

Developer Experience

↓

Development Speed

Never invert this order without explicit justification.

---

# EVIDENCE REQUIREMENTS

Every important conclusion should be supported by at least one of:

Source code.

Documentation.

Logs.

Metrics.

Tests.

Production observations.

Architecture.

Business requirements.

Avoid unsupported conclusions.

---

# UNCERTAINTY MANAGEMENT

Recognize four confidence levels.

Confirmed

Strong evidence.

Likely

Reasonable evidence.

Possible

Limited evidence.

Unknown

Insufficient evidence.

Never present uncertainty as certainty.

---

# COGNITIVE BIASES TO AVOID

Avoid:

Confirmation bias.

Anchoring.

Overconfidence.

Availability bias.

Premature optimization.

Recency bias.

Assuming previous AI responses are correct.

Every conclusion must be independently validated.

---

# ROOT CAUSE THINKING

Never stop at the first explanation.

Ask repeatedly:

Why?

Why?

Why?

Why?

Why?

The objective is identifying systemic causes.

Not temporary symptoms.

---

# SYSTEMS THINKING

Evaluate impact across:

Database.

Backend.

Frontend.

AI.

Infrastructure.

Security.

Operations.

Documentation.

Business workflows.

Local optimizations may damage the global system.

---

# FAILURE ANALYSIS

Before implementing ask:

How could this fail?

What assumptions exist?

What dependencies may change?

How would production behave?

How would rollback work?

Thinking about failure improves design.

---

# SIMPLICITY TEST

Ask:

Can this solution be simpler?

Can one component be removed?

Can existing functionality be reused?

Does this introduce unnecessary complexity?

The simplest correct solution is preferred.

---

# LONG-TERM THINKING

Evaluate:

Maintenance cost.

Future extensibility.

Documentation impact.

Operational burden.

Knowledge transfer.

Engineering sustainability.

Optimize for years,

not days.

---

# SELF-QUESTIONING

Before every important decision ask:

Do I truly understand the problem?

Am I assuming something?

What evidence supports this?

Is there a simpler solution?

What could invalidate my reasoning?

Would I make the same decision six months from now?

---

# STOP CONDITIONS

Pause reasoning when:

Evidence conflicts.

Architecture is unclear.

Business rules are unknown.

Security implications are uncertain.

Production behavior cannot be predicted.

Seek clarification before continuing.

---

# ANTI-PATTERNS

Never:

Jump directly to implementation.

Confuse symptoms with causes.

Assume documentation is current.

Ignore historical decisions.

Choose complexity over clarity.

Optimize before measuring.

Hide uncertainty.

---

# AI RESPONSIBILITIES

The AI must:

Explain decisions.

Expose assumptions.

Highlight risks.

Present alternatives.

Identify unknowns.

Recommend validation.

Protect long-term quality.

Reasoning should always be transparent.

---

# RELATED PROTOCOLS

37_AI_STARTUP_PROTOCOL.md

38_CONTEXT_BUILDER.md

39_TASK_EXECUTION_PROTOCOL.md

41_IMPLEMENTATION_STANDARD.md

42_CODE_REVIEW_STANDARD.md

43_DEBUGGING_STANDARD.md

44_AI_SELF_REVIEW.md

---

# FINAL PRINCIPLE

Good engineers solve problems.

Great engineers first ensure they are solving the right problem.

Engineering excellence begins with disciplined reasoning.

---

End of REASONING STANDARD.