CREATE OR REPLACE FUNCTION public.calculate_retained_earnings_rollforward(
  p_organization_id uuid,
  p_fiscal_year integer,
  p_fiscal_year_start date,
  p_fiscal_year_end date
)
RETURNS TABLE(
  opening_balance numeric,
  net_income numeric,
  dividends numeric,
  prior_period_adjustments numeric,
  closing_balance numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_re_account_id UUID;
  v_opening NUMERIC;
  v_net_inc NUMERIC;
  v_divs NUMERIC;
  v_adj NUMERIC;
BEGIN
  -- Get retained earnings / unrestricted net assets account
  SELECT id INTO v_re_account_id
  FROM public.accounts
  WHERE organization_id = p_organization_id
    AND (
      equity_type = 'retained_earnings'
      OR code = '3-00-201'
      OR name ILIKE '%retained earnings%'
      OR name ILIKE '%unrestricted net assets%'
      OR name ILIKE '%net assets without donor restrictions%'
      OR name ILIKE '%accumulated surplus%'
      OR name ILIKE '%accumulated deficit%'
    )
    AND is_header = false
  ORDER BY
    CASE
      WHEN code = '3-00-201' THEN 1
      WHEN equity_type = 'retained_earnings' THEN 2
      WHEN name ILIKE '%unrestricted net assets%' THEN 3
      WHEN name ILIKE '%net assets without donor restrictions%' THEN 4
      WHEN name ILIKE '%retained earnings%' THEN 5
      ELSE 99
    END,
    code
  LIMIT 1;
  
  IF v_re_account_id IS NULL THEN
    RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;
  
  -- Opening balance = account opening balance + posted activity before fiscal year start
  SELECT
    COALESCE(MAX(a.opening_balance), 0) + COALESCE(SUM(
      CASE
        WHEN je.id IS NULL THEN 0
        WHEN a.normal_balance = 'credit' THEN COALESCE(jel.credit, 0) - COALESCE(jel.debit, 0)
        ELSE COALESCE(jel.debit, 0) - COALESCE(jel.credit, 0)
      END
    ), 0)
  INTO v_opening
  FROM public.accounts a
  LEFT JOIN public.journal_entry_lines jel ON jel.account_id = a.id
  LEFT JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    AND je.status = 'posted'
    AND je.entry_date < p_fiscal_year_start
  WHERE a.id = v_re_account_id;
  
  -- Net income from temporary accounts (excluding CLOSE-* entries)
  v_net_inc := public.calculate_period_net_income(p_organization_id, p_fiscal_year_start, p_fiscal_year_end);
  
  -- Dividends/drawings (debit entries during the period)
  SELECT COALESCE(SUM(COALESCE(jel.debit, 0) - COALESCE(jel.credit, 0)), 0)
  INTO v_divs
  FROM public.journal_entry_lines jel
  JOIN public.journal_entries je ON je.id = jel.journal_entry_id
  JOIN public.accounts a ON a.id = jel.account_id
  WHERE je.organization_id = p_organization_id
    AND je.status = 'posted'
    AND je.entry_date >= p_fiscal_year_start
    AND je.entry_date <= p_fiscal_year_end
    AND (a.equity_type = 'dividends' OR a.name ILIKE '%dividend%' OR a.name ILIKE '%drawing%')
    AND a.is_header = false;
  
  -- Prior period adjustments (entries to RE that are NOT closing entries)
  SELECT COALESCE(SUM(
    CASE WHEN a.normal_balance = 'credit' 
         THEN COALESCE(jel.credit, 0) - COALESCE(jel.debit, 0)
         ELSE COALESCE(jel.debit, 0) - COALESCE(jel.credit, 0) END
  ), 0)
  INTO v_adj
  FROM public.journal_entry_lines jel
  JOIN public.journal_entries je ON je.id = jel.journal_entry_id
  JOIN public.accounts a ON a.id = jel.account_id
  WHERE a.id = v_re_account_id
    AND je.status = 'posted'
    AND je.entry_date >= p_fiscal_year_start
    AND je.entry_date <= p_fiscal_year_end
    AND je.reference NOT LIKE 'CLOSE-%';
  
  RETURN QUERY SELECT 
    ROUND(COALESCE(v_opening, 0), 2),
    ROUND(COALESCE(v_net_inc, 0), 2),
    ROUND(COALESCE(v_divs, 0), 2),
    ROUND(COALESCE(v_adj, 0), 2),
    ROUND(COALESCE(v_opening, 0) + COALESCE(v_net_inc, 0) - COALESCE(v_divs, 0) + COALESCE(v_adj, 0), 2);
END;
$function$;