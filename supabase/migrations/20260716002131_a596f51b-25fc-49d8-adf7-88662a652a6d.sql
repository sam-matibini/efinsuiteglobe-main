
WITH office AS (
  SELECT id FROM public.pricing_plans WHERE tier = 'office_use' LIMIT 1
)
INSERT INTO public.subscriptions (organization_id, plan_id, status, billing_cycle)
SELECT o.id, (SELECT id FROM office), 'active', 'monthly'
FROM public.organizations o
JOIN public.user_roles ur
  ON ur.user_id = o.owner_id AND ur.role = 'admin'
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscriptions s
  WHERE s.organization_id = o.id
    AND s.status IN ('active','trialing')
);

UPDATE public.subscriptions s
SET plan_id = (SELECT id FROM public.pricing_plans WHERE tier = 'office_use' LIMIT 1)
FROM public.organizations o
JOIN public.user_roles ur
  ON ur.user_id = o.owner_id AND ur.role = 'admin'
WHERE s.organization_id = o.id
  AND s.status IN ('active','trialing')
  AND s.plan_id IS DISTINCT FROM (SELECT id FROM public.pricing_plans WHERE tier = 'office_use' LIMIT 1);
