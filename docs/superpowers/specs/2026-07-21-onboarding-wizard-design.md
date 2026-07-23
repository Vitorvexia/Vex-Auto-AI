# Design: First-Run Onboarding Wizard (Store Admin Self-Service Setup)

Status: Approved
Date: 2026-07-21
Owner: Engineering

---

## Context

Vex Auto is provisioning its first real customer (Speed Motos) manually — a Vex engineer creates the store, creates the user, and hands over credentials by hand. This does not scale to a second paying customer without engineering involvement.

This spec covers the **first-run setup wizard**: what a store owner sees the first time they log in, and the self-service permission layer required for them to configure their own store without a Vex human in the loop.

## Explicitly Out of Scope

This session surfaced a larger idea that decomposes into four independent pieces. Only one is specified here:

- **A — Plans/pricing site + checkout.** Not architected yet (per founder). Separate project, own spec, own brainstorm session (payment provider, plan tiers, pricing).
- **B — Auto-provisioning on purchase + transactional email delivery.** Depends on A existing (needs a purchase event to trigger it). Today, `createStoreUserDirect` (`app/admin/actions.ts`) already creates the store admin account and generates a random password, triggered manually by a Vex super-admin — it does not send email. Automating the trigger and adding email delivery is a thin layer on top of A once A exists; not built here.
- **D — WhatsApp Embedded Signup (BL-0001, `docs/vex/28_BACKLOG.md`).** On hold — requires Vex's own Meta Business Verification, which requires Vex to have a CNPJ or MEI. Founder decided 2026-07-21 not to open one yet. The WhatsApp step in this wizard ships as **manual guided entry** instead (see Step 4 below); swap for the real Embedded Signup button once BL-0001 unblocks, without touching the rest of the wizard.
- **BL-0002 — Product mascot.** Registered as a someday/P4 backlog item, unscheduled. Could plug into this wizard's Phase 2 tour later, but not designed or built now.

**This spec (item "C") covers:** the wizard itself, plus the new store-admin self-service permission layer it depends on (detailed below) — because without that layer, the wizard has nothing to call.

## Problem

Today, only a Vex super-admin (`assertSuperAdmin()`) can create users or edit store configuration (`createStoreUser`, `createStoreUserDirect`, `updateStore` in `app/admin/actions.ts`). A store owner has no way to add their own sellers, name their own store, or connect their own WhatsApp number — every one of those steps currently requires a Vex human. The founder's stated goal: the store owner should have full, independent control within their own store (never other stores' data, never Vex's internal/platform data) — the product cannot be self-serve without this.

## Architecture

### New permission tier: store admin self-service

Three new Server Actions, parallel to the existing superadmin-only ones, scoped to the caller's own `store_id`:

- `createStoreVendedorSelfService(formData)` — creates a `role: vendedor` user. Validates the caller is `role: admin` of the **same** `store_id` before doing anything (never trusts `store_id` from the form).
- `updateStoreWhatsAppSelfService(formData)` — updates `whatsapp_phone_number_id` / `whatsapp_numero` on the caller's own store.
- `updateStoreNomeSelfService(formData)` — updates `stores.nome` on the caller's own store.

These do not replace or modify the existing superadmin actions — Vex staff retain full cross-store control via `/admin` unchanged. `createVehicle` already works for regular store users today and needs no new action.

### Gate: dedicated route, not a client-side modal

`/onboarding` is a real page (Server Component), not an overlay. Middleware checks `stores.onboarding_completed_at`: if `NULL`, every request from a user of that store (except login/logout) redirects to `/onboarding`. Enforced server-side — matches the project's existing rule that guardrails are never UI-only (same principle as the margin guardrail and multi-tenant RLS). A client-side modal was considered and rejected: it can't stop someone from calling a Server Action directly or disabling JS.

### Progress tracking: two flags, not a new table

- `stores.onboarding_completed_at` (timestamptz, nullable) — the single source of truth. `NULL` = wizard still gates the store. Set once and never cleared automatically (a superadmin can reset it manually for support purposes — see Edge Cases).
- `stores.estoque_wizard_skipped` (boolean, default `false`) — the one piece of wizard state that can't be derived from existing data (zero vehicles is ambiguous: never attempted vs. deliberately deferred).

The other three steps derive their "done" state directly from existing data (store has a name, store has ≥1 vendedor, store has a `whatsapp_phone_number_id`) — no separate per-step tracking table. Once all conditions are met (or deferred), `onboarding_completed_at` is stamped and the wizard never reopens for that store again, even if the underlying data changes later (e.g., the only vendedor is later removed).

## Flow

### Phase 1 — Mandatory, sequential, full-screen, no close button

Only visible to `role: admin`. A `role: vendedor` who logs in while the store is incomplete sees a simple holding screen ("aguardando o administrador terminar a configuração da loja") instead — they cannot complete admin-only steps.

1. **Nome da loja** — text field, pre-filled if already set. Saves via `updateStoreNomeSelfService`. "Próximo" enabled only with a non-empty name.
2. **Vendedores** — form to add a vendedor (nome + email; random password generated the same way `createStoreUserDirect` already does). Requires **at least 1** before advancing; can add more before continuing.
3. **Estoque** — vehicle form (reuses existing `createVehicle`). Two buttons: **"Cadastrar"** (add and keep adding) or **"Cadastrar depois"** (sets `estoque_wizard_skipped = true`, advances with zero vehicles).
4. **WhatsApp** — since BL-0001 is on hold, this step shows written step-by-step instructions (the same Meta Business Manager path used for Speed Motos: business verification → WhatsApp Manager → migrate/register number → System User token) plus a form to paste the resulting Phone Number ID + token. Saves via `updateStoreWhatsAppSelfService`. Mandatory to advance.

Completing step 4 (or step 3 via "cadastrar depois" + steps 1/2/4) stamps `onboarding_completed_at = now()`.

### Phase 2 — Dismissible product tour

Starts only after Phase 1 is complete. Spotlight overlay dims the screen and highlights one section at a time (Kanban, Leads, Analytics, etc.) with short explanatory text. "Próximo" / "Pular tour" buttons — skipping exits immediately, no per-item checkbox. Once dismissed or finished, it never reappears (covered by the same `onboarding_completed_at` flag — no separate field needed).

## Edge Cases

1. **Vendedor creation fails partway** (auth user created, `users` insert fails) — same rollback pattern as `createStoreUserDirect`: delete the orphaned auth user, surface the error, let the admin retry.
2. **Forged `store_id` in a form submission** — every new action re-derives the caller's `store_id` server-side from their session and rejects any mismatch. Never trusts the form value alone.
3. **Invalid WhatsApp Phone Number ID / token** — accepted and saved regardless (no way to validate against Meta without sending a real message). Surfaces later as `auth_error` through the existing error classification in `lib/whatsapp-credentials.ts`. Does not block wizard completion.
4. **Vendedor logs in mid-onboarding** — sees the holding screen (Phase 1, item above), not the wizard.
5. **Support needs to unstick a store** — `/admin` (superadmin-only) gets a control to view a store's onboarding status and manually reset `onboarding_completed_at` if needed.
6. **A second admin account exists later** — the flag lives on `stores`, not `users`, so they never see the wizard again once the store is marked complete.

## Testing

- Each new self-service action rejects a `store_id` that doesn't match the caller's session
- `createStoreVendedorSelfService` rolls back the auth user if the `users` insert fails
- Middleware redirects to `/onboarding` when `onboarding_completed_at IS NULL`, and stops redirecting once it's set
- Middleware does not redirect login/logout routes (no infinite loop)
- "Cadastrar depois" on the estoque step stamps `onboarding_completed_at` with zero vehicles
- A `vendedor` sees the holding screen, not the wizard, while the store is incomplete

## Related

- `docs/vex/28_BACKLOG.md` — BL-0001 (WhatsApp Embedded Signup, on hold), BL-0002 (mascot, unscheduled)
- `app/admin/actions.ts` — existing superadmin-only actions this design adds a self-service parallel to
- `docs/vex/CLAUDE.md` (root) — Multi-tenant B1, RLS via `my_store_id()` — the isolation model this design extends to store-admin self-service
