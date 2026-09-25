-- Fix get_retained_earnings_rollforward_series to include direct RE adjustments
-- The closing should match the Statement of RE: Opening + NI - Dividends + Adjustments

CREATE OR REPLACE FUNCTION public.get_retained_earnings_rollforward_series(
  p_organization_id uuid,
  p_start_year integer DEFAULT NULL,
  p_end_year integer DEFAULT NULL
)
RETURNS TABLE(
  fiscal_year integer,
  opening_re numeric,
  net_income numeric,
  dividends numeric,
  closing_re numeric
)
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
  v_fy_end_month INTEGER;
  v_fy_start DATE;
  v_fy_end DATE;
  v_re_account_id UUID;
BEGIN
  -- Get organization's fiscal year end month (default to December/12)
  SELECT COALESCE(o.fiscal_year_end_month, 12)
  INTO v_fy_end_month
  FROM organizations o
  WHERE o.id = p_organization_id;
  
  IF v_fy_end_month IS NULL THEN
    v_fy_end_month := 12;
  END IF;

  -- Get retained earnings account
  SELECT id INTO v_re_account_id
  FROM accounts
  WHERE organization_id = p_organization_id
    AND (equity_type = 'retained_earnings' OR code = '3-00-201' OR code LIKE '3-01-200%' OR name ILIKE '%retained earnings%')
    AND is_header = false
  ORDER BY (code = '3-00-201') DESC, (code LIKE '3-01-200%') DESC, code
  LIMIT 1;

  -- Determine earliest fiscal year with transaction activity
  SELECT MIN(
    CASE 
      WHEN v_fy_end_month = 12 THEN EXTRACT(YEAR FROM je.entry_date)::INTEGER
      WHEN EXTRACT(MONTH FROM je.entry_date)::INTEGER > v_fy_end_month 
        THEN EXTRACT(YEAR FROM je.entry_date)::INTEGER + 1
      ELSE EXTRACT(YEAR FROM je.entry_date)::INTEGER
    END
  )
  INTO v_first_year
  FROM journal_entries je
  WHERE je.organization_id = p_organization_id
    AND je.status = 'posted';
  
  IF v_first_year IS NULL THEN
    RETURN;
  END IF;
  
  v_first_year := COALESCE(p_start_year, v_first_year);
  v_last_year := COALESCE(p_end_year, 
    CASE 
      WHEN v_fy_end_month = 12 THEN EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
      WHEN EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER > v_fy_end_month 
        THEN EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER + 1
      ELSE EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
    END
  );
  
  FOR v_loop_year IN v_first_year..v_last_year LOOP
    -- Calculate fiscal year boundaries
    IF v_fy_end_month = 12 THEN
      v_fy_start := make_date(v_loop_year, 1, 1);
      v_fy_end := make_date(v_loop_year, 12, 31);
    ELSE
      -- Non-calendar FY: FY2023 with Sep end = Oct 1, 2022 to Sep 30, 2023
      v_fy_start := make_date(v_loop_year - 1, v_fy_end_month + 1, 1);
      v_fy_end := (make_date(v_loop_year, v_fy_end_month, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    END IF;
    
    -- Use calculate_opening_retained_earnings for proper opening balance
    v_opening_re := COALESCE(public.calculate_opening_retained_earnings(p_organization_id, v_loop_year), 0);
    
    -- Net Income for the fiscal year period
    v_ni := COALESCE(public.calculate_period_net_income(
      p_organization_id,
      v_fy_start,
      v_fy_end
    ), 0);
    
    -- Dividends/drawings
    SELECT COALESCE(SUM(
      CASE WHEN a.normal_balance = 'debit' THEN jel.debit - jel.credit ELSE jel.credit - jel.debit END
    ), 0)
    INTO v_div
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    JOIN accounts a ON a.id = jel.account_id
    WHERE je.organization_id = p_organization_id
      AND je.status = 'posted'
      AND je.entry_date >= v_fy_start
      AND je.entry_date <= v_fy_end
      AND (a.equity_type = 'dividends' OR a.name ILIKE '%dividend%' OR a.name ILIKE '%drawing%')
      AND a.is_header = false;

    -- Direct adjustments to RE account within the period (NOT from CLOSE-* entries)
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
        AND je.entry_date >= v_fy_start
        AND je.entry_date <= v_fy_end
        AND je.reference NOT LIKE 'CLOSE-%';
    ELSE
      v_direct_adj := 0;
    END IF;
    
    -- Closing RE = Opening RE + Net Income - Dividends + Direct Adjustments
    v_closing_re := v_opening_re + v_ni - COALESCE(v_div, 0) + COALESCE(v_direct_adj, 0);
    
    RETURN QUERY SELECT
      v_loop_year,
      ROUND(v_opening_re, 2),
      ROUND(v_ni, 2),
      ROUND(COALESCE(v_div, 0), 2),
      ROUND(v_closing_re, 2);
  END LOOP;
END;
$function$;