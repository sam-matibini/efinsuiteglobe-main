
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS nin text,
  ADD COLUMN IF NOT EXISTS nin_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS nin_verified_by uuid;

CREATE OR REPLACE FUNCTION public.enforce_nigeria_nin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_country text;
BEGIN
  SELECT COALESCE(c.iso2, o.country)
    INTO v_country
  FROM public.organizations o
  LEFT JOIN public.countries c ON c.id = o.country_id
  WHERE o.id = NEW.organization_id;

  IF UPPER(COALESCE(v_country, '')) IN ('NG', 'NIGERIA') THEN
    IF NEW.nin IS NULL OR NEW.nin !~ '^\d{11}$' THEN
      RAISE EXCEPTION 'National Identification Number (NIN) is required for Nigerian employees and must be exactly 11 digits'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_nigeria_nin ON public.employees;
CREATE TRIGGER trg_enforce_nigeria_nin
  BEFORE INSERT OR UPDATE OF nin, organization_id ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_nigeria_nin();
