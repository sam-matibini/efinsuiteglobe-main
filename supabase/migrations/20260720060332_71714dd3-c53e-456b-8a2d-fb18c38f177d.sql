
-- Align get_retained_earnings_rollforward_series with calculate_retained_earnings_statement:
-- direct RE postings (non CLOSE-*) posted inside the fiscal year that represent a
-- brought-forward opening deficit/surplus must be reflected in the OPENING balance,
-- not silently folded into closing. This fixes the SOCE showing "-" for opening RE
-- of the earliest fiscal year when an opening-balance journal was posted to RE.

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
  SELECT COALESCE(o.fiscal_year_end_month, 12)
  INTO v_fy_end_month
  FROM organizations o
  WHERE o.id = p_organization_id;

  IF v_fy_end_month IS NULL THEN
    v_fy_end_month := 12;
  END IF;

  SELECT id INTO v_re_account_id
  FROM accounts
  WHERE organization_id = p_organization_id
    AND is_header = false
    AND (equity_type = 'retained_earnings'
         OR code = '3-00-201'
         OR code LIKE '3-01-200%'
         OR name ILIKE '%retained earnings%'
         OR name ILIKE '%unrestricted net assets%'
         OR name ILIKE '%accumulated surplus%'
         OR name ILIKE '%unrestricted funds%')
  ORDER BY (code = '3-00-201') DESC, (code LIKE '3-01-200%') DESC, (equity_type = 'retained_earnings') DESC, code
  LIMIT 1;

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
    IF v_fy_end_month = 12 THEN
      v_fy_start := make_date(v_loop_year, 1, 1);
      v_fy_end := make_date(v_loop_year, 12, 31);
    ELSE
      v_fy_start := make_date(v_loop_year - 1, v_fy_end_month + 1, 1);
      v_fy_end := (make_date(v_loop_year, v_fy_end_month, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    END IF;

    v_opening_re := COALESCE(public.calculate_opening_retained_earnings(p_organization_id, v_loop_year), 0);

    v_ni := COALESCE(public.calculate_period_net_income(
      p_organization_id,
      v_fy_start,
      v_fy_end
    ), 0);

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

    -- Direct RE postings in the period (excluding system CLOSE-* entries).
    -- These represent brought-forward opening balances or prior-period adjustments,
    -- so they belong in OPENING (matching calculate_retained_earnings_statement),
    -- not in closing.
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

    v_opening_re := v_opening_re + COALESCE(v_direct_adj, 0);

    -- Preserve the roll-forward identity: closing = opening + NI - dividends
    v_closing_re := v_opening_re + v_ni - COALESCE(v_div, 0);

    RETURN QUERY SELECT
      v_loop_year,
      ROUND(v_opening_re, 2),
      ROUND(v_ni, 2),
      ROUND(COALESCE(v_div, 0), 2),
      ROUND(v_closing_re, 2);
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_retained_earnings_rollforward_series(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_retained_earnings_rollforward_series(uuid, integer, integer) TO service_role;
