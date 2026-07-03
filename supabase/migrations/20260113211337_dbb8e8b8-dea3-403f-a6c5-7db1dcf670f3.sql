-- =====================================================
-- PART 1: GLOBAL JURISDICTION REGISTRY
-- =====================================================

-- Countries Master Table
CREATE TABLE public.countries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(2) NOT NULL UNIQUE, -- ISO 3166-1 alpha-2
  code_alpha3 VARCHAR(3) UNIQUE, -- ISO 3166-1 alpha-3
  name VARCHAR(100) NOT NULL,
  default_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  accounting_standard VARCHAR(20) DEFAULT 'IFRS', -- IFRS, GAAP, ASPE, local
  fiscal_year_type VARCHAR(20) DEFAULT 'calendar', -- calendar, april, july, custom
  default_fiscal_month INTEGER DEFAULT 12, -- Month fiscal year ends
  tax_regime_type VARCHAR(50), -- VAT, GST, Sales Tax
  payroll_regime_type VARCHAR(50),
  phone_code VARCHAR(10),
  date_format VARCHAR(20) DEFAULT 'YYYY-MM-DD',
  number_format VARCHAR(20) DEFAULT '1,234.56',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Jurisdictions (Provinces/States/Counties)
CREATE TABLE public.jurisdictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_id UUID NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL, -- Province/State code
  name VARCHAR(100) NOT NULL,
  jurisdiction_type VARCHAR(50) DEFAULT 'province', -- province, state, county, city, zone
  parent_jurisdiction_id UUID REFERENCES public.jurisdictions(id),
  tax_zone_code VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(country_id, code)
);

-- =====================================================
-- PART 2: TAX RULES ENGINE (GLOBAL)
-- =====================================================

-- Tax Types Master
CREATE TABLE public.tax_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_id UUID NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL, -- GST, HST, PST, VAT, PAYE
  name VARCHAR(100) NOT NULL,
  tax_category VARCHAR(50) NOT NULL, -- sales, payroll, withholding, property
  is_recoverable BOOLEAN DEFAULT TRUE,
  is_compound BOOLEAN DEFAULT FALSE,
  calculation_method VARCHAR(20) DEFAULT 'percentage', -- percentage, flat, tiered
  applies_to VARCHAR(50) DEFAULT 'goods_and_services', -- goods, services, both, specific
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(country_id, code)
);

-- Tax Rates by Jurisdiction
CREATE TABLE public.tax_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tax_type_id UUID NOT NULL REFERENCES public.tax_types(id) ON DELETE CASCADE,
  jurisdiction_id UUID REFERENCES public.jurisdictions(id),
  rate DECIMAL(10, 4) NOT NULL DEFAULT 0,
  rate_name VARCHAR(100), -- Standard, Reduced, Zero-rated
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  threshold_min DECIMAL(15, 2),
  threshold_max DECIMAL(15, 2),
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tax Accounts Mapping
CREATE TABLE public.tax_account_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tax_type_id UUID NOT NULL REFERENCES public.tax_types(id) ON DELETE CASCADE,
  collected_account_id UUID REFERENCES public.accounts(id), -- Tax Collected/Payable
  paid_account_id UUID REFERENCES public.accounts(id), -- Tax Paid/Recoverable
  expense_account_id UUID REFERENCES public.accounts(id), -- Non-recoverable expense
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(organization_id, tax_type_id)
);

-- =====================================================
-- PART 3: PAYROLL RULES ENGINE (GLOBAL)
-- =====================================================

-- Payroll Deduction Types
CREATE TABLE public.payroll_deduction_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_id UUID NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  code VARCHAR(30) NOT NULL, -- CPP, EI, PAYE, NHIF, NSSF, NAPSA
  name VARCHAR(100) NOT NULL,
  deduction_category VARCHAR(50) NOT NULL, -- statutory, voluntary, employer, both
  calculation_method VARCHAR(30) NOT NULL, -- percentage, tiered, flat, formula
  is_employer_contribution BOOLEAN DEFAULT FALSE,
  is_employee_deduction BOOLEAN DEFAULT TRUE,
  is_taxable_benefit BOOLEAN DEFAULT FALSE,
  is_tax_deductible BOOLEAN DEFAULT TRUE,
  max_annual_amount DECIMAL(15, 2),
  max_pensionable_earnings DECIMAL(15, 2),
  exemption_amount DECIMAL(15, 2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(country_id, code)
);

-- Payroll Rate Brackets
CREATE TABLE public.payroll_rate_brackets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deduction_type_id UUID NOT NULL REFERENCES public.payroll_deduction_types(id) ON DELETE CASCADE,
  jurisdiction_id UUID REFERENCES public.jurisdictions(id),
  bracket_min DECIMAL(15, 2) NOT NULL DEFAULT 0,
  bracket_max DECIMAL(15, 2),
  rate DECIMAL(10, 4) NOT NULL,
  employer_rate DECIMAL(10, 4),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Payroll Account Mappings
CREATE TABLE public.payroll_account_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  deduction_type_id UUID NOT NULL REFERENCES public.payroll_deduction_types(id) ON DELETE CASCADE,
  liability_account_id UUID REFERENCES public.accounts(id), -- Payroll Liabilities
  expense_account_id UUID REFERENCES public.accounts(id), -- Employer Expense
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(organization_id, deduction_type_id)
);

-- =====================================================
-- PART 4: CHART OF ACCOUNTS TEMPLATES
-- =====================================================

-- COA Templates by Country/Industry
CREATE TABLE public.coa_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_id UUID REFERENCES public.countries(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  industry VARCHAR(50), -- retail, npo, finance, manufacturing
  accounting_standard VARCHAR(20) DEFAULT 'IFRS',
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- COA Template Accounts
CREATE TABLE public.coa_template_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.coa_templates(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  account_type VARCHAR(20) NOT NULL, -- asset, liability, equity, income, expense, cogs
  account_group VARCHAR(50),
  account_sub_group VARCHAR(50),
  parent_code VARCHAR(20),
  is_header BOOLEAN DEFAULT FALSE,
  is_tax_account BOOLEAN DEFAULT FALSE,
  is_payroll_account BOOLEAN DEFAULT FALSE,
  tax_type_code VARCHAR(20),
  deduction_type_code VARCHAR(30),
  normal_balance VARCHAR(10) DEFAULT 'debit',
  description TEXT,
  sort_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- PART 5: ORGANIZATION JURISDICTION SETTINGS
-- =====================================================

-- Organization Country Settings
CREATE TABLE public.organization_jurisdictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  country_id UUID NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  tax_registration_number VARCHAR(50),
  payroll_registration_number VARCHAR(50),
  employer_account_number VARCHAR(50),
  fiscal_year_end_month INTEGER,
  reporting_currency VARCHAR(3),
  accounting_standard VARCHAR(20),
  setup_completed_at TIMESTAMP WITH TIME ZONE,
  ai_setup_confidence DECIMAL(5, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(organization_id, country_id)
);

-- Organization Enabled Tax Types
CREATE TABLE public.organization_tax_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tax_type_id UUID NOT NULL REFERENCES public.tax_types(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT TRUE,
  registration_number VARCHAR(50),
  reporting_frequency VARCHAR(20) DEFAULT 'quarterly', -- monthly, quarterly, annual
  next_filing_due DATE,
  is_registered BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(organization_id, tax_type_id)
);

-- Organization Enabled Payroll Deductions
CREATE TABLE public.organization_payroll_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  deduction_type_id UUID NOT NULL REFERENCES public.payroll_deduction_types(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT TRUE,
  employer_registration_number VARCHAR(50),
  remittance_frequency VARCHAR(20) DEFAULT 'monthly',
  next_remittance_due DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(organization_id, deduction_type_id)
);

-- =====================================================
-- PART 6: AI SETUP LOGS
-- =====================================================

-- AI Configuration Decisions Log
CREATE TABLE public.ai_setup_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  setup_type VARCHAR(50) NOT NULL, -- jurisdiction, tax, payroll, coa
  detected_value JSONB,
  applied_value JSONB,
  confidence_score DECIMAL(5, 2),
  was_overridden BOOLEAN DEFAULT FALSE,
  override_reason TEXT,
  overridden_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- PART 7: ADD JURISDICTION FIELDS TO EXISTING TABLES
-- =====================================================

-- Add jurisdiction tracking to organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS primary_country_id UUID REFERENCES public.countries(id),
ADD COLUMN IF NOT EXISTS primary_jurisdiction_id UUID REFERENCES public.jurisdictions(id),
ADD COLUMN IF NOT EXISTS accounting_standard VARCHAR(20) DEFAULT 'IFRS',
ADD COLUMN IF NOT EXISTS ai_setup_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ai_setup_completed_at TIMESTAMP WITH TIME ZONE;

-- Add jurisdiction tracking to invoices
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES public.countries(id),
ADD COLUMN IF NOT EXISTS jurisdiction_id UUID REFERENCES public.jurisdictions(id),
ADD COLUMN IF NOT EXISTS base_currency_amount DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS exchange_rate_used DECIMAL(15, 6) DEFAULT 1;

-- Add jurisdiction tracking to journal entries
ALTER TABLE public.journal_entries 
ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES public.countries(id),
ADD COLUMN IF NOT EXISTS jurisdiction_id UUID REFERENCES public.jurisdictions(id),
ADD COLUMN IF NOT EXISTS base_currency_amount DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS exchange_rate_used DECIMAL(15, 6) DEFAULT 1;

-- Add jurisdiction tracking to bank transactions  
ALTER TABLE public.bank_transactions
ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES public.countries(id),
ADD COLUMN IF NOT EXISTS jurisdiction_id UUID REFERENCES public.jurisdictions(id);

-- Add jurisdiction tracking to credit card transactions
ALTER TABLE public.credit_card_transactions
ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES public.countries(id),
ADD COLUMN IF NOT EXISTS jurisdiction_id UUID REFERENCES public.jurisdictions(id);

-- =====================================================
-- PART 8: ENABLE RLS ON ALL NEW TABLES
-- =====================================================

ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jurisdictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_account_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_deduction_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_rate_brackets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_account_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coa_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coa_template_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_jurisdictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_tax_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_payroll_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_setup_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PART 9: RLS POLICIES
-- =====================================================

-- Countries & Jurisdictions - Public read, admin write
CREATE POLICY "Countries are readable by all authenticated users" ON public.countries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Jurisdictions are readable by all authenticated users" ON public.jurisdictions FOR SELECT TO authenticated USING (true);

-- Tax Types & Rates - Public read
CREATE POLICY "Tax types are readable by all authenticated users" ON public.tax_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tax rates are readable by all authenticated users" ON public.tax_rates FOR SELECT TO authenticated USING (true);

-- Payroll Deduction Types & Rates - Public read
CREATE POLICY "Payroll deduction types are readable by all authenticated users" ON public.payroll_deduction_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Payroll rate brackets are readable by all authenticated users" ON public.payroll_rate_brackets FOR SELECT TO authenticated USING (true);

-- COA Templates - Public read
CREATE POLICY "COA templates are readable by all authenticated users" ON public.coa_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "COA template accounts are readable by all authenticated users" ON public.coa_template_accounts FOR SELECT TO authenticated USING (true);

-- Organization-specific settings - Org members only
CREATE POLICY "Tax account mappings are viewable by org members" ON public.tax_account_mappings FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Tax account mappings are manageable by org members" ON public.tax_account_mappings FOR ALL USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Payroll account mappings are viewable by org members" ON public.payroll_account_mappings FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Payroll account mappings are manageable by org members" ON public.payroll_account_mappings FOR ALL USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Organization jurisdictions are viewable by org members" ON public.organization_jurisdictions FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Organization jurisdictions are manageable by org members" ON public.organization_jurisdictions FOR ALL USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Organization tax settings are viewable by org members" ON public.organization_tax_settings FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Organization tax settings are manageable by org members" ON public.organization_tax_settings FOR ALL USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Organization payroll settings are viewable by org members" ON public.organization_payroll_settings FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Organization payroll settings are manageable by org members" ON public.organization_payroll_settings FOR ALL USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "AI setup logs are viewable by org members" ON public.ai_setup_logs FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "AI setup logs are manageable by org members" ON public.ai_setup_logs FOR ALL USING (public.is_org_member(auth.uid(), organization_id));

-- =====================================================
-- PART 10: INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_jurisdictions_country ON public.jurisdictions(country_id);
CREATE INDEX idx_tax_types_country ON public.tax_types(country_id);
CREATE INDEX idx_tax_rates_tax_type ON public.tax_rates(tax_type_id);
CREATE INDEX idx_tax_rates_jurisdiction ON public.tax_rates(jurisdiction_id);
CREATE INDEX idx_payroll_deduction_types_country ON public.payroll_deduction_types(country_id);
CREATE INDEX idx_payroll_rate_brackets_deduction ON public.payroll_rate_brackets(deduction_type_id);
CREATE INDEX idx_coa_template_accounts_template ON public.coa_template_accounts(template_id);
CREATE INDEX idx_org_jurisdictions_org ON public.organization_jurisdictions(organization_id);
CREATE INDEX idx_org_tax_settings_org ON public.organization_tax_settings(organization_id);
CREATE INDEX idx_org_payroll_settings_org ON public.organization_payroll_settings(organization_id);
CREATE INDEX idx_ai_setup_logs_org ON public.ai_setup_logs(organization_id);

-- =====================================================
-- PART 11: UPDATED_AT TRIGGERS
-- =====================================================

CREATE TRIGGER update_countries_updated_at BEFORE UPDATE ON public.countries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_jurisdictions_updated_at BEFORE UPDATE ON public.jurisdictions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tax_types_updated_at BEFORE UPDATE ON public.tax_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tax_rates_updated_at BEFORE UPDATE ON public.tax_rates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tax_account_mappings_updated_at BEFORE UPDATE ON public.tax_account_mappings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payroll_deduction_types_updated_at BEFORE UPDATE ON public.payroll_deduction_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payroll_rate_brackets_updated_at BEFORE UPDATE ON public.payroll_rate_brackets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payroll_account_mappings_updated_at BEFORE UPDATE ON public.payroll_account_mappings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_coa_templates_updated_at BEFORE UPDATE ON public.coa_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_org_jurisdictions_updated_at BEFORE UPDATE ON public.organization_jurisdictions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_org_tax_settings_updated_at BEFORE UPDATE ON public.organization_tax_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_org_payroll_settings_updated_at BEFORE UPDATE ON public.organization_payroll_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();