
ALTER TABLE public.pricing_plans ADD COLUMN IF NOT EXISTS tier text;

UPDATE public.pricing_plans
SET tier = CASE
  WHEN lower(name) LIKE '%office%' THEN 'office_use'
  WHEN lower(name) LIKE '%starter%' THEN 'starter'
  WHEN lower(name) LIKE '%professional%' OR lower(name) LIKE '%pro%' THEN 'professional'
  WHEN lower(name) LIKE '%enterprise%' THEN 'enterprise'
  ELSE tier
END
WHERE tier IS NULL;

INSERT INTO public.pricing_plans (name, description, price_monthly, price_yearly, features, max_users, max_employees, is_active, sort_order, tier)
SELECT
  'Office Use',
  'Internal / demo plan with full access. Admin-only.',
  0, 0,
  '["Admin-only demo plan","Full module access","Unlimited users","Unlimited employees"]'::jsonb,
  NULL, NULL,
  true, 0, 'office_use'
WHERE NOT EXISTS (SELECT 1 FROM public.pricing_plans WHERE tier = 'office_use');
