-- Platform admins store API keys here. Authenticated roles cannot select the secret column.
CREATE TABLE IF NOT EXISTS public.platform_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  label text NOT NULL,
  secret_name text NOT NULL UNIQUE,
  secret_hint text NOT NULL DEFAULT '',
  secret_value text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  docs_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE public.platform_api_keys FROM PUBLIC;
REVOKE ALL ON TABLE public.platform_api_keys FROM anon, authenticated;
GRANT ALL ON TABLE public.platform_api_keys TO service_role;
ALTER TABLE public.platform_api_keys ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_platform_apis()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  BEGIN
    allowed := public.has_role(auth.uid(), 'admin');
  EXCEPTION WHEN undefined_function THEN
    allowed := false;
  END;
  IF allowed THEN
    RETURN true;
  END IF;
  IF to_regprocedure('public.is_platform_staff()') IS NOT NULL THEN
    EXECUTE 'SELECT public.is_platform_staff()' INTO allowed;
    RETURN COALESCE(allowed, false);
  END IF;
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.can_manage_platform_apis() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_platform_apis() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_platform_api_keys()
RETURNS TABLE (
  id uuid,
  provider text,
  label text,
  secret_name text,
  secret_hint text,
  enabled boolean,
  docs_url text,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_platform_apis() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  RETURN QUERY
    SELECT k.id, k.provider, k.label, k.secret_name, k.secret_hint, k.enabled, k.docs_url, k.updated_at
    FROM public.platform_api_keys k
    ORDER BY k.label;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_platform_api_key(
  p_provider text,
  p_label text,
  p_secret_name text,
  p_secret_value text,
  p_docs_url text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  provider text,
  label text,
  secret_name text,
  secret_hint text,
  enabled boolean,
  docs_url text,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  saved public.platform_api_keys%ROWTYPE;
  clean_name text := upper(trim(p_secret_name));
  clean_value text := trim(p_secret_value);
BEGIN
  IF NOT public.can_manage_platform_apis() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF trim(p_label) = '' THEN
    RAISE EXCEPTION 'Enter a name for this API.';
  END IF;
  IF clean_name !~ '^[A-Z][A-Z0-9_]{2,63}$' THEN
    RAISE EXCEPTION 'Use a secret name like ELEVENLABS_API_KEY.';
  END IF;
  IF length(clean_value) < 8 THEN
    RAISE EXCEPTION 'Enter the API key.';
  END IF;
  INSERT INTO public.platform_api_keys (provider, label, secret_name, secret_value, secret_hint, docs_url)
  VALUES (COALESCE(NULLIF(trim(p_provider), ''), 'custom'), trim(p_label), clean_name, clean_value, '••••' || right(clean_value, 4), NULLIF(trim(p_docs_url), ''))
  ON CONFLICT (secret_name) DO UPDATE
    SET provider = EXCLUDED.provider,
        label = EXCLUDED.label,
        secret_value = EXCLUDED.secret_value,
        secret_hint = EXCLUDED.secret_hint,
        docs_url = EXCLUDED.docs_url,
        updated_at = now()
  RETURNING * INTO saved;
  RETURN QUERY
    SELECT saved.id, saved.provider, saved.label, saved.secret_name, saved.secret_hint, saved.enabled, saved.docs_url, saved.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_platform_api_key_enabled(p_id uuid, p_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_platform_apis() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  UPDATE public.platform_api_keys SET enabled = p_enabled, updated_at = now() WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_platform_api_key(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_platform_apis() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  DELETE FROM public.platform_api_keys WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_platform_api_keys() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_platform_api_key(text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_platform_api_key_enabled(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_platform_api_key(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_platform_api_keys() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_platform_api_key(text, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_platform_api_key_enabled(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_platform_api_key(uuid) TO authenticated, service_role;
