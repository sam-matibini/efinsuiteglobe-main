## Goal

Make Wise a first-class payout partner alongside Stripe across eFinconnect, add Wise-backed bill payment methods (EFT / e-Transfer / card), add a Stripe-style checkout form, and collapse the three Stripe sidebar entries into one "Payout Routing" hub.

## 1. Sidebar / eFinconnect reorganization

`src/components/layout/Sidebar.tsx` — eFinconnect children become:

```text
Dashboard | CRA Payments | AP Payments | Payroll Payments
Scheduled | Payment History | Payment Links
Payout Routing        <- new hub (/banking-payments/payout-routing)
Approvals | CRA Accounts | Settings
```

Remove the standalone "Stripe Connect", "Payout Routing", "Stripe Compliance" items.

New page `src/pages/treasury/PayoutRouting.tsx` with tabs:
- **Providers** — Stripe Connect vs Wise cards (status, connect/manage)
- **Vendor routing** — existing `StripeConnectRouting` table, extended with a per-vendor provider column (`stripe` | `wise`) and Wise recipient selection
- **Connected accounts** — existing `StripeConnectedAccounts`
- **Compliance** — existing `StripeConnectCompliance`

Old routes redirect into the corresponding tab so nothing breaks.

## 2. Wise as a payout partner

Database (migration, with GRANTs + RLS scoped to org membership):
- `wise_payout_recipients` — org_id, vendor_id/employee_id, currency, account holder, IBAN/account+routing/sort code, wise_recipient_id, status
- `wise_transfers` — org_id, source_type (`bill` | `ap_batch` | `payroll` | `tax` | `payment_link`), source_id, recipient_id, amount, currency, method (`eft` | `etransfer` | `card`), wise_quote_id, wise_transfer_id, reference, status, error
- extend `vendor_stripe_connect` usage with a `payout_provider` column on a new `vendor_payout_routing` view/table so routing is provider-agnostic

Edge functions:
- `wise-create-recipient` — creates/upserts a Wise recipient
- `wise-create-transfer` — quote → transfer → fund, writes `wise_transfers`, records the GL/vendor payment on success
- extend existing `wise-webhook` to move `wise_transfers` rows through `processing` → `outgoing_payment_sent` / `funds_refunded` and mark the linked bill/batch paid

Secrets: the plan assumes `WISE_API_TOKEN` and `WISE_PROFILE_ID` exist. They are **not** currently in this project's secret store (only `GOOGLE_AI_API_KEY`, `LOVABLE_API_KEY`, `PAYROLL_ENCRYPTION_KEY`), so I'll request them before wiring the live calls. Until they're present, transfers record as `instructed` instead of failing.

## 3. Bill payment methods

- `useAPPaymentBatches` `BatchProvider` gains `wise_eft`, `wise_etransfer`, `wise_card`.
- `APPayments.tsx` "Create AP Payment Batch" dialog: Provider select grouped as **Wise** (EFT, e-Transfer, Card) / **Stripe** / **Paysafe** / **Manual**; funding-bank field switches to Wise balance currency when a Wise rail is picked.
- New `PayBillDialog` action on a bill (`ViewBillDialog`) → opens the checkout form (below) with EFT / e-Transfer / Card tabs, posting through `wise-create-transfer` and the existing bill-payment GL path.

## 4. Checkout form (shared)

New `src/components/payments/CheckoutForm.tsx` modelled on the screenshot:
- express row (Apple Pay / Link) when Stripe is the processor
- Contact information (email)
- Payment method card: Card (number / expiry / CVC / cardholder), or EFT bank fields, or e-Transfer email
- Billing address block (country, address 1/2, city, state, postal) with country-aware labels
- "Save payment information" checkbox, sticky Pay button with amount

Used in two places:
- public `/pay/:linkId` page (`PayLink`) — replaces the current inline form
- in-app bill payment dialog from §3

Card fields stay tokenized by the processor (Stripe Elements / Paysafe.js); no raw PAN touches our DB.

## 5. Payment Links

`PaymentLinks.tsx`: add `wise` alongside existing processors — accepted methods gain **EFT (Wise)** and **e-Transfer (Wise)**, and payout partner selection (Stripe / Wise) per link, persisted in the link metadata and honoured by the checkout page.

## Technical notes

- Existing platform-level `wise_receiving_accounts` (inbound invoice payments) is untouched; this adds the outbound payout side.
- All new tables get `GRANT`s plus org-scoped RLS; edge functions use the service role and verify org membership.
- Country/localization: Wise method availability filtered by org country using the existing `countryTreasuryConfig` (e-Transfer CA-only, EFT for CA/US/EU/UK, card everywhere).
