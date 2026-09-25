-- Fix Oluspe Auto Sales: GST/HST Paid (ITC) is an asset but was coded under
-- the 2-xx (liability) range, leaving it orphaned in the Balance Sheet view.
-- Reparent + renumber it under Current Assets (1-01-120) without touching
-- account_type, normal_balance or balances.

DO $$
DECLARE
  v_org uuid;
  v_current_assets_id uuid;
  v_new_header_id uuid;
  v_itc_account_id uuid := 'a8f45948-15de-4349-92cd-9974503e55f1';
BEGIN
  SELECT organization_id INTO v_org FROM public.accounts WHERE id = v_itc_account_id;
  IF v_org IS NULL THEN
    RAISE NOTICE 'ITC account not found; skipping.';
    RETURN;
  END IF;

  SELECT id INTO v_current_assets_id
  FROM public.accounts
  WHERE organization_id = v_org AND code = '1-01' AND is_header = true
  LIMIT 1;

  -- Create the GST/HST Input Tax Credits header under Current Assets if missing
  SELECT id INTO v_new_header_id
  FROM public.accounts
  WHERE organization_id = v_org AND code = '1-01-120'
  LIMIT 1;

  IF v_new_header_id IS NULL THEN
    INSERT INTO public.accounts (
      organization_id, code, name, account_type, normal_balance,
      is_header, is_active, parent_id, opening_balance, current_balance
    ) VALUES (
      v_org, '1-01-120', 'GST/HST Input Tax Credits', 'asset', 'debit',
      true, true, v_current_assets_id, 0, 0
    )
    RETURNING id INTO v_new_header_id;
  END IF;

  -- Renumber and reparent the ITC account
  UPDATE public.accounts
  SET code = '1-01-120-0001',
      parent_id = v_new_header_id
  WHERE id = v_itc_account_id;
END $$;