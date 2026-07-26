# Country-First Scoping (Dynamics 365 style)

Restructure the app so the top-left country selector is the **primary scope**. Once a country is chosen, every list, dashboard, and module only shows data, settings, and options tied to that country. "All countries" is removed — a country is always required.

## Behavior

- Country selector becomes the **root scope** (persisted in `localStorage` + URL search param `?country=CA`).
- On login / first load:
  - If the user has orgs in only one country → auto-select it.
  - If multiple → show a country picker screen (D365-style "Choose environment").
- Switching country:
  - Filters the org switcher to that country only.
  - Auto-switches `currentOrganization` to the first (or last-used) org in that country.
  - Invalidates all React Query caches keyed by org/country.
- No "All countries" option anywhere.

## Module scoping rules

| Module | Scoped behavior |
|---|---|
| Org switcher / dashboards | Only orgs where `organizations.country_id` matches. |
| Tax engine | Route to country's engine only: CA → CRA/GST-HST/PST/QST; NG → FIRS/SIRS (NigeriaTaxEngine); US → IRS/state; GB → HMRC MTD; EU → OSS. Hide the others from nav + Reports Centre. |
| Payroll | Load only the country's `payrollLocalization` (T4/ROE for CA, W-2/1099 for US, PAYE/P60 for GB, PAYE/Pension for NG). Sidebar labels, tax slips, remittance forms swap. |
| Accounting standards & CoA | CoA templates filtered by country (`coa_templates.country_code`). Reporting framework locked to the country default (IFRS / IFRS-SME / ASPE / US GAAP). |
| eFinconnect | Payment rails, tax payees, and dashboard sections come from `countryTreasuryConfig` for that country only. |
| Reports Centre | Country-specific reports only (e.g. hide GST/HST for NG orgs). |

## UI changes (D365-style shell)

- Top-left header becomes a **two-tier selector**:
  1. **Country pill** (flag + name) — opens country grid.
  2. **Organization pill** — opens orgs within the selected country.
- Add a `/select-country` landing screen shown when no country is set and user has orgs in >1 country.
- Sidebar nav items conditionally render based on `country`:
  - `NigeriaTaxEngine` only if `country === 'NG'`.
  - `SalesTax` (CRA) only if `country === 'CA'`.
  - `EuOssFilings` only if `country ∈ EU`.
  - `UkVatFilings` only if `country === 'GB'`.

## Technical details

**New / updated files**
- `src/hooks/useCountryScope.ts` — replaces `useCountryFilter`. Required country (never null), auto-derives from current org, exposes `setCountry(code)` that also switches org.
- `src/context/CountryScopeProvider.tsx` — wraps app, gates rendering until a country is chosen.
- `src/pages/SelectCountry.tsx` — D365-style country grid landing.
- `src/components/layout/CountrySelector.tsx` — country-only picker (orgs move to a separate switcher below).
- `src/components/layout/OrgSwitcher.tsx` — always filtered by scoped country.
- `src/config/countryModuleMap.ts` — maps country code → allowed modules, tax engine, payroll config, CoA template ids, eFinconnect config.
- `src/config/routeModuleMap.ts` — extend with `requiredCountries?: string[]`.
- `src/hooks/useOrganization.ts` — filter `organizations` list by scoped country; block switching to an org outside scope.
- Sidebar + AppLayout — read `useCountryScope()` and hide non-matching nav sections.

**Data**
- Uses existing `organizations.country_id → countries.code`. No schema changes required.
- `coa_templates` already carries country info; ensure templates listing filters by scoped country.
- No migration needed unless we want to enforce a `default_country` per user (optional, not in this plan).

**Removals**
- `useCountryFilter` (superseded).
- "All countries" button in `CountrySelector`.
- Cross-country consolidated dashboards (out of scope — can be reintroduced later as a dedicated "Group" workspace).

## Out of scope
- Multi-country consolidation reporting.
- Per-user default country preference stored server-side.
- Renaming/reorganizing existing tax data.
