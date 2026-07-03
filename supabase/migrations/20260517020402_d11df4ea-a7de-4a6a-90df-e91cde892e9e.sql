-- Align Balance Sheet helper RPCs with Trial Balance source of truth:
-- * Use base_currency_debit/credit with fallback to raw debit/credit
-- * Include both 'posted' and 'reversed' statuses so reversals net to zero
-- * Continue to honor opening_balance once per account

CREATE OR REPLACE FUNCTION public.calculate_total_assets(p_organization_id uuid, p_as_of_date date)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_assets NUMERIC;
BEGIN
  SELECT
    COALESCE(SUM(
      CASE WHEN a.normal_balance = 'debit' THEN 1 ELSE -1 END *
      (COALESCE(a.opening_balance, 0) + COALESCE(
        (SELECT SUM(
           CASE WHEN a.normal_balance = 'debit'
                THEN COALESCE(jel2.base_currency_debit,  jel2.debit)
                   - COALESCE(jel2.base_currency_credit, jel2.credit)
                ELSE COALESCE(jel2.base_currency_credit, jel2.credit)
                   - COALESCE(jel2.base_currency_debit,  jel2.debit)
           END
         )
         FROM journal_entry_lines jel2
         JOIN journal_entries je2 ON jel2.journal_entry_id = je2.id
         WHERE je2.status IN ('posted','reversed')
           AND jel2.account_id = a.id
           AND je2.entry_date <= p_as_of_date
        ), 0))
    ), 0)
  INTO v_total_assets
  FROM accounts a
  WHERE a.organization_id = p_organization_id
    AND a.account_type = 'asset'
    AND a.is_header = false;

  RETURN v_total_assets;
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_total_liabilities(p_organization_id uuid, p_as_of_date date)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_liabilities NUMERIC;
BEGIN
  SELECT
    COALESCE(SUM(
      CASE WHEN a.normal_balance = 'credit' THEN 1 ELSE -1 END *
      (COALESCE(a.opening_balance, 0) + COALESCE(
        (SELECT SUM(
           CASE WHEN a.normal_balance = 'credit'
                THEN COALESCE(jel2.base_currency_credit, jel2.credit)
                   - COALESCE(jel2.base_currency_debit,  jel2.debit)
                ELSE COALESCE(jel2.base_currency_debit,  jel2.debit)
                   - COALESCE(jel2.base_currency_credit, jel2.credit)
           END
         )
         FROM journal_entry_lines jel2
         JOIN journal_entries je2 ON jel2.journal_entry_id = je2.id
         WHERE je2.status IN ('posted','reversed')
           AND jel2.account_id = a.id
           AND je2.entry_date <= p_as_of_date
        ), 0))
    ), 0)
  INTO v_total_liabilities
  FROM accounts a
  WHERE a.organization_id = p_organization_id
    AND a.account_type = 'liability'
    AND a.is_header = false;

  RETURN v_total_liabilities;
END;
$function$;

-- Update get_balance_sheet_data and validate_balance_sheet_equation to compute
-- "other equity" using base-currency amounts and include reversed entries.

CREATE OR REPLACE FUNCTION public.get_balance_sheet_data(p_organization_id uuid, p_fiscal_year_start date, p_as_of_date date)
RETURNS TABLE(total_assets numeric, total_liabilities numeric, total_equity numeric, net_income numeric, total_shareholders_equity numeric, total_liabilities_and_equity numeric, is_balanced boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_assets NUMERIC;
  v_liabilities NUMERIC;
  v_other_equity NUMERIC;
  v_net_income NUMERIC;
  v_re_closing NUMERIC;
  v_total_sh_equity NUMERIC;
  v_total_le NUMERIC;
BEGIN
  v_assets := public.calculate_total_assets(p_organization_id, p_as_of_date);
  v_liabilities := public.calculate_total_liabilities(p_organization_id, p_as_of_date);
  v_net_income := public.calculate_period_net_income(p_organization_id, p_fiscal_year_start, p_as_of_date);

  SELECT res.closing_balance INTO v_re_closing
  FROM public.calculate_retained_earnings_statement(p_organization_id, p_fiscal_year_start, p_as_of_date) res;

  SELECT COALESCE(SUM(
    CASE WHEN a.normal_balance = 'credit' THEN 1 ELSE -1 END *
    (COALESCE(a.opening_balance, 0) + COALESCE(
      (SELECT SUM(
         CASE WHEN a.normal_balance = 'credit'
              THEN COALESCE(jel2.base_currency_credit, jel2.credit)
                 - COALESCE(jel2.base_currency_debit,  jel2.debit)
              ELSE COALESCE(jel2.base_currency_debit,  jel2.debit)
                 - COALESCE(jel2.base_currency_credit, jel2.credit)
         END
       )
       FROM journal_entry_lines jel2
       JOIN journal_entries je2 ON jel2.journal_entry_id = je2.id
       WHERE je2.status IN ('posted','reversed')
         AND jel2.account_id = a.id
         AND je2.entry_date <= p_as_of_date
      ), 0))
  ), 0)
  INTO v_other_equity
  FROM accounts a
  WHERE a.organization_id = p_organization_id
    AND a.account_type = 'equity'
    AND a.is_header = false
    AND a.code != '3-00-202'
    AND NOT (a.name ILIKE '%current year earnings%')
    AND a.code != '3-00-201'
    AND NOT (a.name ILIKE 'retained earnings')
    AND NOT (a.name ILIKE '%accumulated deficit%')
    AND NOT (a.equity_type = 'retained_earnings');

  v_total_sh_equity := COALESCE(v_other_equity, 0) + COALESCE(v_re_closing, 0);
  v_total_le := v_liabilities + v_total_sh_equity;

  RETURN QUERY SELECT
    ROUND(v_assets, 2),
    ROUND(v_liabilities, 2),
    ROUND(v_other_equity, 2),
    ROUND(v_net_income, 2),
    ROUND(v_total_sh_equity, 2),
    ROUND(v_total_le, 2),
    (ABS(v_assets - v_total_le) < 0.02)::BOOLEAN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_balance_sheet_equation(p_organization_id uuid, p_fiscal_year_start date, p_as_of_date date)
RETURNS TABLE(is_balanced boolean, total_assets numeric, total_liabilities numeric, total_equity numeric, current_year_earnings numeric, total_liabilities_equity numeric, difference numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_assets NUMERIC;
  v_liabilities NUMERIC;
  v_other_equity NUMERIC;
  v_re_closing NUMERIC;
  v_net_income NUMERIC;
  v_total_sh_equity NUMERIC;
  v_le_total NUMERIC;
  v_diff NUMERIC;
BEGIN
  v_assets := public.calculate_total_assets(p_organization_id, p_as_of_date);
  v_liabilities := public.calculate_total_liabilities(p_organization_id, p_as_of_date);
  v_net_income := public.calculate_period_net_income(p_organization_id, p_fiscal_year_start, p_as_of_date);

  SELECT res.closing_balance INTO v_re_closing
  FROM public.calculate_retained_earnings_statement(p_organization_id, p_fiscal_year_start, p_as_of_date) res;

  SELECT COALESCE(SUM(
    CASE WHEN a.normal_balance = 'credit' THEN 1 ELSE -1 END *
    (COALESCE(a.opening_balance, 0) + COALESCE(
      (SELECT SUM(
         CASE WHEN a.normal_balance = 'credit'
              THEN COALESCE(jel2.base_currency_credit, jel2.credit)
                 - COALESCE(jel2.base_currency_debit,  jel2.debit)
              ELSE COALESCE(jel2.base_currency_debit,  jel2.debit)
                 - COALESCE(jel2.base_currency_credit, jel2.credit)
         END
       )
       FROM journal_entry_lines jel2
       JOIN journal_entries je2 ON jel2.journal_entry_id = je2.id
       WHERE je2.status IN ('posted','reversed')
         AND jel2.account_id = a.id
         AND je2.entry_date <= p_as_of_date
      ), 0))
  ), 0)
  INTO v_other_equity
  FROM accounts a
  WHERE a.organization_id = p_organization_id
    AND a.account_type = 'equity'
    AND a.is_header = false
    AND a.code != '3-00-202'
    AND NOT (a.name ILIKE '%current year earnings%')
    AND a.code != '3-00-201'
    AND NOT (a.name ILIKE 'retained earnings')
    AND NOT (a.name ILIKE '%accumulated deficit%')
    AND NOT (a.equity_type = 'retained_earnings');

  v_total_sh_equity := COALESCE(v_other_equity, 0) + COALESCE(v_re_closing, 0);
  v_le_total := v_liabilities + v_total_sh_equity;
  v_diff := ABS(v_assets - v_le_total);

  RETURN QUERY SELECT
    (v_diff < 0.02)::BOOLEAN,
    ROUND(v_assets, 2),
    ROUND(v_liabilities, 2),
    ROUND(v_total_sh_equity, 2),
    ROUND(v_net_income, 2),
    ROUND(v_le_total, 2),
    ROUND(v_diff, 2);
END;
$function$;