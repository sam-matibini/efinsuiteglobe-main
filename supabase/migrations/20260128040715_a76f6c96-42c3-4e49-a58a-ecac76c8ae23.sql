-- =====================================================
-- ADD MORE LOCALIZED COUNTRIES TO THE COUNTRIES TABLE
-- =====================================================

-- Add additional countries commonly used in business operations
INSERT INTO public.countries (code, code_alpha3, name, default_currency, accounting_standard, fiscal_year_type, default_fiscal_month, tax_regime_type, payroll_regime_type, phone_code, date_format, number_format, is_active)
VALUES 
  -- Europe
  ('GB', 'GBR', 'United Kingdom', 'GBP', 'IFRS', 'april', 4, 'VAT', 'PAYE/NI', '+44', 'DD/MM/YYYY', '1,234.56', true),
  ('DE', 'DEU', 'Germany', 'EUR', 'IFRS', 'calendar', 12, 'VAT/USt', 'Income Tax/SV', '+49', 'DD.MM.YYYY', '1.234,56', true),
  ('FR', 'FRA', 'France', 'EUR', 'IFRS', 'calendar', 12, 'TVA', 'PAYE/SS', '+33', 'DD/MM/YYYY', '1 234,56', true),
  ('NL', 'NLD', 'Netherlands', 'EUR', 'IFRS', 'calendar', 12, 'BTW', 'Payroll Tax', '+31', 'DD-MM-YYYY', '1.234,56', true),
  ('BE', 'BEL', 'Belgium', 'EUR', 'IFRS', 'calendar', 12, 'TVA/BTW', 'PAYE/SS', '+32', 'DD/MM/YYYY', '1.234,56', true),
  ('CH', 'CHE', 'Switzerland', 'CHF', 'IFRS', 'calendar', 12, 'MWST/TVA', 'AHV/AVS', '+41', 'DD.MM.YYYY', '1''234.56', true),
  ('IT', 'ITA', 'Italy', 'EUR', 'IFRS', 'calendar', 12, 'IVA', 'IRPEF/INPS', '+39', 'DD/MM/YYYY', '1.234,56', true),
  ('ES', 'ESP', 'Spain', 'EUR', 'IFRS', 'calendar', 12, 'IVA', 'IRPF/SS', '+34', 'DD/MM/YYYY', '1.234,56', true),
  ('PT', 'PRT', 'Portugal', 'EUR', 'IFRS', 'calendar', 12, 'IVA', 'IRS/TSU', '+351', 'DD/MM/YYYY', '1 234,56', true),
  ('IE', 'IRL', 'Ireland', 'EUR', 'IFRS', 'calendar', 12, 'VAT', 'PAYE/PRSI', '+353', 'DD/MM/YYYY', '1,234.56', true),
  ('AT', 'AUT', 'Austria', 'EUR', 'IFRS', 'calendar', 12, 'USt', 'Income Tax/SV', '+43', 'DD.MM.YYYY', '1.234,56', true),
  ('SE', 'SWE', 'Sweden', 'SEK', 'IFRS', 'calendar', 12, 'Moms', 'PAYE/SI', '+46', 'YYYY-MM-DD', '1 234,56', true),
  ('NO', 'NOR', 'Norway', 'NOK', 'IFRS', 'calendar', 12, 'MVA', 'PAYE/NI', '+47', 'DD.MM.YYYY', '1 234,56', true),
  ('DK', 'DNK', 'Denmark', 'DKK', 'IFRS', 'calendar', 12, 'Moms', 'A-Skat/AM', '+45', 'DD-MM-YYYY', '1.234,56', true),
  ('FI', 'FIN', 'Finland', 'EUR', 'IFRS', 'calendar', 12, 'ALV', 'PAYE/SI', '+358', 'DD.MM.YYYY', '1 234,56', true),
  ('PL', 'POL', 'Poland', 'PLN', 'IFRS', 'calendar', 12, 'VAT', 'PIT/ZUS', '+48', 'DD.MM.YYYY', '1 234,56', true),
  ('CZ', 'CZE', 'Czech Republic', 'CZK', 'IFRS', 'calendar', 12, 'DPH', 'PAYE/SI', '+420', 'DD.MM.YYYY', '1 234,56', true),
  
  -- Africa
  ('ZA', 'ZAF', 'South Africa', 'ZAR', 'IFRS', 'february', 2, 'VAT', 'PAYE/UIF', '+27', 'YYYY/MM/DD', '1 234.56', true),
  ('NG', 'NGA', 'Nigeria', 'NGN', 'IFRS', 'calendar', 12, 'VAT', 'PAYE/Pension', '+234', 'DD/MM/YYYY', '1,234.56', true),
  ('GH', 'GHA', 'Ghana', 'GHS', 'IFRS', 'calendar', 12, 'VAT/NHIL', 'PAYE/SSNIT', '+233', 'DD/MM/YYYY', '1,234.56', true),
  ('TZ', 'TZA', 'Tanzania', 'TZS', 'IFRS', 'calendar', 12, 'VAT', 'PAYE/NSSF', '+255', 'DD/MM/YYYY', '1,234.56', true),
  ('UG', 'UGA', 'Uganda', 'UGX', 'IFRS', 'calendar', 12, 'VAT', 'PAYE/NSSF', '+256', 'DD/MM/YYYY', '1,234.56', true),
  ('RW', 'RWA', 'Rwanda', 'RWF', 'IFRS', 'calendar', 12, 'VAT', 'PAYE/Pension', '+250', 'DD/MM/YYYY', '1,234.56', true),
  ('ET', 'ETH', 'Ethiopia', 'ETB', 'IFRS', 'july', 7, 'VAT/TOT', 'PAYE/Pension', '+251', 'DD/MM/YYYY', '1,234.56', true),
  ('EG', 'EGY', 'Egypt', 'EGP', 'IFRS', 'calendar', 12, 'VAT', 'PAYE/SI', '+20', 'DD/MM/YYYY', '1,234.56', true),
  ('MA', 'MAR', 'Morocco', 'MAD', 'IFRS', 'calendar', 12, 'TVA', 'IR/CNSS', '+212', 'DD/MM/YYYY', '1 234,56', true),
  
  -- Asia Pacific
  ('AU', 'AUS', 'Australia', 'AUD', 'IFRS', 'july', 7, 'GST', 'PAYG/Super', '+61', 'DD/MM/YYYY', '1,234.56', true),
  ('NZ', 'NZL', 'New Zealand', 'NZD', 'IFRS', 'march', 3, 'GST', 'PAYE/KS', '+64', 'DD/MM/YYYY', '1,234.56', true),
  ('SG', 'SGP', 'Singapore', 'SGD', 'SFRS', 'calendar', 12, 'GST', 'CPF', '+65', 'DD/MM/YYYY', '1,234.56', true),
  ('MY', 'MYS', 'Malaysia', 'MYR', 'MFRS', 'calendar', 12, 'SST', 'PCB/EPF', '+60', 'DD/MM/YYYY', '1,234.56', true),
  ('IN', 'IND', 'India', 'INR', 'Ind-AS', 'march', 3, 'GST', 'TDS/PF/ESI', '+91', 'DD/MM/YYYY', '1,23,456.78', true),
  ('JP', 'JPN', 'Japan', 'JPY', 'J-GAAP', 'march', 3, 'Consumption Tax', 'Withholding/SI', '+81', 'YYYY/MM/DD', '1,234', true),
  ('KR', 'KOR', 'South Korea', 'KRW', 'K-IFRS', 'calendar', 12, 'VAT', 'Withholding/NP', '+82', 'YYYY.MM.DD', '1,234', true),
  ('CN', 'CHN', 'China', 'CNY', 'CAS', 'calendar', 12, 'VAT', 'IIT/SI', '+86', 'YYYY-MM-DD', '1,234.56', true),
  ('HK', 'HKG', 'Hong Kong', 'HKD', 'HKFRS', 'march', 3, 'None', 'Salaries Tax/MPF', '+852', 'DD/MM/YYYY', '1,234.56', true),
  ('PH', 'PHL', 'Philippines', 'PHP', 'PFRS', 'calendar', 12, 'VAT', 'Withholding/SSS', '+63', 'MM/DD/YYYY', '1,234.56', true),
  ('ID', 'IDN', 'Indonesia', 'IDR', 'PSAK', 'calendar', 12, 'PPN', 'PPh21/BPJS', '+62', 'DD/MM/YYYY', '1.234,56', true),
  ('TH', 'THA', 'Thailand', 'THB', 'TFRS', 'calendar', 12, 'VAT', 'Withholding/SSO', '+66', 'DD/MM/YYYY', '1,234.56', true),
  ('VN', 'VNM', 'Vietnam', 'VND', 'VAS', 'calendar', 12, 'VAT', 'PIT/SI', '+84', 'DD/MM/YYYY', '1.234', true),
  
  -- Middle East
  ('AE', 'ARE', 'United Arab Emirates', 'AED', 'IFRS', 'calendar', 12, 'VAT', 'WPS', '+971', 'DD/MM/YYYY', '1,234.56', true),
  ('SA', 'SAU', 'Saudi Arabia', 'SAR', 'IFRS', 'calendar', 12, 'VAT', 'GOSI', '+966', 'DD/MM/YYYY', '1,234.56', true),
  ('QA', 'QAT', 'Qatar', 'QAR', 'IFRS', 'calendar', 12, 'None', 'WPS', '+974', 'DD/MM/YYYY', '1,234.56', true),
  ('KW', 'KWT', 'Kuwait', 'KWD', 'IFRS', 'calendar', 12, 'None', 'PIFSS', '+965', 'DD/MM/YYYY', '1,234.56', true),
  ('BH', 'BHR', 'Bahrain', 'BHD', 'IFRS', 'calendar', 12, 'VAT', 'SIO', '+973', 'DD/MM/YYYY', '1,234.56', true),
  ('OM', 'OMN', 'Oman', 'OMR', 'IFRS', 'calendar', 12, 'VAT', 'PASI', '+968', 'DD/MM/YYYY', '1,234.56', true),
  ('IL', 'ISR', 'Israel', 'ILS', 'IFRS', 'calendar', 12, 'VAT', 'Income Tax/Bituach', '+972', 'DD/MM/YYYY', '1,234.56', true),
  
  -- Americas
  ('MX', 'MEX', 'Mexico', 'MXN', 'IFRS', 'calendar', 12, 'IVA', 'ISR/IMSS', '+52', 'DD/MM/YYYY', '1,234.56', true),
  ('BR', 'BRA', 'Brazil', 'BRL', 'IFRS', 'calendar', 12, 'ICMS/IPI/ISS', 'IRRF/INSS', '+55', 'DD/MM/YYYY', '1.234,56', true),
  ('AR', 'ARG', 'Argentina', 'ARS', 'IFRS', 'calendar', 12, 'IVA', 'Ganancias/SIPA', '+54', 'DD/MM/YYYY', '1.234,56', true),
  ('CL', 'CHL', 'Chile', 'CLP', 'IFRS', 'calendar', 12, 'IVA', 'Tax/AFP', '+56', 'DD-MM-YYYY', '1.234', true),
  ('CO', 'COL', 'Colombia', 'COP', 'IFRS', 'calendar', 12, 'IVA', 'Retencion/EPS', '+57', 'DD/MM/YYYY', '1.234,56', true),
  ('PE', 'PER', 'Peru', 'PEN', 'IFRS', 'calendar', 12, 'IGV', 'Retencion/AFP', '+51', 'DD/MM/YYYY', '1,234.56', true)
ON CONFLICT (code) DO UPDATE SET
  code_alpha3 = EXCLUDED.code_alpha3,
  accounting_standard = EXCLUDED.accounting_standard,
  fiscal_year_type = EXCLUDED.fiscal_year_type,
  default_fiscal_month = EXCLUDED.default_fiscal_month,
  tax_regime_type = EXCLUDED.tax_regime_type,
  payroll_regime_type = EXCLUDED.payroll_regime_type,
  phone_code = EXCLUDED.phone_code,
  date_format = EXCLUDED.date_format,
  number_format = EXCLUDED.number_format,
  updated_at = now();

-- =====================================================
-- ADD display_name TO organization_members FOR CUSTOM NAMES
-- =====================================================
ALTER TABLE public.organization_members 
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.organization_members.display_name IS 'Custom display name for this member within the organization (overrides profile name)';

-- =====================================================
-- ADD joined_at COLUMN TO TRACK WHEN MEMBER ACTUALLY JOINED
-- =====================================================
ALTER TABLE public.organization_members
ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- =====================================================
-- UPDATE RLS POLICIES FOR ORGANIZATION MEMBERS
-- =====================================================

-- Allow members to update their own display_name
DROP POLICY IF EXISTS "Members can update own display name" ON public.organization_members;
CREATE POLICY "Members can update own display name"
ON public.organization_members
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow admins/owners to update any member in their org
DROP POLICY IF EXISTS "Admins can update org members" ON public.organization_members;
CREATE POLICY "Admins can update org members"
ON public.organization_members
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  )
);

-- =====================================================
-- CREATE VIEW FOR ACCEPTED INVITATIONS HISTORY
-- =====================================================
CREATE OR REPLACE VIEW public.organization_invitation_history AS
SELECT 
  oi.id,
  oi.organization_id,
  o.name as organization_name,
  oi.email,
  oi.role,
  oi.status,
  oi.invited_by,
  p.full_name as invited_by_name,
  oi.created_at as invited_at,
  oi.accepted_at,
  oi.expires_at
FROM public.organization_invitations oi
JOIN public.organizations o ON o.id = oi.organization_id
LEFT JOIN public.profiles p ON p.user_id = oi.invited_by
ORDER BY oi.created_at DESC;