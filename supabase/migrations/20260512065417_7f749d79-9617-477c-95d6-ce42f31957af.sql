CREATE OR REPLACE FUNCTION public.get_period_revenue_total(
  p_org_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH settlement_entries AS (
    SELECT je.id
    FROM journal_entries je
    WHERE je.organization_id = p_org_id
      AND je.entry_date BETWEEN p_start_date AND p_end_date
      AND je.status IN ('posted','reversed')
      AND NOT EXISTS (
        SELECT 1 FROM journal_entry_lines jl
        JOIN accounts a ON a.id = jl.account_id
        WHERE jl.journal_entry_id = je.id
          AND a.account_type IN ('income','expense')
      )
  )
  SELECT COALESCE(SUM(
    COALESCE(jel.base_currency_credit, jel.credit)
    - COALESCE(jel.base_currency_debit, jel.debit)
  ), 0)::numeric
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  JOIN accounts a ON a.id = jel.account_id
  WHERE je.organization_id = p_org_id
    AND je.entry_date BETWEEN p_start_date AND p_end_date
    AND je.status IN ('posted','reversed')
    AND a.account_type = 'income'
    -- Exclude FX gain/loss accounts; they are not "Sales and other revenue"
    AND a.name NOT ILIKE '%foreign exchange%'
    AND a.name NOT ILIKE '%fx gain%'
    AND a.name NOT ILIKE '%fx loss%'
    AND a.name NOT ILIKE '%realized fx%'
    AND a.name NOT ILIKE '%unrealized fx%'
    AND a.name NOT ILIKE '%currency gain%'
    AND a.name NOT ILIKE '%currency loss%'
    AND je.id NOT IN (SELECT id FROM settlement_entries);
$$;

GRANT EXECUTE ON FUNCTION public.get_period_revenue_total(uuid, date, date) TO authenticated, anon, service_role;