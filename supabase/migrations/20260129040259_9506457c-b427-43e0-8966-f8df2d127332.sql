
-- Fix Statement of Retained Earnings calculation to use proper opening rollforward
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
  v_year integer;
  v_opening numeric := 0;
  v_net_income numeric := 0;
  v_dividends numeric := 0;
  v_other_additions numeric := 0;
  v_other_deductions numeric := 0;
BEGIN
  v_year := EXTRACT(YEAR FROM p_fiscal_year_start)::integer;

  -- Opening retained earnings for the fiscal year (Year N opening = Year N-1 closing)
  -- This function also respects the "first year of operations => 0" behavior.
  v_opening := COALESCE(public.calculate_opening_retained_earnings(p_organization_id, v_year), 0);

  -- Net income (loss) for the period (excludes CLOSE-* entries)
  v_net_income := COALESCE(public.calculate_period_net_income(p_organization_id, p_fiscal_year_start, p_fiscal_year_end), 0);

  -- Dividends/Drawings for the period (reduces retained earnings)
  SELECT COALESCE(SUM(
    CASE
      -- Dividends are normally debit-balance; we want a positive reduction amount
      WHEN a.normal_balance = 'debit' THEN jel.debit - jel.credit
      ELSE jel.credit - jel.debit
    END
  ), 0)
  INTO v_dividends
  FROM public.journal_entry_lines jel
  JOIN public.journal_entries je ON je.id = jel.journal_entry_id
  JOIN public.accounts a ON a.id = jel.account_id
  WHERE je.organization_id = p_organization_id
    AND je.status = 'posted'
    AND je.entry_date >= p_fiscal_year_start
    AND je.entry_date <= p_fiscal_year_end
    AND a.is_header = false
    AND (a.equity_type = 'dividends' OR a.name ILIKE '%dividend%' OR a.name ILIKE '%drawing%');

  -- Other additions/deductions (reserved for future explicit lines; keep at 0 for now)
  v_other_additions := 0;
  v_other_deductions := 0;

  RETURN QUERY
  SELECT
    ROUND(v_opening, 2) as opening_balance,
    ROUND(v_net_income, 2) as net_income_loss,
    ROUND(v_dividends, 2) as dividends_declared,
    ROUND(v_other_additions, 2) as other_additions,
    ROUND(v_other_deductions, 2) as other_deductions,
    ROUND(v_opening + v_net_income - v_dividends + v_other_additions - v_other_deductions, 2) as closing_balance;
END;
$function$;
