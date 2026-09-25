-- Update calculate_opening_retained_earnings to support fiscal year end month
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

  -- Determine first fiscal year of operations
  -- For fiscal year determination: if date's month > fy_end_month, it belongs to next fiscal year
  SELECT MIN(
    CASE 
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
  
  -- Calculate prior fiscal year end date based on fiscal year end month
  -- Example: For September (month 9) FY end:
  -- - FY2023 ends on Sep 30, 2023
  -- - Prior FY2022 ends on Sep 30, 2022
  -- For FY end month 9 (September): prior year end = Sep 30, p_fiscal_year - 1
  -- For FY end month 12 (December): prior year end = Dec 31, p_fiscal_year - 1
  v_prior_year_end := (make_date(p_fiscal_year - 1, v_fy_end_month, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  
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
  
  -- Part 2: Cumulative net income from UNCLOSED prior fiscal years
  -- (Years that have P&L activity but no CLOSE-* entry yet)
  WITH closed_years AS (
    SELECT DISTINCT 
      CASE 
        WHEN v_fy_end_month = 12 THEN EXTRACT(YEAR FROM je.entry_date)::INTEGER
        ELSE 
          CASE 
            WHEN EXTRACT(MONTH FROM je.entry_date) > v_fy_end_month 
            THEN EXTRACT(YEAR FROM je.entry_date)::INTEGER + 1
            ELSE EXTRACT(YEAR FROM je.entry_date)::INTEGER
          END
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
        ELSE 
          CASE 
            WHEN EXTRACT(MONTH FROM je.entry_date) > v_fy_end_month 
            THEN EXTRACT(YEAR FROM je.entry_date)::INTEGER + 1
            ELSE EXTRACT(YEAR FROM je.entry_date)::INTEGER
          END
      END as fiscal_year,
      SUM(CASE 
        -- INCOME: Credit increases, Debit decreases (contra-revenue)
        WHEN a.account_type = 'income' AND a.normal_balance = 'credit' THEN jel.credit - jel.debit
        WHEN a.account_type = 'income' AND a.normal_balance = 'debit' THEN -(jel.debit - jel.credit)
        -- EXPENSE: Debit increases (reduces NI), Credit decreases (contra-expense adds back)
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
      AND je.entry_date <= v_prior_year_end
      AND je.reference NOT LIKE 'CLOSE-%'
    GROUP BY 
      CASE 
        WHEN v_fy_end_month = 12 THEN EXTRACT(YEAR FROM je.entry_date)::INTEGER
        ELSE 
          CASE 
            WHEN EXTRACT(MONTH FROM je.entry_date) > v_fy_end_month 
            THEN EXTRACT(YEAR FROM je.entry_date)::INTEGER + 1
            ELSE EXTRACT(YEAR FROM je.entry_date)::INTEGER
          END
      END
  )
  SELECT COALESCE(SUM(u.net_income), 0)
  INTO v_unclosed_prior_ni
  FROM unclosed_prior_pnl u
  WHERE u.fiscal_year NOT IN (SELECT fiscal_year FROM closed_years)
    AND u.fiscal_year < p_fiscal_year;
  
  -- Total Opening RE = Account Opening + RE Postings + Unclosed Prior NI
  RETURN ROUND(v_opening_balance + COALESCE(v_re_posted_activity, 0) + COALESCE(v_unclosed_prior_ni, 0), 2);
END;
$$;