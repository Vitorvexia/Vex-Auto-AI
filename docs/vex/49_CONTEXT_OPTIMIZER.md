49_CONTEXT_OPTIMIZER.md
# THE VEX AI RUNTIME

# CONTEXT OPTIMIZER

Version: 2.0

Status: Mandatory

Owner: Engineering Leadership

Execution Time: Before and During Every Task

---

> "Better context is not more context.
It is the minimum context required to make the best decision."

---

# PURPOSE

The Context Optimizer determines:

- Which information should be loaded
- When it should be loaded
- How much should be loaded
- When context should be discarded
- When summaries should replace raw history

Its objective is maximizing reasoning quality while minimizing cognitive load, latency and cost.

---

# PHILOSOPHY

Context is a limited resource.

Every loaded document has a cost.

Every unnecessary file reduces reasoning quality.

Every missing document increases engineering risk.

The Runtime should always seek the optimal balance.

---

# CONTEXT HIERARCHY

Load context in this order.

Current User Request

↓

Session Memory

↓

Current Files

↓

Relevant Documentation

↓

Relevant Source Code

↓

Recent Decisions

↓

Known Issues

↓

Architecture

↓

External Knowledge

Never reverse this order without justification.

---

# CONTEXT LEVELS

The Runtime defines four context depths.

---

## LEVEL 1 — MINIMAL

Use for:

Simple questions

Typos

Small edits

Variable rename

Documentation wording

Expected Context:

Current file

Current request

Nothing else.

---

## LEVEL 2 — STANDARD

Use for:

Feature work

Bug fixes

Refactoring

Expected Context:

Relevant files

Session Memory

Architecture summary

Known Issues

Relevant documentation

---

## LEVEL 3 — DEEP

Use for:

Security

Architecture

Database

Infrastructure

Performance

Expected Context:

All affected modules

Related ADRs

Metrics

Historical decisions

Runbooks

Operational documentation

---

## LEVEL 4 — FULL INVESTIGATION

Use only when:

Production incident

Unknown bug

System redesign

Migration

Critical failure

Maximum context permitted.

---

# CONTEXT SCORING

Every candidate document receives a score.

Factors:

Relevance

Recency

Dependency

Task similarity

Historical importance

Risk reduction

Only the highest scoring documents should be loaded.

---

# DOCUMENT PRIORITY

Highest priority:

Current implementation

↓

Session Memory

↓

Project Status

↓

Relevant ADR

↓

Known Issues

↓

AI Memory

↓

Architecture

↓

Historical releases

↓

Archived documents

Archive should almost never be loaded automatically.

---

# FILE PRIORITY

Prefer:

Files directly modified

↓

Imported dependencies

↓

Shared utilities

↓

Infrastructure

↓

Tests

↓

Documentation

↓

Examples

Avoid loading entire directories unnecessarily.

---

# LAZY CONTEXT LOADING

Never load everything upfront.

Load only when required.

Example:

Need database schema?

↓

Load schema.

Need migration?

↓

Load migration only then.

Need deployment docs?

↓

Load only during deployment.

Context should grow organically.

---

# CONTEXT PRUNING

Discard context when:

Task changes

Hypothesis rejected

Module no longer relevant

Summary available

Context budget exceeded

Keeping obsolete context is harmful.

---

# SUMMARIZATION STRATEGY

Replace large histories with summaries when:

Conversation becomes long

Many files reviewed

Many hypotheses rejected

Architecture already understood

Summaries should preserve:

Facts

Decisions

Evidence

Risks

Pending work

Never summarize away uncertainty.

---

# CONTEXT BUDGET

Allocate context dynamically.

Example:

Current task

40%

Relevant code

25%

Documentation

15%

Architecture

10%

Session Memory

5%

Historical decisions

5%

Budgets should adapt to task complexity.

---

# CONTEXT INVALIDATION

Refresh context whenever:

Code changes

Requirements change

Architecture changes

Deployment occurs

New evidence appears

Do not trust stale context.

---

# DUPLICATE DETECTION

Avoid loading duplicate information.

Prefer the most authoritative source.

Priority:

Source Code

↓

ADR

↓

Project Documentation

↓

AI Memory

↓

Conversation History

One fact should have one source of truth.

---

# CONTEXT CHECKPOINTS

Create checkpoints after:

Architecture review

Major implementation

Debugging milestone

Deployment

Large refactor

Checkpoint summaries become reusable context.

---

# QUALITY METRICS

Measure:

Loaded documents

Unused documents

Average context size

Summary frequency

Retrieval accuracy

Token efficiency

Reasoning confidence

Optimize for quality per token.

---

# FAILURE CONDITIONS

The optimizer fails when:

Irrelevant context dominates

Critical context omitted

Duplicate documents loaded

Outdated information prioritized

Context budget exceeded

Failure reduces reasoning quality.

---

# AI RESPONSIBILITIES

The Runtime must:

Load only what is necessary

Avoid unnecessary token usage

Summarize intelligently

Discard obsolete information

Refresh context when evidence changes

Continuously optimize context quality

Context should be curated.

Never accumulated blindly.

---

# RELATED MODULES

47_RUNTIME_ORCHESTRATOR

48_TOOL_SELECTION_ENGINE

50_MULTI_AGENT_COORDINATION

51_LEARNING_ENGINE

45_SESSION_MEMORY

34_AI_MEMORY

---

# FINAL PRINCIPLE

The quality of an engineering decision depends less on how much information is available and more on whether the right information is available at the right moment.

---

End of CONTEXT OPTIMIZER.