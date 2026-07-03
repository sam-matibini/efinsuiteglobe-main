DO $$
DECLARE
  r RECORD;
  v_pst_paid_id UUID;
  v_pst_collected_id UUID;
  v_code TEXT;
  v_suffix INT;
BEGIN
  FOR r IN
    SELECT s.id AS settings_id, s.organization_id, s.province
    FROM public.sales_tax_settings s
    WHERE s.collect_pst = true
      AND (s.pst_paid_account_id IS NULL OR s.pst_collected_account_id IS NULL)
  LOOP
    --------------------------------------------------------------------
    -- 1. PST Paid (Non-Recoverable) — expense
    --------------------------------------------------------------------
    SELECT id INTO v_pst_paid_id
    FROM public.accounts
    WHERE organization_id = r.organization_id
      AND account_type = 'expense'
      AND (name ILIKE 'PST Paid%' OR name ILIKE 'Provincial Sales Tax Paid%')
    LIMIT 1;

    IF v_pst_paid_id IS NULL THEN
      v_code := '5-04-100-0001';
      v_suffix := 1;
      WHILE EXISTS (
        SELECT 1 FROM public.accounts
        WHERE organization_id = r.organization_id AND code = v_code
      ) LOOP
        v_suffix := v_suffix + 1;
        v_code := '5-04-100-' || lpad(v_suffix::text, 4, '0');
      END LOOP;

      INSERT INTO public.accounts (
        organization_id, code, name, account_type, normal_balance, is_active, description
      ) VALUES (
        r.organization_id, v_code, 'PST Paid (Non-Recoverable)',
        'expense', 'debit', true,
        'Provincial Sales Tax paid on purchases. Non-recoverable — expensed directly per ASPE/ASNPO.'
      )
      RETURNING id INTO v_pst_paid_id;
    END IF;

    --------------------------------------------------------------------
    -- 2. PST Payable — liability
    --------------------------------------------------------------------
    SELECT id INTO v_pst_collected_id
    FROM public.accounts
    WHERE organization_id = r.organization_id
      AND account_type = 'liability'
      AND (name ILIKE 'PST Payable%' OR name ILIKE 'PST Collected%' OR name ILIKE 'Provincial Sales Tax Payable%')
    LIMIT 1;

    IF v_pst_collected_id IS NULL THEN
      v_code := '2-01-103-0001';
      v_suffix := 1;
      WHILE EXISTS (
        SELECT 1 FROM public.accounts
        WHERE organization_id = r.organization_id AND code = v_code
      ) LOOP
        v_suffix := v_suffix + 1;
        v_code := '2-01-103-' || lpad(v_suffix::text, 4, '0');
      END LOOP;

      INSERT INTO public.accounts (
        organization_id, code, name, account_type, normal_balance, is_active, description
      ) VALUES (
        r.organization_id, v_code, 'PST Payable',
        'liability', 'credit', true,
        'Provincial Sales Tax collected from customers and owed to the provincial authority.'
      )
      RETURNING id INTO v_pst_collected_id;
    END IF;

    --------------------------------------------------------------------
    -- 3. Wire settings
    --------------------------------------------------------------------
    UPDATE public.sales_tax_settings
    SET pst_paid_account_id = COALESCE(pst_paid_account_id, v_pst_paid_id),
        pst_collected_account_id = COALESCE(pst_collected_account_id, v_pst_collected_id),
        updated_at = now()
    WHERE id = r.settings_id;
  END LOOP;
END $$;