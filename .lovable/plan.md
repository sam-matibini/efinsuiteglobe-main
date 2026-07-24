Plan to permanently add employee and employer mailing addresses to rendered pay stubs:

1. **Persist address snapshots in the database**
   - Add address snapshot columns to `pay_stubs` for:
     - employee mailing address: line 1, line 2, city, province/state/region, postal/ZIP code, country
     - employer mailing address: line 1, line 2, city, province/state/region, postal/ZIP code, country
   - Backfill existing pay stubs from current `employees` and `organizations` records through `pay_runs`.
   - Include the proper grants/policies compatibility by only altering the existing `pay_stubs` table, not creating a new table.

2. **Capture addresses when payroll is processed**
   - Update pay run processing so every newly generated pay stub stores the employee and employer mailing address at the time of payroll processing.
   - Use `employees.mailing_province` when present; otherwise fall back to `employees.province`.
   - Use organization legal/name and existing organization address fields for employer details.

3. **Render addresses in every pay stub PDF path**
   - Update the shared PDF generator to prefer the new `pay_stubs` address snapshots, falling back to live employee/organization address fields for older records.
   - Update the in-app rendered pay stub viewer/exporter, which currently uses a separate PDF generator, so the PDF shown from `/payroll/runs` includes:
     - employer name/address in the top-right/header area
     - employee name/address stacked on the left, matching the uploaded reference layout
   - Update bulk download, employee self-service, employee pay history, and communication attachment pay stub exports to pass the snapshot fields.

4. **Make it country-neutral for all localized countries**
   - Use a shared address-line builder that works with any localized country instead of hard-coding Canadian-only formatting.
   - Format city + province/state/region + postal/ZIP consistently and omit blank parts cleanly.
   - Keep country display from the organization/employee country value or localized country metadata when available.

5. **Verification**
   - Generate/check a pay stub PDF path from the pay runs view and confirm both employer and employee mailing addresses render.
   - Confirm older pay stubs still render using fallback live address data if snapshot fields are empty.