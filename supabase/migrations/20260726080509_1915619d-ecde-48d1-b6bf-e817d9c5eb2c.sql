
-- Nigeria IFRS CoA: add missing IFRS/tax accounts idempotently
DO $$
DECLARE
  tpl_id uuid;
BEGIN
  SELECT id INTO tpl_id FROM public.coa_templates
   WHERE country_id = (SELECT id FROM public.countries WHERE code='NG')
   ORDER BY is_default DESC NULLS LAST LIMIT 1;

  IF tpl_id IS NULL THEN RETURN; END IF;

  -- Ensure IFRS flag
  UPDATE public.coa_templates SET accounting_standard='IFRS', updated_at=now() WHERE id=tpl_id;

  INSERT INTO public.coa_template_accounts
    (template_id, code, name, account_type, account_group, account_sub_group, parent_code, is_header, is_tax_account, is_payroll_account, tax_type_code, deduction_type_code, normal_balance, description, sort_order)
  VALUES
    (tpl_id, '1550', 'Right-of-Use Assets (IFRS 16)', 'asset', 'Non-Current Assets', NULL, '1500', false, false, false, NULL, NULL, 'debit', 'IFRS 16 lessee right-of-use assets', 1550),
    (tpl_id, '1555', 'Accumulated Depreciation - ROU Assets', 'asset', 'Non-Current Assets', NULL, '1550', false, false, false, NULL, NULL, 'credit', 'Contra: accumulated depreciation on ROU assets', 1555),
    (tpl_id, '2265', 'WHT Payable - Companies (CITA)', 'liability', 'Current Liabilities', NULL, '2000', false, true, false, 'WHT-COMPANIES', NULL, 'credit', 'Withholding tax deducted from corporate suppliers', 2265),
    (tpl_id, '2266', 'WHT Payable - Individuals (PIT)', 'liability', 'Current Liabilities', NULL, '2000', false, true, false, 'WHT-INDIVIDUALS', NULL, 'credit', 'Withholding tax deducted from individual suppliers', 2266),
    (tpl_id, '2350', 'Lease Liability - Current (IFRS 16)', 'liability', 'Current Liabilities', NULL, '2000', false, false, false, NULL, NULL, 'credit', 'IFRS 16 current portion of lease liabilities', 2350),
    (tpl_id, '2650', 'Lease Liability - Non-Current (IFRS 16)', 'liability', 'Non-Current Liabilities', NULL, '2000', false, false, false, NULL, NULL, 'credit', 'IFRS 16 non-current portion of lease liabilities', 2650),
    (tpl_id, '3500', 'Other Comprehensive Income (FVOCI Reserve)', 'equity', 'Equity', NULL, '3000', false, false, false, NULL, NULL, 'credit', 'Accumulated OCI — FVOCI financial assets', 3500),
    (tpl_id, '3600', 'Revaluation Surplus (IAS 16)', 'equity', 'Equity', NULL, '3000', false, false, false, NULL, NULL, 'credit', 'PP&E revaluation surplus per IAS 16', 3600)
  ON CONFLICT DO NOTHING;
END $$;
