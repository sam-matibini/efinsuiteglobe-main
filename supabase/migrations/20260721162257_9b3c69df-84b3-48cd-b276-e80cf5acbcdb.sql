
-- pricing_plans: add country scoping
ALTER TABLE public.pricing_plans
  ADD COLUMN IF NOT EXISTS country_id uuid REFERENCES public.countries(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

-- One plan per (tier, country). NULL country_id = default/fallback (treated as US default).
CREATE UNIQUE INDEX IF NOT EXISTS pricing_plans_tier_country_unique
  ON public.pricing_plans (tier, COALESCE(country_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE is_active = true AND tier IS NOT NULL;

-- discount_presets: add scope + country
ALTER TABLE public.discount_presets
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS country_id uuid REFERENCES public.countries(id) ON DELETE RESTRICT;

ALTER TABLE public.discount_presets
  DROP CONSTRAINT IF EXISTS discount_presets_scope_check;
ALTER TABLE public.discount_presets
  ADD CONSTRAINT discount_presets_scope_check
  CHECK (scope IN ('global','country','organization')
         AND (scope <> 'country' OR country_id IS NOT NULL));
