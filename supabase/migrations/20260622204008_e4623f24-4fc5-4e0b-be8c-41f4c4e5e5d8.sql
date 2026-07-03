INSERT INTO public.organization_modules (organization_id, module_id, is_enabled)
SELECT o.id, m.id, true
FROM public.organizations o
CROSS JOIN public.modules m
WHERE m.code = 'treasury'
ON CONFLICT (organization_id, module_id) DO UPDATE SET is_enabled = true;