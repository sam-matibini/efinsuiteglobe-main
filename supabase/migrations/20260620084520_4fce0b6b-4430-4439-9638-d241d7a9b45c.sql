
REVOKE ALL ON FUNCTION public.resolve_tax_gl_account(uuid, text, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.seed_organization_tax_codes(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.relink_organization_tax_codes(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trg_seed_org_tax_codes() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trg_relink_tax_codes_on_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_tax_gl_account(uuid, text, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.seed_organization_tax_codes(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.relink_organization_tax_codes(uuid) TO authenticated, service_role;
