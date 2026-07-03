
ALTER TABLE public.tax_payments
  ADD COLUMN IF NOT EXISTS number_of_employees integer,
  ADD COLUMN IF NOT EXISTS gross_payroll numeric(14,2),
  ADD COLUMN IF NOT EXISTS income_tax numeric(14,2),
  ADD COLUMN IF NOT EXISTS cpp_employee numeric(14,2),
  ADD COLUMN IF NOT EXISTS cpp_employer numeric(14,2),
  ADD COLUMN IF NOT EXISTS ei_employee numeric(14,2),
  ADD COLUMN IF NOT EXISTS ei_employer numeric(14,2);

CREATE OR REPLACE FUNCTION public.validate_tax_payment_pd7a()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_sum numeric(14,2);
BEGIN
  IF NEW.income_tax IS NOT NULL OR NEW.cpp_employee IS NOT NULL OR NEW.cpp_employer IS NOT NULL
     OR NEW.ei_employee IS NOT NULL OR NEW.ei_employer IS NOT NULL THEN
    v_sum := COALESCE(NEW.income_tax,0) + COALESCE(NEW.cpp_employee,0) + COALESCE(NEW.cpp_employer,0)
           + COALESCE(NEW.ei_employee,0) + COALESCE(NEW.ei_employer,0);
    IF ABS(v_sum - NEW.amount) > 0.02 THEN
      RAISE EXCEPTION 'Payroll remittance breakdown (%) must equal total amount (%) within $0.02', v_sum, NEW.amount;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_tax_payment_pd7a ON public.tax_payments;
CREATE TRIGGER trg_validate_tax_payment_pd7a
  BEFORE INSERT OR UPDATE ON public.tax_payments
  FOR EACH ROW EXECUTE FUNCTION public.validate_tax_payment_pd7a();

CREATE TABLE IF NOT EXISTS public.tax_payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  tax_payment_id uuid NOT NULL REFERENCES public.tax_payments(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  recipient text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tax_payment_events_payment ON public.tax_payment_events(tax_payment_id);
CREATE INDEX IF NOT EXISTS idx_tax_payment_events_org ON public.tax_payment_events(organization_id);
ALTER TABLE public.tax_payment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view tax payment events" ON public.tax_payment_events
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Org members insert tax payment events" ON public.tax_payment_events
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id, auth.uid()));

DO $$ BEGIN
  CREATE TYPE public.payment_approval_role AS ENUM ('preparer','reviewer','approver');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.payment_approval_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role public.payment_approval_role NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, role)
);
CREATE INDEX IF NOT EXISTS idx_par_org_user ON public.payment_approval_roles(organization_id, user_id);
ALTER TABLE public.payment_approval_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view approval roles" ON public.payment_approval_roles
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Org admins insert approval roles" ON public.payment_approval_roles
  FOR INSERT TO authenticated WITH CHECK (public.is_org_admin_or_owner(organization_id, auth.uid()));
CREATE POLICY "Org admins update approval roles" ON public.payment_approval_roles
  FOR UPDATE TO authenticated
    USING (public.is_org_admin_or_owner(organization_id, auth.uid()))
    WITH CHECK (public.is_org_admin_or_owner(organization_id, auth.uid()));
CREATE POLICY "Org admins delete approval roles" ON public.payment_approval_roles
  FOR DELETE TO authenticated USING (public.is_org_admin_or_owner(organization_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.has_payment_approval_role(_org uuid, _user uuid, _role public.payment_approval_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.payment_approval_roles
    WHERE organization_id = _org AND user_id = _user AND role = _role
  ) OR public.is_org_admin_or_owner(_org, _user);
$$;
GRANT EXECUTE ON FUNCTION public.has_payment_approval_role(uuid, uuid, public.payment_approval_role) TO authenticated;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS approval_threshold_amount numeric(14,2) NOT NULL DEFAULT 5000;

CREATE OR REPLACE FUNCTION public.record_payment_decision(
  p_entity_type text, p_entity_id uuid, p_step text, p_decision text, p_comment text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_org uuid; v_originator uuid; v_state text; v_table text; v_new_state text;
  v_amount numeric(14,2); v_threshold numeric(14,2);
  v_required_role public.payment_approval_role;
  v_amount_col text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_entity_type NOT IN ('tax_payment','ap_batch','payroll_batch') THEN RAISE EXCEPTION 'Invalid entity_type'; END IF;
  IF p_step NOT IN ('review','approve') THEN RAISE EXCEPTION 'Invalid step'; END IF;
  IF p_decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Invalid decision'; END IF;

  v_table := CASE p_entity_type
    WHEN 'tax_payment' THEN 'tax_payments'
    WHEN 'ap_batch' THEN 'ap_payment_batches'
    WHEN 'payroll_batch' THEN 'payroll_payment_batches' END;
  v_amount_col := CASE p_entity_type WHEN 'tax_payment' THEN 'amount' ELSE 'total_amount' END;

  EXECUTE format('SELECT organization_id, originator_id, approval_state, COALESCE(%I,0) FROM public.%I WHERE id = $1', v_amount_col, v_table)
    INTO v_org, v_originator, v_state, v_amount USING p_entity_id;

  IF v_org IS NULL THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF NOT public.is_org_member(v_org, v_user) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_originator IS NOT NULL AND v_originator = v_user THEN RAISE EXCEPTION 'Originator cannot self-approve'; END IF;

  v_required_role := CASE p_step WHEN 'review' THEN 'reviewer'::public.payment_approval_role ELSE 'approver'::public.payment_approval_role END;
  IF NOT public.has_payment_approval_role(v_org, v_user, v_required_role) THEN
    RAISE EXCEPTION 'You do not hold the % role', v_required_role;
  END IF;

  SELECT approval_threshold_amount INTO v_threshold FROM public.organizations WHERE id = v_org;

  IF p_decision = 'rejected' THEN
    v_new_state := 'rejected';
  ELSIF p_step = 'review' THEN
    v_new_state := CASE WHEN COALESCE(v_amount,0) < COALESCE(v_threshold,0) THEN 'approved' ELSE 'pending_approval' END;
  ELSE
    v_new_state := 'approved';
  END IF;

  INSERT INTO public.payment_approvals(organization_id, entity_type, entity_id, step, decided_by, decision, comment, decided_at)
    VALUES (v_org, p_entity_type, p_entity_id, p_step, v_user, p_decision, p_comment, now());

  IF p_step = 'review' THEN
    EXECUTE format('UPDATE public.%I SET approval_state = $1, reviewed_by = $2, reviewed_at = now(), updated_at = now() WHERE id = $3', v_table)
      USING v_new_state, v_user, p_entity_id;
  ELSE
    EXECUTE format('UPDATE public.%I SET approval_state = $1, approved_by = $2, approved_at = now(), updated_at = now() WHERE id = $3', v_table)
      USING v_new_state, v_user, p_entity_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'approval_state', v_new_state);
END $$;
GRANT EXECUTE ON FUNCTION public.record_payment_decision(text, uuid, text, text, text) TO authenticated;

INSERT INTO storage.buckets (id, name, public) VALUES ('tax-payment-receipts','tax-payment-receipts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Org members read tax receipts" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'tax-payment-receipts'
    AND public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );
CREATE POLICY "Org members upload tax receipts" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'tax-payment-receipts'
    AND public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );
CREATE POLICY "Service role manage tax receipts" ON storage.objects
  FOR ALL TO service_role USING (bucket_id = 'tax-payment-receipts') WITH CHECK (bucket_id = 'tax-payment-receipts');
