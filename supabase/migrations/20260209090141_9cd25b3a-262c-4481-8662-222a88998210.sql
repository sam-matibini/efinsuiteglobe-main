
-- Fix the calculate_retained_earnings_statement function to only look for dividends within EQUITY accounts
-- The bug was that it matched "CIBC Dividend Platinum Visa" (a liability) as dividends

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
  v_fy_end_month integer := 12;
  v_re_account_id uuid;
  v_direct_adjustment numeric := 0;
BEGIN
  -- Determine organization's fiscal year end month (default to December)
  SELECT COALESCE(o.fiscal_year_end_month, 12)
  INTO v_fy_end_month
  FROM public.organizations o
  WHERE o.id = p_organization_id;

  IF v_fy_end_month IS NULL THEN
    v_fy_end_month := 12;
  END IF;

  -- Fiscal year number must be derived from the period end date.
  v_year := CASE
    WHEN v_fy_end_month = 12 THEN EXTRACT(YEAR FROM p_fiscal_year_end)::integer
    WHEN EXTRACT(MONTH FROM p_fiscal_year_end)::integer > v_fy_end_month
      THEN EXTRACT(YEAR FROM p_fiscal_year_end)::integer + 1
    ELSE EXTRACT(YEAR FROM p_fiscal_year_end)::integer
  END;

  -- Opening retained earnings for the fiscal year
  v_opening := COALESCE(public.calculate_opening_retained_earnings(p_organization_id, v_year), 0);

  -- Net income (loss) for the period (excludes CLOSE-* entries)
  v_net_income := COALESCE(public.calculate_period_net_income(p_organization_id, p_fiscal_year_start, p_fiscal_year_end), 0);

  -- Get RE account ID
  SELECT id INTO v_re_account_id
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

  -- Dividends/Drawings for the period (reduces retained earnings)
  -- CRITICAL FIX: Only look for dividend accounts within EQUITY account type
  -- This prevents matching credit card names like "CIBC Dividend Platinum Visa"
  SELECT COALESCE(SUM(
    CASE
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
    AND a.account_type = 'equity'  -- <-- FIX: Only equity accounts can be dividends
    AND (a.equity_type = 'dividends' OR a.name ILIKE '%dividend%' OR a.name ILIKE '%drawing%');

  -- Direct adjustments to RE account within the period (NOT from CLOSE-* entries)
  IF v_re_account_id IS NOT NULL THEN
    SELECT COALESCE(SUM(
      CASE WHEN a.normal_balance = 'credit' 
           THEN jel.credit - jel.debit 
           ELSE jel.debit - jel.credit END
    ), 0)
    INTO v_direct_adjustment
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    JOIN public.accounts a ON a.id = jel.account_id
    WHERE a.id = v_re_account_id
      AND je.organization_id = p_organization_id
      AND je.status = 'posted'
      AND je.entry_date >= p_fiscal_year_start
      AND je.entry_date <= p_fiscal_year_end
      AND je.reference NOT LIKE 'CLOSE-%';
  ELSE
    v_direct_adjustment := 0;
  END IF;

  -- Categorize direct adjustments as additions or deductions
  IF v_direct_adjustment > 0 THEN
    v_other_additions := v_direct_adjustment;
    v_other_deductions := 0;
  ELSE
    v_other_additions := 0;
    v_other_deductions := ABS(v_direct_adjustment);
  END IF;

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

COMMENT ON FUNCTION public.calculate_retained_earnings_statement IS 
'Calculates Statement of Retained Earnings. Fixed to only look for dividend accounts within equity type (prevents matching CC names like "CIBC Dividend Platinum Visa").';
