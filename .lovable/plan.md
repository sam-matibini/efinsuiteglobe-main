# Grant Office Use subscription to all admin-owned organizations

## Goal
Every organization whose `owner_id` maps to a user with the `admin` role in `user_roles` should have an active subscription on the `Office Use` plan (`tier = 'office_use'`).

## Approach
Single SQL migration that upserts one active subscription per qualifying org:

```sql
INSERT INTO public.subscriptions (organization_id, plan_id, status, billing_cycle)
SELECT o.id,
       (SELECT id FROM public.pricing_plans WHERE tier = 'office_use' LIMIT 1),
       'active',
       'monthly'
FROM public.organizations o
JOIN public.user_roles ur
  ON ur.user_id = o.owner_id AND ur.role = 'admin'
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscriptions s
  WHERE s.organization_id = o.id
    AND s.status IN ('active','trialing')
);

-- Also upgrade any existing active/trialing subs on other plans to Office Use
UPDATE public.subscriptions s
SET plan_id = (SELECT id FROM public.pricing_plans WHERE tier = 'office_use' LIMIT 1)
FROM public.organizations o
JOIN public.user_roles ur
  ON ur.user_id = o.owner_id AND ur.role = 'admin'
WHERE s.organization_id = o.id
  AND s.status IN ('active','trialing')
  AND s.plan_id <> (SELECT id FROM public.pricing_plans WHERE tier = 'office_use' LIMIT 1);
```

## Notes
- Current state: 30+ admin-owned orgs exist with no active subscription — they will each get one Office Use row.
- `useSubscription.hasFeature` already treats `office_use` as admin-only (non-admin members of these orgs won't gain access via this tier), so this is safe.
- No frontend changes.

## Out of scope
- Backfilling subscriptions for orgs whose owner is not a platform admin.
- Changing how new admin-owned orgs get provisioned going forward (can be a follow-up trigger if desired).
