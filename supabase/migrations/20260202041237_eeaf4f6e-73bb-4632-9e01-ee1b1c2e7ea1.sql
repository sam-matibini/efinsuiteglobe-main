-- Sync localization for organizations that are missing it
-- This uses the existing sync_organization_localization function via the trigger

-- Update organizations without localization_synced_at to trigger the sync
UPDATE public.organizations
SET updated_at = now()
WHERE localization_synced_at IS NULL
AND country_id IS NOT NULL;

-- Add time_format column to countries for 12/24 hour display preference
ALTER TABLE public.countries 
ADD COLUMN IF NOT EXISTS time_format VARCHAR(10) DEFAULT '24h';

-- Add default_timezone to countries for automatic timezone detection
ALTER TABLE public.countries
ADD COLUMN IF NOT EXISTS default_timezone VARCHAR(50);

-- Update time formats for known countries
UPDATE public.countries SET time_format = '12h', default_timezone = 'America/Toronto' WHERE code = 'CA';
UPDATE public.countries SET time_format = '12h', default_timezone = 'America/New_York' WHERE code = 'US';
UPDATE public.countries SET time_format = '24h', default_timezone = 'Europe/London' WHERE code = 'GB';
UPDATE public.countries SET time_format = '24h', default_timezone = 'Europe/Berlin' WHERE code = 'DE';
UPDATE public.countries SET time_format = '24h', default_timezone = 'Europe/Paris' WHERE code = 'FR';
UPDATE public.countries SET time_format = '12h', default_timezone = 'Australia/Sydney' WHERE code = 'AU';
UPDATE public.countries SET time_format = '12h', default_timezone = 'Asia/Kolkata' WHERE code = 'IN';
UPDATE public.countries SET time_format = '24h', default_timezone = 'Africa/Johannesburg' WHERE code = 'ZA';
UPDATE public.countries SET time_format = '12h', default_timezone = 'Africa/Lagos' WHERE code = 'NG';
UPDATE public.countries SET time_format = '12h', default_timezone = 'Africa/Accra' WHERE code = 'GH';
UPDATE public.countries SET time_format = '24h', default_timezone = 'Africa/Lusaka' WHERE code = 'ZM';
UPDATE public.countries SET time_format = '24h', default_timezone = 'Africa/Nairobi' WHERE code = 'KE';
UPDATE public.countries SET time_format = '24h', default_timezone = 'Africa/Bujumbura' WHERE code = 'BI';
UPDATE public.countries SET time_format = '24h', default_timezone = 'Africa/Kampala' WHERE code = 'UG';
UPDATE public.countries SET time_format = '12h', default_timezone = 'Asia/Dubai' WHERE code = 'AE';
UPDATE public.countries SET time_format = '12h', default_timezone = 'Asia/Riyadh' WHERE code = 'SA';

-- Add localization preferences to organizations table
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS date_format VARCHAR(20),
ADD COLUMN IF NOT EXISTS number_format VARCHAR(20),
ADD COLUMN IF NOT EXISTS time_format VARCHAR(10) DEFAULT '24h',
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50);

-- Update the sync function to include new fields
CREATE OR REPLACE FUNCTION public.sync_organization_localization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Only sync if country_id changed and is not null
  IF NEW.country_id IS DISTINCT FROM OLD.country_id AND NEW.country_id IS NOT NULL THEN
    UPDATE public.organizations o
    SET 
      currency = COALESCE(o.currency, c.default_currency),
      accounting_standard = COALESCE(o.accounting_standard, c.accounting_standard),
      fiscal_year_end_month = COALESCE(o.fiscal_year_end_month, c.default_fiscal_month),
      date_format = COALESCE(o.date_format, c.date_format),
      number_format = COALESCE(o.number_format, c.number_format),
      time_format = COALESCE(o.time_format, c.time_format),
      timezone = COALESCE(o.timezone, c.default_timezone),
      primary_country_id = COALESCE(o.primary_country_id, NEW.country_id),
      localization_synced_at = now()
    FROM public.countries c
    WHERE c.id = NEW.country_id
    AND o.id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS trg_sync_org_localization ON public.organizations;
CREATE TRIGGER trg_sync_org_localization
  AFTER UPDATE OF country_id ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_organization_localization();

-- Backfill localization for existing organizations with country_id
UPDATE public.organizations o
SET 
  date_format = COALESCE(o.date_format, c.date_format),
  number_format = COALESCE(o.number_format, c.number_format),
  time_format = COALESCE(o.time_format, c.time_format),
  timezone = COALESCE(o.timezone, c.default_timezone),
  localization_synced_at = now()
FROM public.countries c
WHERE c.id = o.country_id
AND o.localization_synced_at IS NULL;