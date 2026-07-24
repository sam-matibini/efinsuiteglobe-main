## Bulk Employee Upload — Phase 1

Add a multi-sheet, transactional, country-aware bulk employee import to Payroll → Employees, following the same wizard pattern already used by the Trial Balance import engine (see `.lovable/memory/features/import-engine.md`).

### 1. Database (single migration)

New tables (all with `organization_id`, RLS scoped via `has_role`/org membership, GRANT to `authenticated` + `service_role`, `updated_at` triggers):

- `employee_import_batches` — one row per upload: `import_mode` (`create` | `update` | `upsert`), `country_code`, `file_name`, `file_hash`, `template_version`, `total_rows`, counts (`created`, `updated`, `skipped`, `failed`), `status` (`draft`→`validating`→`validated`→`posting`→`posted`/`failed`/`reversed`), `replace_blanks bool`, `validation_summary jsonb`, `posted_at`, `posted_by`, `reversed_at`, `reversal_reason`, `created_by`.
- `employee_import_rows` — one row per employee line: `batch_id`, `sheet` (`employees`|`compensation`|`deductions`|`payment`), `row_number`, `raw_data jsonb`, resolved `employee_id` (nullable), `match_type` (`new`|`update_by_id`|`duplicate_suspect`), `is_valid`, `validation_errors jsonb`, `validation_warnings jsonb`, `posted bool`, `posted_entity_id`.
- `employee_compensation` — historical comp records: `employee_id`, `compensation_type` (basic salary, housing, transport, bonus, commission, etc.), `amount numeric`, `currency`, `frequency`, `taxable bool`, `effective_date`, `end_date`, `source_batch_id`.
- `employee_deductions` — `employee_id`, `deduction_type`, `category` (`statutory`|`voluntary`), `amount`, `frequency`, `start_date`, `end_date`, `source_batch_id`.
- `employee_payment_methods` — `employee_id`, `method` (`bank_transfer`|`cheque`|`cash`|`mobile_money`), `bank_name`, `account_name`, `account_number_encrypted` (pgcrypto `pgp_sym_encrypt`), `account_number_last4`, `routing/transit/iban/swift`, `currency`, `is_primary`, `source_batch_id`.
- `employee_import_audit` — every action: batch_id, actor, action (`upload`, `validate`, `post`, `rollback`, `download_errors`), details jsonb, ip, user_agent.

Extend `employees` with nullable jurisdiction-aware fields already implied by the spec but not present: `national_id_encrypted`, `tax_id_encrypted`, `preferred_name`, `nationality`, `cost_centre`, `work_schedule`, `payroll_start_date`. Existing `sin_encrypted`, `department`, `manager_id`, `province`, etc. are reused. Country-specific extras (Nigeria: `pension_pfa`, `rsa_number`, `paye_jurisdiction`; and CA/US/etc.) go into a single `statutory_profile jsonb` column so nothing is hard-coded.

RLS: all new tables restrict to same-org members; `employee_payment_methods` additionally requires `has_role('admin')` or `has_role('payroll_admin')` for SELECT of the encrypted column (view exposes only `last4`).

### 2. Template + parsing

- New `/api/download-employee-template` route served by an edge function that streams a pre-built XLSX (built with the existing `xlsx` skill approach — `exceljs` in the browser is fine too) containing the six sheets from spec §18 (Instructions, Employees, Compensation, Deductions, Payment Information, Reference Data). Reference Data sheet is generated live from the org's departments, divisions, locations, currencies, and country-specific compensation/deduction types.
- Parser (`src/lib/employeeImport/parser.ts`) reads CSV or XLSX via existing `xlsx` dep, normalizes headers (alias map), and yields typed rows per sheet.

### 3. Validation engine

`src/lib/employeeImport/validate.ts` runs file-level + per-row checks from spec §10–§11, jurisdiction-aware:

- Country config table (`src/data/employeeImportRules.ts`, keyed by country code, hooked into existing `COUNTRY_LOCALIZATIONS` and `payrollLocalization`) declares required identifiers (SIN/TIN/NI), statutory deduction types, currency, and date format per country.
- Duplicate detection: primary on `employee_number`; secondary via `(first_name, last_name, date_of_birth, email)` fuzzy match against existing `employees` for the org.
- Cross-sheet checks: every `employee_id` in Compensation/Deductions/Payment exists in Employees sheet or DB.
- Each row tagged `valid` / `warning` / `error`; errors block only that row unless file-level failure.

### 4. UI — wizard

New route `/payroll/employees/bulk-upload` and a "Bulk Upload" button on `EmployeesList.tsx` header. Wizard steps mirror the trial-balance import UX:

1. **Configure** — pick country, import mode (Create / Update / Upsert), toggle "Replace existing values with blanks", download template.
2. **Upload** — drop CSV/XLSX, show file meta, template version check.
3. **Preview & validate** — tabs for each sheet, badge counts (Valid / Warning / Error), inline row editor for quick fixes, "Download error report" (XLSX with error column appended).
4. **Confirm** — summary panel: totals, new vs update, warnings, errors; "Proceed with valid records" vs "Cancel".
5. **Posting** — progress bar streamed from edge function.
6. **Complete** — summary card matching spec §16 with links to Import History and imported employees.

Plus an **Import History** page (`/payroll/employees/bulk-upload/history`) listing `employee_import_batches` with status, counts, download error report, and a **Rollback** action for `posted` batches (admin only).

### 5. Edge function — transactional posting

`supabase/functions/employee-bulk-import/index.ts`:

- Validates JWT, checks role (`payroll_admin` or `admin`).
- Uses service-role client, wraps all writes in a single Postgres function `public.post_employee_import(batch_id uuid)` executed inside one transaction so partial failure rolls back everything (spec §15).
- Encrypts bank account + national/tax IDs with `pgp_sym_encrypt` using a `PAYROLL_ENCRYPTION_KEY` secret (requested via `add_secret` during build).
- Emits row-level audit entries and updates batch counts on completion.
- Rollback path: `public.rollback_employee_import(batch_id, reason)` deletes/soft-deletes rows created by that batch (tracked via `source_batch_id`) and restores prior values for updates (snapshotted in `employee_import_rows.raw_data.previous`).

### 6. Security

- `employee_payment_methods.account_number_encrypted` never returned to client; a view `v_employee_payment_methods_masked` exposes `****last4`.
- Audit log excludes raw account numbers.
- Only `admin` / `payroll_admin` roles see Bulk Upload button (via existing `PermissionGate`).
- File size cap 10 MB, row cap 5 000 per batch enforced client + edge.

### 7. Files to add / touch

New:
- `src/pages/payroll/BulkEmployeeUpload.tsx`, `BulkEmployeeUploadHistory.tsx`
- `src/components/employees/bulk/` — `TemplateDownloadCard`, `UploadDropzone`, `ValidationTabs`, `PreviewSummary`, `RollbackDialog`
- `src/hooks/useEmployeeImport.ts`
- `src/lib/employeeImport/{parser,validate,template,encrypt}.ts`
- `src/data/employeeImportRules.ts`
- `supabase/functions/employee-bulk-import/index.ts`
- Migration creating tables, RPCs, RLS, GRANTs, triggers, and `pgcrypto` extension check.

Touched:
- `src/pages/payroll/EmployeesList.tsx` — add "Bulk Upload" button.
- `src/App.tsx` (or router) — new routes.
- `src/types/payroll.ts` — extend `Employee` with new optional fields plus new `EmployeeCompensation`, `EmployeeDeduction`, `EmployeePaymentMethod`, `EmployeeImportBatch` interfaces.

### Technical notes

- Reuses proven patterns from the Trial Balance import engine (memory: `features/import-engine`) — batch/rows/audit shape, wizard steps, mapping templates.
- Country awareness leverages `COUNTRY_LOCALIZATIONS` (67 countries) and `payrollLocalization.ts`; no rates hard-coded in employee rows — statutory rates continue to resolve at pay-run time via existing `globalPayrollCalculator`.
- One migration only; edge function and RPCs deploy automatically.
- Requires a new secret `PAYROLL_ENCRYPTION_KEY` (I will request via `add_secret` in build mode before wiring encryption).
