CREATE OR REPLACE FUNCTION public.validate_trial_balance(
  p_organization_id uuid,
  p_as_of_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  is_balanced boolean,
  total_debits numeric,
  total_credits numeric,
  difference numeric,
  account_count integer,
  checked_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_debits NUMERIC := 0;
  v_total_credits NUMERIC := 0;
  v_account_count INTEGER := 0;
BEGIN
  -- Real-time trial balance validation from live JE data (not stale current_balance cache).
  -- Sums BASE-currency amounts so multi-currency activity nets correctly.
  -- Falls back to raw debit/credit for legacy rows where base columns are null.
  -- Includes both 'posted' AND 'reversed' statuses: reversals net to zero by design.
  SELECT
    COALESCE(SUM(COALESCE(jel.base_currency_debit, jel.debit)), 0),
    COALESCE(SUM(COALESCE(jel.base_currency_credit, jel.credit)), 0),
    COUNT(DISTINCT jel.account_id)
  INTO v_total_debits, v_total_credits, v_account_count
  FROM public.journal_entry_lines jel
  JOIN public.journal_entries je ON jel.journal_entry_id = je.id
  JOIN public.accounts a ON a.id = jel.account_id
  WHERE je.organization_id = p_organization_id
    AND je.status IN ('posted', 'reversed')
    AND je.entry_date <= p_as_of_date
    AND a.is_header = false;

  RETURN QUERY SELECT
    ABS(v_total_debits - v_total_credits) <= 0.02,
    v_total_debits,
    v_total_credits,
    ABS(v_total_debits - v_total_credits),
    v_account_count,
    now();
END;
$function$;