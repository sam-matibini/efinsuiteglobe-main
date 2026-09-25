-- Fix security warning: Set search_path on the sync_accounting_framework function
CREATE OR REPLACE FUNCTION public.sync_accounting_framework()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;