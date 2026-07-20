15_TESTING_STANDARD.md
# THE VEX OPERATING SYSTEM

# Volume II — Engineering

# Book 15

# TESTING STANDARD

Version: 1.0

Status: Critical

Authority: Extremely High

Depends on:

00_CONSTITUTION.md

08_ARCHITECTURE_PRINCIPLES.md

09_SYSTEM_DESIGN.md

10_CODING_STANDARD.md

11_BACKEND_GUIDELINES.md

12_DATABASE_STANDARDS.md

13_FRONTEND_GUIDELINES.md

14_AI_ENGINEERING.md

---

> "If it cannot be tested, it cannot be trusted."

---

# PURPOSE

This document defines how software quality is verified inside VEX.

Testing is not a final phase.

Testing is part of engineering.

Every feature must be designed to be testable before it is implemented.

---

# QUALITY PHILOSOPHY

Testing does not prove the absence of bugs.

Testing increases confidence.

Confidence allows faster evolution.

The objective is not perfection.

The objective is controlled risk.

---

# THE TEST PYRAMID

Testing follows this priority.

1.

Unit Tests

↓

2.

Integration Tests

↓

3.

End-to-End Tests

↓

4.

Manual Validation

The lower the level,

the more tests should exist.

---

# UNIT TESTS

Unit tests validate isolated behavior.

Characteristics:

Fast

Deterministic

Independent

Repeatable

No external services.

No network.

No database.

No filesystem.

A unit test should execute in milliseconds.

---

# INTEGRATION TESTS

Integration tests verify collaboration.

Examples:

API + Database

Server Actions + Supabase

Webhook + Persistence

AI Pipeline + Queue

Focus on interfaces.

Not implementation.

---

# END-TO-END TESTS

E2E tests validate complete business flows.

Example:

Lead arrives

↓

Conversation created

↓

AI responds

↓

Message persisted

↓

Lead score updated

↓

Dashboard updated

The objective is validating value,

not functions.

---

# MANUAL VALIDATION

Some scenarios require human verification.

Examples:

WhatsApp delivery

Mobile responsiveness

Accessibility

Animation quality

Visual regressions

Production deployment

Manual testing complements automation.

It never replaces it.

---

# WHAT TO TEST

Business Rules

Authorization

Authentication

Calculations

Status transitions

Failure recovery

Retries

Validation

Security

Observability

Concurrency

Race conditions

Permissions

Critical workflows

Never prioritize line coverage.

Prioritize business risk.

---

# WHAT NOT TO TEST

Framework behavior.

React internals.

Next.js internals.

Supabase internals.

Third-party libraries.

Only test code you own.

---

# TEST DESIGN

Every test should answer one question.

Examples:

Can a lead be closed below minimum margin?

No.

Can AI respond after human handoff?

No.

Can duplicate webhooks create duplicate messages?

No.

One question.

One expectation.

---

# TEST NAMING

Tests describe behavior.

Good:

should_prevent_margin_violation()

should_ignore_duplicate_webhook()

should_assign_conversation()

Bad:

test1()

handler_test()

pipeline_test()

Names explain intent.

---

# DETERMINISM

Tests must always produce the same result.

Never depend on:

Current time

Random values

Internet

External APIs

Timezone

Environment

Control everything.

---

# MOCKING

Mock only external dependencies.

Never mock business rules.

Mock:

Anthropic

Meta

Email

Storage

Payment

Do not mock:

Scoring

Guardrails

Validation

Permissions

Domain logic

---

# TEST DATA

Use realistic data.

Fake names.

Realistic prices.

Realistic vehicles.

Realistic conversations.

Avoid meaningless values.

Good data improves confidence.

---

# FAILURE TESTING

Every critical feature needs failure tests.

Database unavailable.

Timeout.

401.

403.

404.

429.

500.

Network interruption.

Unexpected payload.

Graceful degradation is mandatory.

---

# CONCURRENCY

Critical workflows require concurrency tests.

Webhook duplicates.

Parallel updates.

Retry jobs.

Cron execution.

Locks.

Idempotency.

Concurrency bugs are production bugs.

---

# PERFORMANCE TESTING

Measure:

Latency

Memory

CPU

Database queries

Rendering

Bundle size

Optimize only after measuring.

---

# REGRESSION TESTING

Every bug fixed should produce a new test.

A bug without a regression test will eventually return.

---

# CODE COVERAGE

Coverage is an indicator.

Not an objective.

90% useless coverage is worse than

70% meaningful coverage.

Test behavior.

Not implementation.

---

# TEST REVIEW

Every Pull Request should verify:

□ New behavior tested.

□ Existing tests still valid.

□ Failure scenarios covered.

□ Edge cases evaluated.

□ Naming clear.

□ Fast execution.

□ Deterministic.

□ No duplicated tests.

---

# CONTINUOUS INTEGRATION

Every commit must pass:

Typecheck

Lint

Unit Tests

Integration Tests

Build

No exceptions.

Broken main branch is unacceptable.

---

# PRODUCTION VALIDATION

Deployment is not the end.

Verify:

Logs

Metrics

Health

Alerts

Business flow

User experience

Production is the final environment.

---

# TEST ANTI-PATTERNS

❌ Testing implementation details.

❌ Sleeping with timeouts.

❌ Ignoring failures.

❌ Huge tests validating everything.

❌ Shared mutable state.

❌ Hidden dependencies.

❌ Random inputs.

❌ Network calls.

❌ Fake success paths only.

---

# CTO PRINCIPLE

Tests are engineering documentation.

A future engineer should understand the system by reading its tests.

---

# IF YOU REMEMBER ONLY THREE THINGS

1.

Test business value.

Not code.

2.

Every bug deserves a regression test.

3.

Confidence is the true deliverable.

---

# RELATED DOCUMENTS

10_CODING_STANDARD.md

11_BACKEND_GUIDELINES.md

14_AI_ENGINEERING.md

16_OBSERVABILITY.md

17_SECURITY.md

TESTING_PLAYBOOK.md

---

End of Book 15.