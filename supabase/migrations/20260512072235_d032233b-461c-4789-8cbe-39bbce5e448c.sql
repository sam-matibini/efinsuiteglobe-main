-- Fix base-currency aggregation in financial RPCs so multi-currency orgs don't
-- inflate cached balances and break the Balance Sheet equation.

CREATE OR REPLACE FUNCTION public.recalculate_account_balance(p_account_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_opening_balance NUMERIC;
  v_normal_balance TEXT;
  v_total_debits NUMERIC;
  v_total_credits NUMERIC;
  v_calculated_balance NUMERIC;
BEGIN
  SELECT COALESCE(opening_balance, 0), normal_balance
  INTO v_opening_balance, v_normal_balance
  FROM accounts WHERE id = p_account_id;

  -- Sum base-currency amounts so multi-currency activity is aggregated in the
  -- base currency. Falls back to the transaction-currency columns for legacy
  -- single-currency rows where base columns are null.
  SELECT
    COALESCE(SUM(COALESCE(jel.base_currency_debit, jel.debit)), 0),
    COALESCE(SUM(COALESCE(jel.base_currency_credit, jel.credit)), 0)
  INTO v_total_debits, v_total_credits
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE jel.account_id = p_account_id
    AND je.status IN ('posted', 'reversed');

  IF v_normal_balance = 'debit' THEN
    v_calculated_balance := v_opening_balance + v_total_debits - v_total_credits;
  ELSE
    v_calculated_balance := v_opening_balance + v_total_credits - v_total_debits;
  END IF;

  RETURN v_calculated_balance;
END;
$function$;

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
SECURITY DEFINER
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
  SELECT COALESCE(o.fiscal_year_end_month, 12)
  INTO v_fy_end_month
  FROM public.organizations o
  WHERE o.id = p_organization_id;

  IF v_fy_end_month IS NULL THEN
    v_fy_end_month := 12;
  END IF;

  v_year := CASE
    WHEN v_fy_end_month = 12 THEN EXTRACT(YEAR FROM p_fiscal_year_end)::integer
    WHEN EXTRACT(MONTH FROM p_fiscal_year_end)::integer > v_fy_end_month
      THEN EXTRACT(YEAR FROM p_fiscal_year_end)::integer + 1
    ELSE EXTRACT(YEAR FROM p_fiscal_year_end)::integer
  END;

  v_opening := COALESCE(public.calculate_opening_retained_earnings(p_organization_id, v_year), 0);
  v_net_income := COALESCE(public.calculate_period_net_income(p_organization_id, p_fiscal_year_start, p_fiscal_year_end), 0);

  SELECT id INTO v_re_account_id
  FROM public.accounts
  WHERE organization_id = p_organization_id
    AND is_header = false
    AND (
      equity_type = 'retained_earnings'
      OR code = '3-00-201'
      OR code LIKE '3-01-200%'
      OR name ILIKE '%retained earnings%'
      OR name ILIKE '%unrestricted net assets%'
      OR name ILIKE '%accumulated surplus%'
      OR name ILIKE '%unrestricted funds%'
    )
  ORDER BY (code = '3-00-201') DESC, (code LIKE '3-01-200%') DESC, (equity_type = 'retained_earnings') DESC, code
  LIMIT 1;

  -- Dividends/Drawings for the period (base-currency aggregation)
  SELECT COALESCE(SUM(
    CASE
      WHEN a.normal_balance = 'debit'
        THEN COALESCE(jel.base_currency_debit, jel.debit) - COALESCE(jel.base_currency_credit, jel.credit)
      ELSE COALESCE(jel.base_currency_credit, jel.credit) - COALESCE(jel.base_currency_debit, jel.debit)
    END
  ), 0)
  INTO v_dividends
  FROM public.journal_entry_lines jel
  JOIN public.journal_entries je ON je.id = jel.journal_entry_id
  JOIN public.accounts a ON a.id = jel.account_id
  WHERE je.organization_id = p_organization_id
    AND je.status IN ('posted', 'reversed')
    AND je.entry_date >= p_fiscal_year_start
    AND je.entry_date <= p_fiscal_year_end
    AND a.is_header = false
    AND a.account_type = 'equity'
    AND (a.equity_type = 'dividends' OR a.name ILIKE '%dividend%' OR a.name ILIKE '%drawing%');

  -- Direct adjustments to RE account within the period (base-currency aggregation)
  IF v_re_account_id IS NOT NULL THEN
    SELECT COALESCE(SUM(
      CASE WHEN a.normal_balance = 'credit'
           THEN COALESCE(jel.base_currency_credit, jel.credit) - COALESCE(jel.base_currency_debit, jel.debit)
           ELSE COALESCE(jel.base_currency_debit, jel.debit) - COALESCE(jel.base_currency_credit, jel.credit)
      END
    ), 0)
    INTO v_direct_adjustment
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    JOIN public.accounts a ON a.id = jel.account_id
    WHERE a.id = v_re_account_id
      AND je.organization_id = p_organization_id
      AND je.status IN ('posted', 'reversed')
      AND je.entry_date >= p_fiscal_year_start
      AND je.entry_date <= p_fiscal_year_end
      AND je.reference NOT LIKE 'CLOSE-%';
  ELSE
    v_direct_adjustment := 0;
  END IF;

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