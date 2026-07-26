# Localize Payroll Slips & Reports for All Supported Countries

## Problem

The list pages (`TaxSlips`, `Remittances`, `RoeRecords`) already swap **labels** via `src/data/payrollLocalization.ts`, but the actual **PDF generators** and the **PayrollReports** page are hard-coded to Canada (T4, PD7A, ROE, CPP/EI, CRA). Zambia, Nigeria, Kenya, US, UK and Burundi users see localized headers on-screen but download Canadian forms and see Canadian column names in every printed artefact.

## Scope

Countries in scope (already registered in `payrollLocalization.ts`): **CA, US, NG, ZM, KE, GB, BI**.
Artefacts to localize:

1. Annual tax slip PDF (T4 / W-2 / ITF18 / P9 / IPR / Declaration IPR / P60)
2. Periodic remittance PDF + CSV (PD7A / Form 941 / ITF16 / P10 / NRS WHT+VAT+PAYE / OBR)
3. Separation document PDF (ROE / Separation Notice / Termination Letter / Certificate of Service / Attestation de Travail)
4. Pay stub PDF (deduction labels: CPP/EI vs SS/Medicare vs NAPSA/NHIMA vs NSSF/SHIF vs PAYE/Pension/NHF vs INSS/MFP)
5. PayrollReports page (columns, totals, statutory summary tabs)

## Approach

Introduce a **single source of truth for slip/report field mapping per country**, then route each PDF generator through it. Keep Canada's current pixel-perfect T4/PD7A/ROE layouts untouched; other countries use a shared "generic statutory slip / remittance / separation" layout driven by the metadata.

### 1. Extend `src/data/payrollLocalization.ts`

Add per-country PDF metadata alongside the existing `taxSlips` / `remittances` / `separationDoc` blocks:

- `taxSlips.pdfFields[]`: ordered list of `{ code, label, source }` where `source` is a `PayStubField` union (`gross`, `federalTax`, `pension`, `socialInsurance`, `otherDeductions`, `ytdGross`, `insurableEarnings`, …). Drives which boxes render on the annual slip.
- `taxSlips.formTitle`, `taxSlips.authorityLine`, `taxSlips.taxIdLabel` (e.g. "Employer TIN", "PAYE Number", "BN/RP").
- `remittances.pdfFields[]`: rows to render in the periodic remittance summary + CSV columns (`{ code, label, source }` — e.g. NG: `WHT`, `VAT`, `PAYE`, `NHF`, `Pension`).
- `remittances.dueDayOfMonth` and `remittances.filingFrequency` (informational).
- `separationDoc.pdfSections[]`: which sections render (reasons list, insurable-hours table, service dates, salary summary). CA keeps the 27-period ROE grid; others use a plain letter with signature block.
- `payStub.deductionLabels`: pull from existing `getPayrollTerminology(country)` in `localizedCurrencyFormatter.ts` — no duplication, just re-export via `payrollLocalization`.
- `payStub.employerContribLabels`: parallel array for employer side.

### 2. Refactor PDF generators to accept locale metadata

- `src/lib/generateT4Pdf.ts` → `generateTaxSlipPdf.ts` (keep original as `drawT4CanadianCopy`).
  - New entry `downloadTaxSlipPdf(slip, org, countryCode)` dispatches: `CA` → existing bilingual T4 grid; **any other country** → new `drawGenericStatutorySlip()` that renders `formTitle`, employer block, employee block, and a two-column boxes grid from `taxSlips.pdfFields[]`.
- `src/lib/generateRemittancePD7APdf.ts` → `generateRemittancePdf.ts`.
  - New entry `downloadRemittancePdf(data, countryCode)`; CA path unchanged. Others render `formCode`, `authorityName`, employer info, and one row per `remittances.pdfFields[]` mapped from the aggregated `RemittanceReportDetail`.
  - CSV column set derived from same list so PDF and CSV always match.
- `src/lib/generateRoePdf.ts` → `generateSeparationDocPdf.ts`.
  - CA → existing ROE. Others → simple letter using `separationDoc.docName`, `reasonLabel`, employee dates, insurable earnings summary, signature/date fields. When `separationDoc.available === false` (US federal), page + generator surface "Not federally required — see state-specific" (already handled at page level; ensure PDF button is hidden).
- `src/lib/generatePayStubPdf.ts`:
  - Replace hard-coded "CPP / EI / Federal Tax / Provincial Tax" labels with values from `getPayrollTerminology(countryCode)` plus new `employerContribLabels`.
  - Rename totals row (e.g. "Total Statutory Deductions") and hide CA-specific "Province of Employment" line for non-CA.
  - Currency already uses `formatCurrency(value, countryCode)` in most call sites — audit and standardize.

All four generators receive `countryCode` derived once in the caller from `organization.country` (same pattern already present in `TaxSlips.tsx` / `Remittances.tsx`).

### 3. Wire pages to pass `countryCode` to generators

- `src/pages/TaxSlips.tsx`: replace `downloadT4Pdf(slip, org.name)` with `downloadTaxSlipPdf(slip, org, countryCode)`.
- `src/pages/Remittances.tsx`: replace `downloadRemittancePD7APdf` / `downloadRemittanceCsv` with country-aware versions; extend `buildPdfData` to include the mapped `pdfFields` values (NG: PAYE/VAT/WHT/NHF/Pension; KE: PAYE/NSSF/SHIF/AHL; ZM: PAYE/NAPSA/NHIMA; etc.) sourced from `useRemittances().buildRemittanceReport`.
- `src/pages/RoeRecords.tsx`: rename UI to `separationDocLabel`, gate the "New" button on `separationDoc.available`, dispatch to `downloadSeparationDocPdf`.
- `src/components/payroll/PaystubViewer.tsx` + `EmployeePayHistoryDialog.tsx`: pass `countryCode` when calling the stub PDF generator; screen labels already partly localized — extend with `employerContribLabels`.

### 4. Localize the PayrollReports page

`src/pages/PayrollReports.tsx` (937 lines) currently mixes CA-specific summaries (CPP, EI, T4 summary, PD7A reconciliation) with generic ones (gross/net, headcount). Introduce a small config:

- Add `payrollConfig.reports.tabs[]`: `[{ id, label, columns[], totals[] }]` per country.
  - **CA**: Payroll Register, CPP/EI Summary, Tax Summary (Fed+Prov), T4 Summary, PD7A Reconciliation.
  - **US**: Payroll Register, FICA Summary (SS+Medicare), Federal Tax Summary, W-2 Summary, 941 Reconciliation.
  - **NG**: Payroll Register, PAYE Summary, Pension/NHF Summary, WHT/VAT Summary (pull from `ng_tax_transaction_ledger`), NRS Filing Summary.
  - **ZM**: Payroll Register, PAYE Summary, NAPSA/NHIMA Summary, ITF 16 Reconciliation.
  - **KE**: Payroll Register, PAYE Summary, NSSF/SHIF/AHL Summary, P10 Reconciliation.
  - **BI**: Registre de paie, IPR, INSS/MFP, Déclaration OBR.
- Column headers, currency, and locale all sourced from `payrollConfig`. No new business-logic calculators for CA/US remain outside their existing calculators.

### 5. Nigeria hookup

Nigeria's slips/remittances additionally consume `ng_tax_transaction_ledger` for WHT / VAT breakdowns via existing `src/lib/ngTax/` — the remittance builder for NG re-uses `useRemittances.buildRemittanceReport` for PAYE/Pension/NHF and joins `ngTax` totals for WHT/VAT so a single NRS remittance PDF covers all statutory items.

## Deliverables

**New files**
- `src/lib/payroll/slipFieldMapping.ts` — pure mapping tables (per-country pdfFields, formCode, formTitle, taxIdLabel).
- `src/lib/payroll/drawGenericStatutorySlip.ts`
- `src/lib/payroll/drawGenericRemittance.ts`
- `src/lib/payroll/drawGenericSeparationDoc.ts`

**Renamed / extended**
- `src/lib/generateT4Pdf.ts` → dispatcher `downloadTaxSlipPdf`; existing CA renderer kept internal.
- `src/lib/generateRemittancePD7APdf.ts` → `downloadRemittancePdf` dispatcher + shared CSV builder.
- `src/lib/generateRoePdf.ts` → `downloadSeparationDocPdf` dispatcher.
- `src/lib/generatePayStubPdf.ts` → country-aware labels.

**Updated pages/components**
- `src/data/payrollLocalization.ts` — new `pdfFields`, `formTitle`, `taxIdLabel`, `payStub`, `reports` sub-configs for all 7 countries (Rwanda/Uganda/Tanzania not in scope this pass).
- `src/pages/TaxSlips.tsx`, `src/pages/Remittances.tsx`, `src/pages/RoeRecords.tsx`, `src/pages/PayrollReports.tsx`.
- `src/components/payroll/PaystubViewer.tsx`, `src/components/employees/EmployeePayHistoryDialog.tsx`.

**No DB migrations required** — all changes are presentation-layer; existing `tax_slips`, `remittances`, `roe_records`, `pay_stubs` columns are already generic enough. The NG WHT/VAT feed reuses existing `ng_tax_transaction_ledger` reads.

## Out of scope

- Actual e-filing/XML packaging for NG NRS, KE KRA iTax, ZM ZRA TaxOnline (already tracked separately under `src/lib/efile/` and `NigeriaTaxEngine`).
- Rwanda/Uganda/Tanzania/Malawi/Zimbabwe (not yet in `PAYROLL_LOCALIZATIONS`).
- Pixel-exact replicas of foreign statutory forms — we render clean, compliant, brand-consistent statements labelled with the correct authority + form code, not scanned-copy replicas.
