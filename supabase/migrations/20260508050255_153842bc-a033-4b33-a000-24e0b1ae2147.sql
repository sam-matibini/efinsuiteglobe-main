
DO $$
DECLARE
  v_je uuid := '755e5524-36d8-4d3b-9d36-01a3ede30da2';
  v_fx_account uuid := 'cbbaf0da-f716-4009-865c-e2f700d33561';
  v_cad_bank uuid;
  v_correct numeric := 9121.90; -- NGN 10,000,000 × rate 0.000912
BEGIN
  ALTER TABLE journal_entry_lines DISABLE TRIGGER USER;
  ALTER TABLE journal_entries DISABLE TRIGGER USER;

  -- Find CAD bank account id (Expedier - CAD code 1-01-101-0003)
  SELECT id INTO v_cad_bank FROM accounts
  WHERE organization_id='1f8d9dc0-b4c1-4b40-b67d-b1d396d74b83' AND code='1-01-101-0003';

  -- Drop the FX gain/loss line we added previously
  DELETE FROM journal_entry_lines
  WHERE journal_entry_id = v_je AND account_id = v_fx_account;

  -- Update the CAD-bank debit leg to the NGN-translated value
  UPDATE journal_entry_lines
  SET debit = v_correct,
      base_currency_debit = v_correct,
      base_currency_credit = 0,
      currency = 'CAD',
      exchange_rate = 1.0
  WHERE journal_entry_id = v_je
    AND account_id = v_cad_bank
    AND debit > 0;

  ALTER TABLE journal_entry_lines ENABLE TRIGGER USER;
  ALTER TABLE journal_entries ENABLE TRIGGER USER;

  -- Recalculate affected account balances
  PERFORM public.recalculate_account_balance(v_cad_bank);
  PERFORM public.recalculate_account_balance(v_fx_account);
  PERFORM public.recalculate_account_balance(id) FROM accounts
    WHERE organization_id='1f8d9dc0-b4c1-4b40-b67d-b1d396d74b83' AND code='1-01-101-0005';
END $$;
