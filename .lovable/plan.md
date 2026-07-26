## Goal

1. Recognize **IFRS for SMEs** as a first-class accounting standard across the app (currently only `ASPE`, `ASNPO`, `IFRS` exist).
2. Deliver two Nigeria Chart of Accounts (CoA) templates: **Nigeria — Full IFRS** and **Nigeria — IFRS for SMEs**, each aligned to its standard.
3. Add a **Security & Intelligence** industry with a specialized CoA template (offered for NG Full IFRS and NG IFRS-for-SMEs, plus generic IFRS).

## Changes

### 1. Standard: "IFRS for SMEs"
- Extend the framework union in `src/data/industries.ts` from `'ASPE' | 'ASNPO' | 'IFRS'` to include `'IFRS_SME'`, plus a display label map ("IFRS for SMEs").
- Update `getIndustriesByFramework` and any switch on framework (compilation, reports labels) to accept the new value.
- `useLocalizedCurrency.ts`: add `NG` entry → `{ standard: 'IFRS / IFRS for SMEs', label: 'Nigerian GAAP (IFRS)' }` so the UI labels correctly.
- `CreateOrganizationDialog.tsx` and `GlobalComplianceTab.tsx`: when the selected country is Nigeria, show a standard selector (Full IFRS vs IFRS for SMEs); persist the choice on the organization (existing `accounting_standard` column on `organizations`).
- `ai-jurisdiction-setup` edge function: allow `IFRS_SME` as a valid detected value; default Nigerian SMEs to `IFRS_SME`.

### 2. Nigeria CoA templates
Migration work on `coa_templates` + `coa_template_accounts`:
- Rename existing "Nigeria SMEs (IFRS)" template to **"Nigeria — IFRS for SMEs"**, set `accounting_standard = 'IFRS_SME'`, keep `is_default = true` for NG.
- Insert a second template **"Nigeria — Full IFRS"** with `accounting_standard = 'IFRS'`, `is_default = false`. Seed the full 70-account structure plus IFRS-only accounts that IFRS for SMEs omits:
  - Deferred Tax Asset / Liability (IAS 12 recognition)
  - Investment Property at fair value (IAS 40)
  - Biological Assets (IAS 41)
  - Financial assets at FVOCI / FVTPL with expected-credit-loss allowance (IFRS 9 detail)
  - Hedging reserve, cash flow hedge OCI
  - Contract assets / liabilities (IFRS 15 detail split)
  - Non-current assets held for sale (IFRS 5)
- Trim the IFRS-for-SMEs template so it reflects Section-27/29 simplifications: single "Deferred Tax (net)" account, no FVOCI reserve, simplified lease liability (short-term lease exemption), single "Investments" line.
- Ensure both templates keep the NG-specific tax payable accounts (VAT, WHT-CITA, WHT-PIT, PAYE, Pension, NHF, ITF, NSITF, CIT, TET).

### 3. Security & Intelligence industry
- Add `{ value: 'security_intelligence', label: 'Security & Intelligence', description: 'Guarding, investigations, cyber-intel, protective services', icon: 'ShieldCheck', accountingFramework: 'IFRS', specializedAccounts: [...], cogsRequired: true, inventoryRequired: true }` to `src/data/industries.ts`.
- Add a **Security & Intelligence CoA overlay** — a set of ~18 accounts that get merged into any selected NG template (or the generic IFRS template) when this industry is chosen:
  - Revenue: Guarding Services, Investigation & Intelligence Fees, Alarm Monitoring, Escort & VIP Protection, Cybersecurity/Threat-Intel Subscription, Training Income
  - COGS/Direct costs: Guard Wages & Allowances, Uniforms & PPE, Firearms & Ammunition, Canine Unit Costs, Vehicle Fuel & Maintenance, Subcontracted Security, Communications Equipment (radios), Surveillance Equipment (rental/consumables)
  - Assets: Firearms & Weapons (regulated register), Surveillance & CCTV Equipment, Armored Vehicles, K9 Unit Assets
  - Liabilities: Client Retainer Deposits, Regulatory Bond Payable (NSCDC/PSGPB)
  - Expenses: License & Regulatory Fees (NSCDC / DSS clearances), Insurance – Liability & Fidelity, Background-Check Costs
- Extend `AddOrganizationDialog` / industry picker to surface the new industry; ensure `AccountGenerator` / `ai-coa-generator` prompt lists it as an option with sector guidance.

### Technical details

Files touched (planned):
- `src/data/industries.ts` — new framework literal, new industry, helpers.
- `src/data/nigeriaCoaOverlays.ts` (new) — Security & Intelligence overlay definitions.
- `src/hooks/useLocalizedCurrency.ts`, `src/hooks/useGlobalJurisdiction.ts` — NG standard labels.
- `src/components/accounts/CreateOrganizationDialog.tsx` — standard selector when country=NG.
- `src/components/settings/GlobalComplianceTab.tsx` — display of active standard.
- `supabase/functions/ai-jurisdiction-setup/index.ts` and `supabase/functions/ai-coa-generator/index.ts` — accept `IFRS_SME`, new industry prompt.
- Migration:
  1. Update existing NG template (rename, set `IFRS_SME`).
  2. Insert new "Nigeria — Full IFRS" template + full account seed.
  3. Insert Security & Intelligence overlay accounts into both NG templates (marked with `account_group='Security & Intelligence'` so the generator can filter).
- Any code reading `accounting_standard` for switch logic (compilation report headers, disclosure text) gets an `IFRS_SME` branch that reuses IFRS behavior but renders the "IFRS for SMEs" label.

### Out of scope
- No changes to posting logic, tax engine, or existing reports beyond label mapping.
- No retroactive migration of existing organizations already set to `IFRS` — a follow-up UI action lets NG orgs switch to `IFRS_SME` manually.
