## Problem

In the country selector, Zambia appears as "ZM" instead of "Zambia" because `CODE_TO_NAME` in `src/hooks/useCountryFilter.ts` has no `ZM` entry — `countryName('ZM')` falls back to returning the raw code.

## Fix

Add missing country names to `CODE_TO_NAME` (and reverse entries to `NAME_TO_CODE`) in `src/hooks/useCountryFilter.ts`:

- `ZM` → Zambia
- `BI` → Burundi
- `RW` → Rwanda
- `TZ` → Tanzania
- `UG` → Uganda
- `MW` → Malawi
- `ZW` → Zimbabwe

This ensures any org whose country_id resolves to these codes shows the full country name in the top-left selector and elsewhere `countryName()` is used.

No other files change.