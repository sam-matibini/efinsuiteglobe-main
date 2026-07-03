-- ============================================================================
-- FIX: Update get_unclosed_fiscal_years to use organization's fiscal_year_end_month
-- ============================================================================
-- This function was hardcoded to calendar year (Jan 1 - Dec 31), but organizations
-- may have different fiscal year end months (e.g., September for month 9).
--
-- For fiscal_year_end_month = 9 (September):
-- - FY2024 runs from Oct 1, 2023 to Sep 30, 2024
-- - FY2025 runs from Oct 1, 2024 to Sep 30, 2025
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_unclosed_fiscal_years(p_organization_id uuid)
 RETURNS TABLE(fiscal_year integer, fiscal_year_start date, fiscal_year_end date, net_income numeric, is_closed boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_year INTEGER;
  v_earliest_year INTEGER;
  v_loop_year INTEGER;
  v_fy_end_month INTEGER;
  v_fy_start DATE;
  v_fy_end DATE;
  v_current_fy INTEGER;
BEGIN
  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  
  -- Get the organization's fiscal year end month (default to December/12 if not set)
  SELECT COALESCE(o.fiscal_year_end_month, 12)
  INTO v_fy_end_month
  FROM public.organizations o
  WHERE o.id = p_organization_id;
  
  -- Calculate the current fiscal year based on today's date
  -- If current month > FY end month, we're in the next fiscal year
  IF EXTRACT(MONTH FROM CURRENT_DATE) > v_fy_end_month THEN
    v_current_fy := v_current_year + 1;
  ELSE
    v_current_fy := v_current_year;
  END IF;
  
  -- Find earliest transaction year to determine the earliest fiscal year
  SELECT EXTRACT(YEAR FROM MIN(je.entry_date))::INTEGER
  INTO v_earliest_year
  FROM public.journal_entries je
  WHERE je.organization_id = p_organization_id
    AND je.status = 'posted';
  
  IF v_earliest_year IS NULL THEN
    RETURN;
  END IF;
  
  -- Adjust earliest year based on fiscal year end month
  -- If earliest transaction is after FY end month, it belongs to next FY
  DECLARE
    v_earliest_entry_date DATE;
    v_earliest_fy INTEGER;
  BEGIN
    SELECT MIN(je.entry_date)
    INTO v_earliest_entry_date
    FROM public.journal_entries je
    WHERE je.organization_id = p_organization_id
      AND je.status = 'posted';
    
    IF v_fy_end_month = 12 THEN
      v_earliest_fy := EXTRACT(YEAR FROM v_earliest_entry_date)::INTEGER;
    ELSIF EXTRACT(MONTH FROM v_earliest_entry_date) > v_fy_end_month THEN
      v_earliest_fy := EXTRACT(YEAR FROM v_earliest_entry_date)::INTEGER + 1;
    ELSE
      v_earliest_fy := EXTRACT(YEAR FROM v_earliest_entry_date)::INTEGER;
    END IF;
    
    -- Return each fiscal year from earliest to previous fiscal year (not current)
    FOR v_loop_year IN v_earliest_fy..(v_current_fy - 1) LOOP
      -- Calculate FY start and end dates
      IF v_fy_end_month = 12 THEN
        -- Calendar year: Jan 1 to Dec 31
        v_fy_start := make_date(v_loop_year, 1, 1);
        v_fy_end := make_date(v_loop_year, 12, 31);
      ELSE
        -- Non-calendar year: FY starts in month after end month of previous calendar year
        -- E.g., if FY ends Sept (9), FY2024 runs Oct 1, 2023 to Sep 30, 2024
        v_fy_start := make_date(v_loop_year - 1, v_fy_end_month + 1, 1);
        -- Last day of the FY end month
        v_fy_end := (make_date(v_loop_year, v_fy_end_month + 1, 1) - INTERVAL '1 day')::DATE;
      END IF;
      
      RETURN QUERY
      WITH year_activity AS (
        SELECT 
          a.account_type,
          SUM(CASE WHEN a.account_type = 'income' 
              THEN COALESCE(jel.credit, 0) - COALESCE(jel.debit, 0)
              ELSE COALESCE(jel.debit, 0) - COALESCE(jel.credit, 0) END) as activity
        FROM public.journal_entry_lines jel
        JOIN public.journal_entries je ON je.id = jel.journal_entry_id
        JOIN public.accounts a ON a.id = jel.account_id
        WHERE je.organization_id = p_organization_id
          AND je.status = 'posted'
          AND je.entry_date >= v_fy_start
          AND je.entry_date <= v_fy_end
          AND a.account_type IN ('income', 'expense')
          AND a.is_header = false
        GROUP BY a.account_type
      ),
      closed_check AS (
        SELECT fyc.id
        FROM public.fiscal_year_closes fyc
        WHERE fyc.organization_id = p_organization_id
          AND fyc.fiscal_year = v_loop_year
      )
      SELECT 
        v_loop_year,
        v_fy_start,
        v_fy_end,
        COALESCE((SELECT ya.activity FROM year_activity ya WHERE ya.account_type = 'income'), 0) -
        COALESCE((SELECT ya.activity FROM year_activity ya WHERE ya.account_type = 'expense'), 0),
        EXISTS(SELECT 1 FROM closed_check);
    END LOOP;
  END;
END;
$function$;