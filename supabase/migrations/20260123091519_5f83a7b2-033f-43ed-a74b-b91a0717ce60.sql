
-- Fix the get_retained_earnings_balance function to use proper rollforward logic
-- RE = Opening Balance + All prior closed years' net income (via CLOSE-* entries)
CREATE OR REPLACE FUNCTION public.get_retained_earnings_balance(
  p_organization_id UUID,
  p_as_of_date DATE
) RETURNS NUMERIC LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_re_account_id UUID;
  v_opening_balance NUMERIC;
  v_posted_activity NUMERIC;
  v_fiscal_year INTEGER;
BEGIN
  v_fiscal_year := EXTRACT(YEAR FROM p_as_of_date)::INTEGER;
  
  -- Get retained earnings account
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
  
  -- Calculate RE balance: opening + all posted entries to RE account up to as_of_date
  -- EXCLUDING same-year CLOSE-* entries (those are for CYE, not RE yet)
  SELECT COALESCE(SUM(
    CASE WHEN a.normal_balance = 'credit' 
         THEN jel.credit - jel.debit 
         ELSE jel.debit - jel.credit END
  ), 0)
  INTO v_posted_activity
  FROM public.journal_entry_lines jel
  JOIN public.journal_entries je ON je.id = jel.journal_entry_id
  JOIN public.accounts a ON a.id = jel.account_id
  WHERE a.id = v_re_account_id
    AND je.status = 'posted'
    AND je.entry_date <= p_as_of_date
    -- Exclude same-year CLOSE entries (CYE handles current year)
    AND NOT (
      je.reference LIKE 'CLOSE-%'
      AND EXTRACT(YEAR FROM je.entry_date) = v_fiscal_year
    );
  
  RETURN ROUND(v_opening_balance + COALESCE(v_posted_activity, 0), 2);
END;
$$;

-- Create function to calculate Opening RE for any fiscal year using rollforward
CREATE OR REPLACE FUNCTION public.calculate_opening_retained_earnings(
  p_organization_id UUID,
  p_fiscal_year INTEGER
) RETURNS NUMERIC LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_re_account_id UUID;
  v_opening_balance NUMERIC;
  v_prior_year_end DATE;
  v_cumulative_ni NUMERIC;
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
  
  -- Opening RE = Account Opening Balance + All prior years' net income
  -- This includes: 
  --   1. Direct postings to RE (TB imports, adjustments)
  --   2. Prior year CLOSE-* entries (closed earnings)
  SELECT COALESCE(SUM(
    CASE WHEN a.normal_balance = 'credit' 
         THEN jel.credit - jel.debit 
         ELSE jel.debit - jel.credit END
  ), 0)
  INTO v_cumulative_ni
  FROM public.journal_entry_lines jel
  JOIN public.journal_entries je ON je.id = jel.journal_entry_id
  JOIN public.accounts a ON a.id = jel.account_id
  WHERE a.id = v_re_account_id
    AND je.status = 'posted'
    AND je.entry_date <= v_prior_year_end;
  
  RETURN ROUND(v_opening_balance + COALESCE(v_cumulative_ni, 0), 2);
END;
$$;

-- Create function to get complete equity breakdown for Balance Sheet
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
  v_fiscal_year := EXTRACT(YEAR FROM p_as_of_date)::INTEGER;
  
  -- Share Capital (cumulative)
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
  
  -- Opening Retained Earnings (prior year cumulative)
  v_re_opening := public.calculate_opening_retained_earnings(p_organization_id, v_fiscal_year);
  
  -- Current Year Earnings (period-specific net income)
  v_cye := public.calculate_period_net_income(p_organization_id, p_fiscal_year_start, p_as_of_date);
  
  -- Dividends/Drawings (period-specific, as reduction)
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
  
  -- Other Equity (reserves, APIC, etc.)
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
