## Problem

The paystub renders in `$` (CAD) for a Nigerian employee instead of `₦`. Root cause is in `src/components/payroll/ViewPayRunDialog.tsx` line 128:

```ts
const countryCode = (organization as any)?.country?.code || 'CA';
```

`organization.country` is a **string** (e.g. `"Nigeria"`), not an object with `.code` — confirmed in `src/hooks/useOrganization.ts` (`country: string | null`) and in `src/hooks/useCurrencyFormatter.ts`, which correctly reads `organization?.country` directly. So `.code` is always `undefined`, the code falls back to `'CA'`, and `localization.currency` becomes `CAD` — which is then passed into `<PaystubViewer currencyCode={localization.currency} />`.

## Fix

In `src/components/payroll/ViewPayRunDialog.tsx`:

- Replace the broken country-code derivation with the same pattern the rest of the app uses, resolving from the string `organization.country` via `getCountryLocalization` / `getLocaleForCountry` (both already handle full country names and codes).

```ts
const countryCode = (organization as any)?.country || 'CA';
```

That single change makes `localization.currency` = `NGN` and `locale` = `en-NG` for Nigerian organizations, which flow into `PaystubViewer` and format all amounts (Earnings, Deductions, Net Pay, YTD) with `₦`.

## Verification

- Open a pay run for the Nigerian org shown in the screenshot; confirm all currency values on the paystub render with `₦` and no `$` remains.
- Confirm Canadian org paystubs still render in `$` (CAD) — the fallback is unchanged.

## Scope

Frontend-only, one-line change in `ViewPayRunDialog.tsx`. No DB, no other components affected (PaystubViewer already accepts `currencyCode`/`locale` props correctly).