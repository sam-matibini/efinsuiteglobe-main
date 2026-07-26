## Add eFinconnect tab to Settings (country-aware)

Surface a new **eFinconnect** tab in the main Settings page so payment rails and tax remittance targets follow the organization's country automatically, with per-org overrides.

### 1. New Settings tab
In `src/pages/Settings.tsx`:
- Add a new `<TabsTrigger value="efinconnect">` with a `Send` icon (matches sidebar).
- Add a `<TabsContent value="efinconnect">` that renders a new `EfinconnectSettingsTab` component.

### 2. New component: `src/components/settings/EfinconnectSettingsTab.tsx`
Driven by `useCountryTreasuryConfig()` so it re-renders per org country (CA / US / NG / fallback):

- **Country & Profile card** — active country, flag, currency, resolved rails, tax authorities (e.g. CRA vs FIRS/SIRS/PenCom). Read-only summary with a link to change the organization's country in the Organization tab.
- **Payment rails toggles** — dynamic list from config:
  - CA: EFT, Interac e-Transfer, Wire, Bill Pay
  - US: ACH, Wire, RTP, Check
  - NG: NIBSS Instant, CBN RTGS, NEFT
  Toggles persist to `organizations.settings->efinconnect.rails` (JSON column already exists on organizations).
- **Tax remittance targets** — cards for each country-scoped authority from `countryTreasuryConfig.taxPayees`, each with an enable switch and a "Manage payees" deep link (CRA → `/treasury/tax-payments`, NG → `/tax/nigeria?tab=remittances`).
- **Dashboard sections** — checkboxes to show/hide Bills, Transfers, Payments & Collections, Governance on the eFinconnect dashboard. Persisted to `organizations.settings->efinconnect.sections`.
- **Defaults card** — default funding bank account selector (reuses existing `useFundingBankAccounts`) and default approval workflow (reuses existing approval workflow query).

### 3. Wire the dashboard to respect settings
`src/pages/treasury/TreasuryDashboard.tsx` and `src/config/countryTreasuryConfig.ts` consumers already read the config. Add a thin `useEfinconnectPreferences()` hook that merges `organizations.settings.efinconnect` over the country defaults so:
- Disabled rails hide their action cards.
- Disabled sections collapse entirely.
- Disabled tax authorities disappear from the "Pay business taxes" card list.

### 4. Persistence
No new tables. Store the JSON under `organizations.settings` (existing jsonb):
```
settings.efinconnect = {
  rails: { eft: true, interac: true, nibss: false, ... },
  sections: { bills: true, transfers: true, collections: true, governance: true },
  taxAuthorities: { CRA: true, FIRS: true, SIRS: true, PenCom: false },
  defaults: { fundingAccountId: uuid|null, approvalWorkflowId: uuid|null }
}
```
Read/write through the existing `useCurrentOrganization` + Supabase update pattern used elsewhere in Settings.

### 5. Behavior by country (out of the box)
- **CA org**: rails = EFT/Interac/Wire; taxes = CRA + Provincial payees.
- **US org**: rails = ACH/Wire/RTP; taxes = IRS + State.
- **NG org**: rails = NIBSS/RTGS/NEFT; taxes = FIRS/SIRS/PenCom; CRA cards hidden (already handled).
- Unknown country: falls back to CA config with a banner prompting the user to set the country in the Organization tab.

### Technical notes
- No DB migration required (uses existing `organizations.settings jsonb`).
- Reuses `countryTreasuryConfig`, `useCountryTreasuryConfig`, `useFundingBankAccounts`.
- All UI in `src/components/settings/EfinconnectSettingsTab.tsx` (plus a small `useEfinconnectPreferences.ts` hook).
- Tab integrated into `src/pages/Settings.tsx` only; no routing changes.