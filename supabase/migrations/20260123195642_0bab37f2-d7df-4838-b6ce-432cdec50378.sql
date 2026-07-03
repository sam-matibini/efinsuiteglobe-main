-- Update get_balance_sheet_data to use Statement of RE closing balance
-- Total Equity = Other Equity Accounts (excluding RE and CYE) + RE Closing Balance
-- RE Closing Balance already includes Net Income, so no double-counting

CREATE OR REPLACE FUNCTION public.get_balance_sheet_data(p_organization_id uuid, p_fiscal_year_start date, p_as_of_date date)
 RETURNS TABLE(total_assets numeric, total_liabilities numeric, total_equity numeric, net_income numeric, total_shareholders_equity numeric, total_liabilities_and_equity numeric, is_balanced boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_assets NUMERIC;
  v_liabilities NUMERIC;
  v_other_equity NUMERIC;
  v_net_income NUMERIC;
  v_re_closing NUMERIC;
  v_total_sh_equity NUMERIC;
  v_total_le NUMERIC;
BEGIN
  -- Calculate assets and liabilities
  v_assets := public.calculate_total_assets(p_organization_id, p_as_of_date);
  v_liabilities := public.calculate_total_liabilities(p_organization_id, p_as_of_date);
  
  -- Get net income for the period (for informational purposes)
  v_net_income := public.calculate_period_net_income(p_organization_id, p_fiscal_year_start, p_as_of_date);
  
  -- Get RE Closing Balance from Statement of Retained Earnings
  -- This already includes Net Income (Closing RE = Opening RE + Net Income - Dividends)
  SELECT res.closing_balance INTO v_re_closing
  FROM public.calculate_retained_earnings_statement(p_organization_id, p_fiscal_year_start, p_as_of_date) res;
  
  -- Calculate Other Equity Accounts (excluding RE and CYE)
  -- These are accounts like Share Capital, Reserves, etc.
  SELECT COALESCE(SUM(
    CASE WHEN a.normal_balance = 'credit' THEN 1 ELSE -1 END *
    (COALESCE(a.opening_balance, 0) + COALESCE(
      (SELECT SUM(
        CASE WHEN a.normal_balance = 'credit' 
             THEN jel2.credit - jel2.debit 
             ELSE jel2.debit - jel2.credit END
      )
      FROM journal_entry_lines jel2
      JOIN journal_entries je2 ON jel2.journal_entry_id = je2.id
      WHERE je2.status = 'posted' 
        AND jel2.account_id = a.id 
        AND je2.entry_date <= p_as_of_date
      ), 0))
  ), 0)
  INTO v_other_equity
  FROM accounts a
  WHERE a.organization_id = p_organization_id
    AND a.account_type = 'equity'
    AND a.is_header = false
    -- Exclude CYE bucket account (3-00-202) - handled by RE statement
    AND a.code != '3-00-202'
    AND NOT (a.name ILIKE '%current year earnings%')
    -- Exclude Retained Earnings account (3-00-201) - using RE statement closing balance
    AND a.code != '3-00-201'
    AND NOT (a.name ILIKE 'retained earnings')
    AND NOT (a.name ILIKE '%accumulated deficit%')
    AND NOT (a.equity_type = 'retained_earnings');
  
  -- Total Shareholders' Equity = Other Equity + RE Closing Balance
  -- RE Closing already includes Net Income, so no double-counting
  v_total_sh_equity := COALESCE(v_other_equity, 0) + COALESCE(v_re_closing, 0);
  
  -- Total L&E = Liabilities + Total Shareholders' Equity
  v_total_le := v_liabilities + v_total_sh_equity;
  
  RETURN QUERY SELECT 
    ROUND(v_assets, 2),
    ROUND(v_liabilities, 2),
    ROUND(v_other_equity, 2),  -- Returns other equity only (for reference)
    ROUND(v_net_income, 2),     -- Returns net income (for reference)
    ROUND(v_total_sh_equity, 2),
    ROUND(v_total_le, 2),
    (ABS(v_assets - v_total_le) < 0.01)::BOOLEAN;
END;
$function$;

-- Update validate_balance_sheet_equation to use the same formula
CREATE OR REPLACE FUNCTION public.validate_balance_sheet_equation(p_organization_id uuid, p_fiscal_year_start date, p_as_of_date date)
 RETURNS TABLE(is_balanced boolean, total_assets numeric, total_liabilities numeric, total_equity numeric, current_year_earnings numeric, total_liabilities_equity numeric, difference numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_assets NUMERIC;
  v_liabilities NUMERIC;
  v_other_equity NUMERIC;
  v_re_closing NUMERIC;
  v_net_income NUMERIC;
  v_total_sh_equity NUMERIC;
  v_le_total NUMERIC;
  v_diff NUMERIC;
BEGIN
  -- Calculate all components
  v_assets := public.calculate_total_assets(p_organization_id, p_as_of_date);
  v_liabilities := public.calculate_total_liabilities(p_organization_id, p_as_of_date);
  
  -- Net income for informational purposes
  v_net_income := public.calculate_period_net_income(p_organization_id, p_fiscal_year_start, p_as_of_date);
  
  -- Get RE Closing Balance from Statement of Retained Earnings
  SELECT res.closing_balance INTO v_re_closing
  FROM public.calculate_retained_earnings_statement(p_organization_id, p_fiscal_year_start, p_as_of_date) res;
  
  -- Calculate Other Equity Accounts (excluding RE and CYE)
  SELECT COALESCE(SUM(
    CASE WHEN a.normal_balance = 'credit' THEN 1 ELSE -1 END *
    (COALESCE(a.opening_balance, 0) + COALESCE(
      (SELECT SUM(
        CASE WHEN a.normal_balance = 'credit' 
             THEN jel2.credit - jel2.debit 
             ELSE jel2.debit - jel2.credit END
      )
      FROM journal_entry_lines jel2
      JOIN journal_entries je2 ON jel2.journal_entry_id = je2.id
      WHERE je2.status = 'posted' 
        AND jel2.account_id = a.id 
        AND je2.entry_date <= p_as_of_date
      ), 0))
  ), 0)
  INTO v_other_equity
  FROM accounts a
  WHERE a.organization_id = p_organization_id
    AND a.account_type = 'equity'
    AND a.is_header = false
    AND a.code != '3-00-202'
    AND NOT (a.name ILIKE '%current year earnings%')
    AND a.code != '3-00-201'
    AND NOT (a.name ILIKE 'retained earnings')
    AND NOT (a.name ILIKE '%accumulated deficit%')
    AND NOT (a.equity_type = 'retained_earnings');
  
  -- Total Shareholders' Equity = Other Equity + RE Closing Balance
  v_total_sh_equity := COALESCE(v_other_equity, 0) + COALESCE(v_re_closing, 0);
  
  -- Calculate L&E total
  v_le_total := v_liabilities + v_total_sh_equity;
  
  -- Calculate difference
  v_diff := ABS(v_assets - v_le_total);
  
  RETURN QUERY SELECT 
    (v_diff < 0.01)::BOOLEAN,
    ROUND(v_assets, 2),
    ROUND(v_liabilities, 2),
    ROUND(v_total_sh_equity, 2),  -- Now returns total equity (other + RE closing)
    ROUND(v_net_income, 2),       -- For reference (already included in RE closing)
    ROUND(v_le_total, 2),
    ROUND(v_diff, 2);
END;
$function$;

-- Add comment explaining the formula
COMMENT ON FUNCTION public.get_balance_sheet_data IS 
'Balance Sheet data using Statement of RE integration.
Total Equity = Other Equity Accounts (Share Capital, Reserves, etc.) + RE Closing Balance.
RE Closing Balance = Opening RE + Net Income - Dividends (from calculate_retained_earnings_statement).
This avoids double-counting Net Income since it is already included in RE Closing Balance.';