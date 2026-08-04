# Route invoice card payments to Wise settlement

Card checkout stays exactly as it is today (the hosted card window collects the card — Visa, Mastercard, Amex, Visa Debit — so no card data touches our pages). What changes is where the money goes after capture: for invoices, the collected funds are settled to Wise instead of staying with the card processor.

## What the user gets

1. **Wise settlement switch** in eFinconnect → Payout Routing → Providers, on the Wise tile:
   - "Settle invoice card payments to Wise" toggle.
   - A picker for the Wise settlement destination (an existing Wise recipient / balance currency).
   - Saved per organization, so each country/company can differ.
2. **Every invoice card surface** honours the switch:
   - Public pay link page `/pay/:id` ("All cards" and any card-only link).
   - The in-app **Pay Now** button on invoices.
3. **Traceability** — after a successful card capture the payment shows a "Settling to Wise" badge, and the Wise transfer appears in the existing Wise transfers list, linked to the invoice and payment link.

## How it works

```text
Payer -> hosted card window (capture, unchanged)
      -> payment recorded against invoice (unchanged: customer_payment + JE)
      -> NEW: settlement leg -> Wise transfer to the org's Wise destination
```

## Technical changes

**Settings / preferences (no migration needed)**
- Extend `organizations.efinconnect_preferences` with `cardSettlement: { provider: 'processor' | 'wise', wiseRecipientId, currency }`.
- New hook `useCardSettlementSettings.ts` reading/writing that JSON, following the pattern in `usePayoutProviderToggles.ts`.
- Wise tile in `src/pages/treasury/PayoutRouting.tsx` gets the toggle + recipient select (recipients come from `useWisePayouts`).

**Settlement execution**
- New edge function `wise-settle-collection`:
  - Input: `payment_link_id` or `invoice_id`, amount, currency, captured reference.
  - Service-role, invoked internally after capture (not from the browser), idempotent per source id.
  - Reads the org preference; if `provider !== 'wise'` it exits as a no-op.
  - Creates a Wise quote + transfer via `WISE_API_TOKEN` / `WISE_PROFILE_ID` (same call shape as `wise-create-transfer`), records the row in `wise_transfers` with `source_type = 'payment_link'` and the invoice id in `reference`.
  - Surfaces Wise's HTTP status and body on failure; the invoice payment itself is never rolled back — the settlement is logged as `failed` for retry.
- `supabase/functions/paysafe-charge-handle/index.ts`: after the existing invoice/payment/JE block succeeds, fire `wise-settle-collection` and write a `payment_link_events` row (`type: 'settlement_initiated' | 'settlement_failed'`).
- `supabase/functions/stripe-webhook` (path used by the Pay Now button via `collect-invoice-payment`): same call on `checkout.session.completed` for invoice sessions.

**UI feedback**
- `src/pages/public/PayLink.tsx` success screen: keep current copy, add "Funds settle to your Wise account" only when Wise settlement is on for the org (read from the existing public config endpoint).
- Invoice payment detail / `InvoicePayNowButton` unchanged in behaviour; the Wise transfer is visible from Payout Routing → Transfers.

**Failure handling**
- If Wise keys are missing or the transfer call fails, the row is stored with `status = 'failed'` and the error text, and a toast/log points to it — the invoice stays paid.
