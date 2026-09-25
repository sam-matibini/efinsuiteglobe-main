
-- 1. CRA program accounts
CREATE TABLE IF NOT EXISTS public.cra_program_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  account_name text NOT NULL,
  business_number text NOT NULL,
  program_code text NOT NULL,
  reference_number text NOT NULL,
  full_account_number text GENERATED ALWAYS AS (business_number || program_code || reference_number) STORED,
  tax_type text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  is_default boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, business_number, program_code, reference_number)
);

CREATE OR REPLACE FUNCTION public.validate_cra_program_account()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.business_number !~ '^[0-9]{9}$' THEN
    RAISE EXCEPTION 'Business number must be exactly 9 digits';
  END IF;
  IF NEW.program_code NOT IN ('RT','RP','RC') THEN
    RAISE EXCEPTION 'Program code must be RT, RP, or RC';
  END IF;
  IF NEW.reference_number !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'Reference number must be exactly 4 digits';
  END IF;
  IF NEW.tax_type NOT IN ('gst_hst','payroll','corporate_tax') THEN
    RAISE EXCEPTION 'tax_type must be gst_hst, payroll, or corporate_tax';
  END IF;
  IF (NEW.tax_type = 'gst_hst' AND NEW.program_code <> 'RT')
     OR (NEW.tax_type = 'payroll' AND NEW.program_code <> 'RP')
     OR (NEW.tax_type = 'corporate_tax' AND NEW.program_code <> 'RC') THEN
    RAISE EXCEPTION 'Program code % does not match tax_type %', NEW.program_code, NEW.tax_type;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_validate_cra_program_account
BEFORE INSERT OR UPDATE ON public.cra_program_accounts
FOR EACH ROW EXECUTE FUNCTION public.validate_cra_program_account();

ALTER TABLE public.cra_program_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage CRA accounts" ON public.cra_program_accounts
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- 2. Vendor banking profiles
CREATE TABLE IF NOT EXISTS public.vendor_banking_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  vendor_id uuid NOT NULL,
  transit_number text,
  institution_number text,
  account_number text,
  payment_method text NOT NULL DEFAULT 'eft',
  currency text NOT NULL DEFAULT 'CAD',
  remittance_email text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendor_banking_org_vendor ON public.vendor_banking_profiles(organization_id, vendor_id);
ALTER TABLE public.vendor_banking_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage vendor banking" ON public.vendor_banking_profiles
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- 3. Employee banking profiles
CREATE TABLE IF NOT EXISTS public.employee_banking_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  institution_number text,
  transit_number text,
  account_number text,
  deposit_type text NOT NULL DEFAULT 'chequing',
  allocation_percent numeric NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employee_banking_org_emp ON public.employee_banking_profiles(organization_id, employee_id);
ALTER TABLE public.employee_banking_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage employee banking" ON public.employee_banking_profiles
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- 4. Scheduled payments
CREATE TABLE IF NOT EXISTS public.scheduled_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  payment_kind text NOT NULL,
  description text,
  cra_account_id uuid REFERENCES public.cra_program_accounts(id) ON DELETE SET NULL,
  source_ref uuid,
  funding_bank_account_id uuid,
  amount numeric,
  currency text NOT NULL DEFAULT 'CAD',
  frequency text NOT NULL DEFAULT 'monthly',
  next_run_date date NOT NULL,
  end_date date,
  auto_submit boolean NOT NULL DEFAULT false,
  requires_approval boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_status text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (payment_kind IN ('cra','ap_batch','payroll')),
  CHECK (frequency IN ('once','weekly','biweekly','monthly','quarterly','annual'))
);
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_next ON public.scheduled_payments(organization_id, next_run_date) WHERE is_active;
ALTER TABLE public.scheduled_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage scheduled payments" ON public.scheduled_payments
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- 5. CRA payment audit log (immutable)
CREATE TABLE IF NOT EXISTS public.cra_payment_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  actor_id uuid,
  ip_address text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cra_audit_org_created ON public.cra_payment_audit_logs(organization_id, created_at DESC);
ALTER TABLE public.cra_payment_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members read CRA audit logs" ON public.cra_payment_audit_logs
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Service inserts CRA audit logs" ON public.cra_payment_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'cra_payment_audit_logs is append-only';
END $$;
CREATE TRIGGER trg_prevent_audit_update BEFORE UPDATE ON public.cra_payment_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER trg_prevent_audit_delete BEFORE DELETE ON public.cra_payment_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

-- 6. Extend tax_payments
ALTER TABLE public.tax_payments
  ADD COLUMN IF NOT EXISTS cra_account_id uuid REFERENCES public.cra_program_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmation_pdf_url text,
  ADD COLUMN IF NOT EXISTS initiated_by uuid,
  ADD COLUMN IF NOT EXISTS approved_by uuid;
