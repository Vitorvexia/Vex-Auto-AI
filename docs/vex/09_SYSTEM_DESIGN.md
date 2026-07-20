09_SYSTEM_DESIGN.md
# THE VEX OPERATING SYSTEM

# Volume II — Engineering

# Book 09

# SYSTEM DESIGN

Version: 1.0

Status: Critical

Authority: Extremely High

Depends on:

08_ARCHITECTURE_PRINCIPLES.md

06_ENGINEERING_MINDSET.md

04_DECISION_ENGINE.md

---

> "Every expensive bug was once an undocumented design decision."

---

# PURPOSE

This document defines how every new system inside VEX must be designed before implementation.

Design is mandatory.

Coding is optional.

No important feature begins with code.

Every important feature begins with understanding.

---

# THE DESIGN PRINCIPLE

The purpose of system design is reducing uncertainty.

Good design removes unknowns before implementation.

Bad design transfers uncertainty into production.

---

# DESIGN BEFORE CODE

Never ask:

"How should we code this?"

First ask:

"What system are we actually building?"

---

# THE DESIGN PIPELINE

Every system follows this order.

Business Problem

↓

Business Goal

↓

Users

↓

Inputs

↓

Outputs

↓

Rules

↓

Constraints

↓

Data Model

↓

State Machine

↓

Failure Modes

↓

External Integrations

↓

Observability

↓

Security

↓

Implementation

Never reverse this order.

---

# STEP 1

UNDERSTAND THE PROBLEM

Document:

Who has the problem?

Why does it exist?

How often does it happen?

How expensive is it?

How is it solved today?

If the problem is unclear,

stop.

---

# STEP 2

DEFINE SUCCESS

Every system must define success before development.

Examples

Average response time

Lead recovery rate

Manual work reduction

Revenue increase

Error reduction

Customer satisfaction

Without measurable success,

there is no finished feature.

---

# STEP 3

DEFINE ACTORS

List every actor.

Human actors

AI agents

Cron jobs

Webhooks

Integrations

Admin

Customer

Store

Never forget hidden actors.

---

# STEP 4

DEFINE EVENTS

Everything important begins with an event.

Examples

LeadCreated

MessageReceived

VehicleUpdated

ConversationAssigned

SaleCompleted

Events describe facts.

Never intentions.

---

# STEP 5

DEFINE STATE

Every entity must have explicit states.

Every transition must be documented.

Example

NEW

↓

CONTACTED

↓

NEGOTIATING

↓

CLOSED

↓

ARCHIVED

Undefined state transitions create bugs.

---

# STEP 6

BUSINESS RULES

Separate business rules from implementation.

Wrong

"The controller validates."

Correct

"The business requires validation."

Rules survive technology.

---

# STEP 7

DATA MODEL

Every entity must define:

Identity

Owner

Relationships

Lifecycle

Constraints

Indexes

Source of truth

No duplicated ownership.

---

# STEP 8

API DESIGN

APIs expose business capabilities.

Never database structure.

Good

CloseLead()

Bad

UpdateLeadTable()

Operations.

Not storage.

---

# STEP 9

FAILURE ANALYSIS

Assume failure everywhere.

Questions

What if Meta is offline?

What if Anthropic times out?

What if Supabase fails?

What if cron runs twice?

What if webhook retries?

What if network disappears?

If failure is ignored,

the design is incomplete.

---

# STEP 10

IDEMPOTENCY

Every external event should be safely repeatable.

Duplicate webhook?

Safe.

Duplicate cron?

Safe.

Duplicate retry?

Safe.

State corruption is unacceptable.

---

# STEP 11

CONCURRENCY

Assume simultaneous execution.

Questions

Can two users edit together?

Can two AI agents respond?

Can retry happen simultaneously?

Can race conditions exist?

Concurrency is not optional.

Reality is concurrent.

---

# STEP 12

OBSERVABILITY

Every important action must answer:

What happened?

When?

Who initiated it?

Which Store?

Which Lead?

Which Conversation?

Which Agent?

How long did it take?

Did it succeed?

Can we reproduce it?

If not,

observability is incomplete.

---

# STEP 13

SECURITY

Every design must include:

Authentication

Authorization

Isolation

Validation

Secrets

Audit logs

Rate limiting

Least privilege

Security is designed.

Not added later.

---

# STEP 14

AI DESIGN

Whenever AI participates:

Define:

Context source

Prompt source

Memory strategy

Hallucination risks

Fallback

Timeout

Retry

Human override

Confidence evaluation

LLM provider independence

AI without guardrails is unfinished.

---

# STEP 15

TEST STRATEGY

Before implementation define:

Unit tests

Integration tests

E2E tests

Failure tests

Concurrency tests

Security tests

Performance tests

Observability verification

Testing begins during design.

Not after coding.

---

# STEP 16

DEPLOYMENT

Document

Migration strategy

Rollback strategy

Feature flags

Backward compatibility

Monitoring plan

Success metrics

Deployment is part of the design.

---

# DESIGN REVIEW CHECKLIST

Every proposal must answer:

□ What business problem exists?

□ What assumptions exist?

□ What evidence exists?

□ What entities exist?

□ What states exist?

□ What events exist?

□ What failures exist?

□ What security risks exist?

□ How will this be tested?

□ How will this be monitored?

□ How will this evolve?

If any answer is missing,

the proposal is incomplete.

---

# DESIGN DOCUMENT TEMPLATE

Every feature should produce a design document.

Minimum sections

Problem

Business Context

Objectives

Non Objectives

Requirements

Entities

State Machine

Sequence Flow

Architecture

Data Model

API

Failure Analysis

Security

Observability

Testing

Deployment

Open Questions

Decision

ADR Reference

---

# COMMON FAILURE MODES

❌ Designing from the database.

❌ Starting with APIs.

❌ Ignoring failure.

❌ Ignoring concurrency.

❌ Ignoring rollback.

❌ Ignoring observability.

❌ Mixing business rules with implementation.

❌ Designing around frameworks.

❌ Optimizing too early.

---

# REAL WORLD EXAMPLES

Stripe

Every payment flow is designed assuming retries.

Nothing assumes a request executes only once.

Amazon

Every distributed service assumes eventual failure.

Recovery is part of the design.

Cloudflare

Every system is observable.

If engineers cannot explain production behavior,

the system is incomplete.

Linear

Every feature begins as a design discussion before implementation.

Architecture evolves deliberately.

---

# AI SELF REVIEW

Before recommending any implementation,

every AI should internally verify:

Business understanding

★★★★★

Data model

★★★★★

Failure handling

★★★★★

Security

★★★★★

Observability

★★★★★

Maintainability

★★★★★

Operational cost

★★★★★

Future evolution

★★★★★

If any category scores poorly,

continue refining the design.

---

# CTO PRINCIPLE

Good engineers solve problems.

Great engineers eliminate future problems before they exist.

That is the purpose of system design.

---

# IF YOU REMEMBER ONLY THREE THINGS

1.

Never design from technology.

Design from business.

2.

Every system eventually fails.

Design for recovery.

3.

Every line of code should already exist mentally before it exists physically.

---

# RELATED DOCUMENTS

08_ARCHITECTURE_PRINCIPLES.md

10_CODING_STANDARD.md

11_BACKEND_GUIDELINES.md

12_DATABASE_STANDARDS.md

ADR-001_SYSTEM_DESIGN.md

---

End of Book 09.