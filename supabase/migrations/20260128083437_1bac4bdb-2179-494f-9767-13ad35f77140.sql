CREATE OR REPLACE FUNCTION public.calculate_opening_retained_earnings(p_organization_id uuid, p_fiscal_year integer)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_re_account_id UUID;
  v_opening_balance NUMERIC;
  v_prior_year_end DATE;
  v_re_posted_activity NUMERIC;
  v_first_data_year INTEGER;
BEGIN
  -- First year of operations: opening retained earnings is always zero
  SELECT MIN(EXTRACT(YEAR FROM je.entry_date))::INTEGER
  INTO v_first_data_year
  FROM public.journal_entries je
  WHERE je.organization_id = p_organization_id
    AND je.status = 'posted';

  IF v_first_data_year IS NULL OR p_fiscal_year <= v_first_data_year THEN
    RETURN 0;
  END IF;

  -- Get Retained Earnings account
  SELECT id, COALESCE(opening_balance, 0)
  INTO v_re_account_id, v_opening_balance
  FROM public.accounts
  WHERE organization_id = p_organization_id
    AND is_header = false
    AND (
      equity_type = 'retained_earnings'
      OR code = '3-00-201'
      OR name ILIKE '%retained earnings%'
    )
  ORDER BY (code = '3-00-201') DESC, code
  LIMIT 1;

  IF v_re_account_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Opening RE for fiscal year Y = RE account balance as of prior year end
  -- (i.e., only what has actually been posted to the Retained Earnings account).
  v_prior_year_end := make_date(p_fiscal_year - 1, 12, 31);

  SELECT COALESCE(SUM(
    CASE WHEN a.normal_balance = 'credit'
         THEN jel.credit - jel.debit
         ELSE jel.debit - jel.credit END
  ), 0)
  INTO v_re_posted_activity
  FROM public.journal_entry_lines jel
  JOIN public.journal_entries je ON je.id = jel.journal_entry_id
  JOIN public.accounts a ON a.id = jel.account_id
  WHERE a.id = v_re_account_id
    AND je.status = 'posted'
    AND je.entry_date <= v_prior_year_end;

  RETURN ROUND(v_opening_balance + COALESCE(v_re_posted_activity, 0), 2);
END;
$function$;