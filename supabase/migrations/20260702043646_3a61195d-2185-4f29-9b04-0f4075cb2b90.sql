
INSERT INTO public.modules (code, name, description, icon, is_core, display_order)
VALUES ('leases'::public.module_type, 'Leases', 'ASC 842 / IFRS 16 lease accounting, ROU assets and lease liabilities', 'Landmark', false, 65)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.organization_modules (organization_id, module_id, is_enabled, enabled_at)
SELECT om.organization_id, m_lease.id, true, now()
FROM public.organization_modules om
JOIN public.modules m_fa ON m_fa.id = om.module_id AND m_fa.code = 'fixed_assets'::public.module_type
CROSS JOIN LATERAL (SELECT id FROM public.modules WHERE code = 'leases'::public.module_type) m_lease
WHERE om.is_enabled = true
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_modules om2
    WHERE om2.organization_id = om.organization_id AND om2.module_id = m_lease.id
  );
