## 1. Expand Compensation tab with earnings & deductions line items

**File:** `src/components/employees/EditEmployeeDialog.tsx` (Compensation tab, lines 617–675)

Add a **"Salary Structure & Allowances"** section below the Hourly/Annual inputs, seeded with the standard Nigerian breakdown from the reference image but usable for any country:

| Description | Type | Rate (% of Gross) |
|---|---|---|
| Basic Salary | Earning | 50% |
| Housing Allowance | Earning | 25% |
| Transport Allowance | Earning | 15% |
| Utility/Other Allowances | Earning | 10% |
| Annual Pension | Deduction | 10% |
| Annual Rent Relief | Deduction | 20% |

Features:
- Each row shows Description, Type (Earning/Deduction), Rate % (editable), and computed Amount (rate × Annual Salary).
- **"+ Add line"** button to append custom earning/deduction rows.
- Delete (trash) icon per custom row (seeded rows can be zeroed but not deleted).
- Read-only computed rows displayed at the bottom: Total Actual Gross Salary, Annual Rent Calculated, Total Annual Taxable Income, Total Annual Tax, Monthly Pension, Monthly PAYE, Total Deduction, Monthly Net Pay — computed live from the entered rates using the existing Nigeria payroll calculator (`nigeriaPayrollRules.ts`) when country = NG; other countries show a simplified sum.
- Persist as `employees.compensation_structure` JSONB column (new).

**Persistence:** one migration adds `compensation_structure JSONB` to `public.employees` (nullable, default `null`). No changes to grants/RLS needed (inherits existing).

**Payroll integration:** `usePayRunProcessing` / `nigeriaPayrollRules.ts` — if `compensation_structure` is present, use its Basic/Pension rates in place of the hardcoded 8%/2.5% defaults. Backward compatible when column is null.

## 2. Fix currency rendering on paystub PDFs (₦, K, etc.)

**Root cause (verified in `src/lib/generatePayStubPdf.ts:71-78`):** `Intl.NumberFormat` returns `₦` / `K` symbols, but jsPDF's default Helvetica font has no glyph for `₦` (U+20A6) or several other localized symbols → renders as `¦` (as visible in the uploaded paystub image).

**Fix:** in `buildFormatCurrency`, detect currencies whose symbol falls outside WinAnsi and format with the ISO code prefix instead (e.g., `NGN 12,500.00`, `ZMW 9,483.03`), OR embed a Unicode font (DejaVu Sans) once and switch to it for currency cells. Recommended: **ISO code prefix** — zero-byte cost, works for every localized country (NG, ZM, KE, BI, GB fine already).

Apply the same fix in:
- `src/lib/payroll/drawGenericStatutorySlip.ts`
- `src/lib/payroll/drawGenericRemittance.ts`
- `src/lib/generateRemittancePD7APdf.ts`
- `src/lib/generateRoePdf.ts`

Add a shared helper `src/lib/payroll/pdfCurrency.ts` exporting `formatPdfCurrency(amount, countryCode)` so every PDF uses one consistent path.

## Technical Notes

- Migration: single `ALTER TABLE public.employees ADD COLUMN compensation_structure JSONB;`
- New component: `src/components/employees/CompensationStructureEditor.tsx` (keeps EditEmployeeDialog lean).
- Shape: `{ items: [{ id, description, kind: 'earning'|'deduction', ratePct, monthlyAmount?, isSystem }] }`.
- Non-glyph currencies list: NGN, ZMW, KES, BIF, GHS, TZS, UGX, XAF, XOF — fall back to ISO code + space + formatted number using `en-US` grouping.
