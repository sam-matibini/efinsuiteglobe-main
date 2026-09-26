-- Firm CRA software credentials for eFinsuite.
-- This is the representative ID and EFILE number/password of the firm, not a client's CRA login.

CREATE TABLE public.cra_firm_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  representative_id text NOT NULL DEFAULT '',
  efile_number text NOT NULL DEFAULT '',
  efile_password text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.cra_firm_settings (id) VALUES (true);

ALTER TABLE public.cra_firm_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cra_firm_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.cra_firm_settings TO service_role;

CREATE OR REPLACE FUNCTION public.admin_get_cra_firm_settings()
RETURNS TABLE (
  representative_id text,
  efile_number text,
  password_configured boolean,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.representative_id,
    s.efile_number,
    (char_length(s.efile_password) > 0),
    s.updated_at
  FROM public.cra_firm_settings s
  WHERE public.has_role(auth.uid(), 'admin');
$$;

CREATE OR REPLACE FUNCTION public.admin_save_cra_firm_settings(
  _representative_id text,
  _efile_number text,
  _efile_password text
)
RETURNS TABLE (
  representative_id text,
  efile_number text,
  password_configured boolean,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rep text := btrim(coalesce(_representative_id, ''));
  num text := btrim(coalesce(_efile_number, ''));
  pwd text := _efile_password;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only a platform admin can save CRA firm settings';
  END IF;
  IF rep <> '' AND rep !~ '^[A-Za-z0-9]{4,20}$' THEN
    RAISE EXCEPTION 'Representative ID must be 4 to 20 letters or digits';
  END IF;
  IF num <> '' AND num !~ '^[A-Za-z0-9]{4,16}$' THEN
    RAISE EXCEPTION 'EFILE number must be 4 to 16 letters or digits';
  END IF;
  IF pwd IS NOT NULL AND pwd <> '' AND (char_length(pwd) < 4 OR char_length(pwd) > 128 OR position(E'\n' in pwd) > 0) THEN
    RAISE EXCEPTION 'EFILE password must be 4 to 128 characters';
  END IF;
  IF rep = '' AND num = '' AND (pwd IS NULL OR pwd = '') THEN
    RAISE EXCEPTION 'Enter a representative ID, an EFILE number, or a password';
  END IF;

  INSERT INTO public.cra_firm_settings (id) VALUES (true)
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.cra_firm_settings SET
    representative_id = CASE WHEN rep <> '' THEN rep ELSE representative_id END,
    efile_number = CASE WHEN num <> '' THEN num ELSE efile_number END,
    efile_password = CASE WHEN pwd IS NOT NULL AND pwd <> '' THEN pwd ELSE efile_password END,
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = true;

  RETURN QUERY
    SELECT s.representative_id, s.efile_number, (char_length(s.efile_password) > 0), s.updated_at
    FROM public.cra_firm_settings s
    WHERE s.id = true;
END;
$$;

CREATE OR REPLACE FUNCTION public.gateway_cra_firm_settings()
RETURNS TABLE (
  representative_id text,
  efile_number text,
  efile_password text
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
    SELECT s.representative_id, s.efile_number, s.efile_password
    FROM public.cra_firm_settings s
    WHERE s.id = true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_cra_firm_settings() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_save_cra_firm_settings(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gateway_cra_firm_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_cra_firm_settings() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_save_cra_firm_settings(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gateway_cra_firm_settings() TO authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cra_tax_centre_payments'
  ) THEN
    ALTER TABLE public.cra_tax_centre_payments ADD COLUMN IF NOT EXISTS representative_id text;
    ALTER TABLE public.cra_tax_centre_payments ADD COLUMN IF NOT EXISTS efile_number text;
  END IF;
END $$;
