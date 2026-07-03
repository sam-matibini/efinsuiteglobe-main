-- Phase 13: EU VAT OSS / MOSS + Reverse Charge

-- 1) EU VAT OSS registration
CREATE TABLE public.eu_vat_oss_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  scheme TEXT NOT NULL CHECK (scheme IN ('union', 'non_union', 'import_ioss')),
  member_state_of_identification TEXT NOT NULL, -- ISO-2 e.g. 'IE'
  oss_registration_number TEXT NOT NULL,
  ioss_intermediary_number TEXT,
  effective_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, scheme, member_state_of_identification)
);

ALTER TABLE public.eu_vat_oss_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage OSS registrations"
ON public.eu_vat_oss_registrations FOR ALL
TO authenticated
USING (public.is_org_member(organization_id, auth.uid()))
WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX idx_eu_oss_reg_org ON public.eu_vat_oss_registrations(organization_id);

-- 2) EU VAT rates (reference data, shared)
CREATE TABLE public.eu_vat_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,                       -- ISO-2
  country_name TEXT NOT NULL,
  standard_rate NUMERIC(5,2) NOT NULL,
  reduced_rate_1 NUMERIC(5,2),
  reduced_rate_2 NUMERIC(5,2),
  super_reduced_rate NUMERIC(5,2),
  parking_rate NUMERIC(5,2),
  effective_from DATE NOT NULL,
  effective_to DATE,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_code, effective_from)
);

ALTER TABLE public.eu_vat_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "EU VAT rates readable by authenticated"
ON public.eu_vat_rates FOR SELECT
TO authenticated
USING (true);

CREATE INDEX idx_eu_vat_rates_country ON public.eu_vat_rates(country_code, effective_from DESC);

-- Seed current EU 27 standard rates (effective 2024-01-01 - simplified; reduced rates omitted for brevity)
INSERT INTO public.eu_vat_rates (country_code, country_name, standard_rate, effective_from) VALUES
('AT','Austria',20.00,'2024-01-01'),
('BE','Belgium',21.00,'2024-01-01'),
('BG','Bulgaria',20.00,'2024-01-01'),
('HR','Croatia',25.00,'2024-01-01'),
('CY','Cyprus',19.00,'2024-01-01'),
('CZ','Czechia',21.00,'2024-01-01'),
('DK','Denmark',25.00,'2024-01-01'),
('EE','Estonia',22.00,'2024-01-01'),
('FI','Finland',25.50,'2024-09-01'),
('FR','France',20.00,'2024-01-01'),
('DE','Germany',19.00,'2024-01-01'),
('GR','Greece',24.00,'2024-01-01'),
('HU','Hungary',27.00,'2024-01-01'),
('IE','Ireland',23.00,'2024-01-01'),
('IT','Italy',22.00,'2024-01-01'),
('LV','Latvia',21.00,'2024-01-01'),
('LT','Lithuania',21.00,'2024-01-01'),
('LU','Luxembourg',17.00,'2024-01-01'),
('MT','Malta',18.00,'2024-01-01'),
('NL','Netherlands',21.00,'2024-01-01'),
('PL','Poland',23.00,'2024-01-01'),
('PT','Portugal',23.00,'2024-01-01'),
('RO','Romania',19.00,'2024-01-01'),
('SK','Slovakia',23.00,'2025-01-01'),
('SI','Slovenia',22.00,'2024-01-01'),
('ES','Spain',21.00,'2024-01-01'),
('SE','Sweden',25.00,'2024-01-01');

-- 3) OSS quarterly returns
CREATE TABLE public.eu_oss_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  registration_id UUID NOT NULL REFERENCES public.eu_vat_oss_registrations(id) ON DELETE RESTRICT,
  scheme TEXT NOT NULL CHECK (scheme IN ('union', 'non_union', 'import_ioss')),
  period_year INT NOT NULL,
  period_quarter INT NOT NULL CHECK (period_quarter BETWEEN 1 AND 4),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','generated','submitted','accepted','rejected')),
  total_taxable_base_cents BIGINT NOT NULL DEFAULT 0,
  total_vat_cents BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  xml_payload TEXT,
  submitted_at TIMESTAMPTZ,
  confirmation_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, scheme, period_year, period_quarter)
);

ALTER TABLE public.eu_oss_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage OSS returns"
ON public.eu_oss_returns FOR ALL
TO authenticated
USING (public.is_org_member(organization_id, auth.uid()))
WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX idx_eu_oss_returns_org_period ON public.eu_oss_returns(organization_id, period_year DESC, period_quarter DESC);

-- 4) OSS return lines
CREATE TABLE public.eu_oss_return_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.eu_oss_returns(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  member_state_of_consumption TEXT NOT NULL,        -- ISO-2
  supply_type TEXT NOT NULL CHECK (supply_type IN ('services','goods')),
  vat_rate_type TEXT NOT NULL CHECK (vat_rate_type IN ('standard','reduced')),
  vat_rate NUMERIC(5,2) NOT NULL,
  taxable_base_cents BIGINT NOT NULL,
  vat_amount_cents BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.eu_oss_return_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage OSS return lines"
ON public.eu_oss_return_lines FOR ALL
TO authenticated
USING (public.is_org_member(organization_id, auth.uid()))
WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX idx_eu_oss_return_lines_return ON public.eu_oss_return_lines(return_id);

-- 5) EU VAT number validations (VIES cache)
CREATE TABLE public.eu_vat_number_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  customer_id UUID,
  country_code TEXT NOT NULL,
  vat_number TEXT NOT NULL,
  is_valid BOOLEAN NOT NULL,
  trader_name TEXT,
  trader_address TEXT,
  vies_request_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  vies_consultation_number TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, country_code, vat_number)
);

ALTER TABLE public.eu_vat_number_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage VIES validations"
ON public.eu_vat_number_validations FOR ALL
TO authenticated
USING (public.is_org_member(organization_id, auth.uid()))
WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX idx_eu_vat_validations_org ON public.eu_vat_number_validations(organization_id, country_code, vat_number);

-- 6) Reverse charge log (for EC Sales List)
CREATE TABLE public.eu_reverse_charge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  invoice_id UUID,
  document_reference TEXT,
  document_date DATE NOT NULL,
  customer_id UUID,
  customer_name TEXT,
  customer_country_code TEXT NOT NULL,
  customer_vat_number TEXT NOT NULL,
  supply_type TEXT NOT NULL CHECK (supply_type IN ('services','goods','triangulation')),
  taxable_amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  vies_validation_id UUID REFERENCES public.eu_vat_number_validations(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.eu_reverse_charge_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage reverse charge log"
ON public.eu_reverse_charge_log FOR ALL
TO authenticated
USING (public.is_org_member(organization_id, auth.uid()))
WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX idx_eu_rc_log_org_period ON public.eu_reverse_charge_log(organization_id, document_date DESC);

-- updated_at triggers
CREATE TRIGGER trg_eu_oss_reg_updated_at BEFORE UPDATE ON public.eu_vat_oss_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_eu_oss_returns_updated_at BEFORE UPDATE ON public.eu_oss_returns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();