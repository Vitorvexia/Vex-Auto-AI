11_BACKEND_GUIDELINES.md
# THE VEX OPERATING SYSTEM

# Volume II — Engineering

# Book 11

# BACKEND GUIDELINES

Version: 1.0

Status: Critical

Authority: Extremely High

Depends on:

08_ARCHITECTURE_PRINCIPLES.md

09_SYSTEM_DESIGN.md

10_CODING_STANDARD.md

---

> "Backend systems are not judged by what happens when everything works.
They are judged by what happens when everything fails."

---

# PURPOSE

This document defines how every backend service inside VEX must be designed, implemented and maintained.

The backend is the source of truth.

Every business rule belongs here.

Never inside the frontend.

Never inside prompts.

Never inside clients.

---

# THE RESPONSIBILITIES OF THE BACKEND

The backend owns:

Business Rules

State Transitions

Persistence

Authorization

Authentication

Validation

Integrations

Observability

Auditability

Recovery

Nothing else owns these responsibilities.

---

# THE BACKEND PYRAMID

Infrastructure

↓

Framework

↓

Application

↓

Business Rules

Business rules always stay at the top.

Everything else exists only to support them.

---

# BUSINESS LOGIC

Every business rule must have one authoritative implementation.

Never duplicate business logic.

Wrong

Frontend validates margin.

Backend validates margin.

Correct

Backend validates.

Frontend only improves UX.

---

# SERVER ACTIONS

Server Actions should orchestrate.

They should not contain business rules.

Good

validateLead()

transitionLead()

persist()

publishEvent()

Bad

500 lines of business logic.

---

# SERVICES

Complex operations belong in services.

Examples

LeadService

ConversationService

FollowUpService

ReactivationService

VehicleService

AIService

Services encapsulate business behavior.

---

# DOMAIN FIRST

Organize by domain.

Good

/leads

/conversations

/vehicles

/follow-up

/reactivation

Bad

/utils

/helpers

/misc

Domains scale.

Utilities become junk drawers.

---

# IDENTITY

Every request must know:

Who is the user?

Which store?

Which tenant?

Which permissions?

Unknown identity is a defect.

---

# AUTHORIZATION

Authentication identifies.

Authorization allows.

Never confuse them.

Always verify authorization at the backend.

Never trust frontend permissions.

---

# VALIDATION

Validate before processing.

Validate:

IDs

Enums

Numbers

Dates

Ownership

Permissions

Relationships

Business rules

Invalid data must never reach persistence.

---

# STATE TRANSITIONS

State transitions are explicit.

Allowed:

NEW

↓

CONTACTED

↓

NEGOTIATING

↓

CLOSED

Blocked transitions must fail loudly.

---

# TRANSACTIONS

Whenever two business operations must succeed together,

use transactions.

Examples

Sale creation

Inventory update

Conversation ownership

Financial records

Never leave partial state.

---

# IDEMPOTENCY

Every external operation should be safely repeatable.

Webhook retries.

Cron retries.

API retries.

Network retries.

The result should remain identical.

---

# EXTERNAL INTEGRATIONS

External services are unreliable.

Assume:

Timeout

500

429

Network loss

Partial failure

Invalid payload

Expired credentials

Always design recovery.

---

# RETRIES

Retry only transient failures.

Retry:

429

503

Network timeout

Do not retry:

401

403

404

Validation errors

Infinite retries are bugs.

---

# TIMEOUTS

Every external request must define a timeout.

No timeout.

No merge.

---

# CIRCUIT BREAKERS

Repeated failures should temporarily disable integrations.

Protect both:

The external provider.

Our infrastructure.

---

# QUEUES

Slow work belongs in background jobs.

Examples

WhatsApp send

AI generation

Analytics

Notifications

Imports

Never block the user unnecessarily.

---

# WEBHOOKS

Treat every webhook as hostile.

Validate:

Signature

Timestamp

Replay

Schema

Ownership

Process only after validation.

---

# CRON JOBS

Cron jobs must be:

Idempotent

Observable

Interruptible

Recoverable

Retryable

Safe to execute twice.

---

# ERROR HANDLING

Every error belongs to one category.

Validation

Business

Infrastructure

Security

Integration

Unknown

Unknown errors require investigation.

---

# LOGGING

Every backend operation logs:

Operation

Store

Lead

Conversation

Duration

Status

Correlation ID

Error category

Logs are operational tools.

Not debugging tools.

---

# AUDIT TRAIL

Business actions must be traceable.

Who changed it?

When?

From which state?

To which state?

Why?

Audit history is never optional.

---

# EVENTS

Business events describe facts.

Examples

LeadCreated

LeadClosed

ConversationAssigned

MessageReceived

FollowUpSent

Events should be immutable.

---

# CONFIGURATION

Configuration belongs outside the code.

Environment variables.

Feature flags.

Database configuration.

Never magic values.

---

# MULTI-TENANCY

Every query must respect tenant isolation.

Never trust client-side filtering.

Enforce isolation in the backend.

Prefer database enforcement (RLS).

---

# SECURITY

Never expose:

Secrets

Tokens

Internal IDs

Database structure

Infrastructure details

Error stacks

Sanitize everything.

---

# OBSERVABILITY

Every backend feature must expose:

Metrics

Structured logs

Health indicators

Failure reasons

Recovery information

If production cannot explain itself,

the backend is incomplete.

---

# PERFORMANCE

Measure.

Profile.

Optimize.

Never guess.

Database latency matters more than CPU.

Network latency matters more than algorithms.

---

# BACKWARD COMPATIBILITY

Public APIs evolve.

They do not break.

Version when necessary.

Deprecate responsibly.

Communicate changes.

---

# REVIEW CHECKLIST

Before merge:

□ Business rules isolated.

□ Transactions correct.

□ Authorization verified.

□ Validation complete.

□ Logs added.

□ Metrics exposed.

□ Errors categorized.

□ Retry strategy defined.

□ Timeout defined.

□ Idempotency guaranteed.

□ Multi-tenant respected.

□ Tests updated.

---

# THINGS WE NEVER DO

❌ Business logic inside React.

❌ Business logic inside prompts.

❌ Silent failures.

❌ Generic catch blocks.

❌ Retry everything.

❌ Ignore timeouts.

❌ Trust client validation.

❌ Expose internal errors.

❌ Duplicate rules.

---

# CTO PRINCIPLE

Backend systems should continue behaving correctly even when every dependency behaves incorrectly.

Reliability is engineered.

Never assumed.

---

# IF YOU REMEMBER ONLY THREE THINGS

1.

Business rules live in the backend.

2.

Every external dependency will eventually fail.

3.

Correctness is more important than speed.

---

# RELATED DOCUMENTS

09_SYSTEM_DESIGN.md

10_CODING_STANDARD.md

12_DATABASE_STANDARDS.md

14_AI_ENGINEERING.md

15_TESTING_STANDARD.md

---

End of Book 11.