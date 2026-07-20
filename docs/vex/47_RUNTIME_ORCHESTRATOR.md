47_RUNTIME_ORCHESTRATOR.md
# THE VEX AI RUNTIME

# RUNTIME ORCHESTRATOR

Version: 2.0

Status: Mandatory

Owner: Engineering Leadership

Execution Time: Every User Request

---

> "Protocols define capabilities.
The Runtime decides how to use them."

---

# PURPOSE

The Runtime Orchestrator is the central decision engine of the VEX AI Runtime.

Its responsibility is determining how every engineering request should be executed.

Rather than executing protocols sequentially, the Runtime dynamically builds an execution plan based on:

- Task type
- Project state
- Context availability
- Risk
- Confidence
- Required tools
- Expected outcome

The Runtime is responsible for orchestration.

Individual protocols are responsible for execution.

---

# CORE RESPONSIBILITIES

The Runtime must answer, before any action:

What is the user actually asking?

↓

What engineering domain does this belong to?

↓

Which protocols are required?

↓

Which documents must be loaded?

↓

Which tools are needed?

↓

What risks exist?

↓

Can execution begin?

Only after these questions are answered may execution start.

---

# RUNTIME ARCHITECTURE

Every request follows this pipeline.

Incoming Request

↓

Intent Recognition

↓

Task Classification

↓

Risk Analysis

↓

Context Planning

↓

Protocol Selection

↓

Tool Planning

↓

Execution

↓

Validation

↓

Knowledge Preservation

↓

Response

The Runtime owns this pipeline.

---

# STAGE 1 — INTENT RECOGNITION

Determine:

Primary objective

Secondary objectives

Hidden engineering goals

Expected deliverable

Missing information

Separate the request from the implementation.

Example:

"I need WhatsApp integration."

Intent:

Integrate Cloud API.

Not:

Edit file X.

---

# STAGE 2 — TASK CLASSIFICATION

Every request belongs to one category.

Architecture

Feature

Bug

Refactor

Documentation

Infrastructure

Deployment

Security

Testing

Research

Planning

Operations

Multiple categories are allowed.

The primary category drives orchestration.

---

# STAGE 3 — RISK ANALYSIS

Assign one risk level.

LOW

MEDIUM

HIGH

CRITICAL

Risk depends on:

Production impact

Database

Authentication

Authorization

AI

External APIs

Infrastructure

Financial impact

User impact

Higher risk loads more protocols.

---

# STAGE 4 — CONTEXT PLANNING

Determine:

Required documentation

Required source files

Required historical decisions

Required AI memory

Required metrics

Required logs

Avoid unnecessary context loading.

Context is expensive.

---

# STAGE 5 — PROTOCOL SELECTION

The Runtime dynamically builds a protocol chain.

Example:

Bug Investigation

↓

Startup

↓

Context Builder

↓

Reasoning

↓

Debugging

↓

Implementation

↓

Self Review

↓

Automation

A documentation task should not execute Debugging.

A deployment task should not execute Feature Planning.

Only load what is necessary.

---

# STAGE 6 — TOOL PLANNING

Before execution determine:

Required IDE

Required MCPs

Database access

Git operations

Filesystem

Browser

Search

Terminal

AI tools

Tool usage must be intentional.

Never exploratory.

---

# STAGE 7 — EXECUTION

Execute protocols in dependency order.

Each protocol produces outputs.

Those outputs become inputs for the next protocol.

Execution is stateful.

---

# STAGE 8 — VALIDATION

Before completion verify:

Objective achieved

Risks acceptable

Tests completed

Documentation updated

Knowledge preserved

Rollback possible

If validation fails,

execution returns to the appropriate stage.

---

# STAGE 9 — KNOWLEDGE PRESERVATION

Automatically evaluate:

AI_MEMORY

PROJECT_STATUS

CHANGELOG

KNOWN_ISSUES

RELEASE_NOTES

ADR

RUNBOOK

BACKLOG

The Runtime decides whether updates are required.

---

# EXECUTION MODES

The Runtime supports multiple execution modes.

---

## QUICK

Simple requests.

Minimal context.

Fast execution.

Examples:

Rename variable.

Update README.

Fix typo.

---

## STANDARD

Default engineering work.

Moderate context.

Balanced reasoning.

Examples:

Feature.

Bug.

Refactor.

---

## DEEP

Architecture.

Security.

Performance.

Infrastructure.

Migration.

High-risk work.

Maximum context.

Maximum validation.

---

## INCIDENT

Production failures.

Prioritize:

Containment

Diagnosis

Recovery

Root Cause

Documentation

---

# PROTOCOL MATRIX

| Task | Protocols |
|--------|-----------|
| Feature | Startup → Context → Reasoning → Implementation → Self Review |
| Bug | Startup → Context → Debugging → Implementation → Self Review |
| Architecture | Startup → Context → Reasoning → ADR → Review |
| Documentation | Startup → Context → Documentation → Automation |
| Deployment | Startup → Context → Validation → Automation |
| Security | Startup → Context → Reasoning → Security Review → Self Review |

The Runtime builds these chains automatically.

---

# DECISION ENGINE

Before every important decision evaluate:

Evidence

↓

Confidence

↓

Risk

↓

Complexity

↓

Business Value

↓

Engineering Cost

↓

Expected Benefit

This prevents impulsive execution.

---

# INTERRUPTIONS

Execution pauses when:

Architecture unclear

Business rules missing

Production risk unknown

Required permissions absent

Conflicting evidence exists

The Runtime should request clarification instead of guessing.

---

# FAILURE RECOVERY

If execution fails:

Capture evidence.

↓

Determine failure point.

↓

Return to previous stage.

↓

Preserve findings.

↓

Retry safely.

Never restart the entire pipeline unnecessarily.

---

# RUNTIME STATE

The Runtime continuously tracks:

Current stage

Completed stages

Pending stages

Risk level

Confidence

Loaded documents

Loaded files

Executed tools

Open questions

Current hypothesis

This state persists throughout execution.

---

# QUALITY GATES

Before advancing between stages verify:

Inputs complete

↓

Outputs validated

↓

Dependencies satisfied

↓

Evidence sufficient

↓

Confidence acceptable

No stage advances automatically without validation.

---

# AI RESPONSIBILITIES

The Runtime must:

Choose protocols dynamically

Minimize unnecessary work

Reduce context cost

Preserve engineering consistency

Prevent unsafe execution

Optimize reasoning depth

Maintain execution state

Never execute blindly.

---

# RELATED MODULES

37_AI_STARTUP_PROTOCOL

38_CONTEXT_BUILDER

39_TASK_EXECUTION_PROTOCOL

40_REASONING_STANDARD

41_IMPLEMENTATION_STANDARD

42_CODE_REVIEW_STANDARD

43_DEBUGGING_STANDARD

44_AI_SELF_REVIEW

45_SESSION_MEMORY

46_ENGINEERING_AUTOMATION

48_TOOL_SELECTION_ENGINE

49_CONTEXT_OPTIMIZER

50_MULTI_AGENT_COORDINATION

51_LEARNING_ENGINE

52_AUTONOMOUS_ENGINEERING

---

# FINAL PRINCIPLE

The Runtime does not replace engineering.

It ensures that engineering happens in the right order, with the right context, using the right tools, at the right time.

It is the operating system that coordinates intelligence.

---

End of RUNTIME ORCHESTRATOR.