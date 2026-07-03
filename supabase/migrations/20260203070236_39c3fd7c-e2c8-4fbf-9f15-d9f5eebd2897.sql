-- Add default_accounting_framework column to organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS default_accounting_framework TEXT DEFAULT 'ASPE';

-- Create function to sync accounting framework based on industry
CREATE OR REPLACE FUNCTION public.sync_accounting_framework()
RETURNS TRIGGER AS $$
BEGIN
  -- Set framework based on industry
  IF NEW.industry IN ('charity', 'npo', 'religious') THEN
    NEW.default_accounting_framework := 'ASNPO';
  ELSIF NEW.industry IN ('banking', 'insurance', 'energy', 'telecommunications', 'aerospace', 'mining', 'pharmaceuticals', 'biotech', 'fintech', 'venture_capital') THEN
    NEW.default_accounting_framework := 'IFRS';
  ELSE
    NEW.default_accounting_framework := 'ASPE';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-set framework on insert/update
DROP TRIGGER IF EXISTS sync_accounting_framework_trigger ON public.organizations;
CREATE TRIGGER sync_accounting_framework_trigger
  BEFORE INSERT OR UPDATE OF industry ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_accounting_framework();

-- Update existing organizations based on their industry
UPDATE public.organizations
SET default_accounting_framework = CASE
  WHEN industry IN ('charity', 'npo', 'religious') THEN 'ASNPO'
  WHEN industry IN ('banking', 'insurance', 'energy', 'telecommunications', 'aerospace', 'mining', 'pharmaceuticals', 'biotech', 'fintech', 'venture_capital') THEN 'IFRS'
  ELSE 'ASPE'
END;