-- ============================================================================
-- SYSTEM-LEVEL DOUBLE-ENTRY INTEGRITY ENFORCEMENT
-- Ensures Trial Balance and Balance Sheet are ALWAYS balanced per GAAP/IFRS/ASPE
-- ============================================================================

-- 1. Create a function to recalculate account balance from journal entries
CREATE OR REPLACE FUNCTION public.recalculate_account_balance(p_account_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_opening_balance NUMERIC;
  v_normal_balance TEXT;
  v_total_debits NUMERIC;
  v_total_credits NUMERIC;
  v_calculated_balance NUMERIC;
BEGIN
  -- Get account properties
  SELECT 
    COALESCE(opening_balance, 0),
    normal_balance
  INTO v_opening_balance, v_normal_balance
  FROM accounts
  WHERE id = p_account_id;
  
  -- Sum all posted journal entry lines
  SELECT 
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0)
  INTO v_total_debits, v_total_credits
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE jel.account_id = p_account_id
    AND je.status = 'posted';
  
  -- Calculate balance based on normal balance type
  IF v_normal_balance = 'debit' THEN
    v_calculated_balance := v_opening_balance + v_total_debits - v_total_credits;
  ELSE
    v_calculated_balance := v_opening_balance + v_total_credits - v_total_debits;
  END IF;
  
  RETURN v_calculated_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Create a function to recalculate ALL account balances for an organization
CREATE OR REPLACE FUNCTION public.recalculate_all_account_balances(p_organization_id UUID DEFAULT NULL)
RETURNS TABLE(
  account_id UUID,
  account_code TEXT,
  account_name TEXT,
  old_balance NUMERIC,
  new_balance NUMERIC,
  difference NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH recalculated AS (
    SELECT 
      a.id,
      a.code,
      a.name,
      a.current_balance as old_bal,
      public.recalculate_account_balance(a.id) as new_bal
    FROM accounts a
    WHERE a.is_header = false
      AND a.is_active = true
      AND (p_organization_id IS NULL OR a.organization_id = p_organization_id)
  )
  UPDATE accounts acc
  SET current_balance = r.new_bal,
      updated_at = now()
  FROM recalculated r
  WHERE acc.id = r.id
  RETURNING r.id, r.code, r.name, r.old_bal, r.new_bal, (r.new_bal - COALESCE(r.old_bal, 0));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Create/replace the journal entry balance enforcement trigger
-- This ensures NO unbalanced entry can ever be posted
CREATE OR REPLACE FUNCTION public.enforce_balanced_journal_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_total_debits NUMERIC;
  v_total_credits NUMERIC;
  v_difference NUMERIC;
  v_entry_status TEXT;
  v_tolerance NUMERIC := 0.001; -- Allow for floating point tolerance
BEGIN
  -- Get the journal entry status
  SELECT status INTO v_entry_status
  FROM journal_entries
  WHERE id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
  
  -- Calculate totals for this journal entry
  SELECT 
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0)
  INTO v_total_debits, v_total_credits
  FROM journal_entry_lines
  WHERE journal_entry_id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
  
  v_difference := ABS(v_total_debits - v_total_credits);
  
  -- For posted entries, enforce strict balance
  IF v_entry_status = 'posted' AND v_difference > v_tolerance THEN
    RAISE EXCEPTION 'Double-entry violation: Journal entry is out of balance. Debits: %, Credits: %, Difference: %. GAAP/IFRS/ASPE requires debits = credits.',
      v_total_debits, v_total_credits, v_difference;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if it exists and recreate
DROP TRIGGER IF EXISTS enforce_balanced_journal_entry ON journal_entry_lines;

CREATE TRIGGER enforce_balanced_journal_entry
AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
FOR EACH ROW
EXECUTE FUNCTION public.enforce_balanced_journal_entry();

-- 4. Create a trigger to auto-update account balance when journal lines change
CREATE OR REPLACE FUNCTION public.auto_update_account_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_account_id UUID;
  v_entry_status TEXT;
BEGIN
  -- Determine which account was affected
  v_account_id := COALESCE(NEW.account_id, OLD.account_id);
  
  -- Get journal entry status
  SELECT status INTO v_entry_status
  FROM journal_entries
  WHERE id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
  
  -- Only update balance for posted entries
  IF v_entry_status = 'posted' THEN
    UPDATE accounts
    SET current_balance = public.recalculate_account_balance(v_account_id),
        updated_at = now()
    WHERE id = v_account_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if it exists and recreate
DROP TRIGGER IF EXISTS auto_update_account_balance ON journal_entry_lines;

CREATE TRIGGER auto_update_account_balance
AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
FOR EACH ROW
EXECUTE FUNCTION public.auto_update_account_balance();

-- 5. Create a trigger for when journal entry status changes to 'posted'
CREATE OR REPLACE FUNCTION public.on_journal_entry_posted()
RETURNS TRIGGER AS $$
BEGIN
  -- When entry becomes posted, recalculate all affected account balances
  IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted') THEN
    UPDATE accounts a
    SET current_balance = public.recalculate_account_balance(a.id),
        updated_at = now()
    WHERE a.id IN (
      SELECT DISTINCT account_id 
      FROM journal_entry_lines 
      WHERE journal_entry_id = NEW.id
    );
  END IF;
  
  -- When entry becomes reversed, recalculate all affected account balances
  IF NEW.status = 'reversed' AND OLD.status = 'posted' THEN
    UPDATE accounts a
    SET current_balance = public.recalculate_account_balance(a.id),
        updated_at = now()
    WHERE a.id IN (
      SELECT DISTINCT account_id 
      FROM journal_entry_lines 
      WHERE journal_entry_id = NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if it exists and recreate
DROP TRIGGER IF EXISTS on_journal_entry_posted ON journal_entries;

CREATE TRIGGER on_journal_entry_posted
AFTER UPDATE ON journal_entries
FOR EACH ROW
EXECUTE FUNCTION public.on_journal_entry_posted();

-- 6. Create a validation function to check trial balance
CREATE OR REPLACE FUNCTION public.validate_trial_balance(p_organization_id UUID)
RETURNS TABLE(
  is_balanced BOOLEAN,
  total_debits NUMERIC,
  total_credits NUMERIC,
  difference NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH account_balances AS (
    SELECT 
      a.id,
      a.account_type,
      a.normal_balance,
      COALESCE(a.current_balance, 0) as balance
    FROM accounts a
    WHERE a.organization_id = p_organization_id
      AND a.is_header = false
      AND a.is_active = true
  ),
  totals AS (
    SELECT
      SUM(CASE 
        WHEN normal_balance = 'debit' AND balance >= 0 THEN balance
        WHEN normal_balance = 'credit' AND balance < 0 THEN ABS(balance)
        ELSE 0 
      END) as debits,
      SUM(CASE 
        WHEN normal_balance = 'credit' AND balance >= 0 THEN balance
        WHEN normal_balance = 'debit' AND balance < 0 THEN ABS(balance)
        ELSE 0 
      END) as credits
    FROM account_balances
  )
  SELECT 
    (ABS(debits - credits) < 0.01) as is_balanced,
    debits as total_debits,
    credits as total_credits,
    (debits - credits) as difference
  FROM totals;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.recalculate_account_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_all_account_balances(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_trial_balance(UUID) TO authenticated;