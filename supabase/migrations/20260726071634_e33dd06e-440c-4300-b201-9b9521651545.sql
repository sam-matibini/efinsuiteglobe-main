
-- Filing generator: aggregates ledger rows into a filing and back-links them
CREATE OR REPLACE FUNCTION public.ng_generate_filing(
  p_organization_id uuid,
  p_definition_id uuid,
  p_period_start date,
  p_period_end date,
  p_form_code text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_filing_id uuid;
  v_total_base numeric := 0;
  v_total_tax numeric := 0;
  v_count int := 0;
  v_ledger_ids uuid[];
BEGIN
  IF p_organization_id IS NULL OR p_definition_id IS NULL THEN
    RAISE EXCEPTION 'organization_id and definition_id are required';
  END IF;

  SELECT COALESCE(SUM(taxable_base),0), COALESCE(SUM(tax_amount),0), COUNT(*), COALESCE(ARRAY_AGG(id), ARRAY[]::uuid[])
    INTO v_total_base, v_total_tax, v_count, v_ledger_ids
  FROM public.ng_tax_transaction_ledger
  WHERE organization_id = p_organization_id
    AND definition_id = p_definition_id
    AND transaction_date BETWEEN p_period_start AND p_period_end
    AND (filing_id IS NULL OR status = 'draft');

  -- Reuse an open draft filing for this period if one exists
  SELECT id INTO v_filing_id FROM public.ng_tax_filings
   WHERE organization_id = p_organization_id
     AND definition_id = p_definition_id
     AND period_start = p_period_start
     AND period_end = p_period_end
     AND status IN ('draft','ready')
   LIMIT 1;

  IF v_filing_id IS NULL THEN
    INSERT INTO public.ng_tax_filings (
      organization_id, definition_id, period_start, period_end,
      form_code, status, form_data, total_taxable_base, total_tax
    ) VALUES (
      p_organization_id, p_definition_id, p_period_start, p_period_end,
      p_form_code, 'ready',
      jsonb_build_object('ledger_ids', to_jsonb(v_ledger_ids), 'ledger_count', v_count),
      v_total_base, v_total_tax
    ) RETURNING id INTO v_filing_id;
  ELSE
    UPDATE public.ng_tax_filings SET
      total_taxable_base = v_total_base,
      total_tax = v_total_tax,
      form_data = jsonb_build_object('ledger_ids', to_jsonb(v_ledger_ids), 'ledger_count', v_count),
      status = 'ready',
      updated_at = now()
     WHERE id = v_filing_id;
  END IF;

  UPDATE public.ng_tax_transaction_ledger
     SET filing_id = v_filing_id, status = 'filed', updated_at = now()
   WHERE id = ANY(v_ledger_ids);

  RETURN v_filing_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ng_generate_filing(uuid,uuid,date,date,text) TO authenticated;

-- Mark a filing as submitted
CREATE OR REPLACE FUNCTION public.ng_submit_filing(
  p_filing_id uuid,
  p_confirmation_reference text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.ng_tax_filings
     SET status = 'submitted',
         submitted_at = now(),
         submitted_by = auth.uid(),
         confirmation_reference = COALESCE(p_confirmation_reference, confirmation_reference),
         updated_at = now()
   WHERE id = p_filing_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ng_submit_filing(uuid,text) TO authenticated;

-- Remittance posting: create remittance and mark ledger rows remitted
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
BEGIN
  SELECT * INTO v_filing FROM public.ng_tax_filings WHERE id = p_filing_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'filing not found'; END IF;

  INSERT INTO public.ng_tax_remittances (
    organization_id, filing_id, definition_id, amount, payment_date,
    bank_account_id, reference, journal_entry_id, status
  ) VALUES (
    v_filing.organization_id, p_filing_id, v_filing.definition_id, v_filing.total_tax, p_payment_date,
    p_bank_account_id, p_reference, p_journal_entry_id, 'posted'
  ) RETURNING id INTO v_remit_id;

  UPDATE public.ng_tax_filings SET status='remitted', updated_at=now() WHERE id = p_filing_id;

  UPDATE public.ng_tax_transaction_ledger
     SET remittance_id = v_remit_id, status = 'remitted', updated_at = now()
   WHERE filing_id = p_filing_id;

  RETURN v_remit_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ng_post_remittance(uuid,date,uuid,text,uuid) TO authenticated;

-- Reporting view: ledger rollup by definition and month
CREATE OR REPLACE VIEW public.ng_tax_ledger_summary AS
SELECT
  l.organization_id,
  l.definition_id,
  d.code AS definition_code,
  d.name AS definition_name,
  d.tax_category,
  date_trunc('month', l.transaction_date)::date AS period_month,
  COUNT(*) AS transaction_count,
  SUM(l.taxable_base) AS total_taxable_base,
  SUM(l.tax_amount) AS total_tax,
  SUM(l.tax_amount) FILTER (WHERE l.status IN ('computed','pending')) AS unfiled_tax,
  SUM(l.tax_amount) FILTER (WHERE l.status = 'filed') AS filed_tax,
  SUM(l.tax_amount) FILTER (WHERE l.status = 'remitted') AS remitted_tax
FROM public.ng_tax_transaction_ledger l
JOIN public.ng_tax_definitions d ON d.id = l.definition_id
GROUP BY l.organization_id, l.definition_id, d.code, d.name, d.tax_category, date_trunc('month', l.transaction_date);

GRANT SELECT ON public.ng_tax_ledger_summary TO authenticated;
