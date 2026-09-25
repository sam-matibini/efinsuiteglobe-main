-- Add language column to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS language character varying DEFAULT 'en';

-- Add comment
COMMENT ON COLUMN public.organizations.language IS 'ISO 639-1 language code (e.g., en, fr, es, ar)';

-- Add new countries (Turkey, Romania, Hungary, Greece, Croatia, Ukraine, Pakistan, Bangladesh, Sri Lanka, Nepal)
INSERT INTO public.countries (code, code_alpha3, name, default_currency, accounting_standard, fiscal_year_type, default_fiscal_month, tax_regime_type, phone_code, date_format, number_format, time_format, default_timezone, default_locale, is_active)
VALUES
  ('TR', 'TUR', 'Turkey', 'TRY', 'TFRS', 'calendar', 12, 'vat', '+90', 'DD/MM/YYYY', '1.234,56', '24h', 'Europe/Istanbul', 'tr-TR', true),
  ('RO', 'ROU', 'Romania', 'RON', 'IFRS', 'calendar', 12, 'vat', '+40', 'DD.MM.YYYY', '1.234,56', '24h', 'Europe/Bucharest', 'ro-RO', true),
  ('HU', 'HUN', 'Hungary', 'HUF', 'IFRS', 'calendar', 12, 'vat', '+36', 'YYYY.MM.DD', '1 234,56', '24h', 'Europe/Budapest', 'hu-HU', true),
  ('GR', 'GRC', 'Greece', 'EUR', 'IFRS', 'calendar', 12, 'vat', '+30', 'DD/MM/YYYY', '1.234,56', '24h', 'Europe/Athens', 'el-GR', true),
  ('HR', 'HRV', 'Croatia', 'EUR', 'IFRS', 'calendar', 12, 'vat', '+385', 'DD.MM.YYYY', '1.234,56', '24h', 'Europe/Zagreb', 'hr-HR', true),
  ('UA', 'UKR', 'Ukraine', 'UAH', 'IFRS', 'calendar', 12, 'vat', '+380', 'DD.MM.YYYY', '1 234,56', '24h', 'Europe/Kiev', 'uk-UA', true),
  ('PK', 'PAK', 'Pakistan', 'PKR', 'IFRS', 'custom', 6, 'sales_tax', '+92', 'DD/MM/YYYY', '1,234.56', '12h', 'Asia/Karachi', 'ur-PK', true),
  ('BD', 'BGD', 'Bangladesh', 'BDT', 'IFRS', 'custom', 6, 'vat', '+880', 'DD/MM/YYYY', '1,234.56', '12h', 'Asia/Dhaka', 'bn-BD', true),
  ('LK', 'LKA', 'Sri Lanka', 'LKR', 'IFRS', 'custom', 3, 'vat', '+94', 'DD/MM/YYYY', '1,234.56', '24h', 'Asia/Colombo', 'si-LK', true),
  ('NP', 'NPL', 'Nepal', 'NPR', 'NAS', 'custom', 7, 'vat', '+977', 'DD/MM/YYYY', '1,234.56', '24h', 'Asia/Kathmandu', 'ne-NP', true)
ON CONFLICT (code) DO NOTHING;

-- Fill missing default_locale for existing countries
UPDATE public.countries SET default_locale = 'es-AR' WHERE code = 'AR' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'de-AT' WHERE code = 'AT' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'fr-BE' WHERE code = 'BE' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'ar-BH' WHERE code = 'BH' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'fr-BI' WHERE code = 'BI' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'de-CH' WHERE code = 'CH' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'es-CL' WHERE code = 'CL' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'es-CO' WHERE code = 'CO' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'cs-CZ' WHERE code = 'CZ' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'da-DK' WHERE code = 'DK' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'ar-EG' WHERE code = 'EG' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'am-ET' WHERE code = 'ET' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'fi-FI' WHERE code = 'FI' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'zh-HK' WHERE code = 'HK' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'id-ID' WHERE code = 'ID' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'en-IE' WHERE code = 'IE' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'he-IL' WHERE code = 'IL' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'it-IT' WHERE code = 'IT' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'ar-KW' WHERE code = 'KW' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'fr-MA' WHERE code = 'MA' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'ms-MY' WHERE code = 'MY' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'nl-NL' WHERE code = 'NL' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'nb-NO' WHERE code = 'NO' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'en-NZ' WHERE code = 'NZ' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'ar-OM' WHERE code = 'OM' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'es-PE' WHERE code = 'PE' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'en-PH' WHERE code = 'PH' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'pl-PL' WHERE code = 'PL' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'pt-PT' WHERE code = 'PT' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'ar-QA' WHERE code = 'QA' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'rw-RW' WHERE code = 'RW' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'sv-SE' WHERE code = 'SE' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'en-SG' WHERE code = 'SG' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'th-TH' WHERE code = 'TH' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'sw-TZ' WHERE code = 'TZ' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'vi-VN' WHERE code = 'VN' AND default_locale IS NULL;
UPDATE public.countries SET default_locale = 'en-ZM' WHERE code = 'ZM' AND default_locale IS NULL;

-- Update the sync trigger to also sync language from locale
CREATE OR REPLACE FUNCTION public.sync_organization_localization()
RETURNS TRIGGER AS $$
DECLARE
  country_rec RECORD;
BEGIN
  IF NEW.primary_country_id IS NOT NULL AND (OLD IS NULL OR NEW.primary_country_id IS DISTINCT FROM OLD.primary_country_id) THEN
    SELECT date_format, number_format, time_format, default_timezone, default_locale
    INTO country_rec
    FROM public.countries
    WHERE id = NEW.primary_country_id;
    
    IF FOUND THEN
      IF NEW.date_format IS NULL OR OLD IS NULL OR NEW.primary_country_id IS DISTINCT FROM OLD.primary_country_id THEN
        NEW.date_format := COALESCE(country_rec.date_format, NEW.date_format);
      END IF;
      IF NEW.number_format IS NULL OR OLD IS NULL OR NEW.primary_country_id IS DISTINCT FROM OLD.primary_country_id THEN
        NEW.number_format := COALESCE(country_rec.number_format, NEW.number_format);
      END IF;
      IF NEW.time_format IS NULL OR OLD IS NULL OR NEW.primary_country_id IS DISTINCT FROM OLD.primary_country_id THEN
        NEW.time_format := COALESCE(country_rec.time_format, NEW.time_format);
      END IF;
      IF NEW.timezone IS NULL OR OLD IS NULL OR NEW.primary_country_id IS DISTINCT FROM OLD.primary_country_id THEN
        NEW.timezone := COALESCE(country_rec.default_timezone, NEW.timezone);
      END IF;
      IF NEW.locale IS NULL OR OLD IS NULL OR NEW.primary_country_id IS DISTINCT FROM OLD.primary_country_id THEN
        NEW.locale := COALESCE(country_rec.default_locale, NEW.locale);
      END IF;
      -- Derive language from locale (first 2 chars)
      IF NEW.language IS NULL OR NEW.language = 'en' THEN
        IF country_rec.default_locale IS NOT NULL THEN
          NEW.language := LEFT(country_rec.default_locale, 2);
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;