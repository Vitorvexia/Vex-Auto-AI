30_KNOWN_ISSUES.md
# THE VEX OPERATING SYSTEM

# KNOWN ISSUES

Version: 1.0

Status: Living Document

Owner: Engineering

Last Updated: 2026-08-25

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

Issue ID

KI-0005

Title

`tests/integration/webhook.test.ts` "itera TODAS as mensagens do batch" Intermittently Times Out (Real Anthropic API Latency — Test Harness Only)

Category

External Dependency

Severity

Low

Status

Won't Fix (documented, accepted)

Environment

Test (`test:integration`, real Supabase + real Anthropic + real WhatsApp send — never runs in the Husky pre-push hook, confirmed: `package.json` `test` = `vitest run tests/unit` only, this file lives in `tests/integration/`)

Date Discovered

2026-07-27, during item 0.8 review — spotted while running the full suite, unrelated to 0.8's changes (never touched `webhook.test.ts`, `ai-pipeline.ts`, or the webhook route in that session)

Reported By

Observed during verification, flagged to user; user asked for a 2-minute check + this registration

Owner

Engineering

Description

`webhook.test.ts` posts a 3-message WhatsApp batch (`{A, B, C}` across 2 phone numbers) to the real webhook route (`app/api/whatsapp/webhook/route.ts`), which processes each message through the real pipeline — real Anthropic API call per message (`runAgent`) plus real WhatsApp send. Test hit `vitest.config.ts`'s global `testTimeout: 15000` and failed with "Test timed out in 15000ms", reproduced on a second immediate re-run of the same file alone (not a one-off).

Symptoms

`it("itera TODAS as mensagens do batch (messages[])")` times out at 15s. Other tests in the same file (single-message cases) passed in the same run.

Root Cause

3 sequential real Anthropic API calls (one per message in the batch) inside one `it()`, against a 15s global timeout with no per-test override. Single-message tests in the same file have ~3x the effective budget per LLM call and pass reliably; the 3-message batch test doesn't get a proportionally larger timeout. Not a code bug — real LLM inference latency is inherently variable, and 15s for 3 sequential real API round-trips is a tight budget with zero margin.

**Se você está mexendo em `ai-pipeline.ts` (ou qualquer coisa no caminho do webhook) e esse teste especificamente falhar:** é orçamento de tempo, não regressão sua. Antes de investigar a mudança que você acabou de fazer, primeiro rode só esse `it()` de novo isolado (`npx vitest run tests/integration/webhook.test.ts -t "itera TODAS"`) — se passar na segunda tentativa, é este issue, siga em frente. Só trate como regressão real se ele falhar consistentemente (3+ vezes seguidas) OU se o erro não for "Test timed out" (qualquer outro tipo de falha — assertion, exception — É regressão, não confundir com isto).

Impact

None on production or on push — `test:integration` is opt-in, never gates `git push` (see `27_PROJECT_STATUS.md` Quality Metrics, Bloqueante 2 closure). Only affects whoever runs `test:integration`/`test:all` and hits a slow Anthropic response during the 3-message batch test specifically.

Workaround

Re-run the test — passes on a normal-latency run.

Permanent Fix

Not planned now (out of scope, unrelated to item 0.8). If revisited, two options:

(a) **Recommended — dedicated per-test timeout, not global.** `it("itera TODAS as mensagens do batch (messages[])", async () => {...}, 30000)` — one-line change, matches what this test actually needs (3x real API calls = needs 3x the budget other tests in the file get), doesn't touch `vitest.config.ts`'s global 15s (which is fine for every other test in the suite, unit and integration alike — raising it globally would just hide slow tests elsewhere instead of fixing this one specifically).

(b) Mock the Anthropic call for this test. Bigger change — this test's actual intent is verifying webhook batch-iteration (`messages[]` handling, not LLM output quality), so mocking is arguably more correct long-term, but it's a real edit to test intent/setup, not a one-liner. Do (a) first; revisit (b) only if the file grows more LLM-heavy tests that all fight the same timeout problem.

Validation Steps

If revisited: re-run the file in a loop (same methodology as KI-0004) to confirm a longer timeout resolves it without masking a real regression.

Related ADR

None

Related Runbook

None

Related Incident

None

Notes

Distinct from KI-0004 (Realtime test flake) — different file, different root cause (real LLM latency vs. socket-reuse timing), same category of "known integration-test flake that never touches the push gate." Do not conflate the two when triaging `test:integration` failures.

---

Issue ID

KI-0006

Title

`classifyStatus()` Mislabels Template-Rejection Errors as `invalid_recipient` — Will Misdirect Debugging Once WHATSAPP_TEMPLATE_SEND_ENABLED Is Turned On

Category

WhatsApp

Severity

Low

Status

Open (not blocking — flag is off, no real template sends happen yet)

Environment

Production, only once `WHATSAPP_TEMPLATE_SEND_ENABLED=true` (roadmap 0.2, `27_PROJECT_STATUS.md` B006)

Date Discovered

2026-07-27, during item 0.2 review (template send path implementation)

Reported By

User review — flagged as needing to be written down before the flag ever gets turned on, so it doesn't cost someone a debugging afternoon later

Owner

Engineering

Description

`classifyStatus()` in `lib/whatsapp-send.ts` maps any HTTP 400 response from the Meta Cloud API to category `invalid_recipient`. That mapping was written for `sendWhatsAppMessage` (free text), where 400 realistically only means "bad recipient number." `sendWhatsAppTemplateMessage` (added for item 0.2) hits the same `classifyStatus()` via the shared `postToWhatsApp()` helper — but Meta also returns HTTP 400 for template-specific failures (template not approved, template doesn't exist, template/language mismatch, etc). Once template sends are live, an unapproved-template failure will be logged with `category: "invalid_recipient"`, which is simply wrong and will point whoever's debugging at the phone number instead of the template.

Symptoms

Not observed yet — flag is off, no real template send has happened. This is a pre-emptive registration, not a live incident.

Root Cause

`classifyStatus(status: number)` only looks at the HTTP status code, with no awareness of whether the request was a text send or a template send. Both `invalid_recipient` (bad number) and template-rejection failures share HTTP 400 on Meta's side, and the function was designed before template sends existed.

Impact

None today (flag off). Once `WHATSAPP_TEMPLATE_SEND_ENABLED=true`: `follow_up_logs.error_category`/`reactivation_logs` equivalent (not yet persisted — see item 3 increment, `error_message` only) would show a misleading category if that column is ever added. Even without a category column, anyone scanning logs by `category`/`isRetryable` semantics (e.g., "is this retryable?") gets the WRONG answer for a template rejection: `invalid_recipient` is `isRetryable: false` (permanent, matches reality for a genuinely-unapproved template) but is filed under the wrong label, so a human or a future automated retry-classifier reading `category` alone will think "bad phone number," not "check template approval status in Meta Business Manager."

Workaround

`sendWhatsAppTemplateMessage`'s thrown `WhatsAppSendError.message` already includes `(template=<name>)` (added alongside the function itself) — read the message, not just the category, when triaging a template send failure. `error_message` (this session's item-3 increment, `follow-up.ts`/`reactivation.ts`) persists that full message to `follow_up_logs`/`reactivation_logs`, so the template name is recoverable from the DB even though `category` is mislabeled.

Permanent Fix

Not planned now — flag is off, zero real-world exposure yet. If revisited before turning the flag on: `postToWhatsApp()` (or `classifyStatus()`) would need to know it's handling a template request (e.g., an explicit `isTemplate` param, or having `sendWhatsAppTemplateMessage` post-process the thrown error's category — remap `invalid_recipient` → a new category, e.g. `template_rejected`, whenever the error came from the template path) so `category`/`isRetryable` reflect template-specific reality instead of borrowing text-send semantics.

Validation Steps

If revisited: trigger a real rejection against an unapproved template name in a Meta sandbox/test app, confirm the resulting `WhatsAppSendError.category` is no longer `invalid_recipient`.

Related ADR

None

Related Runbook

None

Related Incident

None

Notes

Write this down BEFORE the flag ever flips — this is exactly the kind of mislabeling that reads as "obviously the phone number" and sends someone down the wrong path for an hour before they think to check Meta's template approval status instead.

---

Issue ID

KI-0007

Title

`tsconfig.json` Found Corrupted in Working Tree Twice in 2 Days — No Confirmed Root Cause

Category

Tooling / Dev Environment

Severity

Medium

Status

Open — watching (no fix possible without a repro; documented per user request to avoid rediscovering from scratch a 3rd time)

Environment

Local dev only (Windows, path contains non-ASCII characters: `C:\Users\vitor\OneDrive\Área de Trabalho\VEX`). Never observed in CI or production — CI does a fresh `npm ci` checkout of the committed (correct) file every run.

Date Discovered

2026-07-28, during item 0.7 (`/privacidade` LGPD rewrite) — `npm run lint` crashed with a `tsc` internal `Debug Failure: Expected .../tsconfig.json === ...\tsconfig.json` (forward vs. backslash path-equality assertion inside TypeScript's own diagnostic-formatting code, itself a downstream symptom of the JSON already being invalid, not the cause of the corruption).

Reported By

User — flagged this was the **2nd occurrence in 2 days**: 2026-07-27, `"ignoreDeprecations": "6.0"` appeared malformed; 2026-07-28, `"baseUrl": "."` had been mangled to `: "."` (quoted key name sheared off, colon + value left intact).

Owner

Engineering

Description

Twice in two days, `tsconfig.json` was found modified in the working tree with a corrupted key: a complete, valid key-value pair had its quoted key name stripped, leaving a bare `: <value>` line — invalid JSON. Both times this broke `npm run lint` / `npm run typecheck` outright (JSON.parse-level failure surfaces through `tsc`'s config loader). Both incidents were **never committed** — `git log -p --follow -- tsconfig.json` shows exactly 2 commits total against this file (initial creation, and a legitimate `exclude: ["node_modules", "gstack"]` change from PR work on 2026-04-29), neither matching either corruption. Confirms: corruption is a pure working-tree artifact, not something that ever got staged/pushed.

Investigation (what was ruled out)

- **No repo-level formatter to blame**: no `.prettierrc`/prettier config, no `.editorconfig`, no `.vscode/settings.json` in the repo (checked — none exist).
- **Husky hooks don't write files**: `.husky/pre-push` only runs `lint`/`typecheck`/`test`; no `pre-commit` hook exists; nothing in the hook chain edits `tsconfig.json`.
- **Confirmed a real, proven auto-rewriter exists and runs on every `next lint`/`next dev`/`next build`**: `node_modules/next/dist/lib/typescript/writeConfigurationDefaults.js` parses and re-serializes `tsconfig.json` via `next/dist/compiled/comment-json` whenever it detects missing/incorrect Next.js-recommended compiler options, and **does write to disk** (`fs.promises.writeFile(tsConfigPath, ...)`) when it finds something to change. This is a legitimate, silent, automatic file-write path triggered by ordinary dev commands — proven to exist, but the specific keys it manages (`lib`, `allowJs`, `skipLibCheck`, `strict`, `noEmit`, `incremental`, `module`, `esModuleInterop`, `moduleResolution`, `resolveJsonModule`, `isolatedModules`, `jsx`, `plugins`, `include`, `exclude`) do **not** include `baseUrl` or `ignoreDeprecations` — so this exact function is not a direct match for either observed corruption, though it does establish that concurrent/automatic rewrites of this file are a normal, expected occurrence in this project, not a hypothetical.
- **`ignoreDeprecations` is a real TypeScript 5.5+ compiler option** (confirmed present in `node_modules/typescript/lib/typescript.js` and `_tsc.js`) used specifically to silence deprecated-option warnings — this is exactly the kind of key VS Code's built-in TS language server offers to auto-insert via a lightbulb quick-fix when it flags a deprecated tsconfig option. Suspected but **not confirmed** — no direct evidence (editor history, extension logs) ties a specific quick-fix action to either incident.

Root Cause

**Not conclusively identified.** Leading hypothesis (circumstantial, not proven): a race between two independent writers of the same file — (a) Next.js's own automatic `tsconfig.json` rewriter (proven to exist and run on ordinary `lint`/`dev`/`build` invocations) and (b) an IDE-driven edit (e.g., VS Code TS-server quick-fix, or an agent/tool edit) computed against stale file offsets. If writer (a) rewrites the file between when writer (b) reads it and when writer (b) applies its edit, (b)'s insertion lands at the wrong position in the now-different file, shearing off part of an existing key — which matches the observed pattern (key name vanishes, colon+value survives) far better than a clean single-writer bug would. This is a plausible mechanism, not a confirmed diagnosis.

Impact

Breaks `npm run lint` and `npm run typecheck` locally (JSON parse failure), which also blocks the Husky `pre-push` hook. No impact on CI (fresh checkout) or production (build artifacts, not source, ship). Caught before any push both times.

Workaround

Manually restore the missing key (in both observed cases, restoring to the last-committed value made the working tree exactly match `HEAD` — i.e., the "fix" is just reverting an uncommitted, unintentional edit).

Permanent Fix

None planned — no reliable repro, so no targeted fix is possible yet. If it recurs a 3rd time: (1) capture the exact byte-level diff immediately (`git diff tsconfig.json`) before touching the file, (2) check whether `next dev` or `next lint`/`next build` was running at the same moment an IDE edit was made, (3) check VS Code's local history (`.history` or the built-in "Timeline" view) for the file to see the edit that introduced the corruption, since that would show the exact tool/action responsible.

Validation Steps

N/A — nothing to validate without a fix. Watch for a 3rd occurrence and capture more forensic detail per "Permanent Fix" above.

Related ADR

None

Related Runbook

None

Related Incident

None

Notes

Corrupted twice in 2 days, same shape both times (quoted key name sheared off a key-value pair), never committed either time. Treat any future `tsconfig.json`-related lint/typecheck crash as "check for this pattern first" before assuming a real regression — compare against `git diff HEAD -- tsconfig.json`; if it doesn't match `HEAD`, this is very likely a recurrence, not a code bug.

---

Issue ID

KI-0008

Title

Teste de Integração do Item 0.8 (Realtime) Deixou Sobras em Produção — Paliativo Aplicado, Causa Raiz Não Resolvida

Category

Test Infrastructure

Severity

Medium

Status

Mitigated — dado de teste limpo (2026-07-28); causa raiz (ausência de Supabase de staging) segue aberta

Environment

`tests/integration/realtime-isolation.test.ts` roda contra o Supabase de **produção** real (não existe staging) — `npm run test:integration`, nunca gatilhado pelo hook `pre-push` (só `tests/unit/`).

Date Discovered

Sobras criadas durante a sessão de desenvolvimento do item 0.8 (2026-07-27, ver `29_DECISIONS_LOG.md` DL-0004/DL-0005). Achado e limpo em 2026-07-28.

Reported By

Vitor, ao revisar `/admin` e notar stores/leads estranhos misturados com dado real.

Owner

Engineering

Description

`users.store_id` é `ON DELETE RESTRICT` (não `CASCADE`) — uma store com usuário vinculado nunca é deletável até o usuário (`auth.users`, que cascade pra `public.users`) ser removido primeiro. O `afterAll` do teste, numa versão anterior à atual, deletava a store direto e engolia o erro do delete falho, deixando store + usuário + leads/conversations/messages cascateados presos em produção silenciosamente — sem crash, sem log de alerta, só o dado ficando pra trás.

9 stores (`Test RT-A/RT-B <timestamp>`, `Test webhook <timestamp>`) + 8 usuários (auth+public, `Vendedor A/B`) + 2 leads (artefato do setup do B001, não deste teste) acumularam em produção até serem identificados e removidos.

Symptoms

`/admin` e qualquer contagem de lojas/usuários misturava dado de teste com dado real (`stores` tinha 12 linhas, só 3 legítimas). `leads` tinha 2 registros órfãos (`#1 Atendimento`, `WhatsApp Business`) sem relação com clientes reais.

Root Cause

Duas causas empilhadas: (1) bug pontual no `afterAll` (delete de store antes de deletar o usuário vinculado, ordem errada pro `ON DELETE RESTRICT`) — **já corrigido**, o teste atual (`tests/integration/realtime-isolation.test.ts:180-197`) deleta usuário primeiro, store depois, e verifica explicitamente que a store sumiu, logando erro se não sumir. (2) causa estrutural que **continua aberta**: o teste roda contra produção real porque não existe Supabase de staging — qualquer bug de cleanup (futuro, não só este) tem blast radius direto em produção. O prefixo `__test__realtime-isolation` no nome (adicionado depois) mitiga descoberta manual de sobras futuras, mas não elimina o risco de o teste escrever em produção.

Impact

Nenhum impacto funcional (stores/users de teste não processavam tráfego real, não apareciam pra clientes). Impacto foi de higiene/confiança dos dados administrativos — `/admin` e métricas de contagem ficavam poluídas.

Workaround

Limpeza manual aplicada via `scripts/cleanup-realtime-tests.sql` (2026-07-28) — ver arquivo pra IDs exatos e resultado confirmado (12→3 stores).

Permanent Fix

Não planejado agora. Fix real seria um projeto Supabase de staging dedicado pra `tests/integration/`, isolando qualquer teste que crie dado real do banco de produção — mudança de infraestrutura, não linha de código. Até lá, todo teste de integração novo que cria dado em produção deve seguir o padrão já estabelecido em `realtime-isolation.test.ts`: prefixo `__test__<nome-do-teste>` no nome + `afterAll` que verifica explicitamente que o cleanup funcionou (não só tenta e ignora erro).

Validation Steps

Se um teste de integração futuro deixar sobra: identificar por `nome LIKE '__test__%'` (convenção), nunca assumir que "parece teste" é prova suficiente — confirmar com checagem inversa contra as stores/usuários reais conhecidos antes de deletar qualquer coisa em produção.

Related ADR

None

Related Runbook

None

Related Incident

None

Notes

Esta limpeza é paliativo, não solução. Ausência de Supabase de staging pra testes de integração é dívida estrutural conhecida — cada novo teste de integração que grava em produção repete o mesmo risco até essa dívida ser paga.

---

Issue ID

KI-0009

Title

`schema_migrations` desatualizada — migrations 020-043 nunca registradas no CLI, 2 delas (029 audit_logs, 031 RENAVE) nunca de fato aplicadas em produção apesar de documentadas como "fechadas"

Category

Database

Severity

High

Status

Resolved (2026-08-25) — ver `29_DECISIONS_LOG.md` DL-0020

Environment

Produção (Supabase, projeto `nrwnlhnmsmlyaueylsci`, "VEX AUTO AI").

Date Discovered

2026-08-25, ao aplicar a migration 022 manualmente via `supabase db query --linked` (BL-0037, card "Visitas agendadas") — `supabase migration list` revelou que `supabase_migrations.schema_migrations` só reconhecia migrations até a 019.

Reported By

Achado pelo Claude durante a sessão de redesign do dashboard, ao verificar o estado da migration 022; investigação completa pedida pelo Vitor em seguida.

Owner

Engineering

Description

Migrations 020-043 (24 arquivos) existiam no repo, mas nenhuma tinha registro na tabela de controle do Supabase CLI. Causa: pelo menos parte delas foi aplicada historicamente colando o SQL direto no SQL Editor do Supabase Studio em vez de via CLI — isso grava um registro em `schema_migrations`, só que sob uma `version` timestamp (ex: `20260615193022` pra migration 020, `created_by: vexautoai@gmail.com`), não sob o número simples (`020`) que o CLI local usa — os dois nunca batiam, então `migration list` sempre via 020+ como "nunca aplicada", mesmo quando o schema real já tinha a mudança.

Symptoms

`supabase migration list --linked` mostrava `local: 020..043` / `remote: ""` pra todas — qualquer `supabase migration up`/`db push` às cegas nesse estado tentaria reaplicar 24 migrations do zero e quebraria em "column/constraint already exists" pras que já estavam aplicadas.

Root Cause

Auditoria read-only completa (comparando cada arquivo 020-043 contra o schema real via `information_schema`/`pg_constraint`/`pg_indexes`/`pg_policy`/`pg_views`/`pg_proc`/`storage.buckets`/`pg_publication_tables`/`pg_extension`) encontrou:

1. **21 de 23 migrations batiam 100%** com produção (só nunca tinham sido *registradas* — o schema já estava certo).
2. **2 migrations NUNCA tinham sido aplicadas de verdade**, apesar de `27_PROJECT_STATUS.md` as descrever como "fechadas": `029` (tabela `audit_logs` não existia) e `031` (colunas RENAVE em `vehicles` não existiam).
3. **Achado extra**: `stores` tinha 2 constraints de validação de cor primária — `stores_cor_primaria_hex_check` (migration 039, fonte de verdade) e `stores_cor_primaria_format` (mesma regra, não rastreada em nenhum arquivo — artefato de teste manual esquecido no SQL Editor).

Impact

- **`audit_logs` ausente**: toda chamada a `logAudit()` (`lib/audit.ts`) falhava no insert — capturado por `try/catch`, nunca lançava, erro só ia pro Sentry (`tags: pipeline_stage=audit_log`). **Toda trilha de auditoria esteve 100% silenciosa desde 2026-07-30** (~4 semanas) — nenhuma ação sensível (reatribuição de lead, handoff, fechamento, criação de usuário, avanço de RENAVE) ficou registrada.
- **RENAVE ausente**: `/renave` (`app/renave/page.tsx`) fazia SELECT incluindo `renave_stage`/`renave_nfe_key`/`renave_stage_updated_at` — coluna inexistente, PostgREST retornava erro, página renderizava banner vermelho com a mensagem crua do Postgres pro usuário final em vez da tabela de pendências. **Tela efetivamente inutilizável em produção desde 2026-08-01** (~3 semanas), sem alarme automático porque o erro era só visual, não um crash monitorado.
- Nenhum risco de integridade/perda de dado em nenhum dos dois casos — ausência de escrita, não escrita incorreta.

Workaround

Nenhum aplicado durante o período — os dois problemas ficaram sem mitigação até serem encontrados.

Permanent Fix

Migrations 029 e 031 aplicadas via `supabase db query --linked --file <arquivo>` (SQL exato do repo, sem edição). Validadas estrutural (colunas/tipos/constraints/índices idênticos ao arquivo) e funcionalmente (`BEGIN`/insert ou update mimetizando exatamente `logAudit`/`advanceRenaveStage`/o SELECT de `/renave`/`ROLLBACK`, zero dado de teste persistido em produção). Constraint duplicada `stores_cor_primaria_format` removida. `supabase migration repair --status applied --linked 020 022 023 ... 043` rodado — `schema_migrations` sincronizada, `migration list` confirma `001`-`043` todos com `local == remote`, sem gap.

Validation Steps

`npx supabase migration list --linked` deve mostrar todas as migrations locais com `remote` preenchido (mesmo valor), sem `remote: ""`. Pra qualquer migration nova daqui pra frente: aplicar via `supabase migration up`/`db push` sempre que possível; quando não for viável no ambiente, usar `supabase db query --linked --file <arquivo>` (mesmo SQL, sem colar solto no SQL Editor) e rodar `supabase migration repair` logo em seguida pra manter a tabela de controle sincronizada — nunca deixar uma migration aplicada sem registro.

**Atualização 2026-08-26 — resíduo órfão finalmente removido (não é incidente novo):**

Ao aplicar a migration 044 (`BL-0040`/`DL-0021`) via `supabase db push --linked`, o comando bloqueou com `LegacyDbPushMissingLocalError` apontando exatamente o registro órfão já documentado acima (`version = '20260615193022'`) — o duplicado de migration 020 registrado sob timestamp em vez de `020`, que o DL-0020/esta entrada já tinham identificado e deliberadamente deixado como estava ("inofensivo — não removido, só documentado, pra não confundir uma auditoria futura"). Não é achado novo, é o mesmo item batendo na porta de novo, desta vez bloqueando um comando em vez de só aparecer numa auditoria read-only.

Investigado antes de agir (mesma disciplina do DL-0020, não assumido por memória): `select version, name, statements[1], array_length(statements,1) from supabase_migrations.schema_migrations where version = '20260615193022'` confirmou os mesmos dados já registrados aqui (`name = '020_lead_sale_fields'`, conteúdo idêntico ao arquivo `020_lead_sale_fields.sql`) antes de qualquer ação.

Removido via `supabase migration repair --status reverted 20260615193022` — comando sugerido pelo próprio CLI no erro. Importante: **`--status reverted` deleta a linha da tabela de controle**, não só marca um status (confirmado — reconsulta pós-repair pela mesma `version` retornou 0 linhas). Verificado depois, antes de prosseguir: `version = '020'` (a entrada oficial, correta) continua intacta (`name = 'lead_sale_fields'`, 2 statements) e as colunas reais que ela criou (`leads.valor_final`, `leads.vehicle_id`) seguem presentes — o repair removeu só o duplicado inofensivo, não tocou schema real nem a entrada de controle correta. `supabase db push --linked` rodado em seguida aplicou a 044 normalmente, `migration list` confirma `001`-`044` `local == remote` sem gap e **sem o resíduo órfão pela primeira vez desde o incidente original**.

Related ADR

None

Related Runbook

None

Related Incident

Nenhum incidente formal aberto — tratado como achado de auditoria de rotina, corrigido na mesma sessão em que foi encontrado.

Notes

`29_DECISIONS_LOG.md` (`DL-0019`, `DL-0020`) tem o relato completo passo a passo, incluindo os comandos exatos rodados e o resultado de cada validação. `27_PROJECT_STATUS.md` teve 2 entradas históricas corrigidas (as que diziam "029/031 fechado" sem qualificar que era só código, não deploy real) — ver notas de correção datadas 2026-08-25 nessas entradas. Resíduo órfão (`20260615193022`) removido em 2026-08-26 durante a aplicação da migration 044 — ver atualização datada acima e `DL-0021`/`BL-0040`.

---

KI-0010

Title

Telefone repetido em leads de stores diferentes pode confundir consulta manual sem filtro de `store_id` explícito

Category

Process / Database

Severity

Low

Status

Documented — não é bug, é hábito de investigação a reforçar

Environment

Produção (Supabase, projeto `nrwnlhnmsmlyaueylsci`), qualquer consulta manual de debugging.

Date Discovered

2026-08-26, durante validação em produção de `BL-0040`/`DL-0021` (teste real de opt-out via WhatsApp).

Reported By

Achado pelo Claude ao investigar por que um teste de opt-out não tinha disparado — primeira consulta (`select ... from leads where phone_normalized = '+55...'`, sem filtro de `store_id`) trouxe o lead errado (loja demo/seed, `store_id = 'aaaaaaaa-...'`) em vez do lead real de teste na Speed Motos, atrasando a investigação até o founder apontar o padrão.

Description

`leads.phone_normalized` não é único globalmente — o mesmo telefone pode (e deve poder) existir como lead em lojas diferentes, já que a mesma pessoa pode estar interessada em veículos de duas revendas distintas. **Isso não é violação de isolamento multi-tenant** — o sistema em si (RLS, RPCs de elegibilidade, `getServerStoreId()`) sempre filtra corretamente por `store_id`. O risco é só em queries manuais de debugging/investigação rodadas direto contra produção fora do código da aplicação, que podem esquecer o filtro e pegar a linha errada silenciosamente (sem erro, só dado errado).

Symptoms

Consulta manual por `phone_normalized` sozinho pode retornar mais de 1 linha ou a linha "errada" quando existe lead homônimo em outra loja — investigação parte de premissa errada até alguém notar a divergência (ex: dado que não bate com o esperado).

Root Cause

Nenhum bug — `phone_normalized` nunca teve (nem deveria ter) constraint de unicidade global, só é único por prática dentro de uma loja. Causa é hábito de consulta, não schema.

Impact

Nenhum em produção — sistema aplicativo sempre filtra certo. Impacto é só em velocidade/precisão de investigação manual (o achado de 2026-08-26 atrasou, mas não invalidou, a conclusão certa).

Workaround

Nenhum necessário — não bloqueia nada.

Permanent Fix

Não é caso de fix de código. Prática a reforçar: toda query manual de debugging contra `leads`/`conversations`/tabelas relacionadas deveria filtrar por `store_id` explícito (ou pelo menos checar `count` > 1 antes de assumir resultado único), nunca só por telefone/nome.

Validation Steps

N/A — item de processo, não de código.

Related ADR

None

Related Runbook

None

Related Incident

Nenhum — achado lateral durante validação de `BL-0040`, não incidente próprio.

Notes

`29_DECISIONS_LOG.md` `DL-0021`, atualização de 2026-08-26, tem o contexto completo de onde isso apareceu.

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