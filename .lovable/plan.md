## Problem

On `/tax` for a Zambia-scoped organization, the **Tax Codes** tab shows Canadian codes (GST 5%, HST-ON 13%, HST-ATL 15%, PST-BC/SK/MB, QST), not Zambian VAT.

## Root cause (verified)

`src/hooks/useSalesTax.ts` → `useTaxCodes` (lines 173–422):

- Queries `tax_codes` for the org. If empty (typical for Zambia orgs today), it falls into a derivation branch that **unconditionally** pushes Canadian GST/HST/PST/QST rows into the result, regardless of `organization.country`.
- The Zambia UI copy in `SalesTax.tsx` already exists ("VAT management and ZRA reporting"), but the underlying tax-code list is hard-wired to Canada.

No `tax_codes` rows exist for Zambia orgs; the fix is in the derivation logic (frontend hook), not in the DB.

## Fix

Make the derivation in `useTaxCodes` country-aware, keyed off `organization.country`.

### 1. Extend `useTaxCodes` signature

Accept the country code alongside `organizationId`:

```ts
useTaxCodes(organizationId, countryCode)
```

Update the single caller in `src/pages/SalesTax.tsx` (already computes `countryCode`) to pass it in. Other call sites keep the current CA default.

### 2. Branch the derived-codes list by country

Replace the current Canadian-only block with a switch on `countryCode`:

- **ZM (Zambia)** — ZRA VAT Act:
  - `E` Exempt (0%) — medical, education, financial services
  - `VAT` Standard-rated VAT (16%) — `tax_type: 'VAT'`, recoverable
  - `VAT-ZR` Zero-rated (0%) — exports, prescribed supplies
  - `VAT-EX` VAT Exempt supplies (0%)
  - `IPL` Insurance Premium Levy (5%) — non-recoverable
  - `TL` Tourism Levy (1.5%) — non-recoverable
- **KE (Kenya)** — KRA: `VAT` 16%, `VAT-ZR` 0%, `VAT-EX` 0%
- **NG (Nigeria)** — NRS: `VAT` 7.5%, `VAT-ZR` 0%, `VAT-EX` 0%, `WHT-CONTRACT` 5%, `WHT-PROF` 10%
- **BI (Burundi)** — OBR: `TVA` 18%, `TVA-ZR` 0%, `TVA-EX` 0%
- **GB (UK)** — HMRC: `VAT-STD` 20%, `VAT-RED` 5%, `VAT-ZR` 0%, `VAT-EX` 0%
- **CA / default** — keep the existing Canadian block unchanged

Each derived code uses the current shape (`generateDeterministicUuid`, `gl_collected_account_id`/`gl_paid_account_id` mapped from `sales_tax_settings` where a match exists, else `null`; province tab column stays "Federal" / "-" for non-Canadian rows so the existing table renders cleanly).

### 3. No DB migration required

The derived codes render in the Tax Codes list and flow through the existing tax-selection UI. Users can still click **+ Add Tax Code** to persist overrides into `public.tax_codes`, at which point the DB rows take precedence exactly as they do today for Canadian orgs.

## Files touched

- `src/hooks/useSalesTax.ts` — country-aware derivation branch inside `useTaxCodes`
- `src/pages/SalesTax.tsx` — pass `countryCode` into `useTaxCodes(organization?.id, countryCode)`

## Out of scope

- Editing existing Canadian defaults
- Changing `sales_tax_settings` schema or seeding per-country rows
- Reworking the VAT return posting logic (already country-aware via `taxTerminology`)
