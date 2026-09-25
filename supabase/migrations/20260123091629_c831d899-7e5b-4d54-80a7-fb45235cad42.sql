
-- Fix calculate_opening_retained_earnings to include UNCLOSED prior years' net income
-- RE(Opening Year N) = RE Account Activity (prior years) + Cumulative Net Income (unclosed prior years)
CREATE OR REPLACE FUNCTION public.calculate_opening_retained_earnings(
  p_organization_id UUID,
  p_fiscal_year INTEGER
) RETURNS NUMERIC LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_re_account_id UUID;
  v_opening_balance NUMERIC;
  v_prior_year_end DATE;
  v_re_posted_activity NUMERIC;
  v_unclosed_prior_ni NUMERIC;
BEGIN
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

-- Update get_equity_breakdown to use the fixed function
CREATE OR REPLACE FUNCTION public.get_equity_breakdown(
  p_organization_id UUID,
  p_fiscal_year_start DATE,
  p_as_of_date DATE
) RETURNS TABLE(
  share_capital NUMERIC,
  retained_earnings_opening NUMERIC,
  current_year_earnings NUMERIC,
  dividends NUMERIC,
  other_equity NUMERIC,
  total_equity NUMERIC
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_share_capital NUMERIC := 0;
  v_re_opening NUMERIC := 0;
  v_cye NUMERIC := 0;
  v_dividends NUMERIC := 0;
  v_other NUMERIC := 0;
  v_fiscal_year INTEGER;
BEGIN
  v_fiscal_year := EXTRACT(YEAR FROM p_fiscal_year_start)::INTEGER;
  
  -- Share Capital (cumulative as-of date)
  SELECT COALESCE(SUM(
    COALESCE(a.opening_balance, 0) + COALESCE(
      (SELECT SUM(CASE WHEN a.normal_balance = 'credit' THEN jel2.credit - jel2.debit ELSE jel2.debit - jel2.credit END)
       FROM journal_entry_lines jel2
       JOIN journal_entries je2 ON jel2.journal_entry_id = je2.id
       WHERE je2.status = 'posted' AND jel2.account_id = a.id AND je2.entry_date <= p_as_of_date)
    , 0)
  ), 0) INTO v_share_capital
  FROM accounts a
  WHERE a.organization_id = p_organization_id
    AND a.equity_type = 'share_capital'
    AND a.is_header = false;
  
  -- Opening Retained Earnings (prior year cumulative using fixed function)
  v_re_opening := public.calculate_opening_retained_earnings(p_organization_id, v_fiscal_year);
  
  -- Current Year Earnings (period-specific net income)
  v_cye := public.calculate_period_net_income(p_organization_id, p_fiscal_year_start, p_as_of_date);
  
  -- Dividends/Drawings (current period, as reduction)
  SELECT COALESCE(SUM(
    CASE WHEN a.normal_balance = 'debit' THEN jel.debit - jel.credit ELSE jel.credit - jel.debit END
  ), 0) INTO v_dividends
  FROM journal_entry_lines jel
  JOIN journal_entries je ON jel.journal_entry_id = je.id
  JOIN accounts a ON jel.account_id = a.id
  WHERE a.organization_id = p_organization_id
    AND a.equity_type = 'dividends'
    AND a.is_header = false
    AND je.status = 'posted'
    AND je.entry_date >= p_fiscal_year_start
    AND je.entry_date <= p_as_of_date;
  
  -- Other Equity (reserves, APIC, etc. - cumulative)
  SELECT COALESCE(SUM(
    COALESCE(a.opening_balance, 0) + COALESCE(
      (SELECT SUM(CASE WHEN a.normal_balance = 'credit' THEN jel2.credit - jel2.debit ELSE jel2.debit - jel2.credit END)
       FROM journal_entry_lines jel2
       JOIN journal_entries je2 ON jel2.journal_entry_id = je2.id
       WHERE je2.status = 'posted' AND jel2.account_id = a.id AND je2.entry_date <= p_as_of_date)
    , 0)
  ), 0) INTO v_other
  FROM accounts a
  WHERE a.organization_id = p_organization_id
    AND a.equity_type IN ('reserves', 'other_equity')
    AND a.is_header = false;
  
  RETURN QUERY SELECT 
    ROUND(v_share_capital, 2),
    ROUND(v_re_opening, 2),
    ROUND(v_cye, 2),
    ROUND(v_dividends, 2),
    ROUND(v_other, 2),
    ROUND(v_share_capital + v_re_opening + v_cye - v_dividends + v_other, 2);
END;
$$;
