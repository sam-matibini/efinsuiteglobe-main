-- Phase 11: submission tracking columns
ALTER TABLE public.ng_tax_filings
  ADD COLUMN IF NOT EXISTS submission_mode text CHECK (submission_mode IN ('api','manifest','manual')),
  ADD COLUMN IF NOT EXISTS submission_payload jsonb,
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledgment_reference text,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Mark filing acknowledged (accepted by authority)
CREATE OR REPLACE FUNCTION public.ng_mark_filing_acknowledged(
  p_filing_id uuid,
  p_ack_reference text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.ng_tax_filings
     SET status = 'accepted',
         acknowledged_at = now(),
         acknowledgment_reference = COALESCE(p_ack_reference, acknowledgment_reference),
         updated_at = now()
   WHERE id = p_filing_id;
END $$;

-- Mark filing rejected by authority
CREATE OR REPLACE FUNCTION public.ng_mark_filing_rejected(
  p_filing_id uuid,
  p_reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.ng_tax_filings
     SET status = 'rejected',
         rejection_reason = p_reason,
         updated_at = now()
   WHERE id = p_filing_id;
END $$;

-- Reconciliation: accrued vs filed vs remitted per definition + month
CREATE OR REPLACE FUNCTION public.ng_get_reconciliation(
  p_organization_id uuid,
  p_period_start date,
  p_period_end date
) RETURNS TABLE (
  definition_id uuid,
  definition_code text,
  period_month date,
  accrued_tax numeric,
  filed_tax numeric,
  remitted_tax numeric,
  filed_variance numeric,
  remit_variance numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH ledger AS (
    SELECT l.definition_id,
           date_trunc('month', l.transaction_date)::date AS period_month,
           SUM(l.tax_amount) AS accrued_tax,
           SUM(CASE WHEN l.status IN ('filed','remitted') THEN l.tax_amount ELSE 0 END) AS filed_tax,
           SUM(CASE WHEN l.status = 'remitted' THEN l.tax_amount ELSE 0 END) AS remitted_tax
      FROM public.ng_tax_transaction_ledger l
     WHERE l.organization_id = p_organization_id
       AND l.transaction_date BETWEEN p_period_start AND p_period_end
     GROUP BY l.definition_id, date_trunc('month', l.transaction_date)
  )
  SELECT ledger.definition_id,
         d.code,
         ledger.period_month,
         ledger.accrued_tax,
         ledger.filed_tax,
         ledger.remitted_tax,
         (ledger.accrued_tax - ledger.filed_tax) AS filed_variance,
         (ledger.filed_tax - ledger.remitted_tax) AS remit_variance
    FROM ledger
    JOIN public.ng_tax_definitions d ON d.id = ledger.definition_id
   ORDER BY ledger.period_month DESC, d.code;
$$;

GRANT EXECUTE ON FUNCTION public.ng_mark_filing_acknowledged(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ng_mark_filing_rejected(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ng_get_reconciliation(uuid, date, date) TO authenticated;