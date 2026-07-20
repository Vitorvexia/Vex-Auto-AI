45_SESSION_MEMORY.md
# THE VEX AI OPERATING SYSTEM

# SESSION MEMORY

Version: 1.0

Status: Mandatory

Owner: Engineering Leadership

Execution Time: Throughout Every Engineering Session

---

> "Context is not only what you know.
It is also what you remember."

---

# PURPOSE

This protocol defines how an AI assistant maintains working memory throughout an engineering session.

Unlike AI_MEMORY.md, which stores long-term organizational knowledge, Session Memory stores temporary execution context.

Its purpose is ensuring continuity, reducing repeated work and preventing loss of reasoning.

---

# MEMORY PHILOSOPHY

Working memory is temporary.

Organizational memory is permanent.

Never confuse the two.

Session Memory exists only while solving the current problem.

At the end of the session:

Relevant knowledge is promoted.

Temporary information is discarded.

---

# SESSION LIFECYCLE

Every engineering session follows five stages.

Initialize

↓

Build

↓

Maintain

↓

Summarize

↓

Promote

---

# STAGE 1 — INITIALIZE

At the beginning of the session create an internal snapshot containing:

Current task

Business objective

Relevant documentation

Relevant architecture

Known constraints

Known risks

Confidence level

Execution plan

This snapshot becomes the session baseline.

---

# STAGE 2 — BUILD MEMORY

Continuously record:

Decisions made

Files analyzed

Files modified

Hypotheses accepted

Hypotheses rejected

Evidence collected

Tests executed

Pending questions

Do not rely solely on conversation history.

---

# STAGE 3 — MAINTAIN MEMORY

After each significant step update:

Current progress

Remaining work

Blocked items

New discoveries

Changed assumptions

Architecture impact

Documentation impact

Memory should evolve with the work.

---

# STAGE 4 — SESSION SUMMARY

Whenever the session becomes long or changes focus, produce an internal summary.

The summary should include:

Objective

Current status

Completed work

Pending work

Important discoveries

Outstanding risks

Next recommended action

Summaries reduce context loss.

---

# STAGE 5 — PROMOTE KNOWLEDGE

At the end of the session evaluate:

Should this become AI_MEMORY?

Should KNOWN_ISSUES be updated?

Should DECISIONS_LOG be updated?

Should CHANGELOG be updated?

Should RELEASE_NOTES be updated?

Should PROJECT_STATUS change?

Temporary knowledge becomes permanent only when valuable.

---

# MEMORY CATEGORIES

Track:

Objectives

Architecture

Implementation

Debugging

Testing

Documentation

Operations

Business

Risks

Decisions

Evidence

Open Questions

---

# WORKING MEMORY MODEL

Maintain three lists.

Completed

Tasks fully validated.

In Progress

Current focus.

Pending

Not yet started.

Every task belongs to exactly one list.

---

# HYPOTHESIS TRACKING

Record every significant hypothesis.

Status:

Proposed

Testing

Confirmed

Rejected

Never continue acting on rejected hypotheses.

---

# DECISION TRACKING

Every important decision should record:

Decision

Reason

Evidence

Impact

Reversibility

Temporary decisions remain in Session Memory until promoted or discarded.

---

# CONTEXT REFRESH

Refresh context whenever:

Task changes

Architecture changes

New documentation is discovered

Production behavior differs

Major assumptions change

Never continue with stale context.

---

# INTERRUPTIONS

If interrupted:

Summarize:

Current objective

Current progress

Current blockers

Next step

Assumptions

This enables seamless continuation.

---

# SESSION CHECKPOINTS

Create internal checkpoints after:

Architecture decisions

Major refactors

Bug resolution

Deployment

Database migration

Security changes

Large documentation updates

Checkpointing reduces cognitive drift.

---

# MEMORY QUALITY

Good Session Memory is:

Accurate

Current

Concise

Relevant

Evidence-based

Actionable

Avoid storing unnecessary details.

---

# ANTI-PATTERNS

Never:

Repeat completed investigations

Forget rejected hypotheses

Restart analysis unnecessarily

Lose track of current objective

Mix temporary and permanent knowledge

Treat assumptions as facts

Carry obsolete context forward

---

# AI RESPONSIBILITIES

The AI must:

Maintain an updated internal state

Track progress

Remember previous conclusions

Expose uncertainty

Summarize when appropriate

Promote durable knowledge

Discard temporary noise

Memory should improve reasoning, not replace it.

---

# SESSION COMPLETION

Before ending the session verify:

Objective achieved

Progress summarized

Knowledge promoted where appropriate

Outstanding work identified

Documentation updated

Recommended next step recorded

No valuable knowledge should leave only in conversation history.

---

# RELATED PROTOCOLS

34_AI_MEMORY.md

37_AI_STARTUP_PROTOCOL.md

38_CONTEXT_BUILDER.md

39_TASK_EXECUTION_PROTOCOL.md

40_REASONING_STANDARD.md

44_AI_SELF_REVIEW.md

46_ENGINEERING_AUTOMATION.md

---

# FINAL PRINCIPLE

Engineering sessions end.

Engineering knowledge should not.

Preserve what matters.
Discard what doesn't.

---

End of SESSION MEMORY.