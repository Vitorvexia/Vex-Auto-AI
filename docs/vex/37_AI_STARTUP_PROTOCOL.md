Vamos começar pelo mais importante
37_AI_STARTUP_PROTOCOL.md

Este documento é o BOOTLOADER da IA.

Toda IA que entrar no projeto deve executá-lo antes de responder qualquer tarefa.

# THE VEX AI OPERATING SYSTEM

# AI STARTUP PROTOCOL

Version: 1.0

Status: Mandatory

Owner: Engineering Leadership

Execution Time: Every New Session

---

> "The first five minutes determine the quality of the next five hours."

---

# PURPOSE

This protocol defines the mandatory startup sequence for every AI assistant working on VEX.

No engineering task may begin before this protocol has completed successfully.

The objective is ensuring that every response is based on the latest project knowledge rather than assumptions.

---

# STARTUP PHASES

The startup process is divided into six phases.

1. Project Awareness

2. Context Collection

3. Priority Assessment

4. Knowledge Validation

5. Execution Planning

6. Ready State

Each phase must complete before the next begins.

---

# PHASE 1 — PROJECT AWARENESS

Read, in order:

PROJECT_STATUS.md

↓

BACKLOG.md

↓

DECISIONS_LOG.md

↓

RELEASE_NOTES.md

↓

CHANGELOG.md

Goal:

Understand the current state of the project.

---

# PHASE 2 — CONTEXT COLLECTION

Read:

AI_MEMORY.md

↓

KNOWN_ISSUES.md

↓

Recent ADRs

↓

Relevant Runbooks

↓

Engineering Metrics

Goal:

Understand historical knowledge before making decisions.

---

# PHASE 3 — TASK CLASSIFICATION

Classify the incoming request.

Possible categories:

Bug

Feature

Refactor

Architecture

Infrastructure

Testing

Documentation

Security

Performance

Research

Operations

Multiple categories may apply.

---

# PHASE 4 — CONTEXT BUILDING

Before touching code identify:

Affected modules

Affected database tables

Affected APIs

Affected integrations

Affected documentation

Affected tests

Affected deployments

If any dependency is unknown,

investigate before proceeding.

---

# PHASE 5 — RISK ASSESSMENT

Estimate:

Technical Risk

Business Risk

Security Risk

Operational Risk

Rollback Difficulty

Testing Complexity

Low confidence requires additional investigation.

---

# PHASE 6 — EXECUTION PLAN

Before implementation create a plan containing:

Objective

Constraints

Dependencies

Implementation Steps

Validation Strategy

Rollback Strategy

Documentation Updates

No implementation should begin without a plan.

---

# DECISION GATES

At every phase ask:

Do I have enough context?

Am I making assumptions?

Is there existing documentation?

Has this problem already been solved?

Can I justify my approach?

If any answer is "No",

stop and investigate.

---

# OUTPUT FORMAT

At the end of startup the AI should internally produce:

Project State

Current Priorities

Relevant Documentation

Known Risks

Execution Plan

Only then begin implementation.

---

# FAILURE CONDITIONS

Startup fails if:

Critical documentation cannot be found.

Project status is outdated.

Contradictory decisions exist.

Required context is missing.

Known issues were ignored.

When startup fails,

request clarification before coding.

---

# SUCCESS CRITERIA

Startup is complete only when:

Project understood.

Task classified.

Context collected.

Risks identified.

Plan prepared.

Documentation mapped.

The AI is now ready to work.

---

# FINAL PRINCIPLE

Never optimize execution by skipping understanding.

Context is the foundation of engineering quality.

---

End of AI STARTUP PROTOCOL.