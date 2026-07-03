
CREATE TABLE public.wht_regimes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  authority TEXT NOT NULL,
  slip_type TEXT NOT NULL,
  default_rate NUMERIC(7,4) NOT NULL DEFAULT 0,
  threshold_cents BIGINT NOT NULL DEFAULT 0,
  box_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

CREATE TABLE public.wht_vendor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  vendor_id UUID NOT NULL,
  regime_id UUID REFERENCES public.wht_regimes(id) ON DELETE SET NULL,
  tin_type TEXT,
  tin_value_encrypted TEXT,
  tin_last4 TEXT,
  legal_name TEXT,
  tax_form_type TEXT,
  tax_form_received_date DATE,
  tax_form_expiry_date DATE,
  treaty_country TEXT,
  treaty_rate NUMERIC(7,4),
  is_exempt BOOLEAN NOT NULL DEFAULT false,
  exempt_reason TEXT,
  ytd_paid_cents BIGINT NOT NULL DEFAULT 0,
  ytd_withheld_cents BIGINT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, vendor_id)
);

CREATE TABLE public.wht_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  vendor_id UUID NOT NULL,
  regime_id UUID REFERENCES public.wht_regimes(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL,
  source_id UUID,
  transaction_date DATE NOT NULL,
  tax_year INTEGER NOT NULL,
  gross_amount_cents BIGINT NOT NULL,
  withheld_amount_cents BIGINT NOT NULL,
  net_amount_cents BIGINT NOT NULL,
  applied_rate NUMERIC(7,4) NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'USD',
  journal_entry_id UUID,
  status TEXT NOT NULL DEFAULT 'recorded',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wht_tx_org_year ON public.wht_transactions(organization_id, tax_year);
CREATE INDEX idx_wht_tx_vendor ON public.wht_transactions(vendor_id, tax_year);

CREATE TABLE public.wht_slips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  vendor_id UUID NOT NULL,
  regime_id UUID REFERENCES public.wht_regimes(id) ON DELETE SET NULL,
  tax_year INTEGER NOT NULL,
  slip_type TEXT NOT NULL,
  slip_number TEXT,
  box_amounts JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_paid_cents BIGINT NOT NULL DEFAULT 0,
  total_withheld_cents BIGINT NOT NULL DEFAULT 0,
  recipient_tin_last4 TEXT,
  recipient_name TEXT,
  recipient_address JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  issued_date DATE,
  filed_date DATE,
  filing_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, vendor_id, tax_year, slip_type)
);

CREATE TABLE public.wht_remittances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  regime_id UUID REFERENCES public.wht_regimes(id) ON DELETE SET NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  due_date DATE NOT NULL,
  total_withheld_cents BIGINT NOT NULL DEFAULT 0,
  remitted_amount_cents BIGINT NOT NULL DEFAULT 0,
  remittance_date DATE,
  reference_number TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  journal_entry_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wht_regimes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wht_vendor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wht_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wht_slips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wht_remittances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wht_regimes_org_select" ON public.wht_regimes FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "wht_regimes_org_write" ON public.wht_regimes FOR ALL USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "wht_vp_org_select" ON public.wht_vendor_profiles FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "wht_vp_org_write" ON public.wht_vendor_profiles FOR ALL USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "wht_tx_org_select" ON public.wht_transactions FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "wht_tx_org_write" ON public.wht_transactions FOR ALL USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "wht_slips_org_select" ON public.wht_slips FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "wht_slips_org_write" ON public.wht_slips FOR ALL USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "wht_rem_org_select" ON public.wht_remittances FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "wht_rem_org_write" ON public.wht_remittances FOR ALL USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE TRIGGER trg_wht_regimes_updated BEFORE UPDATE ON public.wht_regimes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_wht_vp_updated BEFORE UPDATE ON public.wht_vendor_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_wht_tx_updated BEFORE UPDATE ON public.wht_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_wht_slips_updated BEFORE UPDATE ON public.wht_slips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_wht_rem_updated BEFORE UPDATE ON public.wht_remittances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
