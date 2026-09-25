-- Fix Retained Earnings year-over-year continuity.
--
-- Bug: calculate_retained_earnings_statement folded in-year (non CLOSE-*)
-- postings to the RE account into OPENING for every year. That made
-- Opening RE (Year N) differ from Closing RE (Year N-1). Example for
-- 1307781 Canada Inc. (FYE 30 June):
--   Closing 2025-06-30 = 117,307.00
--   Opening 2026-06-30 = 119,889.86  (should equal 117,307.00)
--
-- Contract (ASPE / IAS 1 / CRA GIFI):
--   Opening RE (Year N) = Closing RE (Year N-1)
--   Closing RE = Opening + Net Income - Dividends + Other additions - Other deductions
--
-- First year of books: in-year RE journals are opening-balance carryforward
-- and belong in Opening. Later years: those journals are prior-period
-- adjustments (other additions/deductions) so the rollover identity holds.

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
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_year integer;
  v_fy_end_month integer := 12;
  v_first_year integer;
  v_loop_year integer;
  v_fy_start date;
  v_fy_end date;
  v_re_account_id uuid;
  v_opening numeric := 0;
  v_ni numeric := 0;
  v_div numeric := 0;
  v_direct numeric := 0;
  v_other_add numeric := 0;
  v_other_ded numeric := 0;
  v_closing numeric := 0;
  v_prev_closing numeric;
  v_has_row boolean := false;
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

  SELECT MIN(
    CASE
      WHEN v_fy_end_month = 12 THEN EXTRACT(YEAR FROM je.entry_date)::integer
      WHEN EXTRACT(MONTH FROM je.entry_date)::integer > v_fy_end_month
        THEN EXTRACT(YEAR FROM je.entry_date)::integer + 1
      ELSE EXTRACT(YEAR FROM je.entry_date)::integer
    END
  )
  INTO v_first_year
  FROM public.journal_entries je
  WHERE je.organization_id = p_organization_id
    AND je.status IN ('posted', 'reversed');

  IF v_first_year IS NULL OR v_year < v_first_year THEN
    RETURN QUERY SELECT
      0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  SELECT id INTO v_re_account_id
  FROM public.accounts
  WHERE organization_id = p_organization_id
    AND is_header = false
    AND account_type = 'equity'
    AND (
      equity_type = 'retained_earnings'
      OR code = '3-00-201'
      OR name ILIKE '%retained earnings%'
      OR name ILIKE '%unrestricted net assets%'
      OR name ILIKE '%accumulated surplus%'
      OR name ILIKE '%unrestricted funds%'
    )
    AND name NOT ILIKE '%dividend%'
    AND name NOT ILIKE '%drawing%'
    AND name NOT ILIKE '%common shares%'
    AND name NOT ILIKE '%common stock%'
    AND name NOT ILIKE '%share capital%'
    AND name NOT ILIKE '%paid-in capital%'
    AND (equity_type IS NULL OR equity_type NOT IN ('dividends', 'share_capital', 'current_earnings'))
  ORDER BY
    (equity_type = 'retained_earnings') DESC,
    (name ILIKE '%retained earnings%') DESC,
    (code = '3-00-201') DESC,
    code
  LIMIT 1;

  v_prev_closing := NULL;

  FOR v_loop_year IN v_first_year..v_year LOOP
    IF v_fy_end_month = 12 THEN
      v_fy_start := make_date(v_loop_year, 1, 1);
      v_fy_end := make_date(v_loop_year, 12, 31);
    ELSE
      v_fy_start := make_date(v_loop_year - 1, v_fy_end_month + 1, 1);
      v_fy_end := (make_date(v_loop_year, v_fy_end_month, 1) + INTERVAL '1 month' - INTERVAL '1 day')::date;
    END IF;

    -- Requested period may be a stub (Balance Sheet as-of date before FYE).
    IF v_loop_year = v_year THEN
      v_fy_start := p_fiscal_year_start;
      v_fy_end := p_fiscal_year_end;
    END IF;

    v_ni := COALESCE(public.calculate_period_net_income(p_organization_id, v_fy_start, v_fy_end), 0);

    SELECT COALESCE(SUM(
      CASE
        WHEN a.normal_balance = 'debit'
          THEN COALESCE(jel.base_currency_debit, jel.debit) - COALESCE(jel.base_currency_credit, jel.credit)
        ELSE COALESCE(jel.base_currency_credit, jel.credit) - COALESCE(jel.base_currency_debit, jel.debit)
      END
    ), 0)
    INTO v_div
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    JOIN public.accounts a ON a.id = jel.account_id
    WHERE je.organization_id = p_organization_id
      AND je.status IN ('posted', 'reversed')
      AND je.entry_date >= v_fy_start
      AND je.entry_date <= v_fy_end
      AND je.reference NOT LIKE 'CLOSE-%'
      AND a.is_header = false
      AND a.account_type = 'equity'
      AND (a.equity_type = 'dividends' OR a.name ILIKE '%dividend%' OR a.name ILIKE '%drawing%');

    IF v_re_account_id IS NOT NULL THEN
      SELECT COALESCE(SUM(
        CASE WHEN a.normal_balance = 'credit'
             THEN COALESCE(jel.base_currency_credit, jel.credit) - COALESCE(jel.base_currency_debit, jel.debit)
             ELSE COALESCE(jel.base_currency_debit, jel.debit) - COALESCE(jel.base_currency_credit, jel.credit)
        END
      ), 0)
      INTO v_direct
      FROM public.journal_entry_lines jel
      JOIN public.journal_entries je ON je.id = jel.journal_entry_id
      JOIN public.accounts a ON a.id = jel.account_id
      WHERE a.id = v_re_account_id
        AND je.organization_id = p_organization_id
        AND je.status IN ('posted', 'reversed')
        AND je.entry_date >= v_fy_start
        AND je.entry_date <= v_fy_end
        AND je.reference NOT LIKE 'CLOSE-%';
    ELSE
      v_direct := 0;
    END IF;

    -- First year of books: RE journals are opening carryforward.
    -- Later years: Opening = prior closing; in-year RE journals are PPA.
    IF v_prev_closing IS NULL THEN
      v_opening := v_direct;
      v_other_add := 0;
      v_other_ded := 0;
    ELSE
      v_opening := v_prev_closing;
      IF v_direct >= 0 THEN
        v_other_add := v_direct;
        v_other_ded := 0;
      ELSE
        v_other_add := 0;
        v_other_ded := -v_direct;
      END IF;
    END IF;

    v_opening := ROUND(v_opening, 2);
    v_ni := ROUND(v_ni, 2);
    v_div := ROUND(COALESCE(v_div, 0), 2);
    v_other_add := ROUND(v_other_add, 2);
    v_other_ded := ROUND(v_other_ded, 2);
    v_closing := ROUND(v_opening + v_ni - v_div + v_other_add - v_other_ded, 2);
    v_prev_closing := v_closing;
    v_has_row := true;
  END LOOP;

  IF NOT v_has_row THEN
    RETURN QUERY SELECT
      0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    v_opening,
    v_ni,
    v_div,
    v_other_add,
    v_other_ded,
    v_closing;
END;
$function$;

COMMENT ON FUNCTION public.calculate_retained_earnings_statement(uuid, date, date) IS
  'Statement of Retained Earnings with year-over-year rollover: Opening(N) = Closing(N-1). First-year RE journals go to opening; later-year RE journals are prior-period adjustments.';

-- Opening RE (Year N) is defined as Closing RE (Year N-1) from the same statement.
CREATE OR REPLACE FUNCTION public.calculate_opening_retained_earnings(
  p_organization_id uuid,
  p_fiscal_year integer
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fy_end_month integer := 12;
  v_first_year integer;
  v_prior_start date;
  v_prior_end date;
  v_closing numeric;
BEGIN
  SELECT COALESCE(fiscal_year_end_month, 12)
  INTO v_fy_end_month
  FROM public.organizations
  WHERE id = p_organization_id;

  IF v_fy_end_month IS NULL THEN
    v_fy_end_month := 12;
  END IF;

  SELECT MIN(
    CASE
      WHEN v_fy_end_month = 12 THEN EXTRACT(YEAR FROM je.entry_date)::integer
      WHEN EXTRACT(MONTH FROM je.entry_date)::integer > v_fy_end_month
        THEN EXTRACT(YEAR FROM je.entry_date)::integer + 1
      ELSE EXTRACT(YEAR FROM je.entry_date)::integer
    END
  )
  INTO v_first_year
  FROM public.journal_entries je
  WHERE je.organization_id = p_organization_id
    AND je.status IN ('posted', 'reversed');

  IF v_first_year IS NULL OR p_fiscal_year <= v_first_year THEN
    RETURN 0;
  END IF;

  IF v_fy_end_month = 12 THEN
    v_prior_start := make_date(p_fiscal_year - 1, 1, 1);
    v_prior_end := make_date(p_fiscal_year - 1, 12, 31);
  ELSE
    v_prior_start := make_date(p_fiscal_year - 2, v_fy_end_month + 1, 1);
    v_prior_end := (make_date(p_fiscal_year - 1, v_fy_end_month, 1) + INTERVAL '1 month' - INTERVAL '1 day')::date;
  END IF;

  SELECT s.closing_balance
  INTO v_closing
  FROM public.calculate_retained_earnings_statement(
    p_organization_id,
    v_prior_start,
    v_prior_end
  ) s;

  RETURN ROUND(COALESCE(v_closing, 0), 2);
END;
$function$;

COMMENT ON FUNCTION public.calculate_opening_retained_earnings(uuid, integer) IS
  'Opening Retained Earnings for a fiscal year = Closing Retained Earnings of the prior fiscal year.';

-- Keep SOCE / rollforward series on the same statement so Opening(N) = Closing(N-1).
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
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_first_year integer;
  v_last_year integer;
  v_loop_year integer;
  v_fy_end_month integer;
  v_fy_start date;
  v_fy_end date;
  v_opening numeric;
  v_ni numeric;
  v_div numeric;
  v_closing numeric;
BEGIN
  SELECT COALESCE(o.fiscal_year_end_month, 12)
  INTO v_fy_end_month
  FROM public.organizations o
  WHERE o.id = p_organization_id;

  IF v_fy_end_month IS NULL THEN
    v_fy_end_month := 12;
  END IF;

  SELECT MIN(
    CASE
      WHEN v_fy_end_month = 12 THEN EXTRACT(YEAR FROM je.entry_date)::integer
      WHEN EXTRACT(MONTH FROM je.entry_date)::integer > v_fy_end_month
        THEN EXTRACT(YEAR FROM je.entry_date)::integer + 1
      ELSE EXTRACT(YEAR FROM je.entry_date)::integer
    END
  )
  INTO v_first_year
  FROM public.journal_entries je
  WHERE je.organization_id = p_organization_id
    AND je.status IN ('posted', 'reversed');

  IF v_first_year IS NULL THEN
    RETURN;
  END IF;

  v_first_year := COALESCE(p_start_year, v_first_year);
  v_last_year := COALESCE(p_end_year,
    CASE
      WHEN v_fy_end_month = 12 THEN EXTRACT(YEAR FROM CURRENT_DATE)::integer
      WHEN EXTRACT(MONTH FROM CURRENT_DATE)::integer > v_fy_end_month
        THEN EXTRACT(YEAR FROM CURRENT_DATE)::integer + 1
      ELSE EXTRACT(YEAR FROM CURRENT_DATE)::integer
    END
  );

  FOR v_loop_year IN v_first_year..v_last_year LOOP
    IF v_fy_end_month = 12 THEN
      v_fy_start := make_date(v_loop_year, 1, 1);
      v_fy_end := make_date(v_loop_year, 12, 31);
    ELSE
      v_fy_start := make_date(v_loop_year - 1, v_fy_end_month + 1, 1);
      v_fy_end := (make_date(v_loop_year, v_fy_end_month, 1) + INTERVAL '1 month' - INTERVAL '1 day')::date;
    END IF;

    SELECT s.opening_balance, s.net_income_loss, s.dividends_declared, s.closing_balance
    INTO v_opening, v_ni, v_div, v_closing
    FROM public.calculate_retained_earnings_statement(
      p_organization_id,
      v_fy_start,
      v_fy_end
    ) s;

    RETURN QUERY SELECT
      v_loop_year,
      ROUND(COALESCE(v_opening, 0), 2),
      ROUND(COALESCE(v_ni, 0), 2),
      ROUND(COALESCE(v_div, 0), 2),
      ROUND(COALESCE(v_closing, 0), 2);
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.calculate_retained_earnings_statement(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_opening_retained_earnings(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_retained_earnings_rollforward_series(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_retained_earnings_rollforward_series(uuid, integer, integer) TO service_role;

-- Align the close-time rollforward helper with the same statement.
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
BEGIN
  RETURN QUERY
  SELECT
    s.opening_balance,
    s.net_income_loss,
    s.dividends_declared,
    ROUND(s.other_additions - s.other_deductions, 2),
    s.closing_balance
  FROM public.calculate_retained_earnings_statement(
    p_organization_id,
    p_fiscal_year_start,
    p_fiscal_year_end
  ) s;
END;
$function$;
