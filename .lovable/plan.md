## Add "Taxes & Remittances" section back to eFinconnect

### Problem

Tax remittance actions currently live inside the generic **Bills** section of the eFinconnect dashboard (`/treasury`). Users want them broken out into their own dedicated **Taxes & Remittances** section so tax obligations are visible at a glance across every localized country (CA, US, NG, ZM, and any later additions).

### Approach

Purely presentation-layer — split tax cards out of `bills` into a new `taxRemittances` section on `CountryTreasuryConfig`, render it as its own section on `TreasuryDashboard`, and wire it into the existing preference gating.

### Changes

1. **`src/config/countryTreasuryConfig.ts`**
   - Add `taxRemittances: DashboardActionDef[]` to the `sections` type.
   - Move the existing tax-remittance cards out of `bills` and into `taxRemittances` for each country:
     - **CA**: "Pay business taxes" (`/treasury/tax-payments`) + new "CRA Remittance Centre" (`/banking-payments/cra-remittance`) and "Provincial Remittances".
     - **US**: "Pay business taxes" + "US Remittance Centre" (`/banking-payments/us-remittance`).
     - **NG**: "Pay NRS taxes", "Pay State (SIRS) taxes", "Pay pension & NHF" (already exist, just relocated).
     - **ZM**: "Pay ZRA taxes", "Pay NAPSA & NHIMA" (relocated).
   - Leave non-tax entries ("Pay bills", "Pay salaries") in `bills`.

2. **`src/pages/treasury/TreasuryDashboard.tsx`**
   - Render a new `<Section title="Taxes & Remittances" />` between **Bills** and **Transfers**, gated by `sectionEnabled('taxRemittances')` and filtered through the existing `filterByAuthority` helper so per-authority toggles still apply.

3. **`src/hooks/useEfinconnectPreferences.ts`** (light touch)
   - Add `'taxRemittances'` to the section keys recognized by `sectionEnabled` so users can hide it from `EfinconnectSettingsTab` (defaults to enabled).

4. **`src/components/settings/EfinconnectSettingsTab.tsx`**
   - Add a toggle row for "Taxes & Remittances" alongside the existing Bills / Transfers / Payments / Governance toggles.

### Out of scope

- No changes to underlying tax engines, routes, or database.
- No new pages — all links point to existing routes (`/treasury/tax-payments`, `/tax/nigeria`, `/banking-payments/cra-remittance`, `/banking-payments/us-remittance`).
- Countries not currently in `REGISTRY` (KE, BI, GB) — they already fall back to CA and will inherit the new section once their configs are added in a future pass.
