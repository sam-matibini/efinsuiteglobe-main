# Phase 2: In-App Promo Codes + Admin Audit Log UI

Moving to items #2 and #4 from the subscription roadmap.

---

## Part A — In-app promo code field (#2)

**Goal:** Let users enter a promo code inside our checkout page (before being redirected to Stripe) instead of relying solely on Stripe Checkout's promo field.

### Changes

1. `**supabase/functions/stripe-integration/index.ts**`
  - Add a `validate-promotion-code` action:
    - Accepts `{ code, plan_id, billing_cycle }`.
    - Calls Stripe `promotionCodes.list({ code, active: true, limit: 1 })`.
    - Validates: active, not expired, `max_redemptions` not reached, `applies_to` compatible with plan's product (if set), and currency compatible.
    - Returns `{ valid, promotion_code_id, coupon: { percent_off | amount_off, duration, duration_in_months }, preview: { discounted_amount, savings } }`.
  - Update `create-checkout-session` action:
    - Accept optional `promotion_code_id`.
    - If provided → pass `discounts: [{ promotion_code }]` and set `allow_promotion_codes: false` (mutually exclusive in Stripe).
    - If admin coupon is attached to the org → admin coupon still wins (do not accept user promo).
2. `**src/pages/SubscriptionCheckout.tsx**`
  - Add a "Have a promo code?" collapsible section on the plan confirmation step.
  - Input + "Apply" button → calls `validate-promotion-code`.
  - On success: show discount badge (e.g. "20% off — first 3 months"), updated total, and a "Remove" affordance.
  - On failure: inline error ("Code not valid", "Expired", "Already redeemed").
  - Pass `promotion_code_id` into `create-checkout-session`.
  - Hide the field entirely if the org already has an admin-applied discount (show that discount instead).

---

## Part B — Audit log UI for admin overrides (#4)

**Goal:** Give platform admins a searchable view of all subscription overrides (trial extensions, manual status overrides, discounts applied/removed) previously written to `audit_logs` by `admin-subscription-override`.

### Changes

1. `**src/components/admin/SubscriptionAuditLogTab.tsx**` (new)
  - Table view of `audit_logs` rows where `action` starts with `subscription.` (e.g. `subscription.trial_extended`, `subscription.override`, `subscription.discount_set`, `subscription.discount_removed`).
  - Columns: Timestamp, Admin (email via `profiles`), Organization (name), Action (badge), Details (rendered from `metadata` JSON — e.g. "+14 days", "20% off via `PRESET20`", "Removed coupon `abc123`").
  - Filters: date range, action type (multi-select), organization search, admin search.
  - Pagination (25/page).
2. `**src/pages/admin/AdminSubscriptions.tsx**`
  - Convert the current single-view page into a tabs layout: **Overview** (existing content) · **Discounts** (existing `DiscountsTab`) · **Audit Log** (new).
3. **No backend changes required** — `admin-subscription-override` already writes to `audit_logs`. If any override paths are missing an audit write, they'll be added in the same edit.

### Technical notes

- Query via `supabase.from('audit_logs').select('*, profiles:user_id(email), organizations:organization_id(name)')` — verify `audit_logs` has FK relationships to `profiles` and `organizations` before relying on the join; fall back to two-step fetch if not.
- All queries scoped by `useAuth().isAdmin` (page already lives under `AdminRoute`).

---

## Out of scope (deferred)

- #3 Webhook hardening
- #6 Downgrade/cancel flow
- #7 Discount preset editing
- #8 Security findings

Proceed?