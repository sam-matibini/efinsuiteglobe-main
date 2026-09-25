CREATE OR REPLACE FUNCTION public.get_tax_movements_by_code(
  p_org_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  tax_code_id uuid,
  code text,
  name text,
  rate numeric,
  tax_type text,
  jurisdiction text,
  authority_id uuid,
  authority_name text,
  is_recoverable boolean,
  side text,
  gl_account_id uuid,
  account_code text,
  account_name text,
  tax_amount numeric,
  taxable_amount numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH movements AS (
    SELECT
      tc.id              AS tax_code_id,
      tc.code,
      tc.name,
      tc.rate,
      tc.tax_type,
      tc.jurisdiction,
      tc.tax_authority_id AS authority_id,
      ta.name             AS authority_name,
      tc.is_recoverable,
      'collected'::text   AS side,
      a.id                AS gl_account_id,
      a.code              AS account_code,
      a.name              AS account_name,
      COALESCE(jel.credit, 0) - COALESCE(jel.debit, 0) AS tax_amount
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    JOIN accounts a         ON a.id = jel.account_id
    JOIN tax_codes tc       ON tc.gl_collected_account_id = a.id
                           AND tc.organization_id = p_org_id
    LEFT JOIN tax_authorities ta ON ta.id = tc.tax_authority_id
    WHERE je.organization_id = p_org_id
      AND je.status IN ('posted','reversed')
      AND je.entry_date BETWEEN p_start_date AND p_end_date
      AND COALESCE(je.reference, '') NOT LIKE 'CLOSE-%'

    UNION ALL

    SELECT
      tc.id,
      tc.code,
      tc.name,
      tc.rate,
      tc.tax_type,
      tc.jurisdiction,
      tc.tax_authority_id,
      ta.name,
      tc.is_recoverable,
      'paid'::text,
      a.id,
      a.code,
      a.name,
      COALESCE(jel.debit, 0) - COALESCE(jel.credit, 0)
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    JOIN accounts a         ON a.id = jel.account_id
    JOIN tax_codes tc       ON tc.gl_paid_account_id = a.id
                           AND tc.organization_id = p_org_id
    LEFT JOIN tax_authorities ta ON ta.id = tc.tax_authority_id
    WHERE je.organization_id = p_org_id
      AND je.status IN ('posted','reversed')
      AND je.entry_date BETWEEN p_start_date AND p_end_date
      AND COALESCE(je.reference, '') NOT LIKE 'CLOSE-%'
  )
  SELECT
    m.tax_code_id,
    m.code,
    m.name,
    m.rate,
    m.tax_type,
    m.jurisdiction,
    m.authority_id,
    m.authority_name,
    m.is_recoverable,
    m.side,
    m.gl_account_id,
    m.account_code,
    m.account_name,
    ROUND(SUM(m.tax_amount)::numeric, 2)                                          AS tax_amount,
    CASE
      WHEN COALESCE(m.rate, 0) > 0
      THEN ROUND((SUM(m.tax_amount) / (m.rate / 100.0))::numeric, 2)
      ELSE 0
    END                                                                            AS taxable_amount
  FROM movements m
  GROUP BY
    m.tax_code_id, m.code, m.name, m.rate, m.tax_type, m.jurisdiction,
    m.authority_id, m.authority_name, m.is_recoverable, m.side,
    m.gl_account_id, m.account_code, m.account_name
  HAVING SUM(m.tax_amount) <> 0;
$$;

GRANT EXECUTE ON FUNCTION public.get_tax_movements_by_code(uuid, date, date) TO authenticated;