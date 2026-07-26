## Nigerian Tax Engine — Remaining Phases Rollout

Wire the already-shipped engine (schema, calculators, ledger, filings, remittances, admin UI) into live transaction flows and finish reporting/exemptions.

### Phase 3 — Transaction Integration
Attach `useNgTaxCalculation` to the four transaction surfaces so every NG-jurisdiction posting writes to `ng_tax_transaction_ledger`.

1. **Invoices (VAT output)**
   - In `src/pages/invoicing/InvoiceForm.tsx` (and line editor), when org jurisdiction = NG: auto-resolve VAT definition, compute per-line VAT, show a "NG VAT" summary row.
   - On invoice post: call `record()` with `source_type='invoice'`, link `journal_entry_id`.

2. **Bills (WHT + input VAT)**
   - In `src/pages/purchases/BillForm.tsx`: add a WHT service-class selector per line (defaults from vendor profile → `ng_tax_service_classifications`).
   - Compute WHT withheld + input VAT; reduce vendor payable by WHT; write two ledger rows (VAT_INPUT, WHT) on post.

3. **Payroll (PAYE + Pension)**
   - In `src/lib/payroll/processing.ts` (NG branch): replace any inline PAYE math with `calculators.paye()` and `calculators.pension()`.
   - Write ledger rows per pay stub with `source_type='pay_stub'`, `source_id=pay_stub.id`.

4. **Vendor Payments (WHT remittance trigger)**
   - On payment of a bill with WHT ledger rows: mark those rows as `withheld=true` and surface in the Remittances tab.

### Phase 5 completion — Filings polish
- Add filing PDF export (VAT, WHT, PAYE, CIT) using existing `print_templates` pattern.
- Add "Amend filing" action (creates v2, supersedes v1).

### Phase 6 completion — Remittances
- Hook "Post Remittance" to `payments` module: create a `tax_payments` row + JE via existing tax payment infra, then call `ng_post_remittance`.
- Add FIRS/State IRS payee presets in `cra_payee_catalog`-equivalent (new `ng_payee_catalog` seed rows).

### Phase 7 — Reporting & Traceability
- **Reports tab** on `/tax/nigeria`: monthly VAT return, WHT schedule (WHT-01/02), PAYE schedule (Form G/H1), CIT computation — all sourced from `ng_tax_ledger_summary` + ledger drill-down.
- **Traceability drawer**: click any ledger row → shows source txn, JE lines, filing, remittance in one panel.
- Add CSV export per report.

### Phase 8 — Exemptions & Reliefs
- CRUD UI for `ng_tax_exemptions` and `ng_tax_reliefs` (already tables) on the existing tab.
- Resolver enhancement: apply exemption (customer/vendor/item scoped) before calc; apply reliefs (PAYE consolidated relief already in; add pension voluntary, NHF, life assurance).

### Technical notes
- All calls go through `useNgTaxCalculation` — no direct SQL from components.
- Ledger writes are inside the same JE-posting transaction (RPC wrapper) to guarantee traceability.
- Feature-gate every hook by `organization.country_code === 'NG'` to avoid affecting CA/US/GB flows.
- Add vitest coverage for each integration point (invoice VAT, bill WHT, payroll PAYE) mirroring existing calculator tests.

### Deliverables order
1. Phase 3 (Invoices → Bills → Payroll → Payments)
2. Phase 7 Reports + Traceability drawer
3. Phase 8 Exemptions/Reliefs CRUD + resolver
4. Phase 5/6 polish (PDF export, amendments, payee presets)
