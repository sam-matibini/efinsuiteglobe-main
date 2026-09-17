-- Guarantors are optional for companies and regions that do not require them.
-- Missing guarantors must not block employee create or activation.

DROP TRIGGER IF EXISTS trg_enforce_guarantor_confirmation_before_active ON public.employees;

CREATE OR REPLACE FUNCTION public.enforce_guarantor_confirmation_before_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;
