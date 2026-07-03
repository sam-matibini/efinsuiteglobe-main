-- ============================================================================
-- FIX: calculate_period_net_income - CONTRA-ACCOUNT HANDLING (GAAP/ASPE/IFRS)
-- ============================================================================
-- Issue: Contra-revenue (Sales Discounts, Sales Returns) and Contra-expense 
-- (Purchase Discounts) accounts were not being handled correctly.
--
-- GAAP/ASPE Compliant Logic:
-- - Income accounts (credit-normal): ADD to net income
-- - Contra-revenue (debit-normal income): SUBTRACT from net income  
-- - Expense accounts (debit-normal): SUBTRACT from net income
-- - Contra-expense (credit-normal expense): ADD back to net income
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_period_net_income(p_organization_id uuid, p_start_date date, p_end_date date)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_net_income NUMERIC;
BEGIN
  /**
   * CONTRA-ACCOUNT HANDLING (GAAP/ASPE/IFRS Compliant)
   * ==================================================
   * 
   * For INCOME accounts:
   * - Credit-normal (Sales Revenue): positive balance adds to income
   * - Debit-normal (Sales Discounts, Returns & Allowances): positive balance SUBTRACTS
   *
   * For EXPENSE accounts:
   * - Debit-normal (most expenses): positive balance subtracts from income
   * - Credit-normal (Purchase Discounts): positive balance adds back to income
   *
   * This ensures Net Income = Net Revenue - Net Expenses
   * where Net Revenue = Gross Revenue - Contra-Revenue
   * and Net Expenses = Gross Expenses - Contra-Expenses
   */
  SELECT 
    COALESCE(SUM(
      CASE 
        -- INCOME: Credit-normal adds, Debit-normal (contra) subtracts
        WHEN a.account_type = 'income' THEN 
          CASE WHEN a.normal_balance = 'credit' 
               THEN jel.credit - jel.debit  -- Normal income: add
               ELSE -(jel.debit - jel.credit) -- Contra-revenue: subtract
          END
        -- EXPENSE: Debit-normal subtracts, Credit-normal (contra) adds back
        WHEN a.account_type = 'expense' THEN 
          CASE WHEN a.normal_balance = 'debit' 
               THEN -(jel.debit - jel.credit)  -- Normal expense: subtract from income
               ELSE jel.credit - jel.debit     -- Contra-expense: add back to income
          END
        ELSE 0
      END
    ), 0)
  INTO v_net_income
  FROM journal_entry_lines jel
  JOIN journal_entries je ON jel.journal_entry_id = je.id
  JOIN accounts a ON jel.account_id = a.id
  WHERE je.organization_id = p_organization_id
    AND je.status = 'posted'
    AND je.entry_date >= p_start_date
    AND je.entry_date <= p_end_date
    AND je.reference NOT LIKE 'CLOSE-%'  -- Exclude closing entries
    AND a.account_type IN ('income', 'expense')
    AND a.is_header = false;
  
  RETURN v_net_income;
END;
$function$;