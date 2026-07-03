
-- Fix calculate_opening_retained_earnings to use only valid account_type enum values
-- The account_type enum only has: asset, liability, equity, income, expense
-- cogs, other_income, other_expense are not valid enum values
CREATE OR REPLACE FUNCTION public.calculate_opening_retained_earnings(
  p_organization_id UUID,
  p_fiscal_year INTEGER
)
RETURNS NUMERIC
LANGUAGE plpgsql
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
  SELECT COALESCE(fiscal_year_end_month, 12)
  INTO v_fy_end_month
  FROM public.organizations
  WHERE id = p_organization_id;
  
  IF v_fy_end_month IS NULL THEN
    v_fy_end_month := 12;
  END IF;

  IF v_fy_end_month = 12 THEN
    v_current_fy_start := make_date(p_fiscal_year, 1, 1);
    v_prior_fy_end := make_date(p_fiscal_year - 1, 12, 31);
  ELSE
    v_current_fy_start := make_date(p_fiscal_year - 1, v_fy_end_month + 1, 1);
    v_prior_fy_end := (make_date(p_fiscal_year - 1, v_fy_end_month, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  END IF;

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

  IF v_first_data_year IS NULL OR p_fiscal_year <= v_first_data_year THEN
    RETURN 0;
  END IF;

  -- Get RE account - expanded with ASNPO matching
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
      OR name ILIKE '%unrestricted net assets%'
      OR name ILIKE '%accumulated surplus%'
      OR name ILIKE '%unrestricted funds%'
    )
  ORDER BY (code = '3-00-201') DESC, (code LIKE '3-01-200%') DESC, (equity_type = 'retained_earnings') DESC, code
  LIMIT 1;
  
  IF v_re_account_id IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Part 1: Direct postings to RE account up to PRIOR fiscal year end
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
    AND je.entry_date < v_current_fy_start;
  
  -- Part 2: Cumulative net income from UNCLOSED prior fiscal years
  -- Use text cast to avoid enum comparison issues with cogs/other_income/other_expense
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
        ELSE 0 END) as net_income
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    JOIN public.accounts a ON a.id = jel.account_id
    WHERE je.organization_id = p_organization_id
      AND je.status = 'posted'
      AND je.entry_date < v_current_fy_start
      AND je.reference NOT LIKE 'CLOSE-%'
      AND a.account_type IN ('income', 'expense')
    GROUP BY 1
  )
  SELECT COALESCE(SUM(net_income), 0)
  INTO v_unclosed_prior_ni
  FROM unclosed_prior_pnl
  WHERE fiscal_year NOT IN (SELECT fiscal_year FROM closed_years)
    AND fiscal_year < p_fiscal_year;

  RETURN ROUND(v_opening_balance + v_re_posted_activity + v_unclosed_prior_ni, 2);
END;
$$;
