## Goal

Localize subscription pricing and discounts per country. Existing plans become the **US default**; admins can add country-specific variants (own currency + own Stripe prices), and country-level discounts slot between global and per-org.

## Model changes

**1. `pricing_plans` — add country scoping**
- `country_id uuid null` references `countries(id)` (null = US/global default).
- `currency text` (derived from country's `default_currency`, editable).
- Unique index on `(tier, billing_cycle_context, country_id)` so each country has at most one plan per tier. `NULL country_id` = fallback.
- Keep existing rows as `country_id = NULL` (acts as US default; US orgs also match NULL if no explicit US row).

**2. `discount_presets` — add scope**
- `scope text` in `('global','country','organization')`, default `'global'`.
- `country_id uuid null` references `countries(id)` (required when `scope='country'`).
- Enforce via CHECK: `scope='country' ⇒ country_id IS NOT NULL`.
- Existing rows migrated to `scope='global'`.

**3. Resolution order (documented + implemented in code)**
For an org with `country_id = X`:
- **Plans**: prefer `pricing_plans` where `country_id=X`; else fall back to `country_id IS NULL`.
- **Discount**: per-org override > country preset for X > global preset. Applied at checkout and in `admin-subscription-override`.

## Backend

**Edge functions**
- `stripe-integration`
  - `list-plans`: accept `organizationId`, resolve org's `country_id`, return the country-scoped plan set (or NULL fallback) with correct `currency`.
  - `create-checkout-session`: use the country-resolved plan's `stripe_price_id_*` and pass `currency` accordingly.
  - `validate-promotion-code` / `preview-plan-change`: unchanged (Stripe handles currency via the price).
- `admin-subscription-override`
  - When applying a discount without explicit `preset_id`, auto-select the country preset for the target org's country before falling back to global.
  - When creating Stripe coupons for country presets, keep them currency-agnostic (percent-off) unless amount-off is used — in which case the coupon `currency` must match the plan currency (validate and reject mismatches).

**No change** to webhook handlers — they already key off `stripe_subscription_id`.

## Admin UI

**Pricing plans page (existing create/edit flow)**
- Add a **Country** selector (searchable, from `countries`) with a **"Default (US / fallback)"** option that stores `country_id = NULL`.
- On country select, prefill `currency` from `countries.default_currency` (editable).
- Plans list groups by country; a **country filter** at the top switches which country's plans you see.
- Duplicating a plan copies its tier/features and lets admin pick a new country to create a localized variant.
- Stripe product/price creation uses the selected currency.

**Discounts tab (`DiscountsTab.tsx`)**
- Add a **Scope** field: Global / Country / (Organization stays implicit via per-org apply flow).
- When Scope = Country, show country selector. List view shows scope column and filters.
- `SubscriptionAdminControls` "Set discount" for a specific org shows the resolved effective discount (org > country > global) with a badge indicating which tier is active.

## Customer-facing UI

**`SubscriptionCheckout.tsx`**
- Fetch plans via `list-plans` (country-resolved). Prices render in the plan's `currency` using `Intl.NumberFormat`.
- Promo-code preview and discount math unchanged (already percent-based).
- Show a small "Prices shown in {CURRENCY} for {Country}" note.

**`useSubscription` / `useUsageLimits`**
- No behavioral change; resolution happens server-side + in the list query.

## Out of scope
- No IP-based detection or manual country override on checkout (org country is source of truth).
- No automatic FX conversion — admins set each country's price explicitly.
- Existing subscriptions aren't repriced on country change; only new subscriptions/plan changes pick up the country-scoped price.

## Technical details

- Migration order: add columns → backfill NULLs → add unique index → add CHECK → GRANTs unchanged (tables already accessible).
- `pricing_plans` unique index uses `COALESCE(country_id, '00000000-0000-0000-0000-000000000000'::uuid)` to allow one NULL fallback per tier.
- Query pattern for resolution:
  ```sql
  SELECT DISTINCT ON (tier) * FROM pricing_plans
  WHERE is_active AND (country_id = $org_country OR country_id IS NULL)
  ORDER BY tier, country_id NULLS LAST;
  ```
- Discount resolver (server-side helper in `admin-subscription-override` + shared in checkout): org preset → country preset (active, not expired) → global preset.
