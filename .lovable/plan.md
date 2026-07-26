## Problem

Clicking **Subscribe** on the Office Use plan ($0/mo, admin-only) currently calls `openStripeCheckout`, which invokes the `stripe-integration` edge function to create a Stripe Checkout Session. Stripe rejects/complicates $0 subscriptions, and there's no reason to route an internal demo plan through Stripe.

## Change

In `src/pages/SubscriptionCheckout.tsx`, short-circuit `handleSubscribe` when the selected plan is the Office Use tier and there is no existing Stripe subscription. Instead of Stripe:

1. Detect Office Use via `(plan.tier ?? deriveTierFromName(plan.name)) === 'office_use'`.
2. Guard: only admins may activate (already enforced for card visibility, re-check here defensively).
3. Insert a row into `subscriptions` directly (mirrors the admin `assignSubscription` mutation shape):
   - `organization_id`, `plan_id = plan.id`
   - `billing_cycle` = current toggle
   - `status = 'active'`
   - `current_period_start = now`, `current_period_end = +1 month/year`
   - no `stripe_*` fields, no payment method
4. On success: toast "Office Use plan activated", invalidate `['current-subscription']`, and navigate to `/dashboard` (matching post-checkout behavior).
5. If an existing Stripe subscription is active and the user switches TO Office Use, still route through the existing `preview-plan-change` / `manage-subscription` flow so Stripe cancels the paid sub cleanly — no change needed there unless testing shows an issue (out of scope for this fix).

CTA label for Office Use will also change from "Subscribe" to "Activate" for clarity.

## Files

- `src/pages/SubscriptionCheckout.tsx` — branch in `handleSubscribe`; small label tweak in the CTA render.

No edge function, DB, or schema changes.
