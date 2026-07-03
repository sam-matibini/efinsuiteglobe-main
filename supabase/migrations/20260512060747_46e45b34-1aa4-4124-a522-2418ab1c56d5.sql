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
  WITH account_side AS (
    -- One row per (account, side) attributing to a single representative tax code.
    -- Prefer non-zero-rate codes; tie-break by code asc for determinism.
    SELECT DISTINCT ON (a.id, side.kind)
      a.id          AS gl_account_id,
      a.code        AS account_code,
      a.name        AS account_name,
      side.kind     AS side,
      tc.id         AS tax_code_id,
      tc.code,
      tc.name       AS tc_name,
      tc.rate,
      tc.tax_type,
      tc.jurisdiction,
      tc.tax_authority_id AS authority_id,
      ta.name       AS authority_name,
      tc.is_recoverable
    FROM accounts a
    CROSS JOIN (VALUES ('collected'::text), ('paid'::text)) AS side(kind)
    JOIN tax_codes tc
      ON tc.organization_id = p_org_id
     AND ((side.kind = 'collected' AND tc.gl_collected_account_id = a.id)
       OR (side.kind = 'paid'      AND tc.gl_paid_account_id      = a.id))
    LEFT JOIN tax_authorities ta ON ta.id = tc.tax_authority_id
    WHERE a.organization_id = p_org_id
    ORDER BY a.id, side.kind, (tc.rate IS NULL OR tc.rate = 0), tc.code
  ),
  movements AS (
    SELECT
      ac.tax_code_id, ac.code, ac.tc_name AS name, ac.rate, ac.tax_type,
      ac.jurisdiction, ac.authority_id, ac.authority_name, ac.is_recoverable,
      ac.side, ac.gl_account_id, ac.account_code, ac.account_name,
      CASE WHEN ac.side = 'collected'
           THEN COALESCE(jel.credit, 0) - COALESCE(jel.debit, 0)
           ELSE COALESCE(jel.debit, 0) - COALESCE(jel.credit, 0)
      END AS tax_amount
    FROM account_side ac
    JOIN journal_entry_lines jel ON jel.account_id = ac.gl_account_id
    JOIN journal_entries je      ON je.id = jel.journal_entry_id
    WHERE je.organization_id = p_org_id
      AND je.status IN ('posted','reversed')
      AND je.entry_date BETWEEN p_start_date AND p_end_date
      AND COALESCE(je.reference, '') NOT LIKE 'CLOSE-%'
  )
  SELECT
    m.tax_code_id, m.code, m.name, m.rate, m.tax_type, m.jurisdiction,
    m.authority_id, m.authority_name, m.is_recoverable, m.side,
    m.gl_account_id, m.account_code, m.account_name,
    ROUND(SUM(m.tax_amount)::numeric, 2) AS tax_amount,
    CASE
      WHEN COALESCE(m.rate, 0) > 0
      THEN ROUND((SUM(m.tax_amount) / (m.rate / 100.0))::numeric, 2)
      ELSE 0
    END AS taxable_amount
  FROM movements m
  GROUP BY
    m.tax_code_id, m.code, m.name, m.rate, m.tax_type, m.jurisdiction,
    m.authority_id, m.authority_name, m.is_recoverable, m.side,
    m.gl_account_id, m.account_code, m.account_name
  HAVING SUM(m.tax_amount) <> 0;
$$;