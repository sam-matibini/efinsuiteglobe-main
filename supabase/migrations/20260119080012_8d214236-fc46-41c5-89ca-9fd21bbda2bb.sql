
-- Fix the validate_journal_entry_balance trigger function to only validate POSTED entries
-- This allows draft entries to be temporarily unbalanced during multi-step insertion

CREATE OR REPLACE FUNCTION public.validate_journal_entry_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  total_debits NUMERIC;
  total_credits NUMERIC;
  v_entry_status TEXT;
BEGIN
  -- Get the journal entry status
  SELECT status INTO v_entry_status
  FROM public.journal_entries
  WHERE id = NEW.journal_entry_id;
  
  -- Only validate balance for POSTED entries
  -- Draft entries can be temporarily unbalanced during multi-step creation
  IF v_entry_status = 'posted' THEN
    -- Calculate sum of debits and credits for this journal entry
    SELECT 
      COALESCE(SUM(debit), 0),
      COALESCE(SUM(credit), 0)
    INTO total_debits, total_credits
    FROM public.journal_entry_lines
    WHERE journal_entry_id = NEW.journal_entry_id;

    -- Check if debits equal credits (allowing for small floating point differences)
    IF ABS(total_debits - total_credits) > 0.01 THEN
      RAISE EXCEPTION 'Journal entry is not balanced. Total debits (%) must equal total credits (%)',
        total_debits, total_credits;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.validate_journal_entry_balance() IS 
'Validates that posted journal entries have balanced debits and credits. 
Draft entries are exempt to allow multi-step insertion patterns like fiscal year close.'
