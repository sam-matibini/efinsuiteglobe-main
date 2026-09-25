-- =====================================================
-- COMPREHENSIVE DATABASE UPDATE: COUNTRIES, ORGANIZATIONS & MESSAGING
-- =====================================================

-- 1. ADD MISSING COUNTRIES (completing the 15+ priority regions)
-- Note: Many countries already exist, this adds any missing ones

-- Ensure Burundi has complete data
UPDATE countries 
SET phone_code = '+257', date_format = 'DD/MM/YYYY', number_format = '1.234,56'
WHERE code = 'BI';

-- Ensure all African priority countries have phone codes
UPDATE countries SET phone_code = '+260' WHERE code = 'ZM' AND (phone_code IS NULL OR phone_code = '');
UPDATE countries SET phone_code = '+254' WHERE code = 'KE' AND (phone_code IS NULL OR phone_code = '');
UPDATE countries SET phone_code = '+234' WHERE code = 'NG' AND (phone_code IS NULL OR phone_code = '');
UPDATE countries SET phone_code = '+233' WHERE code = 'GH' AND (phone_code IS NULL OR phone_code = '');
UPDATE countries SET phone_code = '+27' WHERE code = 'ZA' AND (phone_code IS NULL OR phone_code = '');

-- Ensure Gulf states have phone codes
UPDATE countries SET phone_code = '+971' WHERE code = 'AE' AND (phone_code IS NULL OR phone_code = '');
UPDATE countries SET phone_code = '+966' WHERE code = 'SA' AND (phone_code IS NULL OR phone_code = '');
UPDATE countries SET phone_code = '+973' WHERE code = 'BH' AND (phone_code IS NULL OR phone_code = '');
UPDATE countries SET phone_code = '+968' WHERE code = 'OM' AND (phone_code IS NULL OR phone_code = '');
UPDATE countries SET phone_code = '+974' WHERE code = 'QA' AND (phone_code IS NULL OR phone_code = '');
UPDATE countries SET phone_code = '+965' WHERE code = 'KW' AND (phone_code IS NULL OR phone_code = '');

-- Ensure major economies have phone codes
UPDATE countries SET phone_code = '+1' WHERE code = 'CA' AND (phone_code IS NULL OR phone_code = '');
UPDATE countries SET phone_code = '+1' WHERE code = 'US' AND (phone_code IS NULL OR phone_code = '');
UPDATE countries SET phone_code = '+44' WHERE code = 'UK' AND (phone_code IS NULL OR phone_code = '');
UPDATE countries SET phone_code = '+44' WHERE code = 'GB' AND (phone_code IS NULL OR phone_code = '');
UPDATE countries SET phone_code = '+61' WHERE code = 'AU' AND (phone_code IS NULL OR phone_code = '');
UPDATE countries SET phone_code = '+49' WHERE code = 'DE' AND (phone_code IS NULL OR phone_code = '');
UPDATE countries SET phone_code = '+33' WHERE code = 'FR' AND (phone_code IS NULL OR phone_code = '');
UPDATE countries SET phone_code = '+91' WHERE code = 'IN' AND (phone_code IS NULL OR phone_code = '');

-- 2. ADD COMMUNICATION CHANNEL PREFERENCES TO ORGANIZATIONS
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS preferred_comm_channel text DEFAULT 'email',
ADD COLUMN IF NOT EXISTS sms_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS email_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS voice_enabled boolean DEFAULT false;

-- 3. ADD LOCALIZATION SYNC TIMESTAMP
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS localization_synced_at timestamp with time zone;

-- 4. CREATE FUNCTION TO SYNC ORGANIZATION LOCALIZATION FROM COUNTRY
CREATE OR REPLACE FUNCTION public.sync_organization_localization(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_country_id uuid;
  v_country_data record;
  v_result jsonb;
BEGIN
  -- Get the organization's country
  SELECT country_id INTO v_country_id
  FROM organizations
  WHERE id = p_organization_id;
  
  IF v_country_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No country assigned to organization');
  END IF;
  
  -- Get country localization data
  SELECT * INTO v_country_data
  FROM countries
  WHERE id = v_country_id;
  
  IF v_country_data IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Country not found');
  END IF;
  
  -- Update organization with country defaults (only if not already set)
  UPDATE organizations
  SET 
    currency = COALESCE(currency, v_country_data.default_currency),
    accounting_standard = COALESCE(accounting_standard, v_country_data.accounting_standard),
    invoice_date_format = COALESCE(invoice_date_format, v_country_data.date_format),
    localization_synced_at = now()
  WHERE id = p_organization_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'country', v_country_data.name,
    'currency', v_country_data.default_currency,
    'accounting_standard', v_country_data.accounting_standard,
    'tax_regime', v_country_data.tax_regime_type,
    'payroll_regime', v_country_data.payroll_regime_type
  );
END;
$$;

-- 5. CREATE FUNCTION TO BULK SYNC ALL ORGANIZATIONS
CREATE OR REPLACE FUNCTION public.sync_all_organizations_localization()
RETURNS TABLE(organization_id uuid, organization_name text, sync_result jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    public.sync_organization_localization(o.id)
  FROM organizations o
  WHERE o.country_id IS NOT NULL;
END;
$$;

-- 6. CREATE TRIGGER TO AUTO-SYNC ON COUNTRY CHANGE
CREATE OR REPLACE FUNCTION public.trigger_sync_org_localization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When country_id changes, sync localization
  IF NEW.country_id IS DISTINCT FROM OLD.country_id AND NEW.country_id IS NOT NULL THEN
    PERFORM public.sync_organization_localization(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_org_localization ON organizations;
CREATE TRIGGER trg_sync_org_localization
  AFTER UPDATE OF country_id ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_sync_org_localization();

-- 7. ADD MESSAGE NORMALIZATION HELPER FOR PHONE NUMBERS
CREATE OR REPLACE FUNCTION public.normalize_phone_e164(phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cleaned text;
BEGIN
  -- Remove all non-digit characters except leading +
  cleaned := regexp_replace(phone, '[^\d+]', '', 'g');
  
  -- Ensure E.164 format
  IF NOT cleaned LIKE '+%' THEN
    -- If 10 digits, assume North American
    IF length(cleaned) = 10 THEN
      cleaned := '+1' || cleaned;
    -- If 11 digits starting with 1, assume North American
    ELSIF length(cleaned) = 11 AND cleaned LIKE '1%' THEN
      cleaned := '+' || cleaned;
    ELSE
      cleaned := '+' || cleaned;
    END IF;
  END IF;
  
  RETURN cleaned;
END;
$$;

-- 8. UPDATE CONVERSATIONS TABLE TO ENSURE PROPER INDEXES
CREATE INDEX IF NOT EXISTS idx_conversations_contact_channel 
ON conversations(contact_identifier, channel);

CREATE INDEX IF NOT EXISTS idx_messages_to_identifier_channel 
ON messages(to_identifier, channel);

CREATE INDEX IF NOT EXISTS idx_messages_direction_channel_created 
ON messages(direction, channel, created_at DESC);

-- 9. SYNC ALL EXISTING ORGANIZATIONS NOW
DO $$
DECLARE
  org record;
BEGIN
  FOR org IN SELECT id FROM organizations WHERE country_id IS NOT NULL LOOP
    PERFORM public.sync_organization_localization(org.id);
  END LOOP;
END;
$$;