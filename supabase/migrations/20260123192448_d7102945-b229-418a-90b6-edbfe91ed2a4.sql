-- Fix fiscal-year labeling for retained earnings statement when fiscal year crosses calendar boundary
-- (e.g., 2023-01-03 to 2024-01-02 should be treated as FY2023 for opening-balance logic)

CREATE OR REPLACE FUNCTION public.calculate_retained_earnings_statement(
  p_organization_id uuid,
  p_fiscal_year_start date,
  p_fiscal_year_end date
)
RETURNS TABLE(
  opening_balance numeric,
  net_income_loss numeric,
  other_additions numeric,
  dividends_declared numeric,
  other_deductions numeric,
  closing_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_opening_balance NUMERIC := 0;
  v_net_income NUMERIC := 0;
  v_dividends NUMERIC := 0;
  v_other_additions NUMERIC := 0;
  v_other_deductions NUMERIC := 0;
  v_fiscal_year INTEGER;
  v_first_data_year INTEGER;
BEGIN
  -- IMPORTANT: fiscal year should be derived from the fiscal year START date.
  -- Using end date breaks for fiscal years that end early in January.
  v_fiscal_year := EXTRACT(YEAR FROM p_fiscal_year_start);

  -- Determine the first year of posted journal entry data for this organization
  SELECT MIN(EXTRACT(YEAR FROM je.entry_date))::INTEGER
    INTO v_first_data_year
  FROM public.journal_entries je
  WHERE je.organization_id = p_organization_id
    AND je.status = 'posted';

  -- If this is the first year of data (or before), opening balance MUST be zero
  IF v_fiscal_year <= COALESCE(v_first_data_year, v_fiscal_year) THEN
    v_opening_balance := 0;
  ELSE
    v_opening_balance := public.calculate_opening_retained_earnings(p_organization_id, v_fiscal_year);
  END IF;

  -- Net income for the period
  v_net_income := public.calculate_period_net_income(p_organization_id, p_fiscal_year_start, p_fiscal_year_end);

  -- Dividends declared during the period
  SELECT COALESCE(
    SUM(
      CASE
        WHEN a.normal_balance = 'debit' THEN jel.debit - jel.credit
        ELSE jel.credit - jel.debit
      END
    ),
    0
  )
  INTO v_dividends
  FROM public.journal_entry_lines jel
  JOIN public.journal_entries je ON jel.journal_entry_id = je.id
  JOIN public.accounts a ON jel.account_id = a.id
  WHERE a.organization_id = p_organization_id
    AND (a.equity_type = 'dividends' OR LOWER(a.name) LIKE '%dividend%' OR LOWER(a.name) LIKE '%drawing%')
    AND a.is_header = false
    AND je.status = 'posted'
    AND je.entry_date >= p_fiscal_year_start
    AND je.entry_date <= p_fiscal_year_end;

  RETURN QUERY
  SELECT
    ROUND(v_opening_balance, 2),
    ROUND(v_net_income, 2),
    ROUND(v_other_additions, 2),
    ROUND(v_dividends, 2),
    ROUND(v_other_deductions, 2),
    ROUND(v_opening_balance + v_net_income + v_other_additions - v_dividends - v_other_deductions, 2);
END;
$function$;
