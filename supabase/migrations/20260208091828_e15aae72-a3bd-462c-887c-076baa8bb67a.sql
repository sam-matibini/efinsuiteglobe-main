-- Add localization preference columns to organizations table
-- These will be synced from countries defaults when country_id is set

-- Add timezone column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'organizations' 
                 AND column_name = 'timezone') THEN
    ALTER TABLE public.organizations ADD COLUMN timezone VARCHAR(100);
  END IF;
END $$;

-- Add date_format column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'organizations' 
                 AND column_name = 'date_format') THEN
    ALTER TABLE public.organizations ADD COLUMN date_format VARCHAR(50);
  END IF;
END $$;

-- Add number_format column if not exists  
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'organizations' 
                 AND column_name = 'number_format') THEN
    ALTER TABLE public.organizations ADD COLUMN number_format VARCHAR(50);
  END IF;
END $$;

-- Add time_format column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'organizations' 
                 AND column_name = 'time_format') THEN
    ALTER TABLE public.organizations ADD COLUMN time_format VARCHAR(20);
  END IF;
END $$;

-- Add locale column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'organizations' 
                 AND column_name = 'locale') THEN
    ALTER TABLE public.organizations ADD COLUMN locale VARCHAR(10);
  END IF;
END $$;

-- Update or create the sync_organization_localization function to copy country defaults
CREATE OR REPLACE FUNCTION public.sync_organization_localization()
RETURNS TRIGGER AS $$
DECLARE
  v_country RECORD;
BEGIN
  -- Only sync when country_id changes (is set or updated)
  IF NEW.country_id IS NOT NULL AND (OLD.country_id IS NULL OR NEW.country_id != OLD.country_id) THEN
    SELECT 
      date_format,
      number_format,
      time_format,
      default_timezone,
      default_currency
    INTO v_country
    FROM public.countries
    WHERE id = NEW.country_id;
    
    IF FOUND THEN
      -- Only update if not already set (don't override user preferences)
      IF NEW.date_format IS NULL THEN
        NEW.date_format := v_country.date_format;
      END IF;
      IF NEW.number_format IS NULL THEN
        NEW.number_format := v_country.number_format;
      END IF;
      IF NEW.time_format IS NULL THEN
        NEW.time_format := v_country.time_format;
      END IF;
      IF NEW.timezone IS NULL THEN
        NEW.timezone := v_country.default_timezone;
      END IF;
      IF NEW.currency IS NULL THEN
        NEW.currency := v_country.default_currency;
      END IF;
      
      NEW.localization_synced_at := NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger if it doesn't exist
DROP TRIGGER IF EXISTS trigger_sync_organization_localization ON public.organizations;
CREATE TRIGGER trigger_sync_organization_localization
  BEFORE INSERT OR UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_organization_localization();

-- Add language support columns to countries table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'countries' 
                 AND column_name = 'default_locale') THEN
    ALTER TABLE public.countries ADD COLUMN default_locale VARCHAR(10);
  END IF;
END $$;

-- Update countries with common locale defaults
UPDATE public.countries SET default_locale = 'en-US' WHERE code = 'US' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'en-CA' WHERE code = 'CA' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'en-GB' WHERE code = 'GB' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'en-AU' WHERE code = 'AU' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'fr-CA' WHERE code = 'CA' AND default_locale IS NULL AND name ILIKE '%quebec%';
UPDATE public.countries SET default_locale = 'fr-FR' WHERE code = 'FR' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'de-DE' WHERE code = 'DE' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'es-MX' WHERE code = 'MX' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'es-ES' WHERE code = 'ES' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'pt-BR' WHERE code = 'BR' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'ja-JP' WHERE code = 'JP' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'zh-CN' WHERE code = 'CN' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'ko-KR' WHERE code = 'KR' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'hi-IN' WHERE code = 'IN' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'ar-SA' WHERE code = 'SA' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'ar-AE' WHERE code = 'AE' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'en-NG' WHERE code = 'NG' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'en-KE' WHERE code = 'KE' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'en-UG' WHERE code = 'UG' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'en-ZA' WHERE code = 'ZA' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'en-GH' WHERE code = 'GH' AND default_locale IS NULL;