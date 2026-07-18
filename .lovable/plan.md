
## 1. Duration field for global and per-org discounts

Right now the admin edge function infers coupon duration (`once` when an expiry is set, otherwise `forever`) and never uses `repeating`. This adds an explicit duration selector to both flows, matching what the Discounts library already supports.

**UI — `src/components/admin/SubscriptionAdminControls.tsx`**
- `SubscriptionDefaultsCard` (global discount): add a **Duration** `<Select>` with options *Once*, *Repeating (months)*, *Forever*. When *Repeating* is chosen, show a **Months** number input. Disable both fields when a saved preset is selected (preset already carries duration). Persist selection in `platform_settings.subscription.global_discount` as `duration` and `duration_in_months`.
- `SetDiscountDialog` (per-org): same Duration + Months controls; disabled when a preset is chosen. Values are sent to the edge function alongside `discount_percent` / `discount_expires_at`.

**Backend — `supabase/functions/admin-subscription-override/index.ts`**
- `update-defaults`: accept optional `duration` and `duration_in_months`. Store them in the `global_discount` platform setting. Pass them to `createStripeCoupon` when auto-provisioning the global coupon (replacing today's expiry-based inference).
- `set-discount`: accept optional `duration` and `duration_in_months`. Pass to `createStripeCoupon` for the per-org one-off coupon. Preset path unchanged (preset's own coupon is reused).
- Audit log entries include the new fields.

**Checkout — `supabase/functions/stripe-integration/index.ts`**
- No coupon-attach logic changes needed (duration is baked into the coupon at creation). Just make sure the effective-discount payload continues to look up the stored `stripe_coupon_id`.

## 2. Promo code entry on Stripe Checkout

**`supabase/functions/stripe-integration/index.ts`**
- In the `create-checkout` action's `sessionParams`, add `allow_promotion_codes: 'true'` so the Stripe Checkout page shows a "Add promotion code" field. Customers can then type any active Stripe **promotion code** (the human-readable code attached to a coupon in Stripe Dashboard → Products → Coupons → Promotion codes).
- Stripe does not allow combining a customer-typed promotion code with an admin-attached coupon on the same session. To keep both paths working: when an admin discount coupon is being applied (per-org or global), attach it via `discounts[0][coupon]` as today and **omit** `allow_promotion_codes`. When no admin discount applies, set `allow_promotion_codes: 'true'` so the customer can enter one themselves.

## Out of scope

- A UI for admins to create/manage Stripe **promotion codes** (the typeable string tied to a coupon). Admins can create these in the Stripe Dashboard for now; a follow-up can add a "Promotion codes" section to the Discounts tab that calls `POST /v1/promotion_codes`.
- Editing duration on existing Stripe coupons — Stripe forbids it. The edge function already replaces (delete + create) the coupon when discount parameters change, so changing duration will trigger a rebuild of the coupon automatically.

## Technical notes

- Duration select values map 1:1 to Stripe's `duration` enum: `once | repeating | forever`. `duration_in_months` is required only when `duration = 'repeating'`; the UI enforces this and the backend validates it before calling Stripe.
- Legacy rows with no stored duration continue to work: the backend falls back to today's behaviour (`once` if expiry set, else `forever`) when the field is absent.
