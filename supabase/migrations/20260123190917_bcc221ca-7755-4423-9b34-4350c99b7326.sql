
-- Update the calculate_retained_earnings_statement function to explicitly handle first fiscal year
-- Opening balance MUST be zero if this is the first year of journal entry data for the organization
CREATE OR REPLACE FUNCTION public.calculate_retained_earnings_statement(
  p_organization_id UUID,
  p_fiscal_year_start DATE,
  p_fiscal_year_end DATE
)
RETURNS TABLE (
  opening_balance NUMERIC,
  net_income_loss NUMERIC,
  other_additions NUMERIC,
  dividends_declared NUMERIC,
  other_deductions NUMERIC,
  closing_balance NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opening_balance NUMERIC := 0;
  v_net_income NUMERIC := 0;
  v_dividends NUMERIC := 0;
  v_other_additions NUMERIC := 0;
  v_other_deductions NUMERIC := 0;
  v_fiscal_year INTEGER;
  v_first_data_year INTEGER;
BEGIN
  v_fiscal_year := EXTRACT(YEAR FROM p_fiscal_year_end);
  
  -- Determine the first year of journal entry data for this organization
  -- This ensures opening balance is zero for the first year of operations
  SELECT MIN(EXTRACT(YEAR FROM je.entry_date))::INTEGER
  INTO v_first_data_year
  FROM journal_entries je
  WHERE je.organization_id = p_organization_id
    AND je.status = 'posted';
  
  -- If this is the first year of data (or before), opening balance MUST be zero
  -- This is per ASPE/IFRS: first year of operations has no prior retained earnings
  IF v_fiscal_year <= COALESCE(v_first_data_year, v_fiscal_year) THEN
    v_opening_balance := 0;
  ELSE
    -- Calculate Opening Balance using the existing function for subsequent years
    v_opening_balance := public.calculate_opening_retained_earnings(p_organization_id, v_fiscal_year);
  END IF;
  
  -- Calculate Net Income for the period using existing function
  v_net_income := public.calculate_period_net_income(p_organization_id, p_fiscal_year_start, p_fiscal_year_end);
  
  -- Calculate Dividends declared during the period
  SELECT COALESCE(SUM(
    CASE WHEN a.normal_balance = 'debit' THEN jel.debit - jel.credit ELSE jel.credit - jel.debit END
  ), 0) INTO v_dividends
  FROM journal_entry_lines jel
  JOIN journal_entries je ON jel.journal_entry_id = je.id
  JOIN accounts a ON jel.account_id = a.id
  WHERE a.organization_id = p_organization_id
    AND (a.equity_type = 'dividends' OR LOWER(a.name) LIKE '%dividend%' OR LOWER(a.name) LIKE '%drawing%')
    AND a.is_header = false
    AND je.status = 'posted'
    AND je.entry_date >= p_fiscal_year_start
    AND je.entry_date <= p_fiscal_year_end;
  
  -- Return the statement values
  -- Closing = Opening + Net Income + Additions - Dividends - Deductions
  RETURN QUERY SELECT 
    ROUND(v_opening_balance, 2),
    ROUND(v_net_income, 2),
    ROUND(v_other_additions, 2),
    ROUND(v_dividends, 2),
    ROUND(v_other_deductions, 2),
    ROUND(v_opening_balance + v_net_income + v_other_additions - v_dividends - v_other_deductions, 2);
END;
$$;

-- Also update the calculate_opening_retained_earnings function to include the same safeguard
CREATE OR REPLACE FUNCTION public.calculate_opening_retained_earnings(
  p_organization_id UUID,
  p_fiscal_year INTEGER
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_re_account_id UUID;
  v_opening_balance NUMERIC;
  v_prior_year_end DATE;
  v_re_posted_activity NUMERIC;
  v_unclosed_prior_ni NUMERIC;
  v_first_data_year INTEGER;
BEGIN
  -- Check if this is the first year of data - if so, opening balance is zero
  SELECT MIN(EXTRACT(YEAR FROM je.entry_date))::INTEGER
  INTO v_first_data_year
  FROM journal_entries je
  WHERE je.organization_id = p_organization_id
    AND je.status = 'posted';
  
  -- First year of operations: opening retained earnings is always zero
  IF p_fiscal_year <= COALESCE(v_first_data_year, p_fiscal_year) THEN
    RETURN 0;
  END IF;

  -- Get RE account and its opening balance
  SELECT id, COALESCE(opening_balance, 0)
  INTO v_re_account_id, v_opening_balance
  FROM public.accounts
  WHERE organization_id = p_organization_id
    AND (equity_type = 'retained_earnings' OR code = '3-00-201')
    AND is_header = false
  LIMIT 1;
  
  IF v_re_account_id IS NULL THEN
    RETURN 0;
  END IF;
  
  v_prior_year_end := make_date(p_fiscal_year - 1, 12, 31);
  
  -- Part 1: Direct postings to RE account (TB imports, prior CLOSE-* entries, adjustments)
  SELECT COALESCE(SUM(
    CASE WHEN a.normal_balance = 'credit' 
         THEN jel.credit - jel.debit 
         ELSE jel.debit - jel.credit END
  ), 0)
  INTO v_re_posted_activity
  FROM public.journal_entry_lines jel
  JOIN public.journal_entries je ON je.id = jel.journal_entry_id
  JOIN public.accounts a ON a.id = jel.account_id
  WHERE a.id = v_re_account_id
    AND je.status = 'posted'
    AND je.entry_date <= v_prior_year_end;
  
  -- Part 2: Cumulative net income from UNCLOSED prior years
  -- (Years that have P&L activity but no CLOSE-* entry)
  WITH closed_years AS (
    SELECT DISTINCT EXTRACT(YEAR FROM je.entry_date)::INTEGER as fiscal_year
    FROM journal_entries je
    WHERE je.organization_id = p_organization_id
      AND je.status = 'posted'
      AND je.reference LIKE 'CLOSE-%'
  ),
  unclosed_prior_pnl AS (
    SELECT 
      EXTRACT(YEAR FROM je.entry_date)::INTEGER as fiscal_year,
      SUM(CASE 
        WHEN a.account_type = 'income' THEN jel.credit - jel.debit
        WHEN a.account_type = 'expense' THEN -(jel.debit - jel.credit)
        ELSE 0
      END) as net_income
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    JOIN accounts a ON jel.account_id = a.id
    WHERE je.organization_id = p_organization_id
      AND je.status = 'posted'
      AND a.account_type IN ('income', 'expense')
      AND a.is_header = false
      AND EXTRACT(YEAR FROM je.entry_date) < p_fiscal_year
      AND je.reference NOT LIKE 'CLOSE-%'
    GROUP BY EXTRACT(YEAR FROM je.entry_date)
  )
  SELECT COALESCE(SUM(u.net_income), 0)
  INTO v_unclosed_prior_ni
  FROM unclosed_prior_pnl u
  WHERE u.fiscal_year NOT IN (SELECT fiscal_year FROM closed_years);
  
  -- Total Opening RE = Account Opening + RE Postings + Unclosed Prior NI
  RETURN ROUND(v_opening_balance + COALESCE(v_re_posted_activity, 0) + COALESCE(v_unclosed_prior_ni, 0), 2);
END;
$$;
