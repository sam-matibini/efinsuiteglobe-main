-- 1) Drop unused backup tables (plain copies of journal data, no RLS, no longer needed)
DROP TABLE IF EXISTS public._backup_oluspe_je_20260517;
DROP TABLE IF EXISTS public._backup_oluspe_jel_20260517;
DROP TABLE IF EXISTS public._backup_oluspe_fx_swap_20260517;

-- 2) Remove unused plaintext SMS auth code column from document_signers
ALTER TABLE public.document_signers DROP COLUMN IF EXISTS auth_sms_code;

-- 3) Restrict tax_authority_credentials (access/refresh tokens, VRN, business number) to admins/owners only
DROP POLICY IF EXISTS "Org members view credentials" ON public.tax_authority_credentials;
DROP POLICY IF EXISTS "Org members insert credentials" ON public.tax_authority_credentials;
DROP POLICY IF EXISTS "Org members update credentials" ON public.tax_authority_credentials;
DROP POLICY IF EXISTS "Org members delete credentials" ON public.tax_authority_credentials;

CREATE POLICY "Org admins view credentials"
ON public.tax_authority_credentials
FOR SELECT
TO authenticated
USING (public.is_org_admin_or_owner(organization_id, auth.uid()));

CREATE POLICY "Org admins insert credentials"
ON public.tax_authority_credentials
FOR INSERT
TO authenticated
WITH CHECK (public.is_org_admin_or_owner(organization_id, auth.uid()));

CREATE POLICY "Org admins update credentials"
ON public.tax_authority_credentials
FOR UPDATE
TO authenticated
USING (public.is_org_admin_or_owner(organization_id, auth.uid()))
WITH CHECK (public.is_org_admin_or_owner(organization_id, auth.uid()));

CREATE POLICY "Org admins delete credentials"
ON public.tax_authority_credentials
FOR DELETE
TO authenticated
USING (public.is_org_admin_or_owner(organization_id, auth.uid()));