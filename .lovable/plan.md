# Nigerian Tax Engine — Configurable & Traceable

Build a fully data-driven Nigerian tax framework layered on the existing tax primitives (`tax_codes`, `tax_authorities`, `tax_jurisdiction_rates`, `payroll_deduction_types`, `payroll_rate_brackets`, `wht_regimes`, `tax_filing_periods`). No rates hard-coded in payroll or sales code paths — every calculation reads from effective-dated config.

## Scope of Nigerian Taxes Covered

| Tax | Authority | Type | Base |
|---|---|---|---|
| VAT (7.5%) | FIRS | Sales/Purchase | Invoice net |
| PAYE | State IRS (36 states + FCT) | Payroll (progressive) | Consolidated Relief-adjusted income |
| WHT (5/10%) | FIRS / SIRS | Withholding | Vendor invoice by service class |
| Pension (8% EE / 10% ER) | PenCom | Payroll | Basic + Housing + Transport |
| NHF (2.5%) | FMBN | Payroll | Basic salary |
| NHIS / NSITF / ITF / EDT | Multiple | Payroll / Corporate | Various |
| CIT / TET | FIRS | Corporate | Assessable profit |

## Data Model (new + extended tables)

New tables (all effective-dated):

- **`ng_tax_definitions`** — one row per tax (VAT, PAYE, WHT-services, PENSION-EE, PENSION-ER, NHF, NHIS, NSITF, ITF, EDT, CIT, TET). Columns: `code`, `name`, `jurisdiction_level` (federal/state/lga), `authority_id`, `tax_category` (sales | payroll | withholding | corporate), `base_formula` (json), `filing_frequency`, `remittance_due_offset_days`, `debit_account_mapping`, `credit_account_mapping`.
- **`ng_tax_rate_versions`** — effective-dated rate/bracket sets. Columns: `definition_id`, `effective_from`, `effective_to`, `calculation_method` (flat | percentage | progressive | formula), `formula` (jsonb DSL), `brackets` (jsonb), `min_threshold`, `max_cap`, `source_reference` (e.g. "Finance Act 2023 s.14").
- **`ng_tax_exemptions`** — effective-dated exemption rules per tax (item class, entity type, jurisdiction, condition expression).
- **`ng_tax_reliefs`** — PAYE consolidated relief allowance components (CRA = ₦200k or 1% of gross + 20% gross; pension, NHF, NHIS, life-assurance reliefs).
- **`ng_tax_service_classifications`** — WHT service categories (construction 5%, professional 10%, rent 10%, dividends 10%, etc.) mapping to definition + rate version.
- **`ng_tax_account_mappings`** — per-org override of default GL accounts (payable, expense, receivable/ITC).
- **`ng_tax_transaction_ledger`** — the universal trace table. One row per tax amount produced anywhere. Columns: `id`, `organization_id`, `definition_id`, `rate_version_id`, `source_type` (invoice_line | bill_line | payroll_line | journal_line | expense_line), `source_id`, `source_parent_id` (invoice/bill/pay_stub id), `taxable_base`, `tax_rate`, `tax_amount`, `computed_at`, `journal_entry_line_id`, `filing_period_id`, `remittance_id`, `status` (accrued | filed | remitted | reversed). This is the join spine: return ↔ transaction ↔ JE ↔ payment.
- **`ng_tax_filings`** — extends `tax_filing_periods` with NG-specific filing forms (VAT Form 002, PAYE Form H1, WHT credit notes, PenCom Schedule).
- **`ng_tax_remittances`** — payment/remittance records linking a filing to bank payment + confirmation refs.

Extend `payroll_deduction_types` seed for NG: PAYE, PENSION-EE, PENSION-ER, NHF, NHIS, NSITF, ITF. Rates live in `payroll_rate_brackets` (already effective-dated) — no code changes to bracket structure.

## Calculation Engine

`src/lib/ngTax/`:

- `definitions.ts` — types for definitions, versions, formulas.
- `resolver.ts` — `resolveTax(code, asOfDate, jurisdiction)` returns the active rate version. Single lookup path for all callers.
- `formulaEvaluator.ts` — safe evaluator for the `formula` jsonb DSL (supports `{op, args}` trees: add/sub/mul/div, min/max, bracket lookup, reference to base variables).
- `calculators/vat.ts`, `paye.ts`, `wht.ts`, `pension.ts`, `nhf.ts`, `corporate.ts` — each accepts a context (taxable base, entity, date, exemptions) and returns `{ taxAmount, rateVersionId, breakdown, journalTemplate }`.
- `journalTemplate.ts` — converts a calculation result into balanced JE lines using `ng_tax_account_mappings`.
- `ledgerWriter.ts` — writes `ng_tax_transaction_ledger` row and links `journal_entry_line_id` after JE posts. All calculators MUST go through this so traceability is enforced.

## Integration Points (no rate hard-coding)

- **Sales invoices** — `useResolvedTaxCode` already routes to `tax_codes`. For NG orgs, tax_code → definition → active version → VAT calc. Ledger row per invoice_line.
- **Purchase bills / expenses** — same path plus WHT: on save, `wht.ts` classifies service, computes WHT, produces (a) reduction of vendor payable and (b) WHT payable credit; both traced in ledger.
- **Payroll** — extend `globalPayrollCalculator.ts` to load NG brackets from `payroll_rate_brackets` via `resolver.ts`. Emit one ledger row per (employee, pay_stub_line, tax_definition).
- **Journal entries** — manual JEs touching a NG payable account can optionally attach a definition_id for filing inclusion.

## Filing & Remittance

- **`useNgTaxFiling(definition, periodId)`** hook aggregates `ng_tax_transaction_ledger` where `status='accrued'` and `filing_period_id=periodId`, producing the return form data.
- Filing lock: on submission, ledger rows flip to `filed` and are frozen. Remittance batch flips to `remitted` and stamps `remittance_id`.
- **Reverse traceability**: drilldown from any filing line → ledger rows → source transaction + JE line + remittance.

## UI

- **`/tax/nigeria/setup`** — wizard to enable Nigerian tax pack, register org for each tax (TIN, VAT reg, PAYE state, PENCOM PIN, etc.), and seed default account mappings.
- **`/tax/nigeria/definitions`** — admin list of tax definitions with effective-dated versions; edit brackets/formulas without deploying code.
- **`/tax/nigeria/filings`** — VAT / PAYE / WHT / Pension filing dashboards with drilldown into ledger.
- **`/tax/nigeria/remittances`** — payment tracker.
- Enhance existing `TaxAuditTrail.tsx` to show `ng_tax_transaction_ledger` chain (source → JE → filing → remittance) as a single audit view.

## Seeding (idempotent migration)

- Insert Nigeria country row if missing, all 36 states + FCT jurisdictions, FIRS + each SIRS + PenCom + FMBN + NSITF + ITF authorities.
- Seed `ng_tax_definitions` for each tax + initial `ng_tax_rate_versions` (Finance Act 2023 rates: VAT 7.5%; PAYE brackets 7/11/15/19/21/24%; CRA formula; WHT 5%/10% by service; Pension 8/10; NHF 2.5%; NSITF 1%; ITF 1%; CIT 30%/20%/0% tiered by turnover; TET 3%).
- Seed `ng_tax_service_classifications` for the 20+ WHT categories from FIRS guidance.

## Delivery Phases

1. **Schema + seeds** — migrations for the 8 new tables + NG seed data + `payroll_deduction_types` rows.
2. **Engine** — `src/lib/ngTax/` with formula evaluator, calculators, and ledger writer + unit tests per tax type.
3. **Integration** — wire sales, purchases, payroll to engine (backward-compatible; other countries untouched).
4. **UI** — setup wizard, definitions admin, filing dashboards, enhanced audit trail.
5. **Filing packets** — VAT Form 002, PAYE H1, WHT credit note generators under `src/lib/filings/nigeria*.ts`.

## Non-goals (this plan)

- Actual e-filing API integration with FIRS TaxProMax (structure supports it; connector is a follow-up).
- Automated bank remittance push (remittances recorded manually or via existing payment module).
