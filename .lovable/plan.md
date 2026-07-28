## Goal
Fix Employee dialogs (Add + Edit) so the Province/State selector and the TD1 tab respect the organization's country. Nigeria (and other non‑Canada countries) currently show an empty province dropdown and a Canada‑only TD1 form.

## 1. Localized State/Province selector

**Where:** `src/components/employees/EditEmployeeDialog.tsx` (line 414) and `src/components/employees/AddEmployeeDialog.tsx` (same field).

**Change:**
- Resolve the active country: prefer country scope (`useCountryScope`) → org country → `CA`.
- Read `jurisdictions` and `jurisdictionLabel` from `COUNTRY_LOCALIZATIONS[country]` in `src/data/countryLocalizations.ts` instead of the Canada‑only `PROVINCE_NAMES` enum.
- Label the field dynamically (e.g. "State" for Nigeria, "Province/Territory" for Canada, "Governorate" for Egypt).
- When the current `formData.province` isn't in the country's list, reset to the first option so the trigger shows a valid value (fixes the blank dropdown in screenshot 1).
- Default new employees to the first jurisdiction of the active country instead of hardcoded `'ON'`.

**Data fix:** expand Nigeria's `jurisdictions` in `countryLocalizations.ts` from 8 states to the full 36 states + FCT so onboarding covers every Nigerian state.

## 2. TD1 tab — Canada‑only

TD1 is a CRA form; Nigeria uses the Consolidated Relief Allowance (already computed in `nigeriaPayrollRules.ts`), not TD1. Other localized countries (US W‑4, UK P45/starter checklist, etc.) also don't use TD1.

**Change in both Add + Edit dialogs:**
- Hide the "TD1 Tax" tab and skip TD1 load/save when country ≠ `CA`. Adjust the tab grid (`grid-cols-5` → `grid-cols-4`) when hidden.
- For Nigeria, show a lightweight read‑only "Tax Relief (Nigeria)" panel in the same slot that surfaces the auto‑calculated CRA / Pension / NHF figures from `calculateNigeriaAnnualPaye` (no user inputs — Nigeria has no employee tax credit certificate equivalent). For other non‑CA countries, simply omit the tab for now.
- Guard the TD1 save block in `EditEmployeeDialog.tsx` (lines ~226–266) so it only runs when country is `CA`, preventing writes with invalid `form_type` values (fixes the state‑as‑TD1‑form_type bug where `form_type: formData.province` was being used).

## 3. Verification
- Nigeria org: Employment tab shows "State" with all 36 states + FCT; TD1 tab is hidden and replaced by a Nigeria tax‑relief summary; saving no longer attempts to insert TD1 rows.
- Canada org: unchanged — Province/Territory dropdown and full TD1 (Federal + Provincial) tabs still work.

## Technical notes
- Files edited: `src/components/employees/EditEmployeeDialog.tsx`, `src/components/employees/AddEmployeeDialog.tsx`, `src/data/countryLocalizations.ts`.
- No DB migration needed (`employees.province` is already `text` from the prior fix).
- Reuses existing `useCountryScope`, `useCurrentOrganization`, and `COUNTRY_LOCALIZATIONS` — no new hooks.
