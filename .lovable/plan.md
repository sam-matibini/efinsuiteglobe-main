## Goal

Let customers pay an invoice by Wise transfer: the invoice shows your Wise account details for the invoice's currency plus a unique payment reference, and the existing `wise-webhook` matches incoming deposits to the invoice by that reference and records the payment.

## What I verified first

- `supabase/functions/wise-webhook/index.ts` is the only Wise code today; it verifies the RSA signature and logs events into `wise_webhook_events`, with payment-record updates still a TODO.
- Its `mapEvent` already handles `balances#credit` / `balances#update` (amount, currency, balance id, post-transaction balance, transaction type), but Wise's balance webhook payload carries **no payer reference** — so the reference must be read back from Wise's API. Since `WISE_API_TOKEN` is already stored, that lookup is available.
- Invoice payment methods are hardcoded to `cc` / `ach` / `interac` tabs in `src/components/invoices/PaymentMethodsTabs.tsx`, toggled by org settings in `src/components/settings/PaymentSettingsTab.tsx`.
- Payments are recorded via `useCustomerPayments.createPayment`, which updates the invoice balance/status and posts a cash-vs-AR journal entry.

## Plan

### 1. Database

New table `public.wise_receiving_accounts` (one row per organization + currency):
`organization_id`, `currency`, `account_holder_name`, `bank_name`, `account_number`, `routing_number`, `iban`, `bic_swift`, `sort_code`, `institution_address`, `wise_profile_id`, `wise_balance_id`, `gl_bank_account_id` (link to an existing `bank_accounts` row so the journal entry hits the right cash account), `is_active`, `notes`. GRANTs for `authenticated` + `service_role`, RLS scoped to org membership (members read, org admins/owners write), `updated_at` trigger.

Invoice / settings side:
- `invoices.wise_payment_reference` — unique short code generated on issue (e.g. `INV1042-7F3K`).
- `wise_enabled` on the org payment settings, next to the existing cc/ach/interac flags.
- `wise_webhook_events.matched_invoice_id`, `match_status`, `matched_reference` for auditability.

### 2. Settings UI

Add a **Wise** section to `PaymentSettingsTab.tsx`: enable toggle plus a per-currency table to add/edit/delete receiving accounts (reusing `ConfirmDeleteDialog`), each row optionally linked to a GL bank account.

### 3. Invoice display

Add a Wise tab to `PaymentMethodsTabs.tsx` following the existing pill + expandable-panel pattern. It shows only the populated fields for the account matching the invoice currency (falling back to the default-currency account with a note), and prominently shows the reference the customer must include. Same data wired into `InvoicePreviewTab`, `InvoiceDetailPanel`, the share/public view, and `src/lib/generateInvoicePdf.ts` so the PDF matches the preview.

### 4. Reference-based auto-matching in `wise-webhook`

On a `balances#credit` event:
1. Resolve the organization from `wise_balance_id` / `wise_profile_id` via `wise_receiving_accounts`.
2. Call the Wise API with `WISE_API_TOKEN` to fetch the balance statement for a short window around the event (`/v1/profiles/{profileId}/balance-statements/{balanceId}/statement.json`, or the account-statement equivalent) and pull the payer reference/description for the matching credit line. Profile id comes from the stored account row, or is discovered once via `/v2/profiles` and cached there.
3. Extract the invoice reference from that text and look up `invoices.wise_payment_reference`.
4. On a match, insert a `customer_payments` row (method `wise`, reference = Wise reference, bank account = the row's `gl_bank_account_id`) using the same balance/status/journal logic as the app, then stamp `matched_invoice_id` and `match_status='matched'`.
5. Fallback when no reference is found: match a single open invoice with equal amount and currency. Zero or multiple candidates → `match_status='unmatched'` / `'ambiguous'`, no payment recorded.
6. If the Wise API call fails, log it and fall back to step 5 rather than dropping the event.

### 5. Manual review surface

Add an "Unmatched Wise deposits" list (Payments page) showing unmatched/ambiguous credit events with an action to attach one to an invoice, recording the payment through the normal path.

## Technical notes

- Money-in only; no Wise payouts in this phase.
- All recorded payments go through the same invoice-update + journal-entry logic so GL, trial balance and AR aging stay correct.
- Webhook stays idempotent on `delivery_id`, with an extra guard against inserting a duplicate `customer_payments` row for the same event.
- No new secrets needed — `WISE_API_TOKEN` and `WISE_WEBHOOK_PUBLIC_KEY` are already stored.
