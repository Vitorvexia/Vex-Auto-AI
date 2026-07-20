17_SECURITY.md
# THE VEX OPERATING SYSTEM

# Volume II — Engineering

# Book 17

# SECURITY

Version: 1.0

Status: Critical

Authority: Absolute

Depends on:

00_CONSTITUTION.md

03_VALUES.md

08_ARCHITECTURE_PRINCIPLES.md

09_SYSTEM_DESIGN.md

11_BACKEND_GUIDELINES.md

12_DATABASE_STANDARDS.md

14_AI_ENGINEERING.md

16_OBSERVABILITY.md

---

> "Security is not a feature.
It is a property of the entire system."

---

# PURPOSE

This document defines the security principles that govern every component of VEX.

Security is not delegated.

Security is everyone's responsibility.

Every architecture decision, feature, deployment, API, AI workflow and database operation must respect these principles.

---

# SECURITY PHILOSOPHY

The objective is not preventing every attack.

The objective is minimizing impact.

Assume failures.

Assume mistakes.

Assume hostile environments.

Design systems that remain safe even when something goes wrong.

---

# SECURITY PRIORITIES

Security decisions always protect, in this order:

People

↓

Customer Data

↓

Business Operations

↓

Infrastructure

↓

Internal Systems

↓

Convenience

Convenience never overrides security.

---

# ZERO TRUST

Trust nothing.

Validate everything.

Every request.

Every token.

Every permission.

Every external service.

Every internal service.

No component receives implicit trust.

---

# DEFENSE IN DEPTH

Security must exist in multiple independent layers.

Authentication

Authorization

Input Validation

Database Policies

Encryption

Monitoring

Logging

Auditing

If one layer fails,

another continues protecting the system.

---

# LEAST PRIVILEGE

Every identity receives only the permissions required.

Users.

Admins.

APIs.

Cron jobs.

AI agents.

Service accounts.

Temporary elevation is acceptable.

Permanent unnecessary privileges are not.

---

# AUTHENTICATION

Authentication proves identity.

Authentication never grants permissions.

Identity and authorization are separate concerns.

---

# AUTHORIZATION

Every sensitive operation requires authorization.

Authorization must always happen on the server.

Never trust browser permissions.

Never trust hidden buttons.

Never trust client-side checks.

---

# DATABASE SECURITY

Database policies are mandatory.

Every query assumes hostile clients.

RLS protects data.

Application code complements RLS.

Application code never replaces RLS.

---

# MULTI-TENANCY

Every tenant is isolated.

No query may leak data across stores.

Cross-tenant access requires explicit engineering approval.

Isolation failures are critical incidents.

---

# SECRET MANAGEMENT

Secrets must never exist in:

Git

Logs

Screenshots

Documentation

Frontend

Client storage

Secrets belong only in secure secret managers.

Rotate periodically.

Audit regularly.

---

# ENCRYPTION

Encrypt sensitive information:

In transit.

At rest.

In backups.

When sharing externally.

Prefer industry standards.

Never invent cryptography.

---

# INPUT VALIDATION

Every external input is untrusted.

Validate:

Length

Type

Encoding

Range

Ownership

Business rules

Reject invalid input immediately.

---

# OUTPUT ENCODING

Protect every output.

Prevent:

XSS

HTML Injection

Script Injection

Header Injection

Never render untrusted content directly.

---

# API SECURITY

Every endpoint defines:

Authentication

Authorization

Rate limits

Validation

Audit logging

Error handling

Versioning

Public APIs require documentation.

Internal APIs require authentication.

---

# RATE LIMITING

Protect expensive operations.

Examples:

Login

AI generation

WhatsApp sending

Search

File uploads

Administrative endpoints

Rate limiting protects infrastructure.

---

# THIRD-PARTY SERVICES

Every external dependency is considered untrusted.

Examples:

Meta

Anthropic

OpenAI

Stripe

Supabase

Failures must be isolated.

Timeouts are mandatory.

Retries are controlled.

---

# AI SECURITY

AI must never:

Expose secrets.

Bypass authorization.

Leak internal prompts.

Reveal system architecture.

Execute arbitrary commands.

Trust user instructions over system rules.

Prompt injection is a security event.

---

# LOGGING SECURITY

Logs are sensitive assets.

Never log:

Passwords

Tokens

Secrets

Raw personal documents

Private conversations without masking

Logs must support audits,

not create risks.

---

# FILE SECURITY

Validate every upload.

Verify:

File type

Extension

Content

Size

Virus scan (when applicable)

Store securely.

Never execute uploaded files.

---

# SESSION SECURITY

Sessions expire.

Sessions rotate.

Sessions can be revoked.

Inactive sessions should not live indefinitely.

---

# BACKUP SECURITY

Backups must be:

Encrypted

Versioned

Verified

Recoverable

Access controlled

An untested backup is not a backup.

---

# INCIDENT RESPONSE

Every security incident produces:

Timeline

Root cause

Impact analysis

Containment

Recovery

Preventive actions

Security incidents improve the system.

---

# VULNERABILITY MANAGEMENT

Continuously identify:

Dependency vulnerabilities

Configuration drift

Secret exposure

Permission escalation

Infrastructure risks

Fix critical vulnerabilities immediately.

---

# SECURITY REVIEWS

Every feature review must answer:

What data is exposed?

Who can access it?

How is authorization enforced?

How are secrets protected?

Can this be abused?

What happens if it fails?

If these questions remain unanswered,

the feature is incomplete.

---

# COMPLIANCE

Respect applicable regulations.

Examples:

LGPD

GDPR

Data retention policies

Customer deletion requests

Audit requirements

Compliance is engineering.

Not paperwork.

---

# COMMON ANTI-PATTERNS

❌ Trusting frontend validation.

❌ Logging secrets.

❌ Shared admin accounts.

❌ Long-lived tokens.

❌ Missing RLS.

❌ Public internal endpoints.

❌ Hardcoded credentials.

❌ Blind retries.

❌ Ignoring failed authentication.

❌ Skipping authorization because "the UI hides it".

---

# SECURITY CHECKLIST

Before deployment:

□ Authentication verified.

□ Authorization verified.

□ RLS validated.

□ Secrets protected.

□ Logs sanitized.

□ Rate limits configured.

□ Input validated.

□ Output encoded.

□ Monitoring enabled.

□ Incident procedures documented.

---

# CTO PRINCIPLE

Security is measured by resilience,

not by the absence of attacks.

A secure system is one that continues protecting users when things fail.

---

# IF YOU REMEMBER ONLY THREE THINGS

1.

Trust nothing.

Validate everything.

2.

Defense in depth always beats a single perfect layer.

3.

Protect users before protecting software.

---

# RELATED DOCUMENTS

12_DATABASE_STANDARDS.md

14_AI_ENGINEERING.md

16_OBSERVABILITY.md

18_DEPLOYMENT.md

19_OPERATIONS.md

SECURITY_PLAYBOOK.md

---

End of Book 17.