# Square online checkout integration

Add Square Checkout (Payment Links API) as an additional card-payment provider alongside the existing Paysafe / Stripe flows, so an invoice or payment link can be paid on Square's hosted checkout page.

## How it will work

1. On the public pay page (`/pay/{id}`) and the in-app "Pay Now" button, when Square is the selected card provider the app calls a new edge function which creates a Square payment link for the exact balance due.
2. Square returns `payment_link.url` / `long_url` (as in the sample response). The payer is redirected to Square's hosted checkout.
3. Square notifies us on completion via webhook; we mark the payment link paid, record the payment against the invoice, and keep the Square `order_id` and `payment_link.id` for traceability.
4. Square appears as a toggleable tile in eFinconnect → Payout Routing → Providers, next to Wise, Stripe Connect, eFinMoney, Paysafe.

## Steps

1. **Secrets** — request `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_ENVIRONMENT` (sandbox/production) and `SQUARE_WEBHOOK_SIGNATURE_KEY` from you via the secure secret form. Nothing is hardcoded.
2. **Database** — add nullable columns to `payment_links`: `square_payment_link_id`, `square_order_id`, `provider` (`paysafe` | `stripe` | `square`). No data migration needed; existing rows default to their current behaviour.
3. **Edge function `square-create-payment-link`** — validates the link/invoice, calls `POST /v2/online-checkout/payment-links` with a quick-pay line item (name = invoice/description, amount in minor units, currency from the link), stores the returned ids, returns `url`.
4. **Edge function `square-webhook`** — verifies the Square signature, handles `payment.updated` / `order.updated` COMPLETED events, marks the payment link paid, inserts the invoice payment and updates `balance_due`, idempotent by Square payment id.
5. **UI** —
   - `src/pages/public/PayLink.tsx`: when the link's provider is Square, show a "Pay with card (Square)" button that redirects to the hosted checkout instead of loading the Paysafe SDK.
   - `src/components/invoices/InvoicePayNowButton.tsx`: route to Square when enabled.
   - `src/pages/treasury/PayoutRouting.tsx`: add a Square `ProviderTile` with enable toggle, configured/not-configured state, and a link to the Square dashboard. Logo already exists at `src/assets/processor-logos/square.svg`.
6. **Provider selection** — Square is off by default; when enabled it becomes the card provider for new links. Existing Paysafe/Stripe/Wise flows stay untouched.

## Technical notes

- Square amounts are integer minor units (`12500` = $125.00), matching the sample response; conversion happens in the edge function.
- API base: `https://connect.squareupsandbox.com` (sandbox) or `https://connect.squareup.com`, selected by `SQUARE_ENVIRONMENT`.
- All Square API calls are server-side only; the access token never reaches the browser.
- Webhook signature verified with HMAC-SHA256 over notification URL + raw body, per Square's spec.
- Wise settlement of card collections is unaffected; Square settles to the connected Square account.
