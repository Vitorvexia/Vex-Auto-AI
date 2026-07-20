38_CONTEXT_BUILDER.md
# THE VEX AI OPERATING SYSTEM

# CONTEXT BUILDER

Version: 1.0

Status: Mandatory

Owner: Engineering Leadership

Execution Time: Before Every Task

---

> "The quality of an answer is limited by the quality of the context."

---

# PURPOSE

This protocol defines how an AI assistant builds the minimum required context before reasoning, coding, reviewing, debugging or making architectural decisions.

The objective is ensuring every decision is based on evidence rather than assumptions.

The AI must actively construct context.

Never wait for context to be provided.

---

# CONTEXT PHILOSOPHY

Never ask:

"What do I know?"

Always ask:

"What do I still need to know before making a decision?"

Unknown information is a risk.

Missing context is technical debt.

Assumptions are bugs waiting to happen.

---

# CONTEXT PYRAMID

Every task builds context from the bottom up.

                 User Request
                      ▲
                Project Context
                      ▲
             Historical Knowledge
                      ▲
           Technical Architecture
                      ▲
             Source Code Evidence

Never start from the top.

Always build from the bottom.

---

# PHASE 1 — UNDERSTAND THE REQUEST

Identify:

Objective

Expected outcome

Business value

Technical objective

Constraints

Unknown information

Rewrite the task internally in one sentence.

If the objective is unclear,

clarify before continuing.

---

# PHASE 2 — CLASSIFY THE TASK

Possible categories:

Bug

Feature

Refactor

Security

Infrastructure

Performance

Testing

Documentation

Architecture

Research

Operations

Deployment

More than one category may apply.

The category determines the remaining context required.

---

# PHASE 3 — IDENTIFY IMPACT

Determine affected areas.

Business

Database

Backend

Frontend

API

Authentication

Authorization

WhatsApp

AI

Infrastructure

Observability

Deployment

Monitoring

Documentation

Every affected area increases required context.

---

# PHASE 4 — DOCUMENT DISCOVERY

Search for relevant documentation.

Priority order:

PROJECT_STATUS

↓

BACKLOG

↓

DECISIONS_LOG

↓

AI_MEMORY

↓

KNOWN_ISSUES

↓

Relevant ADRs

↓

Runbooks

↓

CHANGELOG

↓

RELEASE_NOTES

↓

Engineering Metrics

Never ignore existing knowledge.

---

# PHASE 5 — SOURCE CODE DISCOVERY

Identify:

Files

Folders

Functions

Database tables

Migrations

Environment variables

API routes

Server Actions

Tests

Configuration

Dependencies

The objective is understanding the implementation before modifying it.

---

# PHASE 6 — DEPENDENCY MAP

Map internal dependencies.

Example:

Lead

↓

Conversation

↓

Message

↓

AI Pipeline

↓

WhatsApp

↓

Logs

↓

Metrics

Never modify isolated components without understanding downstream impact.

---

# PHASE 7 — RISK ANALYSIS

Estimate:

Functional Risk

Security Risk

Performance Risk

Operational Risk

Migration Risk

Rollback Risk

Business Risk

Every risk must have a mitigation strategy.

---

# PHASE 8 — KNOWLEDGE GAPS

Before implementation ask:

What do I still not know?

What assumptions am I making?

Which answer depends on guesswork?

Can additional evidence reduce uncertainty?

Never hide uncertainty.

---

# PHASE 9 — BUILD EXECUTION CONTEXT

Produce internally:

Current objective

Relevant architecture

Relevant documentation

Known limitations

Existing standards

Affected components

Risks

Dependencies

Validation strategy

Rollback strategy

Only after this should implementation begin.

---

# CONTEXT COMPLETENESS CHECKLIST

Before writing code verify:

□ Objective understood

□ Business context understood

□ Existing solution reviewed

□ Documentation consulted

□ Relevant ADRs read

□ Known issues checked

□ Dependencies mapped

□ Tests identified

□ Risks evaluated

□ Rollback possible

If any item is missing,

continue gathering context.

---

# CONFIDENCE LEVEL

Every task should receive an internal confidence score.

High

Evidence complete.

Medium

Minor unknowns remain.

Low

Important information missing.

Unknown

Implementation should not begin.

Never present low confidence as certainty.

---

# CONTEXT ANTI-PATTERNS

Never:

Read only the user prompt.

Modify code before reading related files.

Ignore documentation.

Assume architecture.

Guess database schema.

Guess business rules.

Ignore historical decisions.

Assume previous AI responses are correct.

Every assumption must be validated.

---

# FAST PATH

Small changes may require reduced context.

Examples:

Typo fixes

Comment corrections

Formatting

Documentation edits

Even the Fast Path requires validation that no additional impact exists.

---

# DEEP PATH

Large tasks require full context.

Examples:

Architecture changes

Authentication

Database migrations

AI behavior

Security

Infrastructure

Multi-module refactors

Never use Fast Path for Deep Path tasks.

---

# OUTPUT

The Context Builder should produce an internal summary containing:

Task Classification

Affected Components

Relevant Documentation

Relevant Architecture

Known Issues

Dependencies

Risks

Validation Strategy

Confidence Level

This summary becomes the foundation for every subsequent protocol.

---

# RELATED PROTOCOLS

37_AI_STARTUP_PROTOCOL.md

39_TASK_EXECUTION_PROTOCOL.md

40_REASONING_STANDARD.md

41_IMPLEMENTATION_STANDARD.md

42_CODE_REVIEW_STANDARD.md

43_DEBUGGING_STANDARD.md

44_AI_SELF_REVIEW.md

---

# FINAL PRINCIPLE

Do not become faster at writing code.

Become faster at understanding the system.

The best engineering decisions are made before the first line of code is written.

---

End of CONTEXT BUILDER.