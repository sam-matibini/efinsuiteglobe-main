# Auto-provision Stripe Coupons + Discounts Admin Tab

Remove the "paste a Stripe coupon ID" step. Whenever an admin sets a discount (global or per-org), the backend creates the coupon in Stripe automatically and stores its ID. Add a new **Discounts** tab in Admin → Subscriptions to manage a library of reusable Stripe coupons.

## What changes for the admin

**Global discount card (existing)**
- Remove the "Stripe coupon ID" text input.
- On save, if `percent > 0` and no coupon exists (or percent/duration changed), the backend creates a Stripe coupon (`percent_off`, optional `redeem_by = expires_at`, `duration = once|repeating|forever` based on expiry) and stores its ID in `platform_settings.subscription.global_discount.stripe_coupon_id`. If percent is 0, the coupon is cleared (and archived in Stripe).

**Per-org "Set discount" dialog (existing)**
- Same behavior: on save, backend creates/reuses a Stripe coupon for that org and stores its ID on the `subscriptions` row (new column `stripe_coupon_id`). Existing `discount_percent` / `discount_expires_at` still drive the UI.
- Add a "Use saved discount…" selector that picks from the new discounts library (see below); selecting one copies its percent/expiry and reuses its coupon ID.

**New: Discounts tab (`Admin → Subscriptions → Discounts`)**
- Table of saved discount presets from a new `discount_presets` table: name, percent, duration (once / N months / forever), expiry (optional), Stripe coupon ID, status (active / archived), created by, created at.
- Actions: **Create discount** (name, percent, duration, expiry, optional max redemptions) → creates the Stripe coupon and inserts the row. **Archive** → deletes the coupon in Stripe and marks the row archived. **Copy code** for the Stripe coupon ID.
- These presets are what the global card and per-org dialog pick from.

## Data model

New migration:
- `subscriptions.stripe_coupon_id text nullable` — coupon currently attached to this org.
- New table `public.discount_presets`:
  - `id uuid pk`, `name text not null`, `percent numeric not null check (percent > 0 and percent <= 100)`,
  - `duration text not null check (duration in ('once','repeating','forever'))`,
  - `duration_in_months int null`, `expires_at timestamptz null`, `max_redemptions int null`,
  - `stripe_coupon_id text not null unique`, `status text not null default 'active'`,
  - `created_by uuid`, `created_at`, `updated_at` timestamps.
- GRANTs: `authenticated` SELECT (so admin UI can list), `service_role` ALL. RLS: only `has_role(auth.uid(),'admin')` can select; all writes go through the edge function.

## Backend changes

`supabase/functions/admin-subscription-override/index.ts`
- Add Stripe helper `createCoupon({ percent, duration, duration_in_months, redeem_by, max_redemptions, name })` that calls `POST https://api.stripe.com/v1/coupons` with the existing `STRIPE_SECRET_KEY`.
- Add helper `deleteCoupon(id)` (`DELETE /v1/coupons/{id}`).
- New actions:
  - `create-preset` → create Stripe coupon, insert `discount_presets` row.
  - `archive-preset` → delete Stripe coupon, mark row `archived`.
  - `list-presets` (or the UI reads the table directly via RLS).
- Extend existing actions:
  - `update-defaults` (global discount): if `global_discount.percent > 0`, create/replace the Stripe coupon and write its ID back into the setting. If `percent = 0`, delete the existing coupon.
  - `set-discount` (per-org): accept either `preset_id` (reuse that coupon) or raw `discount_percent + discount_expires_at` (create a one-off coupon named `org:<id>`). Store `stripe_coupon_id` on the subscription row.
- All coupon mutations are audit-logged (before/after including coupon id).

`supabase/functions/stripe-integration/index.ts`
- Effective-discount resolution stays the same, but the coupon ID now comes from:
  1. `subscriptions.stripe_coupon_id` if the per-org discount is active, else
  2. `platform_settings.subscription.global_discount.stripe_coupon_id`.
- The "skip Stripe discount when no coupon id is configured" fallback is removed — a discount without a coupon ID is now impossible for new writes, and legacy rows are treated as inactive with a console warning.

## Frontend changes

`src/components/admin/SubscriptionAdminControls.tsx`
- `SubscriptionDefaultsCard`: remove the coupon-ID input; show read-only "Stripe coupon: cpn_… (auto-managed)" once created. Save button triggers coupon provisioning via `update-defaults`.
- `SetDiscountDialog`: add a "Use saved discount" `<Select>` populated from `discount_presets`; when a preset is chosen, percent/expiry inputs become read-only. A "Custom (one-off)" option keeps the current free-form flow.
- New `DiscountsTab` component (list, create dialog, archive action). Uses the edge function for writes and `supabase.from('discount_presets').select()` for reads.

`src/pages/admin/AdminSubscriptions.tsx`
- Add a "Discounts" tab alongside the existing tabs and mount `DiscountsTab`.

## Out of scope

- Coupon codes users type at checkout (promotion codes) — this ticket only handles admin-applied discounts. Can be a follow-up by wrapping the coupon in a Stripe `promotion_code`.
- Amount-off (fixed currency) coupons — percent-off only for now.
- Editing an existing preset's percent/duration (Stripe doesn't allow mutating those; UI offers Archive + Create new instead).
