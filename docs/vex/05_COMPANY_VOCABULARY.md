05_COMPANY_VOCABULARY.md
# THE VEX OPERATING SYSTEM

# Volume I — Foundation

# Book 05

# COMPANY VOCABULARY

Version: 1.0

Status: Critical

Authority: High

Depends on:

00_CONSTITUTION.md

01_IDENTITY.md

02_PHILOSOPHY.md

03_FIRST_PRINCIPLES.md

04_DECISION_ENGINE.md

---

> "Language shapes thought. Thought shapes decisions. Decisions shape companies."

---

# PURPOSE

This document defines the official language of VEX.

Words are not interchangeable.

Every important concept has one official meaning.

Humans and AI must use these definitions consistently.

---

# WHY VOCABULARY MATTERS

Two engineers can read the same sentence and imagine different systems.

Two AI agents can receive the same request and produce different solutions.

Ambiguous language creates ambiguous software.

Precision in language creates precision in execution.

---

# CORE PRINCIPLE

One concept.

One definition.

One meaning.

Always.

---

# COMPANY

Definition

The organization responsible for building the VEX ecosystem.

Never confuse Company with Store.

---

# STORE

Definition

A dealership using VEX.

Examples:

Motorcycle dealership

Car dealership

Truck dealership

Future marketplace partner

A Store is a customer.

Never call a Store a "client" inside the system.

Official internal term:

Store.

---

# USER

Definition

A human with authenticated access to VEX.

Examples:

Owner

Manager

Salesperson

Financial employee

Administrator

Never confuse User with Customer.

---

# CUSTOMER

Definition

A person interested in buying a vehicle.

Customer is external.

User is internal.

---

# LEAD

Definition

A customer with measurable commercial intent.

Examples

WhatsApp conversation

Website form

Instagram inquiry

Phone contact

Referral

Not every customer is a lead.

---

# CONVERSATION

Definition

A communication channel between VEX and a Lead.

Conversation may contain:

messages

AI actions

handoff

status

history

A Conversation owns Messages.

---

# MESSAGE

Definition

One communication event.

Examples

Incoming WhatsApp message

Outgoing AI reply

Human response

System message

---

# AI

Definition

The autonomous commercial assistant operating inside VEX.

AI is not ChatGPT.

AI is not Claude.

AI is the business intelligence layer of VEX.

Different LLMs may power the AI.

The AI identity remains the same.

---

# AGENT

Definition

A software component with autonomous behavior.

Examples

Sales Agent

Follow-up Agent

Reactivation Agent

Analytics Agent

Future Inventory Agent

Agents execute responsibilities.

AI provides intelligence.

---

# PIPELINE

Definition

The complete processing flow from event to outcome.

Pipeline is not Kanban.

Pipeline is execution.

---

# KANBAN

Definition

Visual representation of business stages.

Pipeline executes.

Kanban visualizes.

---

# STATUS

Definition

Current business state.

Never use status to represent actions.

Status represents reality.

---

# ACTION

Definition

An intentional operation performed by a user or agent.

Examples

Assign conversation

Close lead

Archive vehicle

Send follow-up

Actions change state.

---

# EVENT

Definition

Something that happened.

Examples

Message received

Lead created

Vehicle sold

Webhook arrived

Events are immutable.

---

# COMMAND

Definition

A request asking the system to perform an action.

Commands create events.

Events update state.

---

# STATE

Definition

Current truth.

State changes.

History does not.

---

# HISTORY

Definition

Permanent record of everything that happened.

History is append-only.

Never rewrite history.

---

# SOURCE OF TRUTH

Definition

The authoritative location for a specific piece of information.

Examples

Conversation status

Messages table

Vehicle inventory

Lead ownership

Only one source of truth may exist.

---

# AUTOMATION

Definition

A deterministic workflow.

Automation follows rules.

AI makes decisions.

Never confuse both.

---

# GUARDRAIL

Definition

A mandatory business restriction.

Guardrails cannot be bypassed.

Examples

Margin validation

Permission checks

Store isolation

Business hours

---

# VALIDATION

Definition

The process of confirming reality.

Validation is not assumption.

---

# ASSUMPTION

Definition

Information not yet confirmed.

Assumptions must never become database truth.

---

# OBSERVATION

Definition

Verified evidence.

Observations may become knowledge.

---

# KNOWLEDGE

Definition

Validated information accumulated over time.

Knowledge changes only with evidence.

---

# MEMORY

Definition

Persistent contextual information used by AI.

Memory is not history.

History stores events.

Memory stores relevance.

---

# CONTEXT

Definition

The information required for making a good decision.

More context is not always better.

Relevant context is better.

---

# SIGNAL

Definition

Information that increases decision quality.

---

# NOISE

Definition

Information that increases processing while adding little value.

Noise should be removed.

---

# FEATURE

Definition

A capability that produces measurable business value.

Screens are not features.

Buttons are not features.

Business outcomes are features.

---

# BUG

Definition

System behavior that differs from intended behavior.

Unexpected behavior.

Not missing functionality.

---

# TECHNICAL DEBT

Definition

Future engineering work created by current decisions.

Debt is acceptable only when intentional.

Hidden debt is unacceptable.

---

# MVP

Definition

The minimum version capable of proving commercial value.

Not the smallest software.

The smallest business.

---

# VALIDATION

Definition

The process of proving assumptions using reality.

Validation always precedes scaling.

---

# SCALABILITY

Definition

Ability to grow without proportional operational cost.

Never optimize for scalability before validation.

---

# OBSERVABILITY

Definition

Ability to understand system behavior.

Logs.

Metrics.

Tracing.

Monitoring.

Without observability,

bugs become mysteries.

---

# INCIDENT

Definition

Unexpected behavior affecting business operation.

Every incident deserves analysis.

Not every incident deserves panic.

---

# ROOT CAUSE

Definition

The deepest reason an incident occurred.

Never stop at symptoms.

---

# FIX

Definition

A change that removes the root cause.

Workarounds are not fixes.

---

# REFACTOR

Definition

Improve internal implementation without changing behavior.

Refactoring should reduce future cost.

---

# SIMPLICITY

Definition

The minimum complexity required to solve the real problem.

Simple does not mean small.

Simple means understandable.

---

# COMPLEXITY

Definition

Everything that increases cognitive effort.

Complexity is a cost.

Treat it accordingly.

---

# DEFAULT QUESTION

Whenever uncertainty exists,

ask:

"What does this word officially mean inside VEX?"

If the answer is unclear,

this document must be updated.

---

# LANGUAGE RULES

Prefer precise words.

Avoid synonyms for critical concepts.

One concept.

One official term.

One meaning.

---

# RELATED DOCUMENTS

00_CONSTITUTION.md

01_IDENTITY.md

02_PHILOSOPHY.md

03_FIRST_PRINCIPLES.md

04_DECISION_ENGINE.md

06_ENGINEERING_MINDSET.md

07_PRODUCT_PRINCIPLES.md

---

End of Book 05.