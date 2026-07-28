## 1. Localized currency for all reports, forms & slips

**Problem:** UI still shows `$` / CAD for non-Canadian orgs (e.g. Nigeria Compensation Details). PDF generators already accept `currencyCode`/`currencyLocale`, so the fix is at the callers and the remaining hardcoded UI spots.

**Frontend changes**
- Replace hardcoded `Intl.NumberFormat('en-CA', { currency: 'CAD' })` with the country-aware `useCurrencyFormatter()` (already scope-aware via active org country) in:
  - `src/pages/payroll/EmployeeProfile.tsx` (Annual Salary, hourly rate, TD1 claims)
  - `src/pages/payroll/EmployeesList.tsx` (salary column)
  - `src/components/employees/EditEmployeeDialog.tsx` (compensation preview)
  - `src/components/employees/AddEmployeeDialog.tsx` (compensation preview if present)
  - `src/components/payroll/PaystubViewer.tsx` — default `currencyCode`/`locale` from country config instead of hardcoded CAD/en-CA
  - `src/components/payroll/ViewPayRunDialog.tsx` — currency-format money lines using country config
- Add a small helper `getCurrencyForCountry(code)` (wraps `getCountryLocalization`) and use `getLocaleForCountry` for locales (both already exist in `src/data/countryLocalizations` / `src/lib/localizedCurrencyFormatter`).

**PDF/report callers**
- Audit call sites of `generatePayStubPdf`, `generateRemittancePD7APdf`, `drawGenericStatutorySlip`, `drawGenericSeparationDoc`, `drawGenericRemittance` and pass `countryCode` / `currencyCode` / `currencyLocale` resolved from the org's country (via `useCountryFilter` / `useCurrentOrganization` + `getCountryLocalization`). Any site still defaulting to CA gets updated to use the active country.
- Same for T4/PAYE/statutory report exports triggered from `TaxSlips.tsx` and `Remittances.tsx` (verify they forward country/currency).

## 2. Mandatory Guarantor Confirmation before onboarding completes

**Database migration**
- Add to `public.employee_guarantors`:
  - `confirmed boolean not null default false`
  - `confirmed_at timestamptz`
  - `confirmed_by uuid` (nullable — user id or employee id who confirmed)
  - `confirmation_method text` (e.g. `signature`, `email`, `manual`)
- Add to `public.employees`:
  - `guarantors_confirmed boolean not null default false` (denormalized flag for quick checks)

**Business rule**
- An employee is only considered *fully onboarded* when BOTH guarantor rows exist AND `confirmed = true` for each.
- DB trigger on `employee_guarantors` recomputes `employees.guarantors_confirmed` = (count(confirmed=true) >= 2). When `guarantors_confirmed` flips to false, `employees.status` cannot advance from `onboarding` to `active` — enforced by a `BEFORE UPDATE` trigger on `employees` that raises if `NEW.status = 'active'` and `guarantors_confirmed = false`.

**UI changes**
- `GuarantorForm.tsx`: add a required "Guarantor confirmation" checkbox ("I confirm this guarantor has agreed to act as surety") plus optional confirmation method dropdown. Form is invalid until checked.
- `AddEmployeeDialog.tsx`: block final submission (or force status to `onboarding`) unless both guarantors are filled AND confirmed. Show inline warning listing missing confirmations.
- `EditEmployeeDialog.tsx` Guarantors tab: show a "Confirmation status" badge per guarantor (Pending / Confirmed on {date}) and allow toggling with audit fields (`confirmed_by = auth.uid()`, `confirmed_at = now()`).
- `EmployeeProfile.tsx`: onboarding progress card shows "Guarantor Confirmation" as a required step; a red banner appears while `employees.guarantors_confirmed = false`.

## Technical details

- Use `useCurrencyFormatter()` — already country-scoped through `useCurrentOrganization().country`. No need for a new provider.
- Migration must include GRANTs (existing table already granted; new columns inherit). Trigger uses `SECURITY DEFINER` with `set search_path = public`.
- No breaking changes to existing employees: default `guarantors_confirmed=false` but existing `active` employees are left as-is; the status-transition trigger only blocks NEW transitions to `active`.
- Type regen after migration will surface the new columns for the hooks (`useEmployeeGuarantors`) — update the insert/update payloads accordingly.
