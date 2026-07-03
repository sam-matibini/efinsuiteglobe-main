-- Fix get_unclosed_fiscal_years function - the loop variable was being confused with the output column
CREATE OR REPLACE FUNCTION public.get_unclosed_fiscal_years(p_organization_id UUID)
RETURNS TABLE(
  fiscal_year INTEGER,
  fiscal_year_start DATE,
  fiscal_year_end DATE,
  net_income NUMERIC,
  is_closed BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_year INTEGER;
  v_earliest_year INTEGER;
  v_loop_year INTEGER;  -- Use different name to avoid confusion with output column
BEGIN
  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  
  -- Find earliest transaction year
  SELECT EXTRACT(YEAR FROM MIN(je.entry_date))::INTEGER
  INTO v_earliest_year
  FROM public.journal_entries je
  WHERE je.organization_id = p_organization_id
    AND je.status = 'posted';
  
  IF v_earliest_year IS NULL THEN
    RETURN;
  END IF;
  
  -- Return each fiscal year from earliest to previous year
  FOR v_loop_year IN v_earliest_year..(v_current_year - 1) LOOP
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
        AND EXTRACT(YEAR FROM je.entry_date) = v_loop_year
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
      make_date(v_loop_year, 1, 1)::DATE,
      make_date(v_loop_year, 12, 31)::DATE,
      COALESCE((SELECT ya.activity FROM year_activity ya WHERE ya.account_type = 'income'), 0) -
      COALESCE((SELECT ya.activity FROM year_activity ya WHERE ya.account_type = 'expense'), 0),
      EXISTS(SELECT 1 FROM closed_check);
  END LOOP;
END;
$$;