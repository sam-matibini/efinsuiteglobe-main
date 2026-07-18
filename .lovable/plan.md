# Phase 4 — Webhook Hardening

The `stripe-webhook` edge function works but has security and reliability gaps. This phase makes it production-grade without changing any UI.

## Current gaps (verified in `supabase/functions/stripe-webhook/index.ts`)

1. **Signature secret is optional.** If `STRIPE_WEBHOOK_SECRET` is unset, events are accepted unsigned. Anyone hitting the URL can mutate subscriptions.
2. **Signature comparison is not timing-safe.** Uses `===` inside `.some()`.
3. **No event idempotency.** Stripe retries the same `event.id` on any non-2xx; the handler would re-run (double-updating subscriptions, potentially creating duplicate JEs — the customer-payment path is deduped by `reference`, but the subscription path is not).
4. **No event audit log.** Nothing to inspect after the fact.
5. **Missing subscription events**: `invoice.payment_failed`, `customer.subscription.trial_will_end`, `customer.discount.created/updated/deleted` (the last three matter now that admin overrides attach coupons).
6. **Error handling returns 500 for every failure.** Business errors (missing org, unknown subscription) will be retried by Stripe forever. Should log + return 200 for non-retriable cases and reserve 5xx for transient infra failures.
7. **Discount deletion in Stripe doesn't clear `subscriptions.stripe_coupon_id`** locally, so the UI can show a coupon that's already gone.

## Plan

### 1. Signature verification — required + timing-safe
- Return 500 if `STRIPE_WEBHOOK_SECRET` is not configured (fail closed).
- Replace the current byte-string `===` compare with a constant-time comparison over the raw byte arrays.
- Keep 5-minute timestamp tolerance.

### 2. Idempotency via a new `stripe_webhook_events` table
Migration:
```sql
CREATE TABLE public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  status text NOT NULL DEFAULT 'received', -- received | processed | failed | ignored
  error text,
  payload jsonb
);
GRANT ALL ON public.stripe_webhook_events TO service_role;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform admins can read webhook events"
  ON public.stripe_webhook_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'));
```
Handler flow:
1. Verify signature.
2. Insert `{event_id, event_type, payload, status:'received'}`; if the insert hits the PK conflict, respond `200 { duplicate: true }` and stop.
3. Run the switch.
4. On success: update row to `status='processed', processed_at=now()`.
5. On non-retriable failure: `status='ignored'` + error message, return 200.
6. On transient failure (DB/network): `status='failed'`, return 500 so Stripe retries.

### 3. New event handlers
- `invoice.payment_failed` → set subscription `status='past_due'`.
- `customer.subscription.trial_will_end` → mark `trial_ending_notified_at` (add column if needed — will confirm before migrating; skip if not needed for now and just log).
- `customer.discount.deleted` → find subscription by `stripe_subscription_id` from `event.data.object.subscription` and null out `stripe_coupon_id`, `discount_percent`, `discount_amount`.
- `customer.discount.created` / `updated` → mirror coupon id + percent/amount onto the row (keeps local state honest when discounts are applied via the Stripe Dashboard too).

### 4. Error-handling policy
- Any `throw` inside a case is caught, logged, and — unless it's a Supabase/network exception — returns 200 with `{ ignored: true, reason }`. This stops Stripe's retry storm on business-logic bugs while still surfacing them in the `stripe_webhook_events` table and Edge Function logs.
- Reserve 5xx for signature/insert/DB-outage failures.

### 5. Small cleanups
- Extract each `case` into its own function for readability (`handleCheckoutCompleted`, `handleInvoicePaid`, `handleSubscriptionUpdated`, `handleSubscriptionDeleted`, `handleInvoicePaymentFailed`, `handleDiscountEvent`).
- Log `event.id` on every branch for traceability.

## Files touched
- `supabase/functions/stripe-webhook/index.ts` — rewrite in place with the improvements above.
- New migration for `stripe_webhook_events`.
- No frontend changes.

## Out of scope (deliberately)
- Admin UI to browse webhook events (can be a follow-up if you want visibility beyond the Supabase table view).
- Replaying failed events from the DB — flag only for now.

Approve and I'll implement.
