## Goal
Capture the 11-digit **National Identification Number (NIN)** issued by NIMC for Nigerian employees, required during onboarding to satisfy NRS documentation rules. NIN is separate from the existing TIN field (which stays as `sin_encrypted` via the generic `nationalId` slot).

## Database
New migration:
- Add `employees.nin text` (nullable at column level, enforced by app + trigger for NG only).
- Add `employees.nin_verified_at timestamptz`, `employees.nin_verified_by uuid` (optional audit fields for future NIMC verification).
- Add a validation trigger `enforce_nigeria_nin`: when the employee's org country is Nigeria, `nin` must be present and match `^\d{11}$`. Non-NG orgs unaffected.
- No RLS changes needed (inherits from `employees`).

## Frontend

### Add Employee dialog (`src/components/employees/AddEmployeeDialog.tsx`)
- Add `nin` to the Zod schema. Use a country-conditional refine: required + `/^\d{11}$/` when active country is `NG`, otherwise optional.
- Add a NIN input in the Personal tab, shown only when the active country is Nigeria, with placeholder `12345678901`, `maxLength=11`, inputMode numeric, and "* Required by NRS" helper text.
- Include `nin` in the insert payload.

### Edit Employee dialog (`src/components/employees/EditEmployeeDialog.tsx`)
- Add `nin` to form state, hydrate from `employee.nin`.
- Render the same conditional NIN input in the Personal tab.
- Include `nin` in the update payload and block submit with a toast if Nigeria + missing/invalid.

### Employee profile (`src/pages/employees/EmployeeProfile.tsx`)
- Display `NIN` in the Personal/Identity section for Nigerian employees.

### Types
- After the migration regenerates `src/integrations/supabase/types.ts`, the new field flows through automatically. No manual edit to that file.

## Out of scope
- Live NIMC verification API — leave the audit columns in place but don't call any external service yet.
- Backfilling NIN for existing Nigerian employees — surfaced only when a user next edits the record (submit will require it).
- Changing the TIN/`sin_encrypted` field.
