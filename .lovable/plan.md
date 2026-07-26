# Country Selector (Top-Left Company Organizer)

Add a Dynamics 365–style **Country Selector** to the top-left of the app header so companies/clients are grouped and filtered by country, making it easy to administer the accounting system per localized jurisdiction.

## Where it goes

Header top-left, right after the menu button and before the search input, in `src/components/layout/AppLayout.tsx`:

```text
[☰]  [🇳🇬 Nigeria ▾]  [🔍 Search…]        …flag / indicators / user
```

On mobile, the trigger collapses to a flag-only button.

## Behavior

1. **Trigger**: shows the flag + country name of the currently active organization (fallback: "All countries").
2. **Dropdown** (Popover + Command search):
   - "All countries" option at the top.
   - List of countries derived from the distinct `country_code` values across the user's organizations (CA, US, NG, GB, …).
   - Each country row shows flag, name, and a count badge of companies in that country.
   - Expanding a country reveals its companies; clicking a company calls the existing `switchOrganization(id)` from `useOrganization`.
3. **Filter behavior**:
   - Selecting a country stores `selected_country_filter` in `localStorage` (per user).
   - The existing `SearchableOrgSwitcher` in the sidebar reads the same filter and shows only orgs from that country (with a "Clear country filter" chip).
   - If the currently active org is not in the selected country, the dropdown highlights "Switch to a company in {country}" but does not auto-switch.
4. **Auto-set on switch**: switching an org updates the country filter to that org's country so the selector always reflects the active company's jurisdiction.

## Files

- New: `src/components/layout/CountrySelector.tsx` — Popover/Command UI, grouping logic, count badges, flags via existing `CountryFlagBadge` icon set / `country-flag-icons` (already used).
- New: `src/hooks/useCountryFilter.ts` — reads/writes `localStorage` key `efs.country_filter`, exposes `{ country, setCountry, clear }`, backed by a small event bus so sidebar + header stay in sync.
- Edit: `src/components/layout/AppLayout.tsx` — mount `<CountrySelector />` in the left header cluster (line ~188).
- Edit: `src/components/layout/SearchableOrgSwitcher.tsx` — accept optional `filterCountry` prop and filter the org list; show a small "Filtered by {country}" chip with clear button.
- Edit: `src/components/layout/Sidebar.tsx` — pass the current country filter (from `useCountryFilter`) into `SearchableOrgSwitcher`.

## Data

Uses existing `public.organizations.country_code` (already populated; Nigeria orgs are `NG`, Canadian orgs `CA`, etc.). No migration required.

## Out of scope

- No changes to accounting logic, tax engines, or CoA templates — this is UI-only organization/navigation.
- No new country creation flow; countries are inferred from existing organizations.
