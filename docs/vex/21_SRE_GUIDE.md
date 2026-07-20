21_SRE_GUIDE.md
# THE VEX OPERATING SYSTEM

# Volume III — Operations

# Book 21

# SITE RELIABILITY ENGINEERING (SRE)

Version: 1.0

Status: Critical

Authority: Absolute

---

> **TOOLING NOTE (2026-07-20):** `gstack:canary` and `gstack:benchmark` cover live monitoring and performance regression detection with real tooling (browse daemon, screenshots, Core Web Vitals). Prefer those over the prose checklists below for anything actionable.

Depends on:

16_OBSERVABILITY.md

17_SECURITY.md

18_DEPLOYMENT.md

19_OPERATIONS.md

20_INCIDENT_RESPONSE.md

---

> "Reliability is not measured by uptime.
It is measured by predictable customer experience."

---

# PURPOSE

This document defines how VEX maintains reliability as the platform grows.

Engineering builds features.

SRE ensures customers can trust them.

Reliability is a product feature.

---

# SRE PHILOSOPHY

Reliability is designed.

It is never accidental.

Every engineering decision must consider:

Availability

Latency

Scalability

Recoverability

Operational simplicity

Customer impact

---

# CORE OBJECTIVES

The SRE team (or acting engineer) has five priorities:

Maintain production availability.

Reduce operational risk.

Automate repetitive work.

Increase deployment confidence.

Improve recovery speed.

---

# SERVICE LEVEL INDICATORS (SLIs)

Every critical service must expose measurable indicators.

Examples:

API latency

Webhook processing time

AI response time

WhatsApp delivery success

Cron execution success

Database query latency

Error rate

Queue processing time

SLIs describe reality.

---

# SERVICE LEVEL OBJECTIVES (SLOs)

Targets define acceptable reliability.

Initial VEX objectives:

API availability:
99.9%

Webhook success:
99.9%

AI response success:
99%

WhatsApp delivery:
99%

Cron execution:
99.5%

Dashboard availability:
99.9%

These numbers evolve over time.

---

# SERVICE LEVEL AGREEMENTS (SLAs)

SLAs are promises made to customers.

Internal SLOs should always be stricter than public SLAs.

Never promise more than engineering can consistently deliver.

---

# ERROR BUDGET

Perfection is impossible.

Every service receives an acceptable failure budget.

Example:

99.9% uptime

↓

0.1% acceptable failure.

If the error budget is exhausted:

Feature releases slow down.

Reliability improvements become priority.

Stability always wins.

---

# LATENCY BUDGET

Customer experience depends on response time.

Targets:

UI interaction:
<200ms

Server Action:
<1s

Webhook processing:
<5s

AI generation:
<8s

WhatsApp send:
<5s

Long operations require asynchronous execution.

---

# AVAILABILITY

Critical services should tolerate failures.

Single points of failure should be eliminated whenever practical.

Examples:

Retry logic

Timeouts

Circuit breakers

Graceful degradation

Fallbacks

---

# CAPACITY PLANNING

Growth must be predictable.

Monitor:

Requests/day

Messages/day

LLM tokens/day

Database growth

Storage usage

Cron duration

Concurrent users

Capacity planning prevents emergency scaling.

---

# RELIABILITY ENGINEERING

Reliability improvements should prioritize:

Automation

Observability

Simplification

Isolation

Recovery

Complexity reduces reliability.

---

# FAILURE DOMAINS

Separate failures whenever possible.

Examples:

Database

AI Provider

WhatsApp

Authentication

Storage

Deployments

One failure should not destroy the entire platform.

---

# RETRY STRATEGY

Retries must be:

Limited

Exponential

Observable

Idempotent

Infinite retries are bugs.

---

# CIRCUIT BREAKERS

External providers can fail.

Circuit breakers prevent cascading failures.

When repeated failures occur:

Open circuit.

Pause requests.

Recover gradually.

Protect the platform.

---

# GRACEFUL DEGRADATION

If one dependency fails:

Keep the remaining platform usable.

Examples:

AI unavailable

↓

Dashboard still works.

Meta unavailable

↓

CRM still works.

Partial functionality is better than total outage.

---

# CHANGE SAFETY

Every production change should be:

Small

Observable

Reversible

Validated

Frequent small deployments reduce operational risk.

---

# AUTOMATION

Reliability depends on automation.

Automate:

Health checks

Recovery

Deploy validation

Backups

Monitoring

Scaling alerts

Incident creation

---

# TOIL REDUCTION

Manual repetitive work is called toil.

Toil should continuously decrease.

Examples:

Manual deploys

Manual recovery

Manual monitoring

Manual cleanup

Manual reporting

If repeated, automate it.

---

# RELIABILITY REVIEWS

Every month review:

Availability

Latency

Incidents

Error budgets

Deployment success

Customer complaints

Recovery metrics

Operational debt

Continuous improvement is mandatory.

---

# COMMON ANTI-PATTERNS

❌ Deploying without monitoring.

❌ Infinite retries.

❌ Large production releases.

❌ Ignoring latency.

❌ Manual operational work forever.

❌ No capacity planning.

❌ Measuring uptime only.

❌ Depending on one provider.

❌ No rollback strategy.

❌ Treating reliability as optional.

---

# SRE CHECKLIST

Every week verify:

□ SLO compliance.

□ Error budget.

□ Latency.

□ Failed deployments.

□ Recovery metrics.

□ Capacity growth.

□ External provider health.

□ Automation opportunities.

□ Operational toil.

□ Infrastructure costs.

---

# CTO PRINCIPLE

Customers remember downtime.

Not architecture.

Reliability is one of the most valuable features a SaaS can have.

---

# IF YOU REMEMBER ONLY THREE THINGS

1.

Measure reliability.

2.

Automate reliability.

3.

Protect reliability before building new features.

---

# RELATED DOCUMENTS

16_OBSERVABILITY.md

17_SECURITY.md

18_DEPLOYMENT.md

19_OPERATIONS.md

20_INCIDENT_RESPONSE.md

22_ARCHITECTURE_DECISION_RECORDS.md

RUNBOOKS/

---

End of Book 21.