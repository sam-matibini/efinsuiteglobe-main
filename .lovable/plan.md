## Phase 9 — Wire NG Tax Engine into Transaction Flows

Connect the integration helpers built in `src/lib/ngTax/integration.ts` into the actual invoice, bill, payroll, and payment forms so the ledger populates from real user activity.

### Scope

1. **Invoices (AR)**
   - In `CreateInvoiceDialog` / invoice save path: after invoice + JE are persisted, call `recordInvoiceTaxes({ orgId, invoiceId, journalEntryId, lines })`.
   - Guard behind org jurisdiction = NG (helper already no-ops otherwise, but skip the query when possible).
   - Show resolved VAT/WHT breakdown in the invoice totals panel using `useNgTaxCalculation`.

2. **Bills (AP)**
   - In `CreateBillDialog` / bill save path: call `recordBillTaxes(...)` with vendor + lines.
   - When a bill is marked paid and WHT applies, call `markBillWhtWithheld(billId, paymentDate)` from the payment flow so the WHT ledger row flips to `withheld`.
   - Surface WHT-to-withhold amount on the bill summary.

3. **Payroll**
   - In the pay-run finalization path (where JEs are posted): call `recordPayrollTaxes({ orgId, payRunId, employeeId, gross, journalEntryId })` per pay stub for NG employees.
   - Ensures PAYE + Pension appear in the ledger tied to the payroll JE.

4. **Traceability polish**
   - From invoice/bill/pay-stub detail views, add a "Tax Ledger" link that opens the existing Traceability Drawer filtered to that `source_transaction_id`.

### Technical Details

- Helpers are already idempotent-friendly (they write ledger rows keyed by source id); add a pre-check to avoid duplicate inserts on edit/repost.
- Reuse `useOrganization` to get `orgId` and skip when `country_code !== 'NG'`.
- No schema changes required — all tables and RPCs already exist from prior phases.
- Files to touch (expected):
  - `src/components/invoices/CreateInvoiceDialog.tsx` (+ edit dialog)
  - `src/components/bills/CreateBillDialog.tsx` (+ edit dialog, payment dialog)
  - `src/hooks/usePayRunProcessing.ts` (or equivalent finalize path)
  - `src/pages/tax/NigeriaTaxEngine.tsx` — expose drawer open by source id
  - Invoice/Bill/PayStub detail views — add "Tax Ledger" link

### Out of Scope

- New tax types or rate changes
- Non-NG jurisdictions
- Filing generation changes (already implemented)

### Verification

- Create a test NG invoice with VAT + WHT line → confirm two ledger rows appear in `/tax/nigeria` Reports tab with links back to invoice + JE.
- Create a test NG bill, mark paid → WHT row status flips to `withheld`.
- Run a payroll for an NG employee → PAYE + Pension rows appear tied to the pay run JE.
- Typecheck clean.
