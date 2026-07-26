## Problem

The country selector shows **Zambia (ZM)** but the eFinconnect settings tab still shows **"Canada · CAD"** with Canadian rails (Stripe ACH, EFT Paysafe, Interac) and CRA tax payees.

**Root cause (verified):** `src/config/countryTreasuryConfig.ts` `REGISTRY` only contains `CA`, `US`, `NG`. `getCountryTreasuryConfig('ZM')` hits the `?? CA` fallback, so `useCountryTreasuryConfig` returns Canada for Zambia. Scope wiring itself is correct — the config just has no ZM entry.

## Fix

Add a **Zambia (ZM)** entry to the treasury config registry so eFinconnect (settings + dashboard) localizes when Zambia is scoped.

### `src/config/countryTreasuryConfig.ts`

1. Define `const ZM: CountryTreasuryConfig` with:
   - `countryCode: 'ZM'`, `displayName: 'Zambia'`, `defaultCurrency: 'ZMW'`
   - **Rails:** ZIPSS (real-time), DDACC / EFT (T+1), RTGS (BoZ, same-day, high value), Between accounts, Cheque, Mobile Money (MTN / Airtel — grouped as `manual` rail id since no dedicated enum yet)
   - **Tax payees:** ZRA VAT, ZRA PAYE, ZRA WHT, ZRA CIT, ZRA Turnover Tax, NAPSA (pension), NHIMA (health insurance)
   - **Sections:**
     - Bills: Pay bills, Pay ZRA taxes (→ generic tax payments page), Pay NAPSA & NHIMA, Pay salaries
     - Transfers: Between accounts, ZIPSS instant, EFT (DDACC), BoZ RTGS
     - Payments: Payment links, Scheduled payments
2. Register `ZM` in `REGISTRY`.

No new rail IDs are added to the `RailId` union in this pass — Zambian rails reuse existing generic ids (`ach` relabeled as EFT/DDACC, `wire` as RTGS, `interac` as ZIPSS instant, `manual` for mobile money) to avoid touching downstream rail-flag logic. This is the same pattern used for US/NG.

### Out of scope

- `GB`, `KE`, `BI` also missing from the registry but not part of this report — leave for a follow-up unless requested.
- `EfinconnectSettingsTab.tsx` footnote still says *"To change country, update Organization → Country"*; scope selector already overrides this. Not touching copy here.

## Verification

1. With Zambia scoped, `/settings?tab=efinconnect` header badge shows **"Zambia · ZMW"**.
2. Payment rails list shows ZIPSS / EFT / RTGS / Mobile Money (not Stripe ACH / Interac).
3. Tax authorities list shows ZRA / NAPSA / NHIMA (not CRA).
4. `/treasury` dashboard tiles and currency also swap (already wired via `useCountryTreasuryConfig`).