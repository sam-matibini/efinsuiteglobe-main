## Problem

Even after selecting **Nigeria** in the country selector, the eFinconnect page still shows Canadian content:

- Header chip reads "Canada · CAD"
- KPI amounts show `CA$0.00`
- "All modules" and quick-actions list "CRA Remittance", "CRA Accounts"

Root cause: `src/pages/treasury/BankingPaymentsDashboard.tsx` is hard-coded (CRA labels, `currencyOverride: 'CAD'`, static tile list). It never reads the country config or scope. Similarly `useCountryTreasuryConfig` and `CountryFlagBadge` read the *organization's* country, so they ignore the country scope until the org itself changes.

## Plan

### 1. Make the treasury config follow the country scope
Update `src/hooks/useCountryTreasuryConfig.ts` to prefer the scoped country over the organization's country, so eFinconnect switches immediately when the user picks a country — no org switch required.

- Read `useCountryScope()` first.
- Fall back to `organizations.country_id → countries.code`, then `organization.country`, then `CA`.

### 2. Country-aware BankingPaymentsDashboard
Refactor `src/pages/treasury/BankingPaymentsDashboard.tsx`:

- Consume `useCountryTreasuryConfig()` to get `countryCode`, `defaultCurrency`, and `taxPayees`.
- Derive `primaryAuthority` from `taxPayees[0].authority` (CRA / IRS / FIRS / HMRC). Use it for tile titles, button labels, and the transaction "source" prefix.
- Replace the local `cad()` formatter with `fmt.formatCurrency(n, { currencyOverride: config.defaultCurrency })` so KPI cards render `₦0.00` in Nigeria, `$0.00` in the US, etc.
- Rebuild the `tiles` array:
  - Replace "CRA Remittance" with `${primaryAuthority} Remittance` linking to `/treasury/tax-payments` (the country-neutral hub) instead of the Canada-only `/banking-payments/cra-remittance`.
  - Replace "CRA Accounts" with `${primaryAuthority} Accounts`; hide entirely for non-CA (CRA Accounts UI is Canada-specific).
  - Keep AP Payments, Payroll Payments, Scheduled, Payment History, Payment Links, EFT Rails (they are country-neutral).
- Replace the top-right "CRA remittance" button with `${primaryAuthority} remittance` pointing to the same country-neutral hub.
- Filter the KPI/`recent` list source label to use `primaryAuthority` rather than the literal "CRA".

### 3. Country-aware flag badge
Update `src/components/dashboard/CountryFlagBadge.tsx` to read `useCountryScope()` first, then fall back to the organization's country. This fixes the "Canada CAD" chip when Nigeria is scoped.

### 4. Verification
- Load `/banking-payments` while scoped to Nigeria and confirm:
  - Header chip shows Nigeria / NGN
  - KPI values render as `₦0.00`
  - Tiles show "FIRS Remittance", no "CRA Accounts"
- Switch scope to Canada and confirm CRA labels + CAD return.
- Typecheck passes.

## Files touched

- `src/hooks/useCountryTreasuryConfig.ts` — prefer scoped country
- `src/pages/treasury/BankingPaymentsDashboard.tsx` — country-driven tiles, labels, currency
- `src/components/dashboard/CountryFlagBadge.tsx` — follow scope

No database or route changes.
