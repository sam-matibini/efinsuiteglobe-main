
-- Update get_retained_earnings_rollforward_series to include direct RE adjustments
CREATE OR REPLACE FUNCTION public.get_retained_earnings_rollforward_series(p_organization_id uuid, p_start_year integer DEFAULT NULL::integer, p_end_year integer DEFAULT NULL::integer)
 RETURNS TABLE(fiscal_year integer, opening_re numeric, net_income numeric, dividends numeric, closing_re numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_first_year INTEGER;
  v_last_year INTEGER;
  v_loop_year INTEGER;
  v_opening_re NUMERIC;
  v_ni NUMERIC;
  v_div NUMERIC;
  v_direct_adj NUMERIC;
  v_closing_re NUMERIC;
  v_re_account_id UUID;
BEGIN
  -- Get retained earnings account
  SELECT id INTO v_re_account_id
  FROM accounts
  WHERE organization_id = p_organization_id
    AND (equity_type = 'retained_earnings' OR code = '3-00-201')
    AND is_header = false
  LIMIT 1;

  -- Determine earliest year with transaction activity
  SELECT EXTRACT(YEAR FROM MIN(je.entry_date))::INTEGER
  INTO v_first_year
  FROM journal_entries je
  WHERE je.organization_id = p_organization_id
    AND je.status = 'posted';
  
  IF v_first_year IS NULL THEN
    RETURN;
  END IF;
  
  v_first_year := COALESCE(p_start_year, v_first_year);
  v_last_year := COALESCE(p_end_year, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER);
  
  -- Iterate through each fiscal year and compute rollforward components
  v_opening_re := 0;  -- Start with zero for the first year
  
  FOR v_loop_year IN v_first_year..v_last_year LOOP
    -- Opening RE for year = closing RE of prior year (zero for first year)
    IF v_loop_year = v_first_year THEN
      v_opening_re := 0;
    END IF;
    
    -- Net Income = Revenue - Expenses for the fiscal year
    v_ni := public.calculate_period_net_income(
      p_organization_id,
      make_date(v_loop_year, 1, 1),
      make_date(v_loop_year, 12, 31)
    );
    
    -- Dividends/drawings (debit to dividend/drawing accounts)
    SELECT COALESCE(SUM(
      CASE WHEN a.normal_balance = 'debit' THEN jel.debit - jel.credit ELSE jel.credit - jel.debit END
    ), 0)
    INTO v_div
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    JOIN accounts a ON a.id = jel.account_id
    WHERE je.organization_id = p_organization_id
      AND je.status = 'posted'
      AND je.entry_date >= make_date(v_loop_year, 1, 1)
      AND je.entry_date <= make_date(v_loop_year, 12, 31)
      AND (a.equity_type = 'dividends' OR a.name ILIKE '%dividend%' OR a.name ILIKE '%drawing%')
      AND a.is_header = false;
    
    -- Direct adjustments to Retained Earnings (NOT from closing entries)
    -- This captures opening balance entries, prior period adjustments, etc.
    IF v_re_account_id IS NOT NULL THEN
      SELECT COALESCE(SUM(
        CASE WHEN a.normal_balance = 'credit' 
             THEN jel.credit - jel.debit 
             ELSE jel.debit - jel.credit END
      ), 0)
      INTO v_direct_adj
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      JOIN accounts a ON a.id = jel.account_id
      WHERE a.id = v_re_account_id
        AND je.organization_id = p_organization_id
        AND je.status = 'posted'
        AND je.entry_date >= make_date(v_loop_year, 1, 1)
        AND je.entry_date <= make_date(v_loop_year, 12, 31)
        AND je.reference NOT LIKE 'CLOSE-%';  -- Exclude closing entries (handled by net income)
    ELSE
      v_direct_adj := 0;
    END IF;
    
    -- Closing RE = Opening RE + Net Income - Dividends + Direct Adjustments
    v_closing_re := v_opening_re + COALESCE(v_ni, 0) - COALESCE(v_div, 0) + COALESCE(v_direct_adj, 0);
    
    RETURN QUERY SELECT
      v_loop_year,
      ROUND(v_opening_re, 2),
      ROUND(COALESCE(v_ni, 0), 2),
      ROUND(COALESCE(v_div, 0), 2),
      ROUND(v_closing_re, 2);
    
    -- Next year's opening is this year's closing
    v_opening_re := v_closing_re;
  END LOOP;
END;
$function$;
