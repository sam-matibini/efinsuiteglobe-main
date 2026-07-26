## Phase 10 — NG Tax Engine: Filing Automation & Remittance Workflow

With the ledger now capturing taxes from Invoices, Bills, Vendor Payments, and Payroll, the next logical phase closes the loop: turning ledger entries into filed returns and posted remittances with full accounting integration.

### Scope

1. **Automated Filing Generation from Ledger**
   - Extend `generate_ng_filing` RPC to aggregate ledger rows by tax type + period, instead of manual entry.
   - Support VAT (monthly), PAYE (monthly), WHT (monthly), Pension (monthly), CIT (annual).
   - Auto-populate taxable base, tax amount, exemptions applied, and line-item counts.
   - Mark contributing ledger rows with `filing_id` on generation (traceability).

2. **Remittance → Journal Entry Posting**
   - When a remittance is posted via `post_ng_remittance`, auto-create a journal entry:
     - Dr: Tax Liability account (from `ng_tax_account_mappings`)
     - Cr: Bank/Cash account (user-selected)
   - Link JE back to remittance and ledger rows (`remittance_id`, `journal_entry_id`).
   - Update ledger row status from `filed` → `remitted`.

3. **Filing Review & Approval Workflow**
   - Add "Review" step in Filings tab: draft → review → submitted → filed.
   - Show line-level breakdown drill-down (per invoice/bill/pay stub) before submission.
   - Capture submitter, reviewer, submitted_at, filing reference number.

4. **Compliance Dashboard**
   - New "Compliance" tab: upcoming filing deadlines by tax type, overdue alerts, YTD remittance totals vs. accrued liability reconciliation.

5. **Remittance Receipt Attachment**
   - Allow uploading FIRS/State IRS/Pension custodian receipts against remittance records.
   - Store in Supabase Storage bucket `ng-tax-receipts` with RLS.

### Technical Details

- **DB migration**: add `filing_id`, `remittance_id`, `journal_entry_id` FKs on `ng_tax_transaction_ledger` (some may exist — verify first). Add `status` enum transitions. Create `ng-tax-receipts` storage bucket with per-org RLS.
- **RPCs**: rewrite `generate_ng_filing` to aggregate from ledger; extend `post_ng_remittance` to write JE via existing journal helpers; add `submit_ng_filing_for_review` and `approve_ng_filing`.
- **UI**: enhance `NigeriaTaxEngine.tsx` Filings tab with review drawer + line breakdown; enhance Remittances tab with bank account selector + receipt upload; new Compliance tab.
- **Hooks**: extend `useNgTaxCalculation.ts` / add `useNgFilings.ts`, `useNgRemittances.ts`.
- **No-op guard**: all new flows gate on org country = NG.

### Out of Scope (future phases)

- Direct e-filing API integration with FIRS TaxPro-Max (Phase 11).
- Multi-state (Lagos LIRS, Rivers, etc.) tax authority-specific forms.
- Bulk import of historical filings.
