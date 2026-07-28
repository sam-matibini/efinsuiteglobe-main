
## Context

Today is July 2026, so the **Nigeria Tax Act 2025** (signed June 2025, effective **1 January 2026**) now governs Nigerian PAYE. The app currently still uses the old PITA 6th Schedule bands (7%–24%) and the Consolidated Relief Allowance (CRA). Per NRS / the PaidHR guide, three things change for monthly PAYE:

1. **New progressive bands (0%–25%)** applied to annual taxable income.
2. **CRA abolished** → replaced by **Rent Relief = min(20% × annual rent, ₦500,000)**. Only if the employee actually pays rent.
3. **Pension (8%)** remains fully deductible. NHF, NHIS and life assurance reliefs stay as statutory-contribution deductions (the Act keeps contribution reliefs; only CRA is gone).

Monthly PAYE = annual PAYE ÷ 12, computed on: `taxable = gross − pension − rent_relief − NHF − NHIS − life`.

New annual bands:

| Band (annual, ₦)          | Rate |
| ------------------------- | ---- |
| First 800,000             | 0%   |
| Next 2,200,000            | 15%  |
| Next 9,000,000            | 18%  |
| Next 13,000,000           | 21%  |
| Next 25,000,000           | 23%  |
| Above 50,000,000          | 25%  |

## Changes

### 1. Pure calculator — `src/data/nigeriaPayrollRules.ts`
- Replace `getNigeriaPayeBrackets()` with the NTA 2025 bands above (retain old bands under a `getLegacyPitaBrackets()` export for pre-2026 pay dates and use effective-date switching keyed off pay-period start).
- Remove `calculateConsolidatedReliefAllowance` from the active PAYE path; keep it exported but unused (deprecated JSDoc) for legacy recomputation.
- Add `calculateRentRelief(annualRent: number): number` → `min(annualRent * 0.20, 500_000)`.
- Update `calculateNigeriaAnnualPaye` signature to accept `annualRent?: number` and `payPeriodStart?: string`. New taxable formula:
  `taxable = max(0, gross − pension − rentRelief − nhf − nhis − life)`.
- Drop the `applyMinimumTax` call (the NTA 2025 replaces the 1% minimum-tax rule with a 0% first-band exemption up to ₦800k; the ₦800k band effectively enforces the floor).
- Update JSDoc comments to cite NTA 2025 and NRS.

### 2. Global payroll defaults — `src/data/globalPayrollDefaults.ts` (NIGERIA_CONFIG)
- Replace `CRA_FIXED` / `CRA_VARIABLE_PCT` federal tax-credit entries with a single **`RENT_RELIEF`** entry (input = annual rent, capped ₦500,000 auto-applied).
- Update `taxFormDescription` to `"NTA 2025 (effective Jan 2026) — NRS / State IRS statutory deductions"`.
- Keep PENSION_RELIEF, NHF_RELIEF, NHIS_RELIEF, LIFE_ASSURANCE, GRATUITY entries (still valid under NTA 2025).

### 3. UI — employee tax-relief tab
- In `AddEmployeeDialog.tsx` / `EditEmployeeDialog.tsx` (Nigeria branch of the Consolidated Relief note added in a prior turn): swap the "Consolidated Relief" copy for a **"Rent Relief (annual rent paid)"** numeric input. Auto-calc and display the capped relief amount below the field.
- Persist to the existing `tax_credits` / employee-relief JSON slot (add a `rent_relief_annual` key; no schema change needed if it's already JSONB — otherwise a small migration to add the column).

### 4. DB migration — `ng_tax_rate_versions` + `ng_tax_reliefs`
- Insert a **new NG-PAYE rate version** with `effective_from = 2026-01-01`, `calculation_method = 'progressive'`, and the NTA 2025 brackets JSON. Leave the 2023 version in place (effective-dated engine picks the right one).
- Insert a new relief row `RENT-RELIEF` with `effective_from = 2026-01-01`, formula `{"min":[{"mul":["annual_rent",0.20]},500000]}`.
- Deactivate CRA effective 2026-01-01 by inserting an `effective_to = 2025-12-31` update on the existing `CRA` relief row (keep row for history).
- Update `NG-PAYE` definition `source_reference` to `'NTA 2025 (0–25% bands, Rent Relief)'`.
- Verify `formulaEvaluator` supports the `min` operator; if not, extend it (small addition to `src/lib/ngTax/formulaEvaluator.ts`).

### 5. Tests — `src/lib/ngTax/__tests__/calculators.test.ts` + a new unit test for `nigeriaPayrollRules`
- Add cases matching the article:
  - ₦6,000,000 gross, ₦2,000,000 rent → annual PAYE = ₦711,600 (₦59,300/month).
  - ₦6,000,000 gross, no rent → annual PAYE = ₦783,600 (₦65,300/month).
- Add a boundary case for ₦800,000 gross → ₦0 PAYE.

## Out of scope
- No changes to WHT, VAT, CIT, TET, NSITF, ITF (article only covers personal-income PAYE).
- No changes to Canadian/other-country payroll paths.
