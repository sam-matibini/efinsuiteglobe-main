-- Add missing modules: DocSign, Communication, and Accountant Dashboard
INSERT INTO public.modules (code, name, description, icon, is_core, display_order)
VALUES 
  ('docsign', 'DocSign', 'Document signing, sending, and management', 'FileSignature', false, 12),
  ('communication', 'Communication', 'SMS, Email, WhatsApp messaging hub', 'MessageSquare', false, 13),
  ('accountant_dashboard', 'Accountant Dashboard', 'Unified accountant workspace and analytics', 'Calculator', false, 14)
ON CONFLICT (code) DO NOTHING;

-- Enable these new modules for all existing organizations by default
INSERT INTO public.organization_modules (organization_id, module_id, is_enabled)
SELECT o.id, m.id, true
FROM public.organizations o
CROSS JOIN public.modules m
WHERE m.code IN ('docsign', 'communication', 'accountant_dashboard')
ON CONFLICT (organization_id, module_id) DO NOTHING;