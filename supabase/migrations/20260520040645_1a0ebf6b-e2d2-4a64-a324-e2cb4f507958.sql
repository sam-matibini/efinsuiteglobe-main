CREATE OR REPLACE FUNCTION public.populate_equity_movements(
  p_organization_id uuid,
  p_fiscal_year integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_fiscal_start DATE;
  v_fiscal_end DATE;
  v_fy_end_month INTEGER;
  v_re_account RECORD;
  v_sc_account RECORD;
  v_opening NUMERIC;
  v_contributions NUMERIC;
  v_net_income NUMERIC;
  v_distributions NUMERIC;
  v_closing NUMERIC;
BEGIN
  SELECT COALESCE(fiscal_year_end_month, 12) INTO v_fy_end_month
  FROM organizations WHERE id = p_organization_id;

  IF v_fy_end_month = 12 THEN
    v_fiscal_start := make_date(p_fiscal_year, 1, 1);
    v_fiscal_end := make_date(p_fiscal_year, 12, 31);
  ELSE
    v_fiscal_start := make_date(p_fiscal_year - 1, v_fy_end_month + 1, 1);
    v_fiscal_end := (make_date(p_fiscal_year, v_fy_end_month + 1, 1) - INTERVAL '1 day')::DATE;
  END IF;

  DELETE FROM equity_movements
  WHERE organization_id = p_organization_id
    AND fiscal_year = p_fiscal_year;

  -- RETAINED EARNINGS
  SELECT id INTO v_re_account
  FROM accounts
  WHERE organization_id = p_organization_id
    AND equity_category = 'RETAINED_EARNINGS'
    AND is_header = false
  LIMIT 1;

  IF v_re_account IS NOT NULL THEN
    SELECT COALESCE(opening_re, 0) INTO v_opening
    FROM get_retained_earnings_rollforward_series(p_organization_id, p_fiscal_year, p_fiscal_year)
    LIMIT 1;

    SELECT COALESCE(net_income, 0) INTO v_net_income
    FROM get_retained_earnings_rollforward_series(p_organization_id, p_fiscal_year, p_fiscal_year)
    LIMIT 1;

    SELECT COALESCE(dividends, 0) INTO v_distributions
    FROM get_retained_earnings_rollforward_series(p_organization_id, p_fiscal_year, p_fiscal_year)
    LIMIT 1;

    v_closing := v_opening + v_net_income - v_distributions;

    INSERT INTO equity_movements (organization_id, fiscal_year, equity_account_id, movement_type, amount)
    VALUES
      (p_organization_id, p_fiscal_year, v_re_account.id, 'OPENING_BALANCE', v_opening),
      (p_organization_id, p_fiscal_year, v_re_account.id, 'NET_INCOME', v_net_income);

    IF v_distributions <> 0 THEN
      INSERT INTO equity_movements (organization_id, fiscal_year, equity_account_id, movement_type, amount)
      VALUES (p_organization_id, p_fiscal_year, v_re_account.id, 'DIVIDENDS', v_distributions);
    END IF;

    INSERT INTO equity_movements (organization_id, fiscal_year, equity_account_id, movement_type, amount)
    VALUES (p_organization_id, p_fiscal_year, v_re_account.id, 'CLOSING_BALANCE', v_closing);
  END IF;

  -- COMMON STOCK
  FOR v_sc_account IN
    SELECT id, COALESCE(opening_balance, 0) AS opening_balance
    FROM accounts
    WHERE organization_id = p_organization_id
      AND equity_category = 'COMMON_STOCK'
      AND is_header = false
  LOOP
    SELECT v_sc_account.opening_balance + COALESCE(SUM(jel.credit - jel.debit), 0)
    INTO v_opening
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    WHERE jel.account_id = v_sc_account.id
      AND je.status = 'posted'
      AND je.entry_date < v_fiscal_start;

    SELECT COALESCE(SUM(jel.credit - jel.debit), 0)
    INTO v_contributions
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    WHERE jel.account_id = v_sc_account.id
      AND je.status = 'posted'
      AND je.entry_date >= v_fiscal_start
      AND je.entry_date <= v_fiscal_end;

    v_closing := v_opening + v_contributions;

    INSERT INTO equity_movements (organization_id, fiscal_year, equity_account_id, movement_type, amount)
    VALUES (p_organization_id, p_fiscal_year, v_sc_account.id, 'OPENING_BALANCE', v_opening);

    IF v_contributions <> 0 THEN
      INSERT INTO equity_movements (organization_id, fiscal_year, equity_account_id, movement_type, amount)
      VALUES (p_organization_id, p_fiscal_year, v_sc_account.id, 'SHARE_ISSUANCE', v_contributions);
    END IF;

    INSERT INTO equity_movements (organization_id, fiscal_year, equity_account_id, movement_type, amount)
    VALUES (p_organization_id, p_fiscal_year, v_sc_account.id, 'CLOSING_BALANCE', v_closing);
  END LOOP;
END;
$function$;