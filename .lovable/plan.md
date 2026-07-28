## Fix Nigeria employee onboarding

The Add/Edit Employee dialogs always render Canada-specific "CPP Exempt / EI Exempt" checkboxes and Canada-branded labels even when the organization country is Nigeria. The PAYE tab also uses ambiguous "CRA" wording (which reads as Canada Revenue Agency, not Nigeria's Consolidated Relief Allowance).

### Changes

1. **`src/components/employees/AddEmployeeDialog.tsx`** — In `renderTaxCreditsTab`, replace the hard-coded CPP/EI "Deduction Exemptions" card with a country-aware block:
   - **CA**: keep existing CPP Exempt + EI Exempt.
   - **NG**: render Pension Exempt, NHF Exempt, and NSITF Exempt toggles (all optional, default false; stored in existing tax metadata / new fields on the employee record).
   - **US / GB / ZM / KE / BI / other**: hide the card (no equivalent statutory exemptions surfaced here).

2. **`src/components/employees/EditEmployeeDialog.tsx`** — Mirror the same country-aware block around line 533 so edits match the add flow.

3. **`src/data/globalPayrollDefaults.ts`** (Nigeria block, lines 197–198) — Rename credit labels to disambiguate from Canada Revenue Agency:
   - `CRA Fixed Portion` → `Consolidated Relief (Fixed)`
   - `CRA Variable %` → `Consolidated Relief (Variable %)`
   Descriptions unchanged. These labels flow into the PAYE tab automatically.

4. **`src/pages/payroll/EmployeeProfile.tsx`** (line 329) — Show the exemption label based on `countryCode` (`Pension Exempt` for NG, `CPP Exempt` for CA, hide otherwise) so the read-only profile matches.

### Out of scope

- No schema migrations. NG exemption flags reuse the existing `tax_metadata` JSON on employees (already used for other localized flags); no new columns.
- No changes to payroll calculation logic — flags are captured for future use and surfaced on the profile only.
- No changes to the PAYE input fields themselves (Pension Relief, NHF Relief, Life Assurance, Gratuity remain as shown).
