
-- Fix: Include 'reversed' status entries in balance calculation
-- so that original + reversing entries net to zero correctly.
CREATE OR REPLACE FUNCTION public.recalculate_account_balance(p_account_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opening_balance NUMERIC;
  v_normal_balance TEXT;
  v_total_debits NUMERIC;
  v_total_credits NUMERIC;
  v_calculated_balance NUMERIC;
BEGIN
  SELECT 
    COALESCE(opening_balance, 0),
    normal_balance
  INTO v_opening_balance, v_normal_balance
  FROM accounts
  WHERE id = p_account_id;
  
  -- Include both 'posted' and 'reversed' entries
  -- Reversed entries must be counted so their lines + the reversing entry's lines net to zero
  SELECT 
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0)
  INTO v_total_debits, v_total_credits
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE jel.account_id = p_account_id
    AND je.status IN ('posted', 'reversed');
  
  IF v_normal_balance = 'debit' THEN
    v_calculated_balance := v_opening_balance + v_total_debits - v_total_credits;
  ELSE
    v_calculated_balance := v_opening_balance + v_total_credits - v_total_debits;
  END IF;
  
  RETURN v_calculated_balance;
END;
$$;
