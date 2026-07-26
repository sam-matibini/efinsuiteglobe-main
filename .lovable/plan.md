## Problem

The Compliance tab reads `public.tax_types` filtered by the org's country. Nigeria (the current org's country) has **0 rows** in `tax_types` and `tax_rates`, so the card shows "No tax types configured" and clicking "Run AI Setup to configure" doesn't help — the AI apply step only writes `organization_tax_settings` referencing `tax_types.id` rows that don't exist.

Note: the NG Tax Engine already stores full NG tax logic in `ng_tax_definitions`. The compliance tab reads a different (generic) table, which is why it looks empty.

## Fix

1. Seed Nigeria's `tax_types` + `tax_rates` in `public.tax_types` / `public.tax_rates` so the Compliance tab renders them and AI Setup can enable them for the org:
   - VAT — 7.5% (consumption, default)
   - WHT — 10% default (income_tax)
   - CIT — 30% large / 20% medium / 0% small (income_tax)
   - TET (Tertiary Education Tax) — 3% (income_tax)
   - PAYE — progressive placeholder default 7% (payroll)
   - CGT — 10% (income_tax)
   - Stamp Duty — 0.75% (other)

   Each linked to Nigeria `country_id = afa3524b-4e7e-4a48-83ab-69648a263259`, with an `effective_from = 2023-01-01`, `is_default = true` on the primary rate, `is_active = true`.

2. After the seed, `useTaxTypes(NG)` returns 7 rows and the card shows a populated table. Existing "Run AI Setup" button already upserts `organization_tax_settings` for every returned tax_type — no code change needed.

3. Small UI polish: in `GlobalComplianceTab.tsx`, compute the rate column from the first `tax_rates` row instead of showing "—". (Requires selecting `tax_rates(*)` in the query.)

## Out of scope

- Seeding tax_types for the other 40+ countries currently at 0 (Canada, Kenya, Burundi already seeded; other jurisdictions can be addressed on request).
- Any change to the NG Tax Engine (`ng_tax_definitions`) — that stays as the source of truth for calculations; `tax_types` here is just the compliance display/registration list.

## Files

- **New migration** — seed Nigeria into `tax_types` + `tax_rates`.
- **`src/components/settings/GlobalComplianceTab.tsx`** — join `tax_rates` and render the default rate.
