# Fix CRA leakage in eFinconnect for Nigerian organizations

## Root cause (verified)

- `Earthweb Security and Intelligence Network Limited` is correctly stored with `country_id → countries.code = 'NG'`, and `useCountryTreasuryConfig` correctly resolves to the `NG` profile — so the dashboard shell itself renders "Nigeria · NGN".
- However, the NG action cards in `src/config/countryTreasuryConfig.ts` link to `/treasury/tax-payments?authority=FIRS|SIRS|PenCom`, which renders `src/pages/treasury/TaxPayments.tsx` — a **CRA-only** page (labels, PD7A, `cra_my_payment` rail, CRA program-account dropdown, "CRA source deductions, GST/HST, corporate tax…" subheading).
- The shared `src/pages/treasury/PaymentHistory.tsx` also hardcodes copy: *"Unified history of CRA, AP and payroll payments"* and a `CRA` tab, regardless of country.
- Sidebar / KPI-linked destinations (`CraRemittanceCentre`, `CraRailStatusCard`, `PadAgreementsCard`, `MultiBusinessRemittance`, `EftRailSettings`, `BulkPayrollRemittance`, `FintracReports`) are Canada-only and should not surface for NG orgs.

## Changes

### 1. Route NG tax-bill cards to the Nigeria tax engine
`src/config/countryTreasuryConfig.ts` — replace the three NG "Pay …" tax destinations:

| Card | New `to` |
| --- | --- |
| Pay FIRS taxes | `/tax/nigeria?authority=FIRS` |
| Pay State (SIRS) taxes | `/tax/nigeria?authority=SIRS` |
| Pay pension & NHF | `/tax/nigeria?authority=PenCom` |

Confirm `/tax/nigeria` (`NigeriaTaxEngine.tsx`) reads the `authority` query param and pre-filters the Filings/Remittances tab; add that hook if it doesn't already.

### 2. Country-scope `TaxPayments.tsx`
Add `useCountryTreasuryConfig` at the top; if `countryCode !== 'CA'`, render a friendly redirect notice with a button to the country-appropriate page (`/tax/nigeria` for NG, no-op for CA). This prevents anyone who reaches `/treasury/tax-payments` directly from seeing CRA UI on a Nigerian org.

### 3. Make `PaymentHistory.tsx` country-aware
- Replace subtitle with a dynamic string driven by `config.taxPayees[0].authority` (e.g. "Unified history of FIRS, AP and payroll payments" for NG, "CRA, AP and payroll payments" for CA).
- Rename the `cra` tab label to `{primaryAuthority}` from config; filter logic stays the same (it already keys off `payment_type`, which is generic).

### 4. Hide Canada-only sub-nav for non-CA orgs
In the eFinconnect sidebar / `TreasurySettings` links, wrap CRA-specific entries (CRA Remittance Centre, CRA XML Filings, Multi-Business CRA, PAD Agreements, FINTRAC, EFT Rail Settings, Bulk Payroll Remittance) so they only render when `countryCode === 'CA'`. Nigerian orgs get the NG action grid + generic AP/Payroll/History links only.

## Verification

1. Sign in as the Nigerian org, open `/treasury` → header reads "Nigeria · NGN", tax cards link to `/tax/nigeria?authority=…`.
2. Click each of the three tax cards → lands on `NigeriaTaxEngine` pre-filtered to the requested authority; no CRA text anywhere.
3. Visit `/treasury/tax-payments` directly → shows the "This page is for Canadian organizations" redirect card.
4. Visit `/banking-payments/history` → subtitle and tab say "FIRS" not "CRA".
5. Re-check as a Canadian org → all existing CRA screens still render exactly as before.

## Out of scope

- No database migration; `Earthweb`'s country is already NG.
- No changes to the Nigeria tax engine tables/RPCs.
- No visual redesign of `TreasuryDashboard.tsx` beyond the config-driven link swap.
