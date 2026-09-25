-- Create a trigger function to enforce balanced journal entries
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
$$ LANGUAGE plpgsql;

-- Create trigger on journal_entry_lines to check balance after each modification
DROP TRIGGER IF EXISTS check_journal_balance_on_line_change ON public.journal_entry_lines;
CREATE TRIGGER check_journal_balance_on_line_change
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_entry_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_balanced_journal_entry();

-- Create a function to validate journal entry before posting
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
$$ LANGUAGE plpgsql STABLE;

-- Add a comment explaining the enforcement
COMMENT ON FUNCTION public.enforce_balanced_journal_entry() IS 
  'Enforces double-entry accounting by rejecting any journal entry line changes that would result in unbalanced debits and credits';