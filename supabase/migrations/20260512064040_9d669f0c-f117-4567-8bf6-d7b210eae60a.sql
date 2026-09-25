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
  WITH tax_accounts AS (
    SELECT
      a.id,
      a.code,
      a.name,
      CASE
        WHEN a.name ILIKE '%input%' OR a.name ILIKE '%itc%'
             OR (a.name ILIKE '%paid%' AND a.name NOT ILIKE '%payable%')
          THEN 'paid'
        WHEN a.name ILIKE '%payable%' OR a.name ILIKE '%collected%'
          THEN 'collected'
        ELSE NULL
      END AS side
    FROM accounts a
    WHERE a.organization_id = p_org_id
      AND (a.name ILIKE '%gst%' OR a.name ILIKE '%hst%'
        OR a.name ILIKE '%pst%' OR a.name ILIKE '%qst%'
        OR a.name ILIKE '%vat%' OR a.name ILIKE '%tva%'
        OR a.name ILIKE '%input tax%' OR a.name ILIKE '%itc%'
        OR a.name ILIKE '%sales tax%')
  ),
  account_code_match AS (
    SELECT DISTINCT ON (ta.id, ta.side)
      ta.id    AS gl_account_id,
      ta.side,
      tc.id    AS tax_code_id,
      tc.code,
      tc.name  AS tc_name,
      tc.rate,
      tc.tax_type,
      tc.jurisdiction,
      tc.tax_authority_id AS authority_id,
      auth.name AS authority_name,
      tc.is_recoverable
    FROM tax_accounts ta
    LEFT JOIN tax_codes tc
      ON tc.organization_id = p_org_id
     AND ((ta.side = 'collected' AND tc.gl_collected_account_id = ta.id)
       OR (ta.side = 'paid'      AND tc.gl_paid_account_id      = ta.id))
    LEFT JOIN tax_authorities auth ON auth.id = tc.tax_authority_id
    WHERE ta.side IS NOT NULL
    ORDER BY ta.id, ta.side, (tc.id IS NULL), (tc.rate IS NULL OR tc.rate = 0), tc.code
  ),
  account_code_fallback AS (
    SELECT
      acm.gl_account_id, acm.side,
      COALESCE(acm.tax_code_id, tc2.id)              AS tax_code_id,
      COALESCE(acm.code, tc2.code, ta.name)          AS code,
      COALESCE(acm.tc_name, tc2.name, ta.name)       AS name,
      COALESCE(acm.rate, tc2.rate)                   AS rate,
      COALESCE(acm.tax_type, tc2.tax_type, 'sales')  AS tax_type,
      COALESCE(acm.jurisdiction, tc2.jurisdiction)   AS jurisdiction,
      COALESCE(acm.authority_id, tc2.tax_authority_id) AS authority_id,
      COALESCE(acm.authority_name, auth2.name)       AS authority_name,
      COALESCE(acm.is_recoverable, tc2.is_recoverable, true) AS is_recoverable
    FROM account_code_match acm
    JOIN tax_accounts ta ON ta.id = acm.gl_account_id
    LEFT JOIN LATERAL (
      SELECT tc.*
      FROM tax_codes tc
      WHERE tc.organization_id = p_org_id
        AND acm.tax_code_id IS NULL
        AND (
          (ta.name ILIKE '%hst%' AND tc.code ILIKE 'HST%') OR
          (ta.name ILIKE '%gst%' AND tc.code ILIKE 'GST%') OR
          ((ta.name ILIKE '%pst%' OR ta.name ILIKE '%qst%') AND (tc.code ILIKE 'PST%' OR tc.code ILIKE 'QST%')) OR
          (ta.name ILIKE '%vat%' AND tc.code ILIKE 'VAT%')
        )
      ORDER BY tc.rate DESC NULLS LAST
      LIMIT 1
    ) tc2 ON TRUE
    LEFT JOIN tax_authorities auth2 ON auth2.id = tc2.tax_authority_id
  ),
  -- Identify journal entries that look like tax-authority settlements / remittances:
  -- the JE only touches tax accounts and bank/cash/credit-card accounts (no sale or
  -- purchase leg on an income or expense account). These would otherwise pollute the
  -- collected/ITC totals on a GST/HST return (e.g. a CRA refund deposit becomes -ITCs).
  settlement_entries AS (
    SELECT je.id
    FROM journal_entries je
    JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
    JOIN accounts a ON a.id = jel.account_id
    WHERE je.organization_id = p_org_id
      AND je.status IN ('posted','reversed')
      AND je.entry_date BETWEEN p_start_date AND p_end_date
    GROUP BY je.id
    HAVING SUM(CASE WHEN a.account_type IN ('income','expense') THEN 1 ELSE 0 END) = 0
  ),
  movements AS (
    SELECT
      f.tax_code_id, f.code, f.name, f.rate, f.tax_type, f.jurisdiction,
      f.authority_id, f.authority_name, f.is_recoverable, f.side,
      f.gl_account_id,
      ta.code AS account_code,
      ta.name AS account_name,
      CASE WHEN f.side = 'collected'
           THEN COALESCE(jel.credit, 0) - COALESCE(jel.debit, 0)
           ELSE COALESCE(jel.debit, 0) - COALESCE(jel.credit, 0)
      END AS tax_amount
    FROM account_code_fallback f
    JOIN tax_accounts ta         ON ta.id = f.gl_account_id
    JOIN journal_entry_lines jel ON jel.account_id = f.gl_account_id
    JOIN journal_entries je      ON je.id = jel.journal_entry_id
    WHERE je.organization_id = p_org_id
      AND je.status IN ('posted','reversed')
      AND je.entry_date BETWEEN p_start_date AND p_end_date
      AND COALESCE(je.reference, '') NOT LIKE 'CLOSE-%'
      AND je.id NOT IN (SELECT id FROM settlement_entries)
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