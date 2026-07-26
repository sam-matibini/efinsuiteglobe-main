# Nigeria Payroll Localization & Statutory Compliance Refresh

## Problem

Nigeria is partially localized in the payroll module:

- `src/lib/payroll/slipFieldMapping.ts` already has an `NG` block for slip / remittance / separation / pay-stub PDFs.
- `src/data/globalPayrollDefaults.ts` **has no `NG` entry** — `COUNTRY_PAYROLL_CONFIG` contains only CA, US, ZM, KE, BI. `getCountryPayrollConfig('NG')` falls back to `US_CONFIG`, so the Employee onboarding tax form shows "W-4 Withholding", SSN, FICA, IRS defaults for Nigerian employees.
- `src/lib/globalPayrollCalculator.ts` `getStatutoryDeductionCodes` has no `NG` case → returns `[]`, so Nigerian pay runs surface no statutory codes.
- Existing `NG` slip mapping references NHF as "socialInsurance" and shows only pension + NHF; it omits **NSITF (Employee Compensation, 1% employer)** and **ITF (Industrial Training Fund, 1% employer, >5 staff)** and does not reflect the **2024 amendment raising minimum PAYE-exempt tier** or **CRA (Consolidated Relief Allowance)** correctly.
- PAYE bracket tables and Pension Reform Act 2014 amendments (8% EE / 10% ER on pensionable pay = Basic + Housing + Transport) are not seeded anywhere for the calculator.
- `PayrollReports.tsx` / `Remittances.tsx` / `TaxSlips.tsx` / `RoeRecords.tsx` already receive `countryCode` and dispatch to generic renderers, so most page-level wiring is done — but the underlying **NG data model, defaults, and calculator rules are the gap**.

## Scope

Localize the Nigeria payroll module end-to-end and refresh statutory parameters to current (2024/2025) NRS + PenCom + NHF + NSITF + ITF rules. UI wiring for pages is already in place; this pass fills the data + calculation + labelling gaps and tightens the PDF field mappings.

Out of scope: e-filing XML for NRS TaxProMax (tracked separately under `src/lib/efile/`), state-level PAYE variance handling beyond the Personal Income Tax Act baseline, and voluntary pension top-ups.

## Approach

### 1. Add Nigeria to `globalPayrollDefaults.ts`

Add `NIGERIA_CONFIG` and register under `NG`:

- `nationalIdLabel`: "Tax Identification Number (TIN)" with placeholder + BVN sub-field note.
- `federalDeductions`:
  - **Pension (PRA 2014)** — EE 8%, ER 10%, base = Basic + Housing + Transport ("pensionable pay").
  - **NHF (National Housing Fund)** — EE 2.5% of Basic (employees earning ≥ ₦3,000/month).
  - **NSITF (Employee Compensation Act)** — ER 1% of gross (employer-only).
  - **ITF (Industrial Training Fund)** — ER 1% of annual payroll (employer-only, ≥5 employees; flag `inputType: 'boolean'` toggle).
  - **NHIA (Group Life Insurance / NHIA)** — ER minimum 3× annual gross life cover (documented, not deducted; leave placeholder).
- `federalTaxCredits`:
  - **CRA fixed** — ₦200,000 (default) — Consolidated Relief Allowance fixed portion.
  - **CRA variable %** — 20% of gross emoluments (auto-calculated).
  - **Pension relief** — auto (equal to actual pension contribution, deductible).
  - **NHF relief** — auto (equal to NHF contribution).
  - **Life assurance premium** — user-entered.
  - **Gratuity** — user-entered.
- `currencySymbol: '₦'`, `currencyCode: 'NGN'`, `autoPopulateSource: 'NRS'`.

### 2. Register NG in `getStatutoryDeductionCodes`

Add:
```ts
case 'NG':
  return ['PAYE', 'PENSION-EE', 'PENSION-ER', 'NHF', 'NSITF', 'ITF'];
```

### 3. Seed NG PAYE brackets for the tiered calculator

Add a helper `getNigeriaPayeBrackets()` in a new `src/data/nigeriaPayrollRules.ts` returning PIT Act 2011 (as amended) annual tiers, applied on **taxable income = gross − CRA − pension − NHF − life assurance**:

```
First    ₦300,000        7%
Next     ₦300,000        11%
Next     ₦500,000        15%
Next     ₦500,000        19%
Next     ₦1,600,000      21%
Above    ₦3,200,000      24%
```

Also expose a minimum-tax fallback (1% of gross where taxable is nil/low) per PITA s.37.

### 4. Refresh `slipFieldMapping.ts` NG block

- Add NSITF and ITF rows to remittance `rows[]` (employer-only lines).
- Add "Basic Salary", "Housing", "Transport", "CRA relief" columns on the pay stub employer contributions breakdown.
- Update `remittance.formTitle` to "Monthly PAYE Schedule + Statutory Contributions" and `authorityName` to "State Internal Revenue Service (PAYE) / PenCom / FMBN / NSITF / ITF" to match the multi-authority filing reality.
- Slip: rename field 4 "NHF / Other statutory" → "NHF contribution" and add a separate field for "CRA relief".
- Pay stub labels: keep `PAYE`, `Pension (8%)`, `NHF (2.5%)`; add `employerContribLabels` for `Pension ER (10%)`, `NSITF (1%)`, `ITF (1%)`.

### 5. Localize the four payroll pages for Nigeria

Sidebar labels in `usePayrollLocalization` for NG already exist (`taxSlipsLabel`, etc.). Verify + patch:

- `TaxSlips.tsx`: title/subtitle already localized via `taxSlipsLabel`; ensure "Tax Year" column is labelled "Year of Assessment" for NG.
- `Remittances.tsx`: filing frequency label = "Monthly (on/before 10th)"; add NSITF/ITF summary tile.
- `RoeRecords.tsx`: title "Disengagement / Termination Letters" for NG; hide "insurable hours" block (already handled by generic renderer via `sections.hoursBlock: false`).
- `PayrollReports.tsx`: add NG tab set — Payroll Register, PAYE Summary, Pension/NHF Summary, NSITF/ITF Summary, PAYE Schedule (matches Section 5 of prior plan).

### 6. Wire NG PAYE into the pay-run calculator

`useProcessPayRun` / `payrollCalculator.calculatePayStub` currently only handle CA. Extend the entry point to route NG employees through `calculateGlobalPayroll` seeded with:

- Rules built from `NIGERIA_CONFIG.federalDeductions`.
- A synthetic `PAYE` rule with `calculationMethod: 'tiered'` using the brackets from step 3, minus reliefs computed above.

Store `countryCode` on each pay stub so downstream PDFs pick the right renderer (already partially plumbed).

### 7. Onboarding form

`EmployeeOnboarding` / TD1-equivalent form already reads `getCountryPayrollConfig(countryCode)`. With step 1 done, Nigerian employees will automatically see TIN, CRA relief, pension/NHF fields instead of W-4/SSN.

## Deliverables

**New**
- `src/data/nigeriaPayrollRules.ts` — PAYE bracket table + `getNigeriaPayeBrackets()` + minimum-tax helper.

**Updated**
- `src/data/globalPayrollDefaults.ts` — add `NIGERIA_CONFIG`, register under `NG`.
- `src/lib/globalPayrollCalculator.ts` — add `NG` branch in `getStatutoryDeductionCodes`.
- `src/lib/payroll/slipFieldMapping.ts` — refresh NG slip/remittance/pay-stub blocks (NSITF, ITF, CRA, employer labels).
- `src/data/payrollLocalization.ts` — NG sidebar/filing-frequency copy tweaks; NG entry in `reports.tabs[]`.
- `src/pages/PayrollReports.tsx` — render NG tab set from config.
- `src/hooks/usePayRunProcessor` (or wherever `calculatePayStub` is invoked) — route NG through `calculateGlobalPayroll` with the seeded rules.

**Not required**
- DB migration — `pay_stubs`, `tax_slips`, `remittances`, `roe_records` columns are already country-agnostic; `pay_stubs.country_code` already exists.
- Changes to `NigeriaTaxEngine` (sales/withholding side) — pension/PAYE live in payroll, not the NG WHT/VAT ledger.

## Technical notes

- All amounts remain in `NGN`; `formatCurrency(x, 'NG')` already resolves via `localizedCurrencyFormatter`.
- PAYE brackets are annualized then divided by pay periods to match the existing tiered-calc pattern.
- NSITF/ITF are employer-only — they must not affect employee `netPay` and should only appear in `employerContributions[]` (calculator already supports the split via `isEmployeeDeduction`/`isEmployerContribution` flags).
- CRA (Consolidated Relief Allowance) is `max(₦200,000, 1% of gross) + 20% of gross` per PITA; implement as a pre-tax deduction inside the PAYE rule, not as a standalone rule.
- Guard NSITF/ITF applicability behind employer-level toggles on `organizations` (add later if needed); default ON for NG orgs with >5 headcount.
