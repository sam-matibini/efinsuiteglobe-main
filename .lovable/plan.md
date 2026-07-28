## Problem

Onboarding a Nigerian employee fails with `invalid input value for enum province_code: "LA"`. The `employees.province` column is a Postgres enum (`public.province_code`) that only contains Canadian province codes (AB, BC, MB, …, YT). Any non-Canadian jurisdiction (Nigerian states, US states, Zambian provinces, etc.) is rejected at insert time.

Same enum is used on two other tables (`employees`, plus two more references in `types.ts` around lines 9213/9265 — likely payroll tax profile / TD1 tables).

## Fix

Convert the `province` column from the restrictive `province_code` enum to plain `text`, so it can hold any jurisdiction code (Canadian `ON`, Nigerian `LA`, US `CA`, Zambian `10`, etc.). Canadian-specific logic (TD1 forms, CPP/EI) already gates on the org's country, so widening the column type does not affect Canadian behaviour.

### Migration

For every table currently typed as `province_code`:
1. `ALTER COLUMN province TYPE text USING province::text`
2. Preserve the default `'ON'` as a text default
3. Drop the `public.province_code` enum if no other objects depend on it (otherwise leave it in place — the enum values are still valid text)

### Frontend

No component changes required. `AddEmployeeDialog` / `EditEmployeeDialog` already cast `province` as `any` when submitting, and the country-aware jurisdiction picker (`countryConfig.jurisdictions`) already produces the correct codes per country. Once the column accepts text, Nigerian `LA`, `FC`, etc. will save successfully.

## Verification

- Add a Nigerian employee with state = Lagos → save succeeds
- Existing Canadian employees still load and edit normally (values like `ON`, `AB` still valid as text)
- Payroll TD1 flow for Canadian employees unchanged
