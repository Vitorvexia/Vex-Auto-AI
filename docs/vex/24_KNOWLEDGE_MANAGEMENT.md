24_KNOWLEDGE_MANAGEMENT.md
# THE VEX OPERATING SYSTEM

# Volume IV — Engineering Governance

# Book 24

# KNOWLEDGE MANAGEMENT

Version: 1.0

Status: Critical

Authority: Absolute

Depends on:

00_CONSTITUTION.md

22_ARCHITECTURE_DECISION_RECORDS.md

23_RUNBOOKS_STANDARD.md

---

> "Knowledge is the only asset that becomes more valuable every time it is used."

---

# PURPOSE

This document defines how knowledge is created, organized, validated, shared and preserved inside VEX.

Code can always be rewritten.

Lost knowledge cannot.

Knowledge management is a core engineering discipline.

---

# PHILOSOPHY

Every important decision.

Every important failure.

Every important discovery.

Every important lesson.

Must become permanent organizational knowledge.

Documentation is not bureaucracy.

Documentation is organizational memory.

---

# THE SINGLE SOURCE OF TRUTH

Every topic must have exactly one authoritative source.

Never duplicate documentation.

Instead:

Reference.

Link.

Connect.

Duplicate documentation inevitably diverges.

---

# KNOWLEDGE HIERARCHY

Knowledge has levels.

Constitution

↓

Architecture

↓

Engineering Standards

↓

ADRs

↓

Runbooks

↓

Playbooks

↓

Product Documentation

↓

Code Comments

↓

Issues

↓

Chat Discussions

Authority always flows from top to bottom.

---

# KNOWLEDGE LIFECYCLE

Knowledge follows a lifecycle.

Creation

↓

Validation

↓

Publication

↓

Usage

↓

Review

↓

Evolution

↓

Archive

Nothing important should remain undocumented.

---

# TYPES OF KNOWLEDGE

VEX recognizes several categories.

Architectural

Operational

Product

Business

Infrastructure

Security

AI

Customer

Incident

Research

Historical

Each category belongs in its own directory.

---

# DECISION CAPTURE

Whenever an important decision is made:

Capture immediately.

Waiting reduces accuracy.

Every decision should answer:

What?

Why?

Alternatives?

Risks?

Consequences?

Links to related ADRs are encouraged.

---

# INCIDENT KNOWLEDGE

Every incident creates knowledge.

Document:

Timeline

Root cause

Fix

Preventive action

Detection improvements

Automation opportunities

Incidents become future prevention.

---

# PRODUCT KNOWLEDGE

Document continuously:

Features

Business rules

User flows

Limitations

Future ideas

Rejected ideas

Customers evolve.

Product knowledge evolves with them.

---

# AI KNOWLEDGE

Every successful prompt,

workflow,

evaluation,

guardrail,

and failure

should become reusable organizational knowledge.

Prompt engineering is engineering.

Treat it accordingly.

---

# RESEARCH

Research should never disappear.

Store:

Benchmarks

Experiments

Rejected approaches

Performance comparisons

Trade-offs

Learning from failed experiments saves future time.

---

# DOCUMENT OWNERSHIP

Every document has:

Owner

Reviewer

Version

Last review

Next review

Documentation without ownership becomes obsolete.

---

# REVIEW POLICY

Review intervals:

Critical documents:

Every 3 months.

Operational documents:

Every 6 months.

Architecture:

After significant changes.

Runbooks:

After every incident.

Documentation should evolve continuously.

---

# SEARCHABILITY

Documentation must be searchable.

Use:

Clear titles.

Keywords.

Consistent terminology.

Cross references.

Tags.

Knowledge that cannot be found does not exist.

---

# LINKING

Every document should reference:

Parent documents.

Child documents.

Related ADRs.

Related Runbooks.

Related Incidents.

Related RFCs.

The documentation becomes a knowledge graph.

---

# OBSOLETE KNOWLEDGE

Never silently delete important knowledge.

Instead:

Mark deprecated.

Explain why.

Reference replacement.

Archive permanently.

History has value.

---

# WRITING PRINCIPLES

Documentation should be:

Clear.

Objective.

Deterministic.

Versioned.

Actionable.

Avoid ambiguity.

Avoid storytelling.

Optimize for future readers.

---

# AI-FIRST DOCUMENTATION

Every document should be understandable by:

Humans.

Claude Code.

ChatGPT.

Future AI agents.

Machine-readable structure is a feature.

---

# KNOWLEDGE DISCOVERY

Engineers should be able to answer:

Why does this exist?

Where is it documented?

Who owns it?

When was it changed?

Which ADR explains it?

Knowledge should reduce questions.

---

# COMMON ANTI-PATTERNS

❌ Knowledge inside Slack.

❌ Knowledge inside WhatsApp.

❌ Knowledge only in Git history.

❌ Undocumented architecture.

❌ Decisions remembered by one engineer.

❌ Duplicate documentation.

❌ Missing ownership.

❌ Stale documentation.

❌ Documentation without references.

❌ "I'll remember later."

---

# DIRECTORY RECOMMENDATION

docs/

constitution/

architecture/

engineering/

operations/

adr/

runbooks/

playbooks/

research/

security/

product/

business/

incidents/

archive/

Every directory has a clearly defined responsibility.

---

# KNOWLEDGE QUALITY CHECKLIST

Every important document should answer:

□ Why does this exist?

□ Who owns it?

□ Is it current?

□ Is it linked?

□ Is it searchable?

□ Is it actionable?

□ Can another engineer understand it?

□ Can an AI execute it?

---

# CTO PRINCIPLE

Organizations do not scale through people.

They scale through transferable knowledge.

Protect knowledge as carefully as production data.

---

# IF YOU REMEMBER ONLY THREE THINGS

1.

Every important lesson becomes documentation.

2.

Documentation is organizational memory.

3.

Knowledge compounds when it is structured.

---

# RELATED DOCUMENTS

00_CONSTITUTION.md

22_ARCHITECTURE_DECISION_RECORDS.md

23_RUNBOOKS_STANDARD.md

25_PROJECT_EVOLUTION.md

ADR/

RUNBOOKS/

RESEARCH/

INCIDENTS/

---

End of Book 24.