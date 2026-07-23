# Add mailing addresses to pay stub PDFs

Match the reference layout: employer name and mailing address in the top-right of the pay stub header, employee name and mailing address in a left block underneath.

## 1. Extend `PayStubData` (`src/lib/generatePayStubPdf.ts`)

Add optional fields:
- `companyAddressLine1`, `companyAddressLine2`
- `companyCity`, `companyProvince`, `companyPostalCode`, `companyCountry`

Keep existing `employeeAddress` string; also accept structured employee fields (`employeeAddressLine1`, `employeeAddressLine2`, `employeeCity`, `employeeProvince`, `employeePostalCode`) so the PDF can render the address on multiple lines like the picture.

## 2. Redesign header block in `generatePayStubPdf`

Replace the current centered company title + single-line "Address:" row with a two-column header:

```text
[Company Name]                          [Company Name]
                                        [Street]
                                        [City, Province Postal]

EMPLOYEE PAY STUB (centered, small)

Employee:                               PAY PERIOD
  Name                                    Period / Pay Date / etc.
  Street
  City, Province Postal
  Employee # / Province / Department
```

- Employer address: right-aligned, stacked, small font, gray.
- Employee address: left column, stacked under the name.
- Fall back gracefully when fields are missing (skip empty lines).
- Preserve existing sections (Earnings, Deductions, Net Pay, YTD, footer) unchanged.

## 3. Pass addresses from callers

Update the three call sites to populate the new employer address fields from `organization` and structured employee address fields:

- `src/pages/PayRuns.tsx` (bulk stub download)
- `src/pages/payroll/EmployeeSelfService.tsx` (self-serve download)
- `src/lib/communicationAttachments.ts` (email attachments)

All three already read the org (`address_line1`, `city`, `province`, `postal_code`, `country`) and employee address parts, so this is just extra fields on the `PayStubData` object — no new queries.

`EmployeePayHistoryDialog.tsx` has its own local PDF builder (not using `generatePayStubPdf`); apply the same header layout there so the in-app preview and download match.

## Technical notes

- No schema or backend changes.
- No new dependencies.
- Layout uses existing jsPDF calls; only text placement changes.
- All new fields optional, so existing behavior is preserved when address data is missing.
