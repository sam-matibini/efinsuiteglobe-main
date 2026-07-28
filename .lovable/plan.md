## Job Locations/Sites

Add a simple per-organization list of job sites, manageable in Settings, and require selecting one when creating/editing an employee.

### 1. Database
New migration:
- `public.job_sites` table: `id`, `organization_id`, `name`, `code` (optional short code), `is_active` (default true), `created_at`, `updated_at`.
- Unique constraint on `(organization_id, name)`.
- GRANTs to `authenticated` and `service_role`; RLS scoped to org membership via `is_org_member(organization_id)`.
- Add `job_site_id uuid` to `public.employees` (nullable at DB level for backward compatibility with existing rows; required only via UI validation).
- FK `employees.job_site_id -> job_sites.id` (ON DELETE RESTRICT).

### 2. Settings UI
- New tab **"Job Sites"** in `src/pages/Settings.tsx` (icon: `MapPin`).
- New component `src/components/settings/JobSitesSettingsTab.tsx`: list + add/edit/deactivate rows (name, optional code, active toggle).
- New hook `src/hooks/useJobSites.ts` (list/create/update/deactivate, org-scoped, React Query).

### 3. Employee onboarding form
- Add a required **Job Site** select on `AddEmployeeDialog.tsx` and `EditEmployeeDialog.tsx` (Employment tab), populated from `useJobSites` filtered to `is_active`.
- Block submission with inline error if no site selected.
- Show job site on `EmployeeProfile.tsx` in the employment info section.

### Technical notes
- No changes to payroll or reports in this pass.
- Existing employees keep `job_site_id = null`; edit dialog will require selection on next save.
- Localization-agnostic — works for all countries.
