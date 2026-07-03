
-- 1) document_signers column-level access
REVOKE SELECT (access_code, signing_token) ON public.document_signers FROM authenticated;
REVOKE SELECT (access_code, signing_token) ON public.document_signers FROM anon;
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ') INTO cols
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='document_signers'
    AND column_name NOT IN ('access_code','signing_token');
  EXECUTE format('GRANT SELECT (%s) ON public.document_signers TO authenticated', cols);
END $$;
GRANT ALL ON public.document_signers TO service_role;

-- 2) otp_verifications bcrypt-at-rest
UPDATE public.otp_verifications
SET otp_code = extensions.crypt(otp_code, extensions.gen_salt('bf', 8))
WHERE otp_code IS NOT NULL AND otp_code !~ '^\$2[aby]\$';

COMMENT ON COLUMN public.otp_verifications.otp_code IS
  'Bcrypt hash of the OTP. Verify with extensions.crypt(input, otp_code) = otp_code.';

CREATE OR REPLACE FUNCTION public.hash_otp_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF NEW.otp_code IS NOT NULL AND NEW.otp_code !~ '^\$2[aby]\$' THEN
    NEW.otp_code := extensions.crypt(NEW.otp_code, extensions.gen_salt('bf', 8));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS hash_otp_code_trg ON public.otp_verifications;
CREATE TRIGGER hash_otp_code_trg
BEFORE INSERT OR UPDATE OF otp_code ON public.otp_verifications
FOR EACH ROW EXECUTE FUNCTION public.hash_otp_code();

CREATE OR REPLACE FUNCTION public.verify_otp_code(_id uuid, _code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.otp_verifications
    WHERE id = _id AND otp_code = extensions.crypt(_code, otp_code)
  );
$$;
REVOKE ALL ON FUNCTION public.verify_otp_code(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_otp_code(uuid, text) TO service_role;

-- 3) is_org_member: scope the swapped-arg path to true user/org pairs
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = _user_id AND organization_id = _org_id
    )
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = _org_id
        AND om.organization_id = _user_id
        AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = _user_id)
        AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = _org_id)
    );
$$;
