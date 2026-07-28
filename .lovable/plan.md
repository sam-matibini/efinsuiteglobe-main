## Add Employee Guarantors to Payroll Onboarding

Capture up to two guarantors per employee as surety in case of termination or default. Applied globally, especially relevant for Nigeria/African onboarding practice.

### 1. Database (new table `employee_guarantors`)

Columns:
- `employee_id` (FK, cascade delete)
- `organization_id`
- `guarantor_order` (1 or 2)
- `full_name`, `sex`, `phone_number`, `status` (e.g. Married/Single/Widowed), `relationship`, `profession`
- Residential: `residential_address`, `residential_city`, `residential_postal_code`, `residential_state`, `residential_country`
- Office: `office_address`, `office_city`, `office_postal_code`, `office_state`, `office_country`
- Optional: `email`, `id_document_url`, `signature_url`, `notes`
- Standard: `id`, `created_at`, `updated_at`
- Unique `(employee_id, guarantor_order)`

RLS: org-scoped read/write via existing org membership pattern. GRANTs for `authenticated` and `service_role`. Trigger for `updated_at`.

### 2. Hook

`src/hooks/useEmployeeGuarantors.ts` — list/upsert/delete by employee, using React Query, mirroring `useEmployees`.

### 3. UI

- **New component**: `src/components/employees/GuarantorForm.tsx` — reusable card with two collapsible sections (Guarantor 1 / Guarantor 2), fields matching the uploaded image, Zod-validated (name/phone required, phone length limits, address limits).
- **Add to `AddEmployeeDialog`**: new "Guarantors" step/tab after existing sections; save after employee insert.
- **Add to `EditEmployeeDialog` / `EmployeeProfile`**: new "Guarantors" tab to view/edit anytime.
- **Onboarding checklist**: add "Collect guarantor information" task to default onboarding tasks so it appears in the onboarding tracker.

### 4. Reports / Termination

- Include guarantors in the employee profile PDF export where available.
- On termination flow (ROE / disengagement letter pages), surface a read-only "Guarantors on file" panel so HR can contact them.

### Technical notes
- Country/state selectors reuse the same country list used elsewhere; state field is a plain text input to remain jurisdiction-agnostic (NG states, CA/US provinces, etc.).
- No changes to payroll calculation logic — purely HR/compliance data.
- Phone stored as string; validated with light regex, no strict country parsing.
