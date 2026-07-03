-- Fix calculate_opening_retained_earnings - correct prior year end calculation
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
  v_prior_fy_end DATE;
  v_current_fy_start DATE;
  v_re_posted_activity NUMERIC;
  v_unclosed_prior_ni NUMERIC;
  v_first_data_year INTEGER;
  v_fy_end_month INTEGER;
BEGIN
  -- Get organization's fiscal year end month (default to December/12)
  SELECT COALESCE(fiscal_year_end_month, 12)
  INTO v_fy_end_month
  FROM public.organizations
  WHERE id = p_organization_id;
  
  IF v_fy_end_month IS NULL THEN
    v_fy_end_month := 12;
  END IF;

  -- Calculate current FY start and prior FY end dates
  -- For fiscal year ending in month M:
  -- - FY2023 with September (9) end: Oct 1, 2022 to Sep 30, 2023
  -- - Current FY start = (p_fiscal_year - 1, M + 1, 1) for non-December FY
  -- - Prior FY end = current FY start - 1 day
  
  IF v_fy_end_month = 12 THEN
    -- Calendar year: FY2023 = Jan 1, 2023 to Dec 31, 2023
    v_current_fy_start := make_date(p_fiscal_year, 1, 1);
    v_prior_fy_end := make_date(p_fiscal_year - 1, 12, 31);
  ELSE
    -- Non-calendar FY: FY2023 with Sep end = Oct 1, 2022 to Sep 30, 2023
    -- Current FY starts in month (fy_end_month + 1) of year (p_fiscal_year - 1)
    v_current_fy_start := make_date(p_fiscal_year - 1, v_fy_end_month + 1, 1);
    -- Prior FY ends on the last day of fy_end_month in year (p_fiscal_year - 1)
    v_prior_fy_end := (make_date(p_fiscal_year - 1, v_fy_end_month, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  END IF;

  -- Determine first fiscal year of operations
  SELECT MIN(
    CASE 
      WHEN v_fy_end_month = 12 THEN EXTRACT(YEAR FROM je.entry_date)::INTEGER
      WHEN EXTRACT(MONTH FROM je.entry_date) > v_fy_end_month 
        THEN EXTRACT(YEAR FROM je.entry_date)::INTEGER + 1
      ELSE EXTRACT(YEAR FROM je.entry_date)::INTEGER
    END
  )
  INTO v_first_data_year
  FROM public.journal_entries je
  WHERE je.organization_id = p_organization_id
    AND je.status = 'posted';

  -- First year of operations: opening retained earnings is always zero
  IF v_first_data_year IS NULL OR p_fiscal_year <= v_first_data_year THEN
    RETURN 0;
  END IF;

  -- Get RE account and its opening balance
  SELECT id, COALESCE(opening_balance, 0)
  INTO v_re_account_id, v_opening_balance
  FROM public.accounts
  WHERE organization_id = p_organization_id
    AND is_header = false
    AND (
      equity_type = 'retained_earnings'
      OR code = '3-00-201'
      OR code LIKE '3-01-200%'
      OR name ILIKE '%retained earnings%'
    )
  ORDER BY (code = '3-00-201') DESC, (code LIKE '3-01-200%') DESC, code
  LIMIT 1;
  
  IF v_re_account_id IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Part 1: Direct postings to RE account up to PRIOR fiscal year end
  -- (TB imports, prior CLOSE-* entries, adjustments)
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
    AND je.entry_date < v_current_fy_start;  -- Before current FY starts
  
  -- Part 2: Cumulative net income from UNCLOSED prior fiscal years
  WITH closed_years AS (
    SELECT DISTINCT 
      CASE 
        WHEN v_fy_end_month = 12 THEN EXTRACT(YEAR FROM je.entry_date)::INTEGER
        WHEN EXTRACT(MONTH FROM je.entry_date) > v_fy_end_month 
          THEN EXTRACT(YEAR FROM je.entry_date)::INTEGER + 1
        ELSE EXTRACT(YEAR FROM je.entry_date)::INTEGER
      END as fiscal_year
    FROM public.journal_entries je
    WHERE je.organization_id = p_organization_id
      AND je.status = 'posted'
      AND je.reference LIKE 'CLOSE-%'
  ),
  unclosed_prior_pnl AS (
    SELECT 
      CASE 
        WHEN v_fy_end_month = 12 THEN EXTRACT(YEAR FROM je.entry_date)::INTEGER
        WHEN EXTRACT(MONTH FROM je.entry_date) > v_fy_end_month 
          THEN EXTRACT(YEAR FROM je.entry_date)::INTEGER + 1
        ELSE EXTRACT(YEAR FROM je.entry_date)::INTEGER
      END as fiscal_year,
      SUM(CASE 
        WHEN a.account_type = 'income' AND a.normal_balance = 'credit' THEN jel.credit - jel.debit
        WHEN a.account_type = 'income' AND a.normal_balance = 'debit' THEN -(jel.debit - jel.credit)
        WHEN a.account_type = 'expense' AND a.normal_balance = 'debit' THEN -(jel.debit - jel.credit)
        WHEN a.account_type = 'expense' AND a.normal_balance = 'credit' THEN jel.credit - jel.debit
        ELSE 0
      END) as net_income
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON jel.journal_entry_id = je.id
    JOIN public.accounts a ON jel.account_id = a.id
    WHERE je.organization_id = p_organization_id
      AND je.status = 'posted'
      AND a.account_type IN ('income', 'expense')
      AND a.is_header = false
      AND je.entry_date < v_current_fy_start  -- Before current FY starts
      AND je.reference NOT LIKE 'CLOSE-%'
    GROUP BY 1
  )
  SELECT COALESCE(SUM(u.net_income), 0)
  INTO v_unclosed_prior_ni
  FROM unclosed_prior_pnl u
  WHERE u.fiscal_year NOT IN (SELECT fiscal_year FROM closed_years)
    AND u.fiscal_year < p_fiscal_year;
  
  RETURN ROUND(v_opening_balance + COALESCE(v_re_posted_activity, 0) + COALESCE(v_unclosed_prior_ni, 0), 2);
END;
$$;