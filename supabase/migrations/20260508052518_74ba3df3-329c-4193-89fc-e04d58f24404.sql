
CREATE OR REPLACE FUNCTION public.enforce_balanced_journal_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_debits NUMERIC;
  v_total_credits NUMERIC;
  v_total_base_debits NUMERIC;
  v_total_base_credits NUMERIC;
  v_difference NUMERIC;
  v_base_difference NUMERIC;
  v_entry_status TEXT;
  v_tolerance NUMERIC := 0.02; -- 2 cents
BEGIN
  SELECT status INTO v_entry_status
  FROM journal_entries
  WHERE id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);

  SELECT
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0),
    COALESCE(SUM(base_currency_debit), 0),
    COALESCE(SUM(base_currency_credit), 0)
  INTO v_total_debits, v_total_credits, v_total_base_debits, v_total_base_credits
  FROM journal_entry_lines
  WHERE journal_entry_id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);

  v_difference := ABS(v_total_debits - v_total_credits);
  v_base_difference := ABS(v_total_base_debits - v_total_base_credits);

  -- For posted entries, require balance in BASE currency (multi-currency aware).
  -- Raw debit/credit may differ across legs of cross-currency JEs; that's fine.
  IF v_entry_status = 'posted' AND v_base_difference > v_tolerance THEN
    RAISE EXCEPTION 'Double-entry violation: Journal entry is out of balance in base currency. Base Debits: %, Base Credits: %, Difference: %.',
      v_total_base_debits, v_total_base_credits, v_base_difference;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;
