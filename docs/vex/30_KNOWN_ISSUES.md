30_KNOWN_ISSUES.md
# THE VEX OPERATING SYSTEM

# KNOWN ISSUES

Version: 1.0

Status: Living Document

Owner: Engineering

Last Updated: 2026-07-21

---

> "Never debug the same problem twice."

---

# PURPOSE

This document is the authoritative registry of all known issues affecting the VEX platform.

Its purpose is to prevent duplicate investigations.

Every confirmed bug.

Every known limitation.

Every temporary workaround.

Every operational caveat.

Should be documented here.

This document is continuously updated.

---

# PHILOSOPHY

Software evolves.

Bugs happen.

Repeated investigation is waste.

Knowledge is permanent.

Engineering time is limited.

Every solved problem should reduce future effort.

---

# WHEN TO ADD AN ISSUE

Create an entry whenever:

A bug is confirmed.

A limitation is discovered.

An external dependency is unreliable.

A workaround exists.

A production incident reveals a recurring pattern.

An infrastructure issue becomes known.

If engineers may encounter the same problem again,

document it.

---

# WHEN NOT TO USE THIS DOCUMENT

Do NOT use this document for:

Ideas.

Feature requests.

Architecture decisions.

Temporary hypotheses.

Meeting notes.

Git history.

Unconfirmed suspicions.

Only confirmed issues belong here.

---

# ISSUE TEMPLATE

Each issue follows the same structure.

Issue ID

Title

Category

Severity

Status

Environment

Date Discovered

Reported By

Owner

Description

Symptoms

Root Cause

Impact

Affected Components

Workaround

Permanent Fix

Validation Steps

Related ADR

Related Runbook

Related Incident

Notes

Consistency is mandatory.

---

# ISSUE CATEGORIES

Application

Infrastructure

Database

Authentication

Authorization

WhatsApp

AI

Supabase

Vercel

Performance

Security

Deployment

Monitoring

User Interface

API

Data Integrity

External Dependency

Other

---

# SEVERITY

Critical

Blocks production.

---

High

Major functionality affected.

---

Medium

Feature degraded.

---

Low

Minor inconvenience.

---

Informational

Known limitation.

No immediate action required.

---

# STATUS

Open

Investigating

Workaround Available

Fix In Progress

Awaiting Validation

Resolved

Won't Fix

Archived

Issues are never deleted.

Only archived.

---

# EXAMPLE ISSUE

Issue ID

KI-0001

Title

Meta Cloud API Sandbox Blocks Message Delivery

Category

WhatsApp

Severity

Critical

Status

Resolved

Environment

Production

Description

Messages cannot be delivered when using Meta Sandbox Phone Number ID.

Symptoms

Outgoing messages fail.

No delivery.

Meta returns authorization errors.

Root Cause

Sandbox Phone Number ID configured.

Impact

100% delivery failure.

Workaround

Register production Cloud API number.

Permanent Fix

Update Phone Number ID.

Update Store configuration.

Validation

Send test message.

Confirm delivery.

Related Runbook

WhatsApp Setup

---

# ROOT CAUSE ANALYSIS

Every issue should explain:

Why it happened.

Not only what happened.

Fixing symptoms without understanding causes creates recurring incidents.

---

# WORKAROUNDS

Temporary solutions should be documented.

Every workaround must include:

Purpose.

Limitations.

Risks.

Removal conditions.

Temporary fixes should never become permanent by accident.

---

# PERMANENT FIXES

Whenever possible document:

Code changes.

Infrastructure changes.

Migration required.

Configuration updates.

Validation procedure.

Rollback strategy.

---

# SEARCHABILITY

Issue IDs follow:

KI-0001

KI-0002

KI-0003

...

Titles should be concise.

Search should always be easy.

---

# COMMON ANTI-PATTERNS

❌ Solving without documenting.

❌ Deleting resolved issues.

❌ Recording assumptions as facts.

❌ Missing workaround.

❌ Missing root cause.

❌ Missing validation.

❌ Multiple documents describing the same issue.

---

# MONTHLY REVIEW

Once every month:

Archive obsolete issues.

Verify workarounds.

Remove resolved temporary notes.

Review recurring problems.

Identify patterns.

Recurring issues often reveal architectural improvements.

---

# AI GUIDANCE

Before debugging:

Read this document.

Search for similar symptoms.

Reuse existing knowledge.

Avoid duplicate investigations.

If an issue is new,

document it immediately after confirmation.

Every resolved bug strengthens the project.

---

# CURRENT KNOWN ISSUES

This section contains active issues only. Populated 2026-07-20 from CLAUDE.md audit — see 27_PROJECT_STATUS.md ACTIVE BLOCKERS (B001-B005) for the operational-config items; this section covers the underlying technical issues.

---

Issue ID

KI-0002

Title

WhatsApp Sends Fail in Production — Phone Number ID Points at Meta Sandbox

Category

WhatsApp

Severity

Critical

Status

Open

Description

`WHATSAPP_PHONE_NUMBER_ID` env var is set to the Meta sandbox number (`1150232648165177`), not the real Speed Motos number (`1233441783176942`, which is `ON_PREMISE` and incompatible with Cloud API as-is).

Impact

Follow-up automation and lead reactivation sends fail in production.

Workaround

None — reads/writes to DB still work, only outbound WhatsApp send fails (non-fatal per pipeline design, `ok_send_failed` status).

Permanent Fix

Register a Cloud API-compatible number for Speed Motos in Meta Business Manager, update `WHATSAPP_PHONE_NUMBER_ID` on Vercel.

Related

27_PROJECT_STATUS.md B001

---

Issue ID

KI-0003

Title

CRON_SECRET Absent in Production — daily-run Accepts Any Bearer Token

Category

Security

Severity

High

Status

Resolved (2026-07-21)

Description

`/api/internal/daily-run` GET handler accepts any Bearer token when `CRON_SECRET` is unset in the environment (commit a06035c). This was a deliberate compatibility fallback for Vercel Cron GET requests, not a fix for the missing secret itself.

Impact

Endpoint had no real authentication until the secret was set.

Permanent Fix

`CRON_SECRET` confirmed set in Vercel production + preview env (verified via `vercel env ls production`, present ~40 days prior to verification). Fallback path in `route.ts:47-52` only triggers when the var is absent — no longer reachable in production.

Validation

Verified 2026-07-21: `vercel env ls production` shows `CRON_SECRET` as Encrypted / Production, Preview.

Related

27_PROJECT_STATUS.md B003

---

(Update continuously.)

---

# ISSUE HISTORY

Resolved issues remain documented.

History prevents repeated mistakes.

Never erase engineering knowledge.

---

# RELATED DOCUMENTS

17_INCIDENT_RESPONSE.md

23_RUNBOOKS_STANDARD.md

24_KNOWLEDGE_MANAGEMENT.md

27_PROJECT_STATUS.md

29_DECISIONS_LOG.md

31_RELEASE_NOTES.md

34_AI_MEMORY.md

---

# FINAL PRINCIPLE

A solved problem has value only if the solution can be reused.

Knowledge turns bugs into permanent organizational learning.

---

End of KNOWN ISSUES.