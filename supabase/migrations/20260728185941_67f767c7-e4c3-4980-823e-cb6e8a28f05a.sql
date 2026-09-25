
ALTER TABLE public.employee_guarantors
  ADD COLUMN IF NOT EXISTS confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS confirmation_method text;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS guarantors_confirmed boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.recompute_guarantors_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id uuid;
  v_confirmed_count int;
BEGIN
  v_employee_id := COALESCE(NEW.employee_id, OLD.employee_id);
  IF v_employee_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COUNT(*) INTO v_confirmed_count
  FROM public.employee_guarantors
  WHERE employee_id = v_employee_id AND confirmed = true;

  UPDATE public.employees
     SET guarantors_confirmed = (v_confirmed_count >= 2)
   WHERE id = v_employee_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_guarantors_confirmed ON public.employee_guarantors;
CREATE TRIGGER trg_recompute_guarantors_confirmed
AFTER INSERT OR UPDATE OR DELETE ON public.employee_guarantors
FOR EACH ROW EXECUTE FUNCTION public.recompute_guarantors_confirmed();

CREATE OR REPLACE FUNCTION public.enforce_guarantor_confirmation_before_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active'
     AND COALESCE(OLD.status, 'onboarding') <> 'active'
     AND COALESCE(NEW.guarantors_confirmed, false) = false THEN
    RAISE EXCEPTION 'Employee cannot be activated until both guarantors are on file and confirmed.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_guarantor_confirmation_before_active ON public.employees;
CREATE TRIGGER trg_enforce_guarantor_confirmation_before_active
BEFORE UPDATE OF status ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.enforce_guarantor_confirmation_before_active();
