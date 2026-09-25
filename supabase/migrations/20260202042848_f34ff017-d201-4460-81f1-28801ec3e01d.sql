-- Add ASNPO as a valid accounting framework option for compilation reports
-- This supports Canadian Not-for-Profit Organizations following ASNPO standards

-- First, let's check and update the accounting_framework column constraint if it exists
-- The column is TEXT type, so we just need to ensure ASNPO values are accepted

-- Add a comment to document the valid values
COMMENT ON COLUMN public.compilation_reports.accounting_framework IS 
  'Accounting framework used for this report. Valid values: ASPE (Accounting Standards for Private Enterprises), IFRS (International Financial Reporting Standards), ASNPO (Accounting Standards for Not-for-Profit Organizations)';

-- Update organizations table to track if organization uses ASNPO (for NPO/charity industries)
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS default_accounting_framework TEXT DEFAULT 'ASPE';

COMMENT ON COLUMN public.organizations.default_accounting_framework IS 
  'Default accounting framework for the organization. ASPE for private enterprises, ASNPO for NPOs/charities, IFRS for public/international entities';

-- Create a function to auto-set accounting framework based on industry
CREATE OR REPLACE FUNCTION public.sync_organization_accounting_framework()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-set ASNPO for NPO and charity industries
  IF NEW.industry IN ('npo', 'charity') AND (OLD.industry IS NULL OR OLD.industry != NEW.industry) THEN
    NEW.default_accounting_framework := 'ASNPO';
  -- Auto-set ASPE for other Canadian private enterprises (if not already set)
  ELSIF NEW.default_accounting_framework IS NULL THEN
    NEW.default_accounting_framework := 'ASPE';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-set framework on industry change
DROP TRIGGER IF EXISTS trigger_sync_accounting_framework ON public.organizations;
CREATE TRIGGER trigger_sync_accounting_framework
  BEFORE INSERT OR UPDATE OF industry ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_organization_accounting_framework();

-- Backfill existing NPO/charity organizations with ASNPO framework
UPDATE public.organizations
SET default_accounting_framework = 'ASNPO'
WHERE industry IN ('npo', 'charity')
  AND (default_accounting_framework IS NULL OR default_accounting_framework = 'ASPE');

-- Backfill other organizations with ASPE if not set
UPDATE public.organizations
SET default_accounting_framework = 'ASPE'
WHERE default_accounting_framework IS NULL;