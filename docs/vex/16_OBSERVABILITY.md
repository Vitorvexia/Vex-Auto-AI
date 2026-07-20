16_OBSERVABILITY.md
# THE VEX OPERATING SYSTEM

# Volume II — Engineering

# Book 16

# OBSERVABILITY

Version: 1.0

Status: Critical

Authority: Extremely High

Depends on:

08_ARCHITECTURE_PRINCIPLES.md

09_SYSTEM_DESIGN.md

11_BACKEND_GUIDELINES.md

14_AI_ENGINEERING.md

15_TESTING_STANDARD.md

---

> "You cannot improve what you cannot observe."

---

# PURPOSE

This document defines how VEX monitors itself in production.

Observability is not debugging.

Observability allows engineers to understand:

What happened.

Why it happened.

What is happening now.

What will probably happen next.

A production system without observability is blind.

---

# THE THREE PILLARS

Every production service should expose:

Logs

Metrics

Traces

These three pillars complement each other.

Logs explain.

Metrics summarize.

Traces connect.

---

# LOGGING PHILOSOPHY

Logs exist for engineers.

Not for users.

Every log should answer at least one future investigation.

If nobody will ever read it,

do not create it.

---

# STRUCTURED LOGGING

Never log plain text when structured data is possible.

Prefer:

event

timestamp

request_id

store_id

lead_id

conversation_id

duration_ms

status

error

source

Structured logs are machine-readable.

---

# LOG LEVELS

DEBUG

Development only.

Never enabled permanently in production.

INFO

Normal business events.

WARN

Unexpected but recoverable situations.

ERROR

Failures requiring investigation.

FATAL

System cannot continue.

Choose the lowest appropriate level.

---

# WHAT TO LOG

Authentication

Authorization

Webhook events

AI execution

WhatsApp delivery

Cron execution

Retries

Database failures

External API failures

Security events

Critical business actions

Never log everything.

Log what matters.

---

# WHAT MUST NEVER BE LOGGED

Passwords

Access tokens

Refresh tokens

API secrets

Credit card data

PII without masking

Internal secrets

Private prompts

Sensitive environment variables

If in doubt,

do not log it.

---

# CORRELATION IDs

Every request receives a unique request_id.

Every asynchronous workflow propagates it.

A single business operation should be traceable across:

Frontend

Backend

Database

Cron

Queues

External APIs

One identifier.

One story.

---

# METRICS

Metrics describe health.

Examples:

Requests per minute

Success rate

Error rate

Average latency

P95 latency

P99 latency

Webhook throughput

AI response time

WhatsApp delivery success

Cron duration

Database query time

Business metrics and technical metrics are equally important.

---

# ALERTING

Alerts should notify engineers only when action is required.

Avoid noisy alerts.

Every alert must answer:

What happened?

Who should respond?

How urgent is it?

False alerts destroy trust.

---

# DISTRIBUTED TRACING

Every distributed workflow should be traceable.

Example:

Webhook

↓

AI Pipeline

↓

Database

↓

WhatsApp

↓

Lead Score

↓

Dashboard

One trace.

Complete visibility.

---

# ERROR REPORTING

Every production error should capture:

Timestamp

Environment

Stack trace

Context

Correlation ID

Affected user

Affected store

Recovery status

Never lose failure context.

---

# BUSINESS EVENTS

Observability is not only technical.

Track business events:

Lead created

Conversation started

Vehicle sold

Follow-up sent

Lead reactivated

AI handoff

Margin violation

Business visibility is engineering visibility.

---

# DASHBOARDS

Every important metric must have a dashboard.

Operational dashboard

Business dashboard

Infrastructure dashboard

Security dashboard

No hidden information.

---

# RETENTION

Retention policies must balance:

Cost

Compliance

Debugging needs

Historical analysis

Delete what is no longer necessary.

---

# PRIVACY

Logs are production data.

Protect them.

Encrypt when necessary.

Restrict access.

Audit access.

Never expose customer information unnecessarily.

---

# INCIDENT RESPONSE

Every incident should produce:

Timeline

Root cause

Impact

Resolution

Lessons learned

Action items

Incidents become documentation.

---

# SLOW OPERATIONS

Measure all operations above acceptable latency.

Examples:

Database > 300ms

External API > 2s

AI > 8s

Cron > expected duration

Slow systems eventually become broken systems.

---

# OBSERVABILITY REVIEW

Every new feature must answer:

What will be logged?

What metrics exist?

How will failures be detected?

How will engineers investigate problems?

How will success be measured?

If these questions have no answer,

the feature is incomplete.

---

# COMMON ANTI-PATTERNS

❌ Logging secrets.

❌ Logging everything.

❌ Missing correlation IDs.

❌ Silent failures.

❌ No latency metrics.

❌ No business metrics.

❌ Alert fatigue.

❌ Manual production debugging.

❌ Depending on users to report failures.

---

# CTO PRINCIPLE

A healthy system explains itself.

Engineers should discover problems before customers do.

---

# IF YOU REMEMBER ONLY THREE THINGS

1.

Logs explain.

Metrics measure.

Traces connect.

2.

Every production failure should leave evidence.

3.

Observability is part of the product,

not an optional tool.

---

# RELATED DOCUMENTS

11_BACKEND_GUIDELINES.md

14_AI_ENGINEERING.md

15_TESTING_STANDARD.md

17_SECURITY.md

18_DEPLOYMENT.md

INCIDENT_PLAYBOOK.md

---

End of Book 16.