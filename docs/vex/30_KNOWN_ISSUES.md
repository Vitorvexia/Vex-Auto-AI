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

Resolved (code/DB side) 2026-07-27 — pending Vercel env update + manual Meta panel steps (see below)

Description

`WHATSAPP_PHONE_NUMBER_ID` env var was set to the Meta sandbox number (`1150232648165177`), not the real Speed Motos number. Note: the DB column `stores.whatsapp_phone_number_id` had also drifted independently — as of 2026-07-27 it held `2365906556789250` (an intermediate value from the 2026-07-23 WABA setup attempt), which matched neither the sandbox nor the previously-documented `ON_PREMISE` number (`1233441783176942`). Docs had not tracked that drift.

2026-07-27 update: Speed Motos registered a real Cloud API number today, out of sandbox.

- WABA ID: `28099462022990346`
- Phone Number ID: `1238597592667311`
- Number: `+5532998366528`
- Meta status: display name "Em análise", quality "Pendente"

`stores.whatsapp_phone_number_id` and `stores.whatsapp_numero` updated in production DB to match (2026-07-27). `.env.local` `WHATSAPP_PHONE_NUMBER_ID` updated to `1238597592667311`.

Impact

Follow-up automation and lead reactivation sends were failing in production while pointed at sandbox/stale values. Resolved for the code/DB path; production send still blocked until Vercel env vars (`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`) are updated and the app redeployed, and until Meta clears the "Em análise"/"Pendente" status.

Workaround

None — reads/writes to DB still work, only outbound WhatsApp send fails (non-fatal per pipeline design, `ok_send_failed` status) until the Vercel-side steps below land.

Permanent Fix

Remaining steps (manual, outside code):
1. Update `WHATSAPP_PHONE_NUMBER_ID` on Vercel (Production + Preview) to `1238597592667311`
2. Generate new System User token scoped to the new WABA (`28099462022990346`), update `WHATSAPP_ACCESS_TOKEN` on Vercel
3. Redeploy
4. Confirm webhook Callback URL in Meta for Developers points at the production Vercel URL, and the `messages` field is subscribed
5. WABA ID has no column in `stores` yet — tracked in `28_BACKLOG.md` as a follow-up for template-sending work, not required for basic send/receive

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

Issue ID

KI-0004

Title

`tests/integration/realtime-isolation.test.ts` RT-2a Intermittently Fails on Channel Setup (Test Harness Only — Not a Product Bug)

Category

Application

Severity

Low

Status

Won't Fix (documented, accepted)

Environment

Test (`test:integration`, real Supabase — never runs in the Husky pre-push hook, see `27_PROJECT_STATUS.md` Quality Metrics)

Date Discovered

2026-07-27, during item 0.8 (Inbox em tempo real) review

Reported By

User review of the 0.8 PR — flagged the flake and asked for root-cause investigation before considering 0.8 closed

Owner

Engineering

Description

`RT-2a` (userA subscribes to a channel for a conversation belonging to storeB, asserting no cross-store event arrives) intermittently times out at the `waitForSubscribed` step (~18% of runs across 22 observed executions) with "timeout esperando status SUBSCRIBED do canal". `RT-1` and `RT-2b` — structurally identical assertions, different client instances — never failed once in the same 22 runs.

Symptoms

Channel opened via `subscribeToConversationMessages(userA.client, ...)` in `RT-2a` occasionally never reaches `SUBSCRIBED` within an 8-15s budget. Always the same test (`RT-2a`), never `RT-1` or `RT-2b`.

Root Cause

Investigated hypothesis (raised by user): does `app/components/ConversationMessages.tsx` have the same race in production — unsubscribe channel A, subscribe channel B in quick succession when the vendor switches conversations, causing the new channel to intermittently stay mute?

Confirmed NOT applicable to production. `ConversationMessages.tsx` calls `createSupabaseBrowserClient()` fresh inside the `useEffect` body on every `conversationId` change — each conversation switch gets its own `SupabaseClient` instance, and therefore its own independent Realtime WebSocket (confirmed by reading the installed `@supabase/supabase-js` 2.103.0 source: `RealtimeClient.removeChannel()` calls `this.disconnect()` once `channels.length === 0`, so the old socket is torn down cleanly and never shared with the new one).

`RT-2a`'s flakiness is a test-harness artifact: it reuses the SAME `userA.client` (and therefore the same underlying socket) that `RT-1` just used and unsubscribed from moments earlier in the same test file — a pattern the production component never exercises. Rapid resubscribe on a socket that just tore down a channel is the actual trigger, not RLS, not the app's subscribe/unsubscribe ordering.

Added `tests/unit/conversation-messages.test.ts` (5 tests, mock-based, zero network, stable across 5 consecutive runs) to lock in the real invariant: every `conversationId` change gets a fresh client/socket, the old one's channel is torn down (`removeChannel` called exactly once), and nothing leaks on unmount — including a same-task zero-yield triple-switch case, where the component's own `cancelled` guard correctly prevents an intermediate conversation from ever opening a channel it would immediately have to tear down.

Impact

None on production. `test:integration` is never part of the push-blocking path (`npm run test` — see `27_PROJECT_STATUS.md`), so this flake cannot block a push or a deploy. Only affects whoever runs `test:integration`/`test:all` deliberately and happens to hit the ~18% window on `RT-2a` specifically.

Workaround

Re-run `npm run test:integration` (or just the one file) — RT-2a passing on retry confirms it's the known harness flake, not a regression. If `RT-1` or `RT-2b` ever fail, that IS a signal worth investigating — those two have never flaked.

Permanent Fix

Not planned — fixing it would mean giving `RT-2a` its own fresh client (mirroring `RT-2b`'s pattern) instead of reusing `userA.client` right after `RT-1`. Low priority: the test still proves what it needs to (isolation holds — never once violated in 22+ runs), and reworking it purely to remove a non-blocking flake isn't worth the churn right now. Revisit if `test:integration` starts being consulted more heavily (e.g., made a CI gate) or if the flake rate changes.

Validation Steps

If revisited: give `RT-2a` its own freshly-signed-in client (same pattern as `userB` in the same file) instead of reusing `userA.client`, then re-run the 8-run batch methodology used during this investigation to confirm the flake is gone.

Related ADR

None

Related Runbook

None

Related Incident

None — caught during code review, never shipped/observed in production

Notes

Do not reopen this investigation from scratch — read this entry first. The isolation guarantee itself (RLS blocking cross-store `postgres_changes`) has never failed in any run; only channel-setup timing on a reused, just-torn-down socket has. See DL-0004 (realtime.setAuth() requirement) and DL-0005 (this investigation) in `29_DECISIONS_LOG.md` for the full trail.

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