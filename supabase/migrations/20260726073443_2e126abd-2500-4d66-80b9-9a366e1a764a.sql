
-- 1. Fix filings status constraint to include lifecycle values already emitted by RPCs
ALTER TABLE public.ng_tax_filings DROP CONSTRAINT IF EXISTS ng_tax_filings_status_check;
ALTER TABLE public.ng_tax_filings ADD CONSTRAINT ng_tax_filings_status_check
  CHECK (status IN ('draft','ready','submitted','accepted','rejected','amended','remitted'));

-- 2. Receipt attachment on remittances
ALTER TABLE public.ng_tax_remittances
  ADD COLUMN IF NOT EXISTS receipt_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS receipt_uploaded_at TIMESTAMPTZ;

-- 3. Rewrite ng_post_remittance to auto-create JE when bank account provided
CREATE OR REPLACE FUNCTION public.ng_post_remittance(
  p_filing_id uuid,
  p_payment_date date,
  p_bank_account_id uuid DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_journal_entry_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_remit_id uuid;
  v_filing public.ng_tax_filings%ROWTYPE;
  v_def public.ng_tax_definitions%ROWTYPE;
  v_je_id uuid := p_journal_entry_id;
  v_payable_acct uuid;
  v_bank_gl_acct uuid;
  v_entry_no text;
BEGIN
  SELECT * INTO v_filing FROM public.ng_tax_filings WHERE id = p_filing_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'filing not found'; END IF;
  SELECT * INTO v_def FROM public.ng_tax_definitions WHERE id = v_filing.definition_id;

  -- Auto-post JE when no external JE supplied AND we have a bank account AND mapping
  IF v_je_id IS NULL AND p_bank_account_id IS NOT NULL AND v_filing.total_tax > 0 THEN
    -- Resolve payable (tax liability) account from mapping, else by code
    SELECT payable_account_id INTO v_payable_acct
      FROM public.ng_tax_account_mappings
     WHERE organization_id = v_filing.organization_id
       AND definition_id = v_filing.definition_id
     LIMIT 1;

    IF v_payable_acct IS NULL AND v_def.default_credit_account_code IS NOT NULL THEN
      SELECT id INTO v_payable_acct FROM public.accounts
       WHERE organization_id = v_filing.organization_id
         AND account_code = v_def.default_credit_account_code
       LIMIT 1;
    END IF;

    -- Resolve bank GL account from bank_accounts.gl_account_id
    SELECT gl_account_id INTO v_bank_gl_acct
      FROM public.bank_accounts WHERE id = p_bank_account_id;

    IF v_payable_acct IS NOT NULL AND v_bank_gl_acct IS NOT NULL THEN
      v_entry_no := 'NG-REM-' || to_char(now(), 'YYYYMMDDHH24MISS');
      INSERT INTO public.journal_entries (
        organization_id, entry_number, entry_date, description,
        status, source_type, source_id, total_debit, total_credit, created_by
      ) VALUES (
        v_filing.organization_id, v_entry_no, p_payment_date,
        'NG tax remittance ' || COALESCE(v_def.code, '') || ' ' || v_filing.period_start || '..' || v_filing.period_end,
        'posted', 'ng_tax_remittance', p_filing_id,
        v_filing.total_tax, v_filing.total_tax, auth.uid()
      ) RETURNING id INTO v_je_id;

      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description, line_number)
      VALUES
        (v_je_id, v_payable_acct, v_filing.total_tax, 0,
          'Clear ' || COALESCE(v_def.code,'') || ' liability', 1),
        (v_je_id, v_bank_gl_acct, 0, v_filing.total_tax,
          'Payment ' || COALESCE(p_reference,''), 2);
    END IF;
  END IF;

  INSERT INTO public.ng_tax_remittances (
    organization_id, filing_id, definition_id, amount, payment_date,
    bank_account_id, reference, journal_entry_id, status
  ) VALUES (
    v_filing.organization_id, p_filing_id, v_filing.definition_id, v_filing.total_tax, p_payment_date,
    p_bank_account_id, p_reference, v_je_id, 'remitted'
  ) RETURNING id INTO v_remit_id;

  UPDATE public.ng_tax_filings SET status='remitted', updated_at=now() WHERE id = p_filing_id;

  UPDATE public.ng_tax_transaction_ledger
     SET remittance_id = v_remit_id,
         journal_entry_id = COALESCE(journal_entry_id, v_je_id),
         status = 'remitted',
         updated_at = now()
   WHERE filing_id = p_filing_id;

  RETURN v_remit_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ng_post_remittance(uuid,date,uuid,text,uuid) TO authenticated;

-- 4. Compliance dashboard view: per-tax next due date, accrued unfiled, filed unremitted
CREATE OR REPLACE VIEW public.ng_tax_compliance_dashboard AS
WITH ledger_agg AS (
  SELECT
    l.organization_id,
    l.definition_id,
    date_trunc('month', l.transaction_date)::date AS period_month,
    SUM(l.tax_amount) FILTER (WHERE l.status = 'accrued') AS accrued_tax,
    SUM(l.tax_amount) FILTER (WHERE l.status = 'filed')   AS filed_unremitted_tax,
    COUNT(*) FILTER (WHERE l.status = 'accrued')          AS accrued_count
  FROM public.ng_tax_transaction_ledger l
  GROUP BY l.organization_id, l.definition_id, date_trunc('month', l.transaction_date)
)
SELECT
  la.organization_id,
  la.definition_id,
  d.code           AS definition_code,
  d.name           AS definition_name,
  d.tax_category,
  d.filing_frequency,
  la.period_month,
  (la.period_month + INTERVAL '1 month' - INTERVAL '1 day')::date AS period_end,
  ((la.period_month + INTERVAL '1 month' - INTERVAL '1 day')::date
    + (d.remittance_due_offset_days || ' days')::interval)::date  AS due_date,
  COALESCE(la.accrued_tax, 0)          AS accrued_tax,
  COALESCE(la.filed_unremitted_tax, 0) AS filed_unremitted_tax,
  COALESCE(la.accrued_count, 0)        AS accrued_count,
  CASE
    WHEN ((la.period_month + INTERVAL '1 month' - INTERVAL '1 day')::date
      + (d.remittance_due_offset_days || ' days')::interval)::date < CURRENT_DATE
      AND (COALESCE(la.accrued_tax,0) > 0 OR COALESCE(la.filed_unremitted_tax,0) > 0)
      THEN 'overdue'
    WHEN ((la.period_month + INTERVAL '1 month' - INTERVAL '1 day')::date
      + (d.remittance_due_offset_days || ' days')::interval)::date <= CURRENT_DATE + 14
      THEN 'due_soon'
    ELSE 'upcoming'
  END AS urgency
FROM ledger_agg la
JOIN public.ng_tax_definitions d ON d.id = la.definition_id
WHERE COALESCE(la.accrued_tax,0) + COALESCE(la.filed_unremitted_tax,0) > 0;

GRANT SELECT ON public.ng_tax_compliance_dashboard TO authenticated;
