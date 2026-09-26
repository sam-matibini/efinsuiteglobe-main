-- Firm contact CRA has for this representative.
-- Sent with filing and Client Data Enquiry. Not a client's CRA login.

ALTER TABLE public.cra_firm_settings
  ADD COLUMN IF NOT EXISTS representative_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS efile_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mailing_address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS telephone text NOT NULL DEFAULT '';

DROP FUNCTION IF EXISTS public.admin_get_cra_firm_settings();
DROP FUNCTION IF EXISTS public.admin_save_cra_firm_settings(text, text, text);
DROP FUNCTION IF EXISTS public.admin_save_cra_firm_settings(text, text, text, text, text);
DROP FUNCTION IF EXISTS public.gateway_cra_firm_settings();

CREATE OR REPLACE FUNCTION public.admin_get_cra_firm_settings()
RETURNS TABLE (
  representative_name text,
  representative_id text,
  efile_name text,
  efile_number text,
  contact_email text,
  mailing_address text,
  telephone text,
  password_configured boolean,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.representative_name,
    s.representative_id,
    s.efile_name,
    s.efile_number,
    s.contact_email,
    s.mailing_address,
    s.telephone,
    (char_length(s.efile_password) > 0),
    s.updated_at
  FROM public.cra_firm_settings s
  WHERE public.has_role(auth.uid(), 'admin');
$$;

CREATE OR REPLACE FUNCTION public.admin_save_cra_firm_settings(
  _representative_name text,
  _representative_id text,
  _efile_name text,
  _efile_number text,
  _efile_password text,
  _contact_email text,
  _mailing_address text,
  _telephone text
)
RETURNS TABLE (
  representative_name text,
  representative_id text,
  efile_name text,
  efile_number text,
  contact_email text,
  mailing_address text,
  telephone text,
  password_configured boolean,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rep_name text := regexp_replace(btrim(coalesce(_representative_name, '')), '\s+', ' ', 'g');
  rep text := btrim(coalesce(_representative_id, ''));
  file_name text := regexp_replace(btrim(coalesce(_efile_name, '')), '\s+', ' ', 'g');
  num text := btrim(coalesce(_efile_number, ''));
  pwd text := _efile_password;
  mail text := lower(regexp_replace(btrim(coalesce(_contact_email, '')), '\s+', ' ', 'g'));
  addr text := regexp_replace(btrim(coalesce(_mailing_address, '')), '\s+', ' ', 'g');
  phone text := regexp_replace(btrim(coalesce(_telephone, '')), '\s+', ' ', 'g');
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only a platform admin can save CRA firm settings';
  END IF;
  IF rep_name <> '' AND (char_length(rep_name) < 2 OR char_length(rep_name) > 80 OR rep_name ~ '[[:cntrl:]]') THEN
    RAISE EXCEPTION 'Representative name must be 2 to 80 characters';
  END IF;
  IF rep <> '' AND rep !~ '^[A-Za-z0-9]{4,20}$' THEN
    RAISE EXCEPTION 'Representative ID must be 4 to 20 letters or digits';
  END IF;
  IF file_name <> '' AND (char_length(file_name) < 2 OR char_length(file_name) > 80 OR file_name ~ '[[:cntrl:]]') THEN
    RAISE EXCEPTION 'EFILE name must be 2 to 80 characters';
  END IF;
  IF num <> '' AND num !~ '^[A-Za-z0-9]{4,16}$' THEN
    RAISE EXCEPTION 'EFILE number must be 4 to 16 letters or digits';
  END IF;
  IF pwd IS NOT NULL AND pwd <> '' AND (char_length(pwd) < 4 OR char_length(pwd) > 128 OR position(E'\n' in pwd) > 0) THEN
    RAISE EXCEPTION 'EFILE password must be 4 to 128 characters';
  END IF;
  IF mail <> '' AND (char_length(mail) > 120 OR mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN
    RAISE EXCEPTION 'Enter a valid email address';
  END IF;
  IF addr <> '' AND (char_length(addr) < 5 OR char_length(addr) > 200 OR addr ~ '[[:cntrl:]]' OR addr !~ '[[:alnum:]]') THEN
    RAISE EXCEPTION 'Mailing address must be 5 to 200 characters';
  END IF;
  IF phone <> '' AND (
    char_length(phone) < 7
    OR char_length(phone) > 20
    OR phone !~ '^[0-9+(). -]+$'
    OR char_length(regexp_replace(phone, '[^0-9]', '', 'g')) < 7
  ) THEN
    RAISE EXCEPTION 'Telephone must include at least 7 digits';
  END IF;
  IF rep_name = '' AND rep = '' AND file_name = '' AND num = '' AND (pwd IS NULL OR pwd = '') AND mail = '' AND addr = '' AND phone = '' THEN
    RAISE EXCEPTION 'Enter a representative name, representative ID, an EFILE name, an EFILE number, a password, or contact details';
  END IF;

  INSERT INTO public.cra_firm_settings (id) VALUES (true)
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.cra_firm_settings SET
    representative_name = CASE WHEN rep_name <> '' THEN rep_name ELSE representative_name END,
    representative_id = CASE WHEN rep <> '' THEN rep ELSE representative_id END,
    efile_name = CASE WHEN file_name <> '' THEN file_name ELSE efile_name END,
    efile_number = CASE WHEN num <> '' THEN num ELSE efile_number END,
    efile_password = CASE WHEN pwd IS NOT NULL AND pwd <> '' THEN pwd ELSE efile_password END,
    contact_email = CASE WHEN mail <> '' THEN mail ELSE contact_email END,
    mailing_address = CASE WHEN addr <> '' THEN addr ELSE mailing_address END,
    telephone = CASE WHEN phone <> '' THEN phone ELSE telephone END,
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = true;

  RETURN QUERY
    SELECT
      s.representative_name,
      s.representative_id,
      s.efile_name,
      s.efile_number,
      s.contact_email,
      s.mailing_address,
      s.telephone,
      (char_length(s.efile_password) > 0),
      s.updated_at
    FROM public.cra_firm_settings s
    WHERE s.id = true;
END;
$$;

CREATE OR REPLACE FUNCTION public.gateway_cra_firm_settings()
RETURNS TABLE (
  representative_name text,
  representative_id text,
  efile_name text,
  efile_number text,
  efile_password text,
  contact_email text,
  mailing_address text,
  telephone text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.user_id = auth.uid()
    )
  ) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT
      s.representative_name,
      s.representative_id,
      s.efile_name,
      s.efile_number,
      s.efile_password,
      s.contact_email,
      s.mailing_address,
      s.telephone
    FROM public.cra_firm_settings s
    WHERE s.id = true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_cra_firm_settings() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_save_cra_firm_settings(text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gateway_cra_firm_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_cra_firm_settings() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_save_cra_firm_settings(text, text, text, text, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gateway_cra_firm_settings() TO authenticated, service_role;
