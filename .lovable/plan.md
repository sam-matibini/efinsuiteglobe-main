# Admin: Trial, Override & Discount Controls

Three related admin capabilities that all live in the existing `Admin → Subscriptions` page and reuse existing columns where possible.

## What admins get

**Global defaults (new "Subscription Defaults" card at top of Admin → Subscriptions)**
- Default trial length (days) — applied to every new checkout
- Global discount percent — applied to every active/trialing org that has no per-org override
- Optional expiry date on the global discount (so promos auto-end)

**Per-organization row actions (new dropdown items on each subscription row)**
- **Extend trial** — pick "+N days" or an exact new trial end date. Sets status to `trialing` and pushes `current_period_end` forward.
- **Override subscription** — one dialog to change plan, billing cycle, status, `current_period_end`, `custom_price`, and admin notes. Also creates a subscription row if the org has none.
- **Set discount** — set `discount_percent` (0–100) and optional expiry, or clear it to fall back to the global discount.

All three actions write an entry into `audit_logs` (org_id, admin user, before/after values).

## Data model

`platform_settings` already exists (key/jsonb). Two new rows, no schema change:
- `subscription.trial_period_days` → `{ "days": 14 }`
- `subscription.global_discount` → `{ "percent": 0, "expires_at": null, "note": null }`

`subscriptions` already has `discount_percent`, `custom_price`, `admin_notes`. Add two nullable columns via migration:
- `discount_expires_at timestamptz` — per-org discount auto-expiry
- `trial_extended_by uuid` / `trial_extended_at timestamptz` — audit fingerprint for the last trial extension

## Backend changes

`supabase/functions/stripe-integration/index.ts`
- Replace the hard-coded `trial_period_days = 14` with a read from `platform_settings.subscription.trial_period_days` (fallback 14).
- On checkout session creation, read the effective discount for the org (per-org `discount_percent` if present and not expired, else global) and, when > 0, attach it via Stripe `discounts[0][coupon]` using a stored coupon id in `platform_settings.subscription.global_discount.stripe_coupon_id`. If no coupon id is configured, skip the Stripe-side discount and only record it in DB for display/reporting.

New edge function `admin-subscription-override` (verify caller has `admin` role via `has_role`):
- Actions: `extend-trial`, `override`, `set-discount`, `update-defaults`.
- Writes to `subscriptions` / `platform_settings` and inserts an `audit_logs` entry per change.
- Used by the admin UI so all mutations go through one authorized entry point (avoids fragile client-side RLS bypass).

## Frontend changes (all in `src/pages/admin/AdminSubscriptions.tsx`)

- New **Subscription Defaults** card (trial days input, global discount %, expiry date, save button).
- Extend the row dropdown with: *Extend trial…*, *Override…*, *Set discount…*.
- Three dialog components (co-located): `ExtendTrialDialog`, `OverrideSubscriptionDialog`, `SetDiscountDialog`.
- Show effective discount (per-org or inherited global) as a badge in the subscription row.

`src/hooks/useSubscription.ts`
- Surface `effectiveDiscountPercent` for downstream UI (checkout page already reads this hook).

`src/pages/SubscriptionCheckout.tsx`
- If a discount applies, show the discounted price alongside the list price on plan cards.

## Out of scope

- Actually creating Stripe coupon objects — admin pastes an existing Stripe coupon ID into the global discount setting. Auto-provisioning coupons via API can be a follow-up.
- Per-plan (rather than per-org) discounts.
