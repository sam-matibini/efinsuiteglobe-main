-- Phase 12: Real-time address-based tax (Avalara / TaxJar)

-- 1) Provider settings
CREATE TABLE public.tax_provider_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('avalara','taxjar','none')) DEFAULT 'none',
  environment TEXT NOT NULL CHECK (environment IN ('sandbox','production')) DEFAULT 'sandbox',
  company_code TEXT,
  default_origin_address JSONB,
  auto_calculate_on_invoice BOOLEAN NOT NULL DEFAULT false,
  auto_validate_addresses BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);
ALTER TABLE public.tax_provider_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage provider settings" ON public.tax_provider_settings
  FOR ALL USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- 2) Nexus registrations
CREATE TABLE public.tax_nexus_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL DEFAULT 'US',
  region_code TEXT NOT NULL,
  registration_number TEXT,
  effective_date DATE NOT NULL,
  expiry_date DATE,
  filing_frequency TEXT CHECK (filing_frequency IN ('monthly','quarterly','annually')),
  economic_nexus_threshold_amount NUMERIC(14,2),
  economic_nexus_threshold_transactions INT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, country_code, region_code)
);
ALTER TABLE public.tax_nexus_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage nexus" ON public.tax_nexus_registrations
  FOR ALL USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE INDEX idx_nexus_org_region ON public.tax_nexus_registrations(organization_id, region_code);

-- 3) Economic nexus tracker (rolling totals)
CREATE TABLE public.tax_economic_nexus_tracker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL DEFAULT 'US',
  region_code TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  sales_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  transaction_count INT NOT NULL DEFAULT 0,
  threshold_amount NUMERIC(14,2),
  threshold_transactions INT,
  threshold_crossed BOOLEAN NOT NULL DEFAULT false,
  threshold_crossed_at TIMESTAMPTZ,
  last_recalculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, country_code, region_code, period_end)
);
ALTER TABLE public.tax_economic_nexus_tracker ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read nexus tracker" ON public.tax_economic_nexus_tracker
  FOR SELECT USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "org members write nexus tracker" ON public.tax_economic_nexus_tracker
  FOR ALL USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- 4) Address tax cache
CREATE TABLE public.tax_address_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cache_key TEXT NOT NULL,
  provider TEXT NOT NULL,
  request_payload JSONB NOT NULL,
  response_payload JSONB NOT NULL,
  total_rate NUMERIC(8,5),
  total_tax_cents INT,
  jurisdictions JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, cache_key)
);
ALTER TABLE public.tax_address_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read tax cache" ON public.tax_address_cache
  FOR SELECT USING (public.is_org_member(organization_id, auth.uid()));
-- Writes performed by service role from edge function
CREATE INDEX idx_tax_cache_lookup ON public.tax_address_cache(organization_id, cache_key, expires_at);

-- 5) Exemption certificates
CREATE TABLE public.tax_exemption_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id UUID,
  certificate_number TEXT NOT NULL,
  exemption_reason TEXT NOT NULL,
  exemption_type TEXT CHECK (exemption_type IN ('resale','government','nonprofit','agricultural','manufacturing','other')),
  region_code TEXT,
  country_code TEXT DEFAULT 'US',
  issued_date DATE,
  expiry_date DATE,
  document_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tax_exemption_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage exemptions" ON public.tax_exemption_certificates
  FOR ALL USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE INDEX idx_exemptions_customer ON public.tax_exemption_certificates(organization_id, customer_id);

-- updated_at triggers
CREATE TRIGGER trg_tax_provider_settings_updated_at
  BEFORE UPDATE ON public.tax_provider_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tax_nexus_updated_at
  BEFORE UPDATE ON public.tax_nexus_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tax_exemptions_updated_at
  BEFORE UPDATE ON public.tax_exemption_certificates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();