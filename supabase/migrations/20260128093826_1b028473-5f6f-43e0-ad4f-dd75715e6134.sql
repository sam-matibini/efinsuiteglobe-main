
-- ============================================================================
-- INTEGRATE STATEMENT OF RETAINED EARNINGS WITH STATEMENT OF CHANGES IN EQUITY
-- ============================================================================
-- This migration updates the calculate_retained_earnings_statement function
-- to use the same rollforward logic as get_retained_earnings_rollforward_series
-- ensuring both the Balance Sheet and Statement of Changes in Equity
-- display consistent Retained Earnings values.
-- ============================================================================

-- First drop the existing function
DROP FUNCTION IF EXISTS public.calculate_retained_earnings_statement(uuid, date, date);

-- Recreate with proper rollforward logic
CREATE OR REPLACE FUNCTION public.calculate_retained_earnings_statement(
  p_organization_id uuid,
  p_fiscal_year_start date,
  p_fiscal_year_end date
)
RETURNS TABLE(
  opening_balance numeric,
  net_income_loss numeric,
  dividends_declared numeric,
  other_additions numeric,
  other_deductions numeric,
  closing_balance numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fiscal_year INTEGER;
  v_opening_re NUMERIC;
  v_net_income NUMERIC;
  v_dividends NUMERIC;
  v_closing_re NUMERIC;
  v_first_data_year INTEGER;
  v_loop_year INTEGER;
BEGIN
  v_fiscal_year := EXTRACT(YEAR FROM p_fiscal_year_start)::INTEGER;
  
  -- Find the first year with transaction activity
  SELECT MIN(EXTRACT(YEAR FROM je.entry_date))::INTEGER
  INTO v_first_data_year
  FROM journal_entries je
  WHERE je.organization_id = p_organization_id
    AND je.status = 'posted';
  
  -- If no data, return zeros
  IF v_first_data_year IS NULL THEN
    RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;
  
  -- Calculate Opening RE using proper year-over-year rollforward
  -- Opening RE for year Y = Closing RE of year Y-1
  -- This ensures consistency with get_retained_earnings_rollforward_series
  v_opening_re := 0;
  
  -- Iterate from first data year to (fiscal_year - 1) to build opening balance
  FOR v_loop_year IN v_first_data_year..(v_fiscal_year - 1) LOOP
    -- Get net income for that year
    v_net_income := public.calculate_period_net_income(
      p_organization_id,
      make_date(v_loop_year, 1, 1),
      make_date(v_loop_year, 12, 31)
    );
    
    -- Get dividends/drawings for that year
    SELECT COALESCE(SUM(
      CASE WHEN a.normal_balance = 'debit' THEN jel.debit - jel.credit ELSE jel.credit - jel.debit END
    ), 0)
    INTO v_dividends
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    JOIN accounts a ON a.id = jel.account_id
    WHERE je.organization_id = p_organization_id
      AND je.status = 'posted'
      AND je.entry_date >= make_date(v_loop_year, 1, 1)
      AND je.entry_date <= make_date(v_loop_year, 12, 31)
      AND (a.equity_type = 'dividends' OR a.name ILIKE '%dividend%' OR a.name ILIKE '%drawing%')
      AND a.is_header = false;
    
    -- Roll forward: Opening RE for next year = Opening RE + Net Income - Dividends
    v_opening_re := v_opening_re + COALESCE(v_net_income, 0) - COALESCE(v_dividends, 0);
  END LOOP;
  
  -- Now calculate current year values
  v_net_income := public.calculate_period_net_income(
    p_organization_id,
    p_fiscal_year_start,
    p_fiscal_year_end
  );
  
  -- Get dividends/drawings for current year
  SELECT COALESCE(SUM(
    CASE WHEN a.normal_balance = 'debit' THEN jel.debit - jel.credit ELSE jel.credit - jel.debit END
  ), 0)
  INTO v_dividends
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  JOIN accounts a ON a.id = jel.account_id
  WHERE je.organization_id = p_organization_id
    AND je.status = 'posted'
    AND je.entry_date >= p_fiscal_year_start
    AND je.entry_date <= p_fiscal_year_end
    AND (a.equity_type = 'dividends' OR a.name ILIKE '%dividend%' OR a.name ILIKE '%drawing%')
    AND a.is_header = false;
  
  -- Closing RE = Opening RE + Net Income - Dividends
  v_closing_re := v_opening_re + COALESCE(v_net_income, 0) - COALESCE(v_dividends, 0);
  
  RETURN QUERY SELECT 
    ROUND(v_opening_re, 2),
    ROUND(COALESCE(v_net_income, 0), 2),
    ROUND(COALESCE(v_dividends, 0), 2),
    0::NUMERIC, -- other_additions (for future use)
    0::NUMERIC, -- other_deductions (for future use)
    ROUND(v_closing_re, 2);
END;
$function$;

-- Add comment explaining the integration
COMMENT ON FUNCTION public.calculate_retained_earnings_statement IS 
'Calculates Statement of Retained Earnings using proper year-over-year rollforward logic. 
Integrated with get_retained_earnings_rollforward_series for consistency between 
Balance Sheet and Statement of Changes in Equity. 
Formula: Closing RE = Opening RE + Net Income - Dividends
Opening RE (Year N) = Closing RE (Year N-1)';
