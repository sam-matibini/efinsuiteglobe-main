
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS preferred_name text,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS national_id_encrypted text,
  ADD COLUMN IF NOT EXISTS tax_id_encrypted text,
  ADD COLUMN IF NOT EXISTS cost_centre text,
  ADD COLUMN IF NOT EXISTS work_schedule text,
  ADD COLUMN IF NOT EXISTS payroll_start_date date,
  ADD COLUMN IF NOT EXISTS statutory_profile jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.employee_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  import_mode text NOT NULL DEFAULT 'create' CHECK (import_mode IN ('create','update','upsert')),
  country_code text,
  file_name text,
  file_hash text,
  file_size_bytes integer,
  template_version text NOT NULL DEFAULT 'v1',
  total_rows integer NOT NULL DEFAULT 0,
  created_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','validating','validated','posting','posted','failed','reversed')),
  replace_blanks boolean NOT NULL DEFAULT false,
  validation_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_report jsonb,
  posted_at timestamptz,
  posted_by uuid,
  reversed_at timestamptz,
  reversed_by uuid,
  reversal_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_import_batches TO authenticated;
GRANT ALL ON public.employee_import_batches TO service_role;
ALTER TABLE public.employee_import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage import batches"
  ON public.employee_import_batches FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = employee_import_batches.organization_id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = employee_import_batches.organization_id AND m.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.employee_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.employee_import_batches(id) ON DELETE CASCADE,
  sheet text NOT NULL CHECK (sheet IN ('employees','compensation','deductions','payment')),
  row_number integer NOT NULL,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_data jsonb,
  employee_number text,
  resolved_employee_id uuid,
  match_type text CHECK (match_type IN ('new','update_by_id','duplicate_suspect','not_found')),
  is_valid boolean NOT NULL DEFAULT false,
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  validation_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  posted boolean NOT NULL DEFAULT false,
  posted_entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employee_import_rows_batch_idx ON public.employee_import_rows(batch_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_import_rows TO authenticated;
GRANT ALL ON public.employee_import_rows TO service_role;
ALTER TABLE public.employee_import_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage import rows"
  ON public.employee_import_rows FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.employee_import_batches b JOIN public.organization_members m ON m.organization_id = b.organization_id WHERE b.id = employee_import_rows.batch_id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.employee_import_batches b JOIN public.organization_members m ON m.organization_id = b.organization_id WHERE b.id = employee_import_rows.batch_id AND m.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.employee_import_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.employee_import_batches(id) ON DELETE CASCADE,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  performed_by uuid,
  performed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employee_import_audit_batch_idx ON public.employee_import_audit(batch_id);
GRANT SELECT, INSERT ON public.employee_import_audit TO authenticated;
GRANT ALL ON public.employee_import_audit TO service_role;
ALTER TABLE public.employee_import_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read import audit"
  ON public.employee_import_audit FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.employee_import_batches b JOIN public.organization_members m ON m.organization_id = b.organization_id WHERE b.id = employee_import_audit.batch_id AND m.user_id = auth.uid()));
CREATE POLICY "org members insert import audit"
  ON public.employee_import_audit FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.employee_import_batches b JOIN public.organization_members m ON m.organization_id = b.organization_id WHERE b.id = employee_import_audit.batch_id AND m.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.employee_compensation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  compensation_type text NOT NULL,
  amount numeric(18,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'CAD',
  frequency text NOT NULL DEFAULT 'monthly',
  taxable boolean NOT NULL DEFAULT true,
  effective_date date NOT NULL DEFAULT current_date,
  end_date date,
  source_batch_id uuid REFERENCES public.employee_import_batches(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employee_compensation_emp_idx ON public.employee_compensation(employee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_compensation TO authenticated;
GRANT ALL ON public.employee_compensation TO service_role;
ALTER TABLE public.employee_compensation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage compensation"
  ON public.employee_compensation FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = employee_compensation.organization_id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = employee_compensation.organization_id AND m.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.employee_deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  deduction_type text NOT NULL,
  category text NOT NULL DEFAULT 'voluntary' CHECK (category IN ('statutory','voluntary')),
  amount numeric(18,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'CAD',
  frequency text NOT NULL DEFAULT 'monthly',
  start_date date NOT NULL DEFAULT current_date,
  end_date date,
  source_batch_id uuid REFERENCES public.employee_import_batches(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employee_deductions_emp_idx ON public.employee_deductions(employee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_deductions TO authenticated;
GRANT ALL ON public.employee_deductions TO service_role;
ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage deductions"
  ON public.employee_deductions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = employee_deductions.organization_id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = employee_deductions.organization_id AND m.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.employee_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  method text NOT NULL DEFAULT 'bank_transfer',
  bank_name text,
  account_name text,
  account_number_encrypted text,
  account_number_last4 text,
  routing_number text,
  transit_number text,
  institution_number text,
  iban text,
  swift text,
  currency text NOT NULL DEFAULT 'CAD',
  is_primary boolean NOT NULL DEFAULT true,
  source_batch_id uuid REFERENCES public.employee_import_batches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employee_payment_methods_emp_idx ON public.employee_payment_methods(employee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_payment_methods TO authenticated;
GRANT ALL ON public.employee_payment_methods TO service_role;
ALTER TABLE public.employee_payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage payment methods"
  ON public.employee_payment_methods FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = employee_payment_methods.organization_id AND m.user_id = auth.uid())
    AND public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = employee_payment_methods.organization_id AND m.user_id = auth.uid())
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE OR REPLACE VIEW public.v_employee_payment_methods_masked AS
SELECT id, organization_id, employee_id, method, bank_name, account_name,
       CASE WHEN account_number_last4 IS NOT NULL THEN '******' || account_number_last4 ELSE NULL END AS account_number_masked,
       account_number_last4, routing_number, transit_number, institution_number,
       CASE WHEN iban IS NOT NULL THEN '****' || right(iban, 4) ELSE NULL END AS iban_masked,
       swift, currency, is_primary, created_at, updated_at
FROM public.employee_payment_methods;
GRANT SELECT ON public.v_employee_payment_methods_masked TO authenticated;

CREATE TRIGGER trg_eib_updated BEFORE UPDATE ON public.employee_import_batches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_eir_updated BEFORE UPDATE ON public.employee_import_rows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ec_updated  BEFORE UPDATE ON public.employee_compensation FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ed_updated  BEFORE UPDATE ON public.employee_deductions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_epm_updated BEFORE UPDATE ON public.employee_payment_methods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.rollback_employee_import(_batch_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.employee_import_batches WHERE id = _batch_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Batch not found'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = v_org AND m.user_id = auth.uid()
  ) OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.employee_compensation WHERE source_batch_id = _batch_id;
  DELETE FROM public.employee_deductions   WHERE source_batch_id = _batch_id;
  DELETE FROM public.employee_payment_methods WHERE source_batch_id = _batch_id;

  UPDATE public.employees e
     SET deleted_at = now()
    FROM public.employee_import_rows r
   WHERE r.batch_id = _batch_id
     AND r.sheet = 'employees'
     AND r.match_type = 'new'
     AND r.posted_entity_id = e.id;

  UPDATE public.employee_import_batches
     SET status = 'reversed',
         reversed_at = now(),
         reversed_by = auth.uid(),
         reversal_reason = _reason
   WHERE id = _batch_id;

  INSERT INTO public.employee_import_audit(batch_id, action, details, performed_by)
  VALUES (_batch_id, 'rollback', jsonb_build_object('reason', _reason), auth.uid());
END $$;

GRANT EXECUTE ON FUNCTION public.rollback_employee_import(uuid, text) TO authenticated;
