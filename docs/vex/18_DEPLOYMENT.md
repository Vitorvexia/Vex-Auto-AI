18_DEPLOYMENT.md
# THE VEX OPERATING SYSTEM

# Volume II — Engineering

# Book 18

# DEPLOYMENT

Version: 1.0

Status: Critical

Authority: Absolute

---

> **TOOLING NOTE (2026-07-20):** `gstack:land-and-deploy` and `gstack:setup-deploy` are the actual executable deployment pipeline for this repo. Prefer invoking those. Read this chapter only for VEX-specific deployment rules (WhatsApp/Meta token rotation, migration ordering) not covered by gstack.

Depends on:

08_ARCHITECTURE_PRINCIPLES.md

09_SYSTEM_DESIGN.md

10_CODING_STANDARD.md

15_TESTING_STANDARD.md

16_OBSERVABILITY.md

17_SECURITY.md

---

> "Deployment is not the moment we hope everything works.
Deployment is the moment we prove it."

---

# PURPOSE

This document defines how software reaches production inside VEX.

Deployment is an engineering process.

Never an improvisation.

Every release must be:

Repeatable

Observable

Reversible

Auditable

Safe

---

# RELEASE PHILOSOPHY

A release is successful only when:

The deployment finishes.

The system remains healthy.

Users remain unaffected.

Business continues normally.

Deploying code is not the objective.

Delivering value safely is.

---

# ENVIRONMENTS

Every environment has a purpose.

Development

Experimentation.

Staging

Production simulation.

Production

Real users.

Never confuse responsibilities.

Production is never a testing environment.

---

# ENVIRONMENT PARITY

Development should resemble production whenever practical.

Configuration.

Dependencies.

Database version.

Runtime.

Feature flags.

Reducing environmental differences reduces production failures.

---

# CONFIGURATION

Configuration belongs outside code.

Examples:

Environment variables

Secrets

Feature flags

External endpoints

Never hardcode environment-specific values.

---

# BRANCH STRATEGY

Main

Always deployable.

Develop

Integration branch (optional).

Feature branches

Small.

Focused.

Short-lived.

Long-lived branches increase merge complexity.

---

# CONTINUOUS INTEGRATION

Every commit must execute:

Typecheck

Lint

Unit Tests

Integration Tests

Build

Security checks

A failing pipeline blocks merging.

---

# DEPLOYMENT GATES

A deployment cannot proceed unless:

All CI checks pass.

Critical alerts are resolved.

Migration plan reviewed.

Rollback plan prepared.

Required approvals completed.

Deployment readiness is mandatory.

---

# DATABASE MIGRATIONS

Migrations must be:

Versioned.

Reviewed.

Reversible whenever possible.

Idempotent when appropriate.

Backward compatible during rollout.

Never modify production manually unless explicitly approved.

---

# FEATURE FLAGS

Large changes should be released behind feature flags.

Feature flags reduce deployment risk.

Deployment and feature release are different events.

---

# ZERO-DOWNTIME

Whenever practical:

Avoid downtime.

Prefer:

Backward-compatible migrations.

Rolling deployments.

Graceful shutdowns.

Progressive activation.

Users should not notice deployments.

---

# ROLLBACK

Every deployment must have a rollback strategy.

Questions:

Can code be reverted?

Can database changes be reverted?

Can feature flags disable the change?

Can traffic be redirected?

Rollback planning happens before deployment.

---

# DEPLOYMENT CHECKLIST

Before deployment:

□ CI passing.

□ Tests green.

□ Database migration reviewed.

□ Feature flags configured.

□ Monitoring enabled.

□ Alerts active.

□ Rollback documented.

□ Release notes prepared.

If any item is incomplete,

deployment waits.

---

# POST-DEPLOY VALIDATION

Immediately after deployment verify:

Health endpoints.

Application logs.

Error rate.

Latency.

Critical business flows.

Authentication.

AI pipeline.

WhatsApp integration.

Dashboard metrics.

Production validation is mandatory.

---

# CANARY RELEASES

High-risk features should be released gradually.

Small percentage.

Observe.

Expand.

If instability appears,

stop.

Safety before speed.

---

# INCIDENT RESPONSE

If deployment causes issues:

Stop rollout.

Assess impact.

Rollback if necessary.

Communicate clearly.

Document lessons learned.

Never hide deployment failures.

---

# RELEASE NOTES

Every deployment produces release notes.

Include:

Features.

Bug fixes.

Breaking changes.

Database migrations.

Operational changes.

Known limitations.

Documentation is part of the release.

---

# VERSIONING

Every release receives a version.

Versions identify:

Code.

Database.

Infrastructure.

Documentation.

Production must always be identifiable.

---

# DEPLOYMENT METRICS

Measure:

Deployment duration.

Rollback frequency.

Deployment success rate.

Change failure rate.

Mean time to recovery.

Frequent deployments with low failure rates indicate engineering maturity.

---

# COMMON ANTI-PATTERNS

❌ Deploying on Friday evening.

❌ Manual production fixes.

❌ Missing rollback.

❌ Skipping tests.

❌ Large releases.

❌ Deploying without monitoring.

❌ Hotfixes without documentation.

❌ Database changes without review.

❌ Environment-specific code.

❌ Production debugging by users.

---

# DEPLOYMENT REVIEW

Every deployment should answer:

Was it safe?

Was it observable?

Was it reversible?

Was it documented?

Could it be repeated?

Continuous improvement applies to deployments too.

---

# CTO PRINCIPLE

The best deployment is the one users never notice.

---

# IF YOU REMEMBER ONLY THREE THINGS

1.

Every deployment must be reversible.

2.

Production is never the testing environment.

3.

Confidence comes from process, not luck.

---

# RELATED DOCUMENTS

15_TESTING_STANDARD.md

16_OBSERVABILITY.md

17_SECURITY.md

19_OPERATIONS.md

20_INCIDENT_RESPONSE.md

CI_CD_GUIDE.md

---

End of Book 18.