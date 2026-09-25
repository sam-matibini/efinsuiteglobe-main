
-- Register module (enum value added in previous migration)
INSERT INTO public.modules (code, name, description, icon, is_core, display_order)
VALUES ('treasury'::module_type, 'Treasury Management', 'Pay tax authorities and process AP vendor payments via Stripe, Plaid and other rails', 'Landmark', false, 55)
ON CONFLICT (code) DO NOTHING;

-- ============ tax_payments ============
CREATE TABLE IF NOT EXISTS public.tax_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reference text NOT NULL,
  authority_id uuid REFERENCES public.tax_authorities(id) ON DELETE SET NULL,
  payment_type text NOT NULL CHECK (payment_type IN ('source_deductions','gst_hst','corporate_tax','provision','withholding','other')),
  period_start date,
  period_end date,
  amount numeric(15,2) NOT NULL,
  currency text NOT NULL DEFAULT 'CAD',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','submitted','paid','failed','reversed','cancelled')),
  scheduled_for date,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  payment_method text NOT NULL DEFAULT 'manual' CHECK (payment_method IN ('eft','pad','stripe','plaid_ach','manual','cra_my_payment','wire','cheque')),
  confirmation_number text,
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  remittance_id uuid REFERENCES public.remittances(id) ON DELETE SET NULL,
  tax_filing_period_id uuid REFERENCES public.tax_filing_periods(id) ON DELETE SET NULL,
  provider_transfer_id text,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  submitted_by uuid,
  submitted_at timestamptz,
  paid_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, reference)
);
CREATE INDEX IF NOT EXISTS idx_tax_payments_org ON public.tax_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_tax_payments_status ON public.tax_payments(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_tax_payments_remittance ON public.tax_payments(remittance_id);
CREATE INDEX IF NOT EXISTS idx_tax_payments_filing ON public.tax_payments(tax_filing_period_id);

ALTER TABLE public.tax_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view tax payments" ON public.tax_payments FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Org members insert tax payments" ON public.tax_payments FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Org members update tax payments" ON public.tax_payments FOR UPDATE TO authenticated USING (public.is_org_member(organization_id, auth.uid())) WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Org members delete tax payments" ON public.tax_payments FOR DELETE TO authenticated USING (public.is_org_member(organization_id, auth.uid()));

-- ============ ap_payment_batches ============
CREATE TABLE IF NOT EXISTS public.ap_payment_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  batch_number text NOT NULL,
  pay_date date NOT NULL DEFAULT CURRENT_DATE,
  funding_bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  total_amount numeric(15,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'CAD',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','processing','completed','partial','failed','cancelled')),
  provider text NOT NULL DEFAULT 'manual' CHECK (provider IN ('stripe','plaid','manual','wire','cheque')),
  provider_batch_id text,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  approved_by uuid,
  approved_at timestamptz,
  submitted_by uuid,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, batch_number)
);
CREATE INDEX IF NOT EXISTS idx_ap_batches_org ON public.ap_payment_batches(organization_id);
CREATE INDEX IF NOT EXISTS idx_ap_batches_status ON public.ap_payment_batches(organization_id, status);

ALTER TABLE public.ap_payment_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view ap batches" ON public.ap_payment_batches FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Org members insert ap batches" ON public.ap_payment_batches FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Org members update ap batches" ON public.ap_payment_batches FOR UPDATE TO authenticated USING (public.is_org_member(organization_id, auth.uid())) WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Org members delete ap batches" ON public.ap_payment_batches FOR DELETE TO authenticated USING (public.is_org_member(organization_id, auth.uid()));

-- ============ ap_payment_batch_items ============
CREATE TABLE IF NOT EXISTS public.ap_payment_batch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.ap_payment_batches(id) ON DELETE CASCADE,
  bill_id uuid REFERENCES public.bills(id) ON DELETE SET NULL,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  amount numeric(15,2) NOT NULL,
  currency text NOT NULL DEFAULT 'CAD',
  vendor_payment_id uuid,
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','cancelled','reversed')),
  provider_transfer_id text,
  failure_reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ap_batch_items_batch ON public.ap_payment_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_ap_batch_items_bill ON public.ap_payment_batch_items(bill_id);

ALTER TABLE public.ap_payment_batch_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view ap batch items" ON public.ap_payment_batch_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.ap_payment_batches b WHERE b.id = batch_id AND public.is_org_member(b.organization_id, auth.uid())));
CREATE POLICY "Org members insert ap batch items" ON public.ap_payment_batch_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.ap_payment_batches b WHERE b.id = batch_id AND public.is_org_member(b.organization_id, auth.uid())));
CREATE POLICY "Org members update ap batch items" ON public.ap_payment_batch_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.ap_payment_batches b WHERE b.id = batch_id AND public.is_org_member(b.organization_id, auth.uid())));
CREATE POLICY "Org members delete ap batch items" ON public.ap_payment_batch_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.ap_payment_batches b WHERE b.id = batch_id AND public.is_org_member(b.organization_id, auth.uid())));

-- ============ treasury_payment_audit ============
CREATE TABLE IF NOT EXISTS public.treasury_payment_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('tax_payment','ap_batch','ap_batch_item')),
  entity_id uuid NOT NULL,
  action text NOT NULL,
  actor_id uuid,
  ip_address text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_treasury_audit_org ON public.treasury_payment_audit(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_treasury_audit_entity ON public.treasury_payment_audit(entity_type, entity_id);

ALTER TABLE public.treasury_payment_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view treasury audit" ON public.treasury_payment_audit FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Org members insert treasury audit" ON public.treasury_payment_audit FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- Triggers
CREATE TRIGGER trg_tax_payments_updated_at BEFORE UPDATE ON public.tax_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ap_payment_batches_updated_at BEFORE UPDATE ON public.ap_payment_batches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ap_payment_batch_items_updated_at BEFORE UPDATE ON public.ap_payment_batch_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sequential numbering helpers
CREATE OR REPLACE FUNCTION public.next_tax_payment_reference(p_org uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_year text := to_char(now(),'YYYY'); v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.tax_payments WHERE organization_id = p_org AND reference LIKE 'TAX-'||v_year||'-%';
  RETURN 'TAX-'||v_year||'-'||lpad((v_count+1)::text,4,'0');
END; $$;

CREATE OR REPLACE FUNCTION public.next_ap_batch_number(p_org uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_year text := to_char(now(),'YYYY'); v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.ap_payment_batches WHERE organization_id = p_org AND batch_number LIKE 'APB-'||v_year||'-%';
  RETURN 'APB-'||v_year||'-'||lpad((v_count+1)::text,4,'0');
END; $$;

REVOKE EXECUTE ON FUNCTION public.next_tax_payment_reference(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.next_ap_batch_number(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.next_tax_payment_reference(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_ap_batch_number(uuid) TO authenticated;
