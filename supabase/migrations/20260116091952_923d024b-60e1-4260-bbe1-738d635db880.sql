-- Fix the enforce_balanced_journal_entry function to set search_path
CREATE OR REPLACE FUNCTION public.enforce_balanced_journal_entry()
RETURNS TRIGGER AS $$
DECLARE
  total_debits NUMERIC;
  total_credits NUMERIC;
  difference NUMERIC;
BEGIN
  -- Calculate totals for the journal entry
  SELECT 
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0)
  INTO total_debits, total_credits
  FROM public.journal_entry_lines
  WHERE journal_entry_id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
  
  difference := ABS(total_debits - total_credits);
  
  -- Allow a tiny tolerance for floating point (0.001 = 0.1 cent)
  IF difference > 0.001 THEN
    RAISE EXCEPTION 'Journal entry is not balanced. Debits: %, Credits: %, Difference: %', 
      total_debits, total_credits, difference;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Fix the validate_journal_entry_balance function to set search_path
CREATE OR REPLACE FUNCTION public.validate_journal_entry_balance(p_journal_entry_id UUID)
RETURNS TABLE(is_balanced BOOLEAN, total_debits NUMERIC, total_credits NUMERIC, difference NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ABS(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)) <= 0.001 AS is_balanced,
    COALESCE(SUM(jel.debit), 0) AS total_debits,
    COALESCE(SUM(jel.credit), 0) AS total_credits,
    ABS(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)) AS difference
  FROM public.journal_entry_lines jel
  WHERE jel.journal_entry_id = p_journal_entry_id;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

-- Fix update_updated_at_column to set search_path  
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;