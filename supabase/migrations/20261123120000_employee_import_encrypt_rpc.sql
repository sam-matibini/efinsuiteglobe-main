-- Bulk employee import encrypts national ID / tax ID / bank account numbers
-- through an RPC. pgcrypto lives in the `extensions` schema on Supabase, so
-- `rpc('pgp_sym_encrypt')` never resolved and every identifier was silently
-- dropped. This wrapper is callable by the service role only.
CREATE OR REPLACE FUNCTION public.encrypt_payroll_value(_plain text, _key text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT CASE
    WHEN _plain IS NULL OR _plain = '' THEN NULL
    ELSE encode(extensions.pgp_sym_encrypt(_plain, _key), 'base64')
  END;
$$;

REVOKE ALL ON FUNCTION public.encrypt_payroll_value(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.encrypt_payroll_value(text, text) TO service_role;
