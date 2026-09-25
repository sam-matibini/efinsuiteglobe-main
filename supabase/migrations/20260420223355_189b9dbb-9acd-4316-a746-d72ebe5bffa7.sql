-- ============ tax_authorities ============
CREATE TABLE IF NOT EXISTS public.tax_authorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  country_id uuid REFERENCES public.countries(id),
  region text,
  filing_frequency text NOT NULL DEFAULT 'quarterly' CHECK (filing_frequency IN ('monthly','quarterly','annually','semi_annually')),
  reporting_currency text NOT NULL DEFAULT 'CAD',
  registration_number text,
  next_due_date date,
  efile_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tax_authorities_org ON public.tax_authorities(organization_id);
ALTER TABLE public.tax_authorities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view tax authorities" ON public.tax_authorities FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members insert tax authorities" ON public.tax_authorities FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members update tax authorities" ON public.tax_authorities FOR UPDATE USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members delete tax authorities" ON public.tax_authorities FOR DELETE USING (public.is_org_member(auth.uid(), organization_id));

-- ============ tax_filing_periods ============
CREATE TABLE IF NOT EXISTS public.tax_filing_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tax_authority_id uuid NOT NULL REFERENCES public.tax_authorities(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','filed','locked','paid')),
  tax_return_id uuid REFERENCES public.tax_returns(id) ON DELETE SET NULL,
  filed_at timestamptz,
  filed_by uuid,
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tax_authority_id, period_start, period_end)
);
CREATE INDEX IF NOT EXISTS idx_tax_filing_periods_org ON public.tax_filing_periods(organization_id);
CREATE INDEX IF NOT EXISTS idx_tax_filing_periods_authority ON public.tax_filing_periods(tax_authority_id);
CREATE INDEX IF NOT EXISTS idx_tax_filing_periods_status ON public.tax_filing_periods(status);
ALTER TABLE public.tax_filing_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view filing periods" ON public.tax_filing_periods FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members insert filing periods" ON public.tax_filing_periods FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members update filing periods" ON public.tax_filing_periods FOR UPDATE USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members delete filing periods" ON public.tax_filing_periods FOR DELETE USING (public.is_org_member(auth.uid(), organization_id));

-- ============ tax_period_locks ============
CREATE TABLE IF NOT EXISTS public.tax_period_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tax_authority_id uuid REFERENCES public.tax_authorities(id) ON DELETE CASCADE,
  filing_period_id uuid REFERENCES public.tax_filing_periods(id) ON DELETE CASCADE,
  lock_start date NOT NULL,
  lock_end date NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT now(),
  locked_by uuid,
  override_reason text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tax_period_locks_org ON public.tax_period_locks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tax_period_locks_dates ON public.tax_period_locks(lock_start, lock_end);
ALTER TABLE public.tax_period_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view period locks" ON public.tax_period_locks FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members insert period locks" ON public.tax_period_locks FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members update period locks" ON public.tax_period_locks FOR UPDATE USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members delete period locks" ON public.tax_period_locks FOR DELETE USING (public.is_org_member(auth.uid(), organization_id));

-- ============ tax_audit_log ============
CREATE TABLE IF NOT EXISTS public.tax_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  before_value jsonb,
  after_value jsonb,
  reason text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tax_audit_org ON public.tax_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_tax_audit_entity ON public.tax_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_tax_audit_created ON public.tax_audit_log(created_at DESC);
ALTER TABLE public.tax_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view tax audit" ON public.tax_audit_log FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members insert tax audit" ON public.tax_audit_log FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- ============ tax_codes extensions ============
ALTER TABLE public.tax_codes
  ADD COLUMN IF NOT EXISTS effective_date date,
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS tax_authority_id uuid REFERENCES public.tax_authorities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_zero_rated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_exempt boolean NOT NULL DEFAULT false;

-- ============ customers / vendors extensions ============
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS default_tax_code_id uuid REFERENCES public.tax_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tax_exempt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_exempt_certificate_no text;

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS default_tax_code_id uuid REFERENCES public.tax_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tax_exempt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_exempt_certificate_no text;

-- ============ inventory_items extensions ============
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS default_tax_code_id uuid REFERENCES public.tax_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tax_category text DEFAULT 'standard' CHECK (tax_category IN ('standard','zero_rated','exempt','reduced'));

-- ============ updated_at triggers ============
DROP TRIGGER IF EXISTS update_tax_authorities_updated_at ON public.tax_authorities;
CREATE TRIGGER update_tax_authorities_updated_at BEFORE UPDATE ON public.tax_authorities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_tax_filing_periods_updated_at ON public.tax_filing_periods;
CREATE TRIGGER update_tax_filing_periods_updated_at BEFORE UPDATE ON public.tax_filing_periods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();