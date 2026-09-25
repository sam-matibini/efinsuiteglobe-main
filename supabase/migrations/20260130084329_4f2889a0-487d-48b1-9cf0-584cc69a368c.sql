-- =====================================================
-- AFRICAN VOICE LOCALIZATION - Routes & Rates
-- Supports: Zambia, Zimbabwe, Malawi, DRC, Tanzania, Uganda, 
-- Ghana, Rwanda, Botswana, Mozambique, Ethiopia, Egypt, Morocco, 
-- Senegal, Ivory Coast, Cameroon, Angola, Namibia, and more
-- =====================================================

-- Get provider IDs for reference
DO $$
DECLARE
  v_africas_talking_id UUID;
  v_termii_id UUID;
  v_infobip_id UUID;
  v_twilio_id UUID;
  v_plivo_id UUID;
BEGIN
  SELECT id INTO v_africas_talking_id FROM voice_providers WHERE code = 'africas_talking';
  SELECT id INTO v_termii_id FROM voice_providers WHERE code = 'termii';
  SELECT id INTO v_infobip_id FROM voice_providers WHERE code = 'infobip';
  SELECT id INTO v_twilio_id FROM voice_providers WHERE code = 'twilio';
  SELECT id INTO v_plivo_id FROM voice_providers WHERE code = 'plivo';

  -- =====================================================
  -- INSERT AFRICAN COUNTRY ROUTES
  -- Primary: Africa's Talking (best Africa coverage)
  -- Secondary: Termii (West/Central Africa specialist)
  -- Failover: Infobip (global backup)
  -- =====================================================
  
  INSERT INTO voice_provider_routes (country_code, country_name, region, routing_strategy, primary_provider_id, secondary_provider_id, failover_provider_id, is_active)
  VALUES 
    -- Southern Africa
    ('ZM', 'Zambia', 'africa', 'cost', v_africas_talking_id, v_termii_id, v_infobip_id, true),
    ('ZW', 'Zimbabwe', 'africa', 'cost', v_africas_talking_id, v_termii_id, v_infobip_id, true),
    ('MW', 'Malawi', 'africa', 'cost', v_africas_talking_id, v_termii_id, v_infobip_id, true),
    ('BW', 'Botswana', 'africa', 'cost', v_africas_talking_id, v_infobip_id, v_plivo_id, true),
    ('NA', 'Namibia', 'africa', 'cost', v_africas_talking_id, v_infobip_id, v_plivo_id, true),
    ('SZ', 'Eswatini', 'africa', 'cost', v_africas_talking_id, v_infobip_id, v_plivo_id, true),
    ('LS', 'Lesotho', 'africa', 'cost', v_africas_talking_id, v_infobip_id, v_plivo_id, true),
    ('MZ', 'Mozambique', 'africa', 'cost', v_africas_talking_id, v_termii_id, v_infobip_id, true),
    ('AO', 'Angola', 'africa', 'cost', v_africas_talking_id, v_termii_id, v_infobip_id, true),
    
    -- Central Africa
    ('CD', 'Democratic Republic of the Congo', 'africa', 'cost', v_africas_talking_id, v_termii_id, v_infobip_id, true),
    ('CG', 'Republic of the Congo', 'africa', 'cost', v_africas_talking_id, v_termii_id, v_infobip_id, true),
    ('CM', 'Cameroon', 'africa', 'cost', v_termii_id, v_africas_talking_id, v_infobip_id, true),
    ('GA', 'Gabon', 'africa', 'cost', v_africas_talking_id, v_termii_id, v_infobip_id, true),
    ('CF', 'Central African Republic', 'africa', 'cost', v_africas_talking_id, v_infobip_id, v_plivo_id, true),
    ('TD', 'Chad', 'africa', 'cost', v_africas_talking_id, v_termii_id, v_infobip_id, true),
    ('GQ', 'Equatorial Guinea', 'africa', 'cost', v_africas_talking_id, v_infobip_id, v_plivo_id, true),
    
    -- East Africa
    ('TZ', 'Tanzania', 'africa', 'cost', v_africas_talking_id, v_infobip_id, v_plivo_id, true),
    ('UG', 'Uganda', 'africa', 'cost', v_africas_talking_id, v_infobip_id, v_plivo_id, true),
    ('RW', 'Rwanda', 'africa', 'cost', v_africas_talking_id, v_infobip_id, v_plivo_id, true),
    ('BI', 'Burundi', 'africa', 'cost', v_africas_talking_id, v_infobip_id, v_plivo_id, true),
    ('ET', 'Ethiopia', 'africa', 'cost', v_africas_talking_id, v_infobip_id, v_plivo_id, true),
    ('ER', 'Eritrea', 'africa', 'cost', v_africas_talking_id, v_infobip_id, v_plivo_id, true),
    ('DJ', 'Djibouti', 'africa', 'cost', v_africas_talking_id, v_infobip_id, v_plivo_id, true),
    ('SO', 'Somalia', 'africa', 'cost', v_africas_talking_id, v_infobip_id, v_plivo_id, true),
    ('SS', 'South Sudan', 'africa', 'cost', v_africas_talking_id, v_infobip_id, v_plivo_id, true),
    ('SD', 'Sudan', 'africa', 'cost', v_africas_talking_id, v_infobip_id, v_plivo_id, true),
    
    -- West Africa
    ('GH', 'Ghana', 'africa', 'cost', v_termii_id, v_africas_talking_id, v_infobip_id, true),
    ('SN', 'Senegal', 'africa', 'cost', v_termii_id, v_africas_talking_id, v_infobip_id, true),
    ('CI', 'Ivory Coast', 'africa', 'cost', v_termii_id, v_africas_talking_id, v_infobip_id, true),
    ('BJ', 'Benin', 'africa', 'cost', v_termii_id, v_africas_talking_id, v_infobip_id, true),
    ('TG', 'Togo', 'africa', 'cost', v_termii_id, v_africas_talking_id, v_infobip_id, true),
    ('BF', 'Burkina Faso', 'africa', 'cost', v_termii_id, v_africas_talking_id, v_infobip_id, true),
    ('ML', 'Mali', 'africa', 'cost', v_termii_id, v_africas_talking_id, v_infobip_id, true),
    ('NE', 'Niger', 'africa', 'cost', v_termii_id, v_africas_talking_id, v_infobip_id, true),
    ('GN', 'Guinea', 'africa', 'cost', v_africas_talking_id, v_termii_id, v_infobip_id, true),
    ('SL', 'Sierra Leone', 'africa', 'cost', v_africas_talking_id, v_termii_id, v_infobip_id, true),
    ('LR', 'Liberia', 'africa', 'cost', v_africas_talking_id, v_termii_id, v_infobip_id, true),
    ('GM', 'Gambia', 'africa', 'cost', v_africas_talking_id, v_termii_id, v_infobip_id, true),
    ('GW', 'Guinea-Bissau', 'africa', 'cost', v_africas_talking_id, v_infobip_id, v_plivo_id, true),
    ('CV', 'Cape Verde', 'africa', 'cost', v_africas_talking_id, v_infobip_id, v_plivo_id, true),
    ('MR', 'Mauritania', 'africa', 'cost', v_africas_talking_id, v_termii_id, v_infobip_id, true),
    
    -- North Africa
    ('EG', 'Egypt', 'africa', 'cost', v_twilio_id, v_infobip_id, v_plivo_id, true),
    ('MA', 'Morocco', 'africa', 'cost', v_twilio_id, v_infobip_id, v_plivo_id, true),
    ('DZ', 'Algeria', 'africa', 'cost', v_twilio_id, v_infobip_id, v_plivo_id, true),
    ('TN', 'Tunisia', 'africa', 'cost', v_twilio_id, v_infobip_id, v_plivo_id, true),
    ('LY', 'Libya', 'africa', 'cost', v_infobip_id, v_twilio_id, v_plivo_id, true),
    
    -- Island Nations
    ('MU', 'Mauritius', 'africa', 'cost', v_africas_talking_id, v_infobip_id, v_plivo_id, true),
    ('MG', 'Madagascar', 'africa', 'cost', v_africas_talking_id, v_infobip_id, v_plivo_id, true),
    ('SC', 'Seychelles', 'africa', 'cost', v_africas_talking_id, v_infobip_id, v_plivo_id, true),
    ('KM', 'Comoros', 'africa', 'cost', v_africas_talking_id, v_infobip_id, v_plivo_id, true),
    ('RE', 'Réunion', 'africa', 'cost', v_twilio_id, v_infobip_id, v_plivo_id, true),
    ('ST', 'São Tomé and Príncipe', 'africa', 'cost', v_africas_talking_id, v_infobip_id, v_plivo_id, true)
    
  ON CONFLICT (country_code) DO UPDATE SET
    country_name = EXCLUDED.country_name,
    primary_provider_id = EXCLUDED.primary_provider_id,
    secondary_provider_id = EXCLUDED.secondary_provider_id,
    failover_provider_id = EXCLUDED.failover_provider_id,
    is_active = true,
    updated_at = now();

END $$;

-- =====================================================
-- CREATE VOICE RATES TABLE (if not exists)
-- =====================================================
CREATE TABLE IF NOT EXISTS voice_country_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  country_name TEXT NOT NULL,
  dialing_code TEXT NOT NULL,
  rate_per_minute NUMERIC(10, 4) NOT NULL DEFAULT 0.05,
  billing_increment_seconds INTEGER NOT NULL DEFAULT 6,
  currency TEXT NOT NULL DEFAULT 'USD',
  margin_percent NUMERIC(5, 2) DEFAULT 20.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(country_code)
);

-- Enable RLS
ALTER TABLE voice_country_rates ENABLE ROW LEVEL SECURITY;

-- Public read access for rates
CREATE POLICY "Anyone can view voice rates" ON voice_country_rates
  FOR SELECT USING (true);

-- Admin write access
CREATE POLICY "Admins can manage voice rates" ON voice_country_rates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- INSERT AFRICAN COUNTRY RATES
-- Rates based on typical Africa voice termination costs
-- =====================================================
INSERT INTO voice_country_rates (country_code, country_name, dialing_code, rate_per_minute, billing_increment_seconds, margin_percent)
VALUES
  -- Southern Africa
  ('ZM', 'Zambia', '+260', 0.045, 6, 20),
  ('ZW', 'Zimbabwe', '+263', 0.055, 6, 20),
  ('MW', 'Malawi', '+265', 0.048, 6, 20),
  ('BW', 'Botswana', '+267', 0.042, 6, 20),
  ('NA', 'Namibia', '+264', 0.044, 6, 20),
  ('SZ', 'Eswatini', '+268', 0.052, 6, 20),
  ('LS', 'Lesotho', '+266', 0.055, 6, 20),
  ('MZ', 'Mozambique', '+258', 0.058, 6, 20),
  ('AO', 'Angola', '+244', 0.065, 6, 20),
  ('ZA', 'South Africa', '+27', 0.035, 6, 20),
  
  -- Central Africa
  ('CD', 'Democratic Republic of the Congo', '+243', 0.085, 6, 25),
  ('CG', 'Republic of the Congo', '+242', 0.075, 6, 25),
  ('CM', 'Cameroon', '+237', 0.052, 6, 20),
  ('GA', 'Gabon', '+241', 0.068, 6, 20),
  ('CF', 'Central African Republic', '+236', 0.095, 6, 25),
  ('TD', 'Chad', '+235', 0.088, 6, 25),
  ('GQ', 'Equatorial Guinea', '+240', 0.078, 6, 20),
  
  -- East Africa
  ('TZ', 'Tanzania', '+255', 0.042, 6, 20),
  ('UG', 'Uganda', '+256', 0.038, 6, 20),
  ('RW', 'Rwanda', '+250', 0.045, 6, 20),
  ('BI', 'Burundi', '+257', 0.065, 6, 25),
  ('ET', 'Ethiopia', '+251', 0.055, 6, 20),
  ('ER', 'Eritrea', '+291', 0.125, 6, 30),
  ('DJ', 'Djibouti', '+253', 0.085, 6, 25),
  ('SO', 'Somalia', '+252', 0.145, 6, 30),
  ('SS', 'South Sudan', '+211', 0.185, 6, 30),
  ('SD', 'Sudan', '+249', 0.095, 6, 25),
  ('KE', 'Kenya', '+254', 0.032, 6, 20),
  
  -- West Africa
  ('NG', 'Nigeria', '+234', 0.028, 6, 20),
  ('GH', 'Ghana', '+233', 0.035, 6, 20),
  ('SN', 'Senegal', '+221', 0.048, 6, 20),
  ('CI', 'Ivory Coast', '+225', 0.055, 6, 20),
  ('BJ', 'Benin', '+229', 0.058, 6, 20),
  ('TG', 'Togo', '+228', 0.055, 6, 20),
  ('BF', 'Burkina Faso', '+226', 0.062, 6, 20),
  ('ML', 'Mali', '+223', 0.068, 6, 20),
  ('NE', 'Niger', '+227', 0.072, 6, 25),
  ('GN', 'Guinea', '+224', 0.065, 6, 20),
  ('SL', 'Sierra Leone', '+232', 0.075, 6, 25),
  ('LR', 'Liberia', '+231', 0.078, 6, 25),
  ('GM', 'Gambia', '+220', 0.065, 6, 20),
  ('GW', 'Guinea-Bissau', '+245', 0.085, 6, 25),
  ('CV', 'Cape Verde', '+238', 0.072, 6, 20),
  ('MR', 'Mauritania', '+222', 0.078, 6, 25),
  
  -- North Africa
  ('EG', 'Egypt', '+20', 0.028, 6, 20),
  ('MA', 'Morocco', '+212', 0.032, 6, 20),
  ('DZ', 'Algeria', '+213', 0.038, 6, 20),
  ('TN', 'Tunisia', '+216', 0.035, 6, 20),
  ('LY', 'Libya', '+218', 0.095, 6, 25),
  
  -- Island Nations
  ('MU', 'Mauritius', '+230', 0.042, 6, 20),
  ('MG', 'Madagascar', '+261', 0.065, 6, 20),
  ('SC', 'Seychelles', '+248', 0.058, 6, 20),
  ('KM', 'Comoros', '+269', 0.088, 6, 25),
  ('RE', 'Réunion', '+262', 0.025, 6, 20),
  ('ST', 'São Tomé and Príncipe', '+239', 0.095, 6, 25)
  
ON CONFLICT (country_code) DO UPDATE SET
  rate_per_minute = EXCLUDED.rate_per_minute,
  billing_increment_seconds = EXCLUDED.billing_increment_seconds,
  margin_percent = EXCLUDED.margin_percent,
  is_active = true,
  updated_at = now();

-- =====================================================
-- ADD NON-AFRICAN ESSENTIAL COUNTRIES FOR COMPLETENESS
-- =====================================================
INSERT INTO voice_country_rates (country_code, country_name, dialing_code, rate_per_minute, billing_increment_seconds, margin_percent)
VALUES
  ('US', 'United States', '+1', 0.012, 6, 20),
  ('CA', 'Canada', '+1', 0.012, 6, 20),
  ('GB', 'United Kingdom', '+44', 0.015, 6, 20),
  ('DE', 'Germany', '+49', 0.018, 6, 20),
  ('FR', 'France', '+33', 0.018, 6, 20),
  ('NL', 'Netherlands', '+31', 0.016, 6, 20),
  ('BE', 'Belgium', '+32', 0.018, 6, 20),
  ('IE', 'Ireland', '+353', 0.022, 6, 20),
  ('AU', 'Australia', '+61', 0.025, 6, 20),
  ('NZ', 'New Zealand', '+64', 0.028, 6, 20),
  ('AE', 'United Arab Emirates', '+971', 0.055, 6, 20),
  ('SA', 'Saudi Arabia', '+966', 0.048, 6, 20),
  ('QA', 'Qatar', '+974', 0.052, 6, 20),
  ('KW', 'Kuwait', '+965', 0.045, 6, 20),
  ('BH', 'Bahrain', '+973', 0.042, 6, 20),
  ('OM', 'Oman', '+968', 0.048, 6, 20),
  ('IN', 'India', '+91', 0.018, 6, 20),
  ('PK', 'Pakistan', '+92', 0.025, 6, 20),
  ('BD', 'Bangladesh', '+880', 0.022, 6, 20),
  ('PH', 'Philippines', '+63', 0.028, 6, 20),
  ('SG', 'Singapore', '+65', 0.012, 6, 20),
  ('MY', 'Malaysia', '+60', 0.022, 6, 20),
  ('ID', 'Indonesia', '+62', 0.032, 6, 20),
  ('TH', 'Thailand', '+66', 0.025, 6, 20),
  ('VN', 'Vietnam', '+84', 0.028, 6, 20),
  ('CN', 'China', '+86', 0.015, 6, 20),
  ('JP', 'Japan', '+81', 0.035, 6, 20),
  ('KR', 'South Korea', '+82', 0.028, 6, 20),
  ('HK', 'Hong Kong', '+852', 0.012, 6, 20),
  ('BR', 'Brazil', '+55', 0.035, 6, 20),
  ('MX', 'Mexico', '+52', 0.025, 6, 20)
ON CONFLICT (country_code) DO NOTHING;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_voice_country_rates_country ON voice_country_rates(country_code);
CREATE INDEX IF NOT EXISTS idx_voice_country_rates_dialing ON voice_country_rates(dialing_code);