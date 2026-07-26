
## Goal

Fully localize Nigeria across the platform so an organization set to `NG` gets a working chart of accounts, tax framework, statutory payroll, and jurisdictions out of the box — matching the depth already in place for CA/US/GB.

## Current State (verified)

- `countries` row for `NG` exists with correct defaults: currency `NGN`, locale `en-NG`, timezone `Africa/Lagos`, phone `+234`, tax regime `VAT`, IFRS, `PAYE/Pension`, VAT/TIN labels, DD/MM/YYYY.
- `src/data/countryLocalizations.ts` has a Nigeria entry (currency NGN).
- NG tax engine tables exist (`ng_tax_definitions`, `ng_tax_rate_versions`, `ng_tax_reliefs`, etc.) and were seeded in earlier phases with Finance Act 2023 rates (VAT, CIT, WHT, PAYE, Pension, NHF, ITF, NSITF, EDT, CGT, Stamp Duty).
- What's missing / thin for a full NG localization: state jurisdictions, NG chart-of-accounts template, `country_tax_code_seeds` for NG, `tax_authorities` records for FIRS + 36 SIRS + FCT-IRS, `provincial_tax_authorities` for NG states, and confirmation that `payroll_deduction_types` / `payroll_rate_brackets` cover PAYE/Pension/NHF/ITF/NSITF/EDT.

## Scope

### 1. Reference data (DB migration)

- **Jurisdictions**: seed the 36 Nigerian states + FCT under `jurisdictions.country_id = NG` with ISO 3166-2 codes (`NG-AB` … `NG-FC`) and jurisdiction type `state`.
- **Tax authorities**: seed FIRS (federal), FCT-IRS, and one SIRS per state into `tax_authorities` and `provincial_tax_authorities`, wired to the jurisdictions above. Include filing frequencies (VAT monthly, WHT monthly, CIT annual, PAYE monthly).
- **CoA template**: create a `coa_templates` row "Nigeria SMEs (IFRS for SMEs)" for NG with a full account set in `coa_template_accounts` — assets, liabilities, equity, revenue, COGS, opex — including NG-specific accounts: VAT Input/Output, WHT Receivable/Payable, PAYE Payable, Pension Payable (Employee/Employer), NHF Payable, ITF Payable, NSITF Payable, EDT Payable, CIT Payable, Deferred Tax.
- **Tax code seeds** (`country_tax_code_seeds` for `NG`):
  - VAT 7.5% (Standard), 0% (Zero-Rated Export), Exempt
  - WHT 5%, 10%, 2.5%, 2% (by service class, mapped to `ng_tax_service_classifications`)
  - CIT 30% (large), 20% (medium), 0% (small — turnover ≤ ₦25m)
  - EDT 3%, Stamp Duty 6% (tenancy), CGT 10%
- **Payroll**: ensure `payroll_deduction_types` for NG include PAYE, Employee Pension (8%), Employer Pension (10%), NHF (2.5%), ITF (employer 1%), NSITF (employer 1%), EDT (2%). Seed `payroll_rate_brackets` with the PAYE consolidated relief allowance bands (7% / 11% / 15% / 19% / 21% / 24%).
- **Currency**: ensure `currencies` has NGN with correct symbol `₦` and 2 decimals.

### 2. App wiring

- Add Nigeria to the country picker in `src/pages/settings/*` organization setup and onboarding wizards (verify it renders; add if missing).
- Ensure `useCurrencies` / formatters honor `NGN` symbol `₦` and `en-NG` locale (thousand `,`, decimal `.`, DD/MM/YYYY dates, 12h time — already in `countries`).
- Confirm `src/data/countryLocalizations.ts` Nigeria entry aligns with the DB row (fiscal year calendar, VAT primary, TIN registration label). Update fields that drift.
- In the CoA generator page (`/settings?tab=coa-generator`), surface the new NG template so a user with NG org can generate accounts from it.
- Verify `NigeriaTaxEngine` page loads without an active NG org (fallback empty states), and that tax mapping helpers in `src/lib/ngTax/integration.ts` no-op cleanly for non-NG orgs (already implemented — just re-verify after seeds land).

### 3. Verification

- Query counts after migration: jurisdictions=37, tax_authorities≥38, coa_template_accounts>60, country_tax_code_seeds≥10, payroll_rate_brackets=6 for NG.
- Manual smoke: switch preview org to NG → generate CoA → create a test invoice with 7.5% VAT → confirm ledger writes NG tax rows.

## Technical Notes

- Migration order per platform rules: CREATE tables (none new — reusing existing), then INSERT seed rows via a single migration with `ON CONFLICT DO NOTHING` guards keyed on natural keys (country_id + code) so re-runs are idempotent.
- No RLS/policy changes required — all target tables already have policies.
- No frontend business-logic changes; only data seeding plus minor picker/label surfacing.
- `countryLocalizations.ts` stays as UI reference; DB `countries` row is source of truth for runtime formatting.

## Out of Scope

- E-filing API integration with FIRS TaxProMax (already covered in Phase 11 manifest export).
- Nigerian bank direct-debit rails.
- Translation to Hausa/Yoruba/Igbo (English only for now).
