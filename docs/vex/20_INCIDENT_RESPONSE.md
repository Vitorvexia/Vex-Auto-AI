20_INCIDENT_RESPONSE.md
# THE VEX OPERATING SYSTEM

# Volume III — Operations

# Book 20

# INCIDENT RESPONSE

Version: 1.0

Status: Critical

Authority: Absolute

---

> **TOOLING NOTE (2026-07-20):** `gstack:canary` (post-deploy monitoring) and `gstack:investigate` (systematic debugging) are the actual tool-backed mechanisms here. Prefer invoking those. Read this chapter for VEX-specific incident classification/escalation only.

Depends on:

16_OBSERVABILITY.md

17_SECURITY.md

18_DEPLOYMENT.md

19_OPERATIONS.md

---

> "An incident is not a failure of engineering.
Failing to learn from it is."

---

# PURPOSE

This document defines how VEX detects, classifies, responds to, communicates and learns from production incidents.

Incidents are inevitable.

Chaos is optional.

Preparation transforms emergencies into controlled engineering processes.

---

# INCIDENT PHILOSOPHY

The objective is not avoiding every incident.

The objectives are:

Detect quickly.

Contain impact.

Recover safely.

Learn permanently.

Every incident should improve the platform.

---

# WHAT IS AN INCIDENT

An incident is any event that negatively affects:

Availability

Integrity

Security

Performance

Customer experience

Business operations

Financial operations

Infrastructure

Not every bug is an incident.

Not every incident is caused by a bug.

---

# INCIDENT SEVERITY

## SEV-1

Critical.

Platform unavailable.

Customer data exposed.

Massive revenue impact.

Immediate response required.

Target response:

5 minutes.

---

## SEV-2

Major functionality unavailable.

Partial production outage.

Critical integration failure.

Response:

15 minutes.

---

## SEV-3

Limited business impact.

Performance degradation.

Operational inconvenience.

Response:

1 hour.

---

## SEV-4

Minor issue.

Cosmetic.

Documentation.

Internal tooling.

Response during normal work.

---

# INCIDENT LIFECYCLE

Detection

↓

Classification

↓

Containment

↓

Communication

↓

Investigation

↓

Recovery

↓

Validation

↓

Postmortem

↓

Preventive Actions

Every incident follows this lifecycle.

---

# DETECTION

Incidents should preferably be detected by:

Monitoring

Alerts

Health checks

Logs

Metrics

Automated validation

Customers should never be the primary monitoring system.

---

# FIRST RESPONSE

Before changing anything:

Understand.

Stabilize.

Collect evidence.

Avoid panic.

Avoid assumptions.

Never destroy evidence.

---

# CONTAINMENT

First objective:

Stop impact from increasing.

Examples:

Disable feature flag.

Stop cron.

Block endpoint.

Pause AI.

Disable webhook.

Rollback deployment.

Containment comes before root cause.

---

# COMMUNICATION

Communication must be:

Accurate.

Honest.

Frequent.

Transparent.

Unknown information should be stated as unknown.

Never speculate.

---

# INTERNAL COMMUNICATION

Every incident channel should include:

Severity.

Timeline.

Current status.

Owner.

Impact.

Next update.

Clear communication reduces confusion.

---

# CUSTOMER COMMUNICATION

If customers are affected:

Acknowledge.

Explain impact.

Describe current status.

Provide estimated resolution when possible.

Avoid technical jargon.

Trust is more important than perfection.

---

# EVIDENCE COLLECTION

Collect before recovery whenever practical:

Logs.

Metrics.

Traces.

Screenshots.

Requests.

Responses.

Database state.

Configuration.

Evidence disappears quickly.

---

# ROOT CAUSE ANALYSIS

Never stop at symptoms.

Ask repeatedly:

Why?

Until reaching the true system failure.

Root cause is rarely the first explanation.

---

# RECOVERY

Recovery should prioritize:

Customer safety.

Data integrity.

Operational stability.

Speed without control creates new incidents.

---

# VALIDATION

Recovery is complete only after verifying:

Business flows.

Logs.

Metrics.

Alerts.

Customer experience.

Recovery without validation is incomplete.

---

# POSTMORTEM

Every significant incident produces a postmortem.

Include:

Timeline.

Detection.

Impact.

Root cause.

Contributing factors.

Recovery.

Lessons learned.

Preventive actions.

Postmortems improve engineering.

Not blame.

---

# BLAMELESS CULTURE

The objective is understanding.

Not punishment.

Humans make mistakes.

Engineering improves systems.

The system should prevent human errors from becoming customer problems.

---

# ACTION ITEMS

Every incident generates actions.

Actions must be:

Specific.

Assigned.

Prioritized.

Tracked.

Closed.

Untracked lessons are forgotten lessons.

---

# AUTOMATION AFTER INCIDENTS

Whenever possible:

Replace manual recovery.

Examples:

Automatic rollback.

Health verification.

Alerting.

Retry logic.

Circuit breakers.

Self-healing systems.

The best incident is the one automatically resolved.

---

# INCIDENT REVIEW

Monthly engineering review should evaluate:

Incident frequency.

Recovery time.

Detection time.

Repeated failures.

Customer impact.

Operational improvements.

Recurring incidents indicate systemic weaknesses.

---

# COMMON INCIDENTS

Examples:

Meta API outage.

Anthropic timeout.

Supabase unavailable.

Expired tokens.

Database migration failure.

Broken deployment.

Webhook replay.

Rate limiting.

Expired secrets.

Storage outage.

Every common incident should have a runbook.

---

# INCIDENT METRICS

Track continuously:

MTTD

Mean Time To Detect

MTTR

Mean Time To Recover

Incident frequency

Repeated incidents

Customer impact

Recovery success

Engineering quality improves through measurement.

---

# COMMON ANTI-PATTERNS

❌ Panic deployments.

❌ Guessing the cause.

❌ Deleting logs.

❌ Silent incidents.

❌ Blaming individuals.

❌ Recovery without validation.

❌ No documentation.

❌ Repeating identical failures.

❌ Manual recovery forever.

❌ Ignoring small incidents.

---

# INCIDENT RESPONSE CHECKLIST

During every incident verify:

□ Severity assigned.

□ Incident owner defined.

□ Evidence collected.

□ Impact understood.

□ Containment applied.

□ Customers informed if necessary.

□ Recovery validated.

□ Postmortem scheduled.

□ Action items created.

□ Documentation updated.

---

# CTO PRINCIPLE

Every incident is an investment.

Either the system becomes stronger,

or the incident will happen again.

Choose improvement.

---

# IF YOU REMEMBER ONLY THREE THINGS

1.

Contain first.

Investigate second.

2.

Evidence before assumptions.

3.

Every incident must permanently improve the platform.

---

# RELATED DOCUMENTS

16_OBSERVABILITY.md

17_SECURITY.md

18_DEPLOYMENT.md

19_OPERATIONS.md

21_SRE_GUIDE.md

POSTMORTEM_TEMPLATE.md

RUNBOOKS/

---

End of Book 20.