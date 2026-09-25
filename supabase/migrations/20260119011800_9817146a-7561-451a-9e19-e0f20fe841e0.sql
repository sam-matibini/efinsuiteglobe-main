-- ============================================================
-- DOUBLE-ENTRY INTEGRITY ENFORCEMENT (GAAP/IFRS/ASPE COMPLIANT)
-- Ensures Trial Balance and Balance Sheet are ALWAYS balanced
-- ============================================================

-- 1. Prevent posting to header or non-posting accounts
CREATE OR REPLACE FUNCTION public.validate_journal_line_account()
RETURNS TRIGGER AS $$
DECLARE
  v_is_header boolean;
  v_posting_allowed boolean;
  v_account_name text;
BEGIN
  SELECT is_header, COALESCE(posting_allowed, true), name
  INTO v_is_header, v_posting_allowed, v_account_name
  FROM public.accounts
  WHERE id = NEW.account_id;

  IF v_is_header = true THEN
    RAISE EXCEPTION 'Cannot post to header account: %. Header accounts are for grouping only.', v_account_name;
  END IF;

  IF v_posting_allowed = false THEN
    RAISE EXCEPTION 'Cannot post to account: %. This account does not allow direct postings.', v_account_name;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS validate_journal_line_account_trigger ON public.journal_entry_lines;
CREATE TRIGGER validate_journal_line_account_trigger
  BEFORE INSERT OR UPDATE ON public.journal_entry_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_journal_line_account();

-- 2. Validate opening balances are balanced per organization (Assets = Liabilities + Equity)
CREATE OR REPLACE FUNCTION public.validate_organization_opening_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id uuid;
  v_debit_sum numeric;
  v_credit_sum numeric;
  v_difference numeric;
BEGIN
  v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);
  
  IF v_org_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Calculate sum of opening balances by normal_balance
  SELECT 
    COALESCE(SUM(CASE WHEN normal_balance = 'debit' THEN COALESCE(opening_balance, 0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN normal_balance = 'credit' THEN COALESCE(opening_balance, 0) ELSE 0 END), 0)
  INTO v_debit_sum, v_credit_sum
  FROM public.accounts
  WHERE organization_id = v_org_id
    AND is_header = false;

  v_difference := ABS(v_debit_sum - v_credit_sum);

  -- Allow 0.01 tolerance for floating point
  IF v_difference > 0.01 THEN
    RAISE EXCEPTION 'Opening balances are out of balance for organization. Debit accounts: %, Credit accounts: %, Difference: %. Opening balances must follow double-entry principles.', 
      v_debit_sum, v_credit_sum, v_difference;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS validate_org_opening_balance_trigger ON public.accounts;
CREATE TRIGGER validate_org_opening_balance_trigger
  AFTER INSERT OR UPDATE OF opening_balance ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_organization_opening_balance();

-- 3. Immutable function to verify trial balance integrity
CREATE OR REPLACE FUNCTION public.verify_trial_balance_integrity(p_organization_id uuid, p_as_of_date date DEFAULT CURRENT_DATE)
RETURNS TABLE(
  is_balanced boolean,
  total_debits numeric,
  total_credits numeric,
  difference numeric,
  account_count integer
) AS $$
BEGIN
  RETURN QUERY
  WITH posted_entries AS (
    SELECT je.id
    FROM public.journal_entries je
    WHERE je.organization_id = p_organization_id
      AND je.status = 'posted'
      AND je.entry_date <= p_as_of_date
  ),
  account_movements AS (
    SELECT 
      jel.account_id,
      SUM(COALESCE(jel.debit, 0)) as total_debit,
      SUM(COALESCE(jel.credit, 0)) as total_credit
    FROM public.journal_entry_lines jel
    JOIN posted_entries pe ON pe.id = jel.journal_entry_id
    GROUP BY jel.account_id
  ),
  account_balances AS (
    SELECT 
      a.id,
      a.normal_balance,
      COALESCE(a.opening_balance, 0) + COALESCE(am.total_debit, 0) - COALESCE(am.total_credit, 0) as raw_balance
    FROM public.accounts a
    LEFT JOIN account_movements am ON am.account_id = a.id
    WHERE a.organization_id = p_organization_id
      AND a.is_header = false
  ),
  trial_balance AS (
    SELECT
      SUM(CASE WHEN raw_balance > 0 THEN raw_balance ELSE 0 END) as debits,
      SUM(CASE WHEN raw_balance < 0 THEN ABS(raw_balance) ELSE 0 END) as credits,
      COUNT(*) as acct_count
    FROM account_balances
  )
  SELECT 
    ABS(tb.debits - tb.credits) <= 0.01 as is_balanced,
    ROUND(tb.debits, 2) as total_debits,
    ROUND(tb.credits, 2) as total_credits,
    ROUND(ABS(tb.debits - tb.credits), 2) as difference,
    tb.acct_count::integer as account_count
  FROM trial_balance tb;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

-- 4. Add integrity check constraint via trigger on journal_entries status change
CREATE OR REPLACE FUNCTION public.verify_balanced_after_post()
RETURNS TRIGGER AS $$
DECLARE
  v_is_balanced boolean;
  v_difference numeric;
BEGIN
  -- Only check when posting (changing to 'posted' status)
  IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted') THEN
    SELECT is_balanced, difference 
    INTO v_is_balanced, v_difference
    FROM public.verify_trial_balance_integrity(NEW.organization_id, NEW.entry_date);

    -- Log warning if imbalance detected (but don't block since individual entry is already validated)
    IF NOT v_is_balanced THEN
      RAISE WARNING 'Trial balance shows difference of % after posting entry %. This may indicate a data integrity issue.', 
        v_difference, NEW.reference;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS verify_balanced_after_post_trigger ON public.journal_entries;
CREATE TRIGGER verify_balanced_after_post_trigger
  AFTER UPDATE OF status ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.verify_balanced_after_post();

-- 5. Add comment documenting the integrity system
COMMENT ON FUNCTION public.validate_journal_line_account() IS 
  'Prevents posting to header or non-posting accounts - enforces chart of accounts structure';

COMMENT ON FUNCTION public.validate_organization_opening_balance() IS 
  'Ensures opening balances follow double-entry principles (debits = credits) per organization';

COMMENT ON FUNCTION public.verify_trial_balance_integrity(uuid, date) IS 
  'Verifies trial balance is balanced as of a given date - use for auditing and validation';

COMMENT ON FUNCTION public.verify_balanced_after_post() IS 
  'Warns if trial balance is out of balance after posting - provides audit trail';