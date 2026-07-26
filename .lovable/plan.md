## Nigerian Tax Engine — Complete Rollout (Phases 3, 5, 6, 7)

Phase 1 (schema + seeds), Phase 2 (calculation library), and Phase 4 (admin UI) are already live. This plan wires the engine into real transactions and closes the loop through filings, remittances, and reporting.

### Phase 3 — Transaction Integration
Hook the engine into the modules that generate taxable events so every calculation writes to `ng_tax_transaction_ledger` with full traceability.

- **Sales (Invoices / POS)**: VAT auto-calc per line using `ng_tax_service_classifications`; supports exempt / zero-rated / standard. Write ledger rows linked to `invoices.id` + `journal_entries.id`.
- **Purchases (Bills / Expenses)**: Input VAT recovery + WHT deduction at source based on vendor service class and threshold rules. Split JE: expense / input VAT receivable / WHT payable / net payable to vendor.
- **Payroll (Pay Runs)**: PAYE (consolidated relief + progressive brackets), Pension (8% employee / 10% employer), NHF, ITF, NSITF via `calculators.ts`. Attach to `pay_stubs` and write ledger + JE.
- **Corporate Income Tax accrual**: Period-end job computes CIT (tiered small/medium/large) + TET, posts provision JE.
- All writes go through `ledgerWriter.ts` inside a single transaction with the source JE (rollback on failure).

### Phase 5 — Filings & Returns
Build filing generators that aggregate ledger rows into authority-ready returns.

- **New table** `ng_tax_filings` already exists — add generator RPCs:
  - Monthly VAT return (FIRS TaxProMax format)
  - Monthly PAYE schedule (State IRS)
  - Monthly WHT schedule (Federal + State split)
  - Monthly Pension/NHF/ITF/NSITF schedules
  - Annual CIT + TET return
- Each filing snapshots the underlying ledger row IDs so re-opens/amendments are auditable.
- UI: `/tax/nigeria/filings` — list, drill-down to source transactions, generate/regenerate, mark filed, attach receipt.

### Phase 6 — Remittances & Payments
Close the loop from filing → payment → GL clearance.

- **New table** `ng_tax_remittances` (already scaffolded) — link remittance to filing + payment JE.
- Payment workflow: select filing → choose bank account → post payment JE (Dr Tax Payable / Cr Bank) → mark ledger rows remitted.
- Reconciliation view: outstanding tax payables by authority, aged.

### Phase 7 — Reporting & Traceability
End-to-end drill-through across the whole chain.

- **Nigeria Tax Dashboard** additions:
  - VAT position (output − input, net payable)
  - PAYE by employee, by period
  - WHT by vendor, by service class
  - CIT provision vs paid
- **Traceability drawer**: from any ledger row click through to source transaction → JE → filing → remittance → bank payment.
- **Exemptions & Reliefs UI**: manage `ng_tax_exemptions` and `ng_tax_reliefs` (pioneer status, export incentives, TET credits).
- **Audit export**: CSV/PDF pack per return period for FIRS/SIRS audits.

### Technical Notes
- All new SQL via `supabase--migration`; every new `public` table gets GRANTs + RLS scoped to `organization_id` via `has_org_access`.
- New calculators reuse `src/lib/ngTax/` — no rate hard-coding; everything resolves through `resolver.ts`.
- Ledger writes are idempotent (unique on `source_type + source_id + tax_definition_id + period`) so re-runs don't double-post.
- New edge functions: `ng-tax-generate-filing`, `ng-tax-post-remittance`, `ng-tax-cit-accrual` (scheduled monthly via pg_cron).
- New routes under `/tax/nigeria/`: `filings`, `remittances`, `exemptions`, `reports`.

### Deliverable Order
1. Phase 3 hooks (Sales → Payroll → Purchases → CIT accrual)
2. Phase 5 filing generators + UI
3. Phase 6 remittance workflow + UI
4. Phase 7 reports, traceability drawer, exemptions UI, audit export
