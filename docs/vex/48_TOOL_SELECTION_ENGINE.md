48_TOOL_SELECTION_ENGINE.md
# THE VEX AI RUNTIME

# TOOL SELECTION ENGINE

Version: 2.0

Status: Mandatory

Owner: Engineering Leadership

Execution Time: Before Every Tool Invocation

---

> "The best tool is not the most powerful.
It is the one that solves the problem with the least cost and risk."

---

# PURPOSE

This module defines how the Runtime selects, sequences and validates tools during engineering execution.

Tool usage is an engineering decision.

Every invocation has:

- Cost
- Risk
- Latency
- Context impact
- Failure probability

The Runtime must optimize all of them.

---

# PHILOSOPHY

Never call a tool because it exists.

Call it because it is necessary.

Every tool invocation must answer:

Why this tool?

Why now?

Why not another?

What evidence is expected?

---

# TOOL SELECTION PIPELINE

Need Detected

↓

Capability Matching

↓

Risk Evaluation

↓

Cost Evaluation

↓

Tool Ranking

↓

Execution

↓

Validation

↓

Fallback (if needed)

Tool usage should be intentional.

---

# TOOL CATEGORIES

The Runtime classifies tools by responsibility.

Knowledge

Search

Filesystem

Code Editing

Terminal

Database

Git

Deployment

Observability

Browser

AI Models

Communication

Each category has different selection rules.

---

# DECISION FACTORS

Every tool receives a score based on:

Capability

Accuracy

Latency

Cost

Risk

Context Consumption

Determinism

Availability

Security

The Runtime always prefers the highest total score.

---

# TOOL PRIORITY

Default priority:

Existing Context

↓

Documentation

↓

Filesystem

↓

Code Search

↓

Git History

↓

Database

↓

Logs

↓

External Search

↓

Browser

↓

LLM Reasoning

Never search externally before exhausting local knowledge.

---

# CAPABILITY MATRIX

Example:

Read source code

Filesystem

Search project

Code Search

Analyze logs

Observability

Modify code

Filesystem + Editor

Run tests

Terminal

Deploy

Deployment

Inspect database

Database

Review Git history

Git

Each task maps to one or more capabilities.

---

# TOOL CHAINING

Tools should be composed.

Example:

Search

↓

Read File

↓

Analyze

↓

Modify

↓

Run Tests

↓

Review

↓

Commit

Avoid isolated tool usage.

---

# TOOL CONFIDENCE

Before invocation determine:

High

Necessary tool.

Medium

Useful tool.

Low

Optional tool.

Unknown

Need more context.

Low-confidence calls should be minimized.

---

# COST AWARENESS

Estimate before execution:

Execution time

Token usage

API cost

Rate limits

Context growth

Human interruption

Prefer lower total engineering cost.

---

# CONTEXT IMPACT

Every tool affects context.

Filesystem:

Low

Git History:

Medium

Database:

Medium

Browser:

High

Large Search:

High

LLM Calls:

Variable

The Runtime must track cumulative context usage.

---

# FAILURE HANDLING

If a tool fails:

Determine failure type.

Retry only if appropriate.

Try alternative tool.

Preserve evidence.

Avoid infinite retries.

Failure should improve future selection.

---

# TOOL FALLBACKS

Every important tool should define alternatives.

Example:

Primary:

Database Query

Fallback:

Application Logs

Primary:

Git History

Fallback:

CHANGELOG

Primary:

External Search

Fallback:

Internal Documentation

Fallbacks reduce execution failures.

---

# TOOL SAFETY

Never invoke tools that may:

Delete production data

Expose secrets

Modify infrastructure

Change authentication

Bypass authorization

Unless explicitly approved.

Safety overrides convenience.

---

# TOOL CACHING

Reuse previous results whenever possible.

Avoid:

Repeated searches

Repeated file reads

Repeated API calls

Repeated repository scans

The Runtime should remember previous observations.

---

# PARALLEL EXECUTION

Independent tools may run simultaneously.

Examples:

Read documentation

+

Read source code

+

Load AI Memory

Sequential execution is required only when dependencies exist.

---

# STOP CONDITIONS

Do not invoke additional tools when:

Evidence sufficient

Confidence high

Objective achieved

Additional data unlikely to change the decision

Stop gathering information when diminishing returns begin.

---

# TOOL METRICS

Track:

Tool frequency

Success rate

Failure rate

Latency

Average cost

Context generated

Retry count

Fallback usage

Tool quality should be measurable.

---

# AI RESPONSIBILITIES

The Runtime must:

Choose the minimum necessary toolset

Explain non-obvious tool choices

Avoid unnecessary external calls

Optimize for reliability

Track execution cost

Preserve engineering evidence

Use tools deliberately.

Never habitually.

---

# RELATED MODULES

47_RUNTIME_ORCHESTRATOR

49_CONTEXT_OPTIMIZER

50_MULTI_AGENT_COORDINATION

51_LEARNING_ENGINE

52_AUTONOMOUS_ENGINEERING

---

# FINAL PRINCIPLE

Engineering excellence is not measured by how many tools are available.

It is measured by selecting the right one, at the right moment, for the right reason.

---

End of TOOL SELECTION ENGINE.