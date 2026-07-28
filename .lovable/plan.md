## Add State/Province to Job Sites

Extend the Job Sites / Locations feature so each site records a state or province (localized to the active country, e.g. Nigerian states for NG orgs, Canadian provinces for CA).

### Database
- Migration on `public.job_sites`:
  - Add `state_province text` (nullable — existing rows stay valid).
  - No enum; use free text so it works across all localized countries (CA, NG, ZM, US, KE, etc.).

### Types & hook
- `src/hooks/useJobSites.ts`: add `state_province` to the `JobSite` interface, and to `createSite` / `updateSite` / `bulkCreateSites` payloads.

### Settings UI — `JobSitesSettingsTab.tsx`
- Add a **State/Province** dropdown next to Site name / Code in the add-site row.
- Populate options from the active country's jurisdictions via `getCountryLocalization(scopedCountry)` (same source used by employee dialogs).
- Show the new column in the sites table.
- Edit dialog / inline edit: allow changing state/province.

### Bulk import — `src/lib/jobSitesBulk.ts`
- Add `state_province` column to:
  - CSV template (`downloadJobSitesTemplate`)
  - Parser (`parseJobSitesFile`, `parsePastedJobSites`) — accept `state`, `province`, `state_province` header aliases.
  - Validation — warn (not block) if value isn't in the active country's jurisdiction list.
  - Failed-rows export.

### Employee onboarding (optional auto-fill)
- In `AddEmployeeDialog` / `EditEmployeeDialog`: when a Job Site is selected and the employee's province is empty, pre-fill it from the site's `state_province`. Non-destructive — user can still override.

### Out of scope
- No changes to reports, payroll, or tax logic. State/prov on the site is purely descriptive metadata for now.
