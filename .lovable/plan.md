# Wise transfer webhook

Add a public edge function that receives Wise transfer update events, verifies authenticity with Wise's public key, and logs every event to a table. Business logic (updating payments) is deliberately left as a placeholder for a later phase.

## 1. Database

New table `public.wise_webhook_events`:
- `id` uuid pk default `gen_random_uuid()`
- `event_type` text (e.g. `transfers#state-change`)
- `subscription_id` text, `delivery_id` text (unique — idempotency)
- `transfer_id` text, `profile_id` text
- `current_state` text, `previous_state` text, `occurred_at` timestamptz
- `signature_valid` boolean
- `payload` jsonb, `received_at` timestamptz default now()

Follows the existing pattern (`stripe_webhook_events`, `efinsign_webhook_events`): grants to `service_role` (all) and `authenticated` (select), RLS enabled, read policy limited to platform admins. Index on `delivery_id` (unique) and `transfer_id`.

## 2. Edge function `wise-webhook`

- Public (`verify_jwt = false` in `supabase/config.toml`).
- Handles `OPTIONS` with CORS headers, allowing the `x-signature-sha256`/`x-delivery-id`/`x-test-notification` headers.
- Reads the raw body text (needed for signature verification before JSON parsing).
- Verifies `X-Signature-SHA256` (base64 RSA-SHA256 over the raw body) against Wise's public key using WebCrypto `crypto.subtle.importKey('spki', ...)` + `verify`. The key comes from a new secret `WISE_WEBHOOK_PUBLIC_KEY` (PEM). Invalid signature → 401, no row written.
- Responds `200` immediately to Wise's test notification pings.
- Accepts **all transfer update event types** — `transfers#state-change`, `transfers#active-cases`, `transfers#refund`, `transfers#payout-failure` and any other `transfers#*` — normalizing the differing `data` shapes into the columns above; unknown transfer events are still logged with the full payload.
- Inserts one row per event, ignoring duplicates on `delivery_id` (idempotent redelivery).
- Placeholder block with a clear `TODO` comment marking where transfer state will later be applied to `ap_payment_batch_items` / `tax_payments` via `provider_transfer_id`. No records are mutated for now.
- Always returns `200` with `{ received: true }` on successfully verified events so Wise doesn't retry; logs parsing problems to console.

## 3. Secret

Request `WISE_WEBHOOK_PUBLIC_KEY` (Wise's sandbox/production webhook public key, PEM format). Until it's set, the function rejects requests with 401 and logs that the key is missing.

## 4. Deploy

Deploy `wise-webhook`; the callback URL to register in the Wise dashboard is
`https://<project>.supabase.co/functions/v1/wise-webhook`.

## Notes

No frontend changes. No existing payment records are touched in this phase.