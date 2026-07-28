## Bulk Job Sites Upload

Extend the Job Sites settings tab with a bulk import flow, mirroring the existing bulk-invite pattern.

### New file: `src/lib/jobSitesBulk.ts`
- `downloadJobSitesTemplate()` — emits `job-sites-template.csv` with headers `name,code,is_active` plus 2 example rows and a `# name is required; code optional; is_active true/false` comment line.
- `parseJobSitesFile(file)` — uses `xlsx` (already a dep, see `bulkInviteTemplate.ts`) to read CSV/XLSX into `{ name, code, is_active }[]`, trims values, defaults `is_active` to `true`.
- `parsePastedJobSites(text)` — one entry per line, `name` or `name,code` or `name,code,is_active`.
- `exportFailedJobSitesCsv(rows)` — for retry.

### Update `src/hooks/useJobSites.ts`
- Add `bulkCreateSites` mutation: accepts `{ name, code, is_active }[]`, dedupes by lowercase name against existing `jobSites`, inserts remaining in one `.insert([...])` call scoped to current org, returns `{ inserted, skipped, failed }`. Invalidates the `job_sites` query and toasts a summary.

### Update `src/components/settings/JobSitesSettingsTab.tsx`
- Add a "Bulk import" section above the list with:
  - "Download template" button (calls `downloadJobSitesTemplate`).
  - File input accepting `.csv,.xlsx,.xls`.
  - Textarea for paste (one site per line).
  - Preview table showing parsed rows with per-row validation (missing name, duplicate of existing, duplicate within upload, code >20 chars).
  - "Import N sites" button (disabled when nothing valid) → calls `bulkCreateSites`.
  - Result summary with "Download failed rows" link when any fail.
- Keep the existing single-add form and table unchanged.

### Technical notes
- No DB or RLS changes — reuses existing `job_sites` table, org scope, and policies.
- Validation runs client-side before insert; server-side unique-name guard is not added (matches current single-add behavior).
- `is_active` parsing accepts `true/false/1/0/yes/no` (case-insensitive), defaults `true`.
