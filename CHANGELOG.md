# Changelog

All notable changes to this project will be documented in this file.

## [0.0.2.0] - 2026-04-22

### Added

- **WhatsApp Cloud API send** — after the AI generates a reply, it is now delivered
  to the lead via the WhatsApp Cloud API (`lib/whatsapp-send.ts`). Send failures are
  non-fatal: the reply is already saved in the database before the send attempt.
- **Centralized AI pipeline** (`lib/ai-pipeline.ts`) — all pipeline logic extracted
  from the webhook route for independent testability. Flow:
  `buildAgentContext → runGuardrails → buildPrompt → runAgent → messages.insert →
  sendWhatsAppMessage → transitionStatus (if handoff) → leads.update (score) → logAi`
- **`ok_send_failed` agent status** — distinguishes "AI replied + saved but delivery
  failed" from a genuine pipeline error. Leads are never lost even when WhatsApp is
  unavailable.
- **E2E pipeline tests** (`tests/integration/ai-pipeline.e2e.test.ts`) — 5 real-world
  scenarios covering short messages, purchase intent, off-hours, human handoff, and
  closing intent. Calls the live Anthropic API.
- **4096-char truncation invariant** — reply text is truncated before the database
  insert, guaranteeing the stored content matches what is delivered to the lead.

### Fixed

- **Brazilian mobile normalization** — `lib/phone.ts` now correctly converts 8-digit
  BR mobiles (12-digit format: `55 + DDD + 8`) to the 9-digit mandatory format by
  inserting the leading `9`. Landline numbers (first digit after DDD < 6) are left
  unchanged to avoid creating invalid numbers.
- **Webhook always returns HTTP 200** — the Meta webhook platform retries any non-2xx
  response for up to 7 days. Systemic errors are now logged internally and the webhook
  always acknowledges with 200.
- **Phone PII in logs** — logs now show only the last 4 digits of the recipient phone
  number (`**********1234`) for LGPD compliance.
- **Test environment** — `.env.local` now takes precedence over committed defaults
  (`override: true` in dotenv load).

### Changed

- `app/api/whatsapp/webhook/route.ts` refactored to delegate AI processing to
  `runAiPipeline()`, removing ~150 lines of inline logic.
- `agent_status` field in webhook response now distinguishes `ok_send_failed` from
  `ok`.
