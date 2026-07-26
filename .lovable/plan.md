## Phase 11 — NG Tax Engine: Taxpayer Portal Sync & E-Filing

With filings and remittances now closing the loop into the GL (Phase 10), the next logical phase is **outbound submission** to Nigerian tax authorities and **inbound reconciliation** with taxpayer portals (FIRS TaxProMax, State IRS portals like LIRS eTax).

### Scope

1. **E-Filing Submission Layer**
   - New edge function `ng-tax-submit-filing` that packages a `ng_tax_filings` row into the authority-specific payload format (FIRS VAT schedule, PAYE schedule, WHT schedule, CIT return).
   - Support two submission modes per authority:
     - **API mode** (where credentials configured in `tax_authority_credentials`) — direct POST to authority endpoint.
     - **Manifest mode** (default) — generate signed XLSX/CSV manifest + cover letter PDF for manual upload, stored in `ng-tax-receipts` bucket.
   - Capture submission acknowledgment (reference number, timestamp) back onto the filing row.

2. **Filing Status Lifecycle**
   - Extend `ng_tax_filings.status` to include `submitted`, `acknowledged`, `rejected`.
   - Add columns: `submission_reference`, `submitted_at`, `acknowledged_at`, `rejection_reason`.
   - New RPC `ng_mark_filing_submitted(filing_id, reference, mode)` and `ng_mark_filing_acknowledged(filing_id, ack_ref)`.

3. **Compliance Calendar**
   - Extend the Compliance tab with a monthly calendar view showing due dates per tax type (VAT: 21st, PAYE: 10th, WHT: 21st, CIT: annual).
   - Color-coded: green (submitted), amber (due <7 days), red (overdue).
   - "Prepare filing" shortcut per calendar cell.

4. **Reconciliation Report**
   - New "Reconciliation" sub-tab under Reports comparing ledger accruals vs filed amounts vs remitted amounts per period.
   - Highlights variances (accrued but not filed, filed but not remitted, over-remitted).

5. **Notifications**
   - Add rows to existing notification/toast layer when filings become due in 3 days or overdue, driven by a scheduled edge function `ng-tax-due-scanner` (daily cron).

### Technical Details

**Migration**
- `ALTER TABLE ng_tax_filings` — new status values + submission columns.
- New RPCs: `ng_mark_filing_submitted`, `ng_mark_filing_acknowledged`, `ng_get_reconciliation(period_start, period_end)`.

**Edge Functions**
- `supabase/functions/ng-tax-submit-filing/index.ts` — payload builder + dispatcher.
- `supabase/functions/ng-tax-due-scanner/index.ts` — daily cron scanning `ng_tax_filings` and upcoming period-ends.

**Frontend**
- `src/pages/tax/NigeriaTaxEngine.tsx` — add Calendar view to Compliance tab, Reconciliation sub-tab under Reports, Submit-filing dialog with mode selector.
- `src/lib/ngTax/submission.ts` — client-side helpers for invoking the submit function and downloading manifests.
- `src/hooks/useNgTaxSubmission.ts` — mutation hooks for submit/acknowledge/reject.

**No changes to transaction flows** — Phase 11 is purely outbound compliance + reconciliation UI.

### Out of Scope (deferred to later phases)
- Real API integration with FIRS TaxProMax (requires production credentials + sandbox access).
- E-signature workflow on submissions (would reuse existing document-signing module).
- Multi-year CIT computation with capital allowances (Phase 12).

Proceed with Phase 11?
