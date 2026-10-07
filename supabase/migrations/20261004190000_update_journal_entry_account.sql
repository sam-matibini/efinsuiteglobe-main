-- Let a drilldown journal edit change the postable account on each line
-- in the same in-place update as the amounts. Header accounts stay blocked.
-- The balance triggers still pause for this transaction, then both the old
-- and new account balances are recalculated. Changing the account otherwise
-- leaves the previous account's cached balance stale.

CREATE OR REPLACE FUNCTION public.update_journal_entry_amounts(
  p_entry_id uuid,
  p_lines jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_status text;
  v_expected integer;
  v_line jsonb;
  v_id uuid;
  v_debit numeric;
  v_credit numeric;
  v_rate numeric;
  v_old_debit numeric;
  v_old_credit numeric;
  v_old_base_dr numeric;
  v_old_base_cr numeric;
  v_base_dr numeric;
  v_base_cr numeric;
  v_base_dr_sum numeric := 0;
  v_base_cr_sum numeric := 0;
  v_prepared jsonb := '[]'::jsonb;
  v_account uuid;
  v_old_account uuid;
  v_account_org uuid;
  v_is_header boolean;
  v_posting_allowed boolean;
  v_is_active boolean;
  v_touched uuid[] := '{}';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT organization_id, status
    INTO v_org, v_status
  FROM public.journal_entries
  WHERE id = p_entry_id
  FOR UPDATE;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Journal entry not found';
  END IF;

  IF NOT public.is_org_member(auth.uid(), v_org) THEN
    RAISE EXCEPTION 'Not authorized for this organization';
  END IF;

  IF v_status = 'reversed' THEN
    RAISE EXCEPTION 'Cannot edit a reversed journal entry. Reversed entries are immutable.';
  END IF;

  IF jsonb_typeof(p_lines) <> 'array' THEN
    RAISE EXCEPTION 'Lines must be a list of amounts';
  END IF;

  SELECT COUNT(*) INTO v_expected
  FROM public.journal_entry_lines
  WHERE journal_entry_id = p_entry_id;

  IF v_expected < 2 OR jsonb_array_length(p_lines) <> v_expected THEN
    RAISE EXCEPTION 'Every journal line amount must be included';
  END IF;

  IF (
    SELECT COUNT(DISTINCT elem->>'id')
    FROM jsonb_array_elements(p_lines) elem
  ) <> v_expected THEN
    RAISE EXCEPTION 'Every journal line amount must be included';
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    BEGIN
      v_id := (v_line->>'id')::uuid;
      v_debit := round(COALESCE((v_line->>'debit')::numeric, 0), 2);
      v_credit := round(COALESCE((v_line->>'credit')::numeric, 0), 2);
    EXCEPTION
      WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        RAISE EXCEPTION 'Enter a valid amount';
    END;

    IF v_debit < 0 OR v_credit < 0 THEN
      RAISE EXCEPTION 'Amounts cannot be negative';
    END IF;
    IF v_debit > 0 AND v_credit > 0 THEN
      RAISE EXCEPTION 'A line cannot have both a debit and a credit';
    END IF;

    SELECT jel.debit, jel.credit,
           COALESCE(NULLIF(jel.exchange_rate, 0), 1),
           jel.base_currency_debit, jel.base_currency_credit,
           jel.account_id
      INTO v_old_debit, v_old_credit, v_rate, v_old_base_dr, v_old_base_cr, v_old_account
    FROM public.journal_entry_lines jel
    WHERE jel.id = v_id
      AND jel.journal_entry_id = p_entry_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Journal line does not belong to this entry';
    END IF;

    v_account := v_old_account;
    IF NULLIF(v_line->>'account_id', '') IS NOT NULL THEN
      BEGIN
        v_account := (v_line->>'account_id')::uuid;
      EXCEPTION
        WHEN invalid_text_representation THEN
          RAISE EXCEPTION 'Choose a valid account';
      END;
    END IF;

    IF v_account IS DISTINCT FROM v_old_account THEN
      SELECT organization_id,
             COALESCE(is_header, false),
             COALESCE(posting_allowed, true),
             COALESCE(is_active, true)
        INTO v_account_org, v_is_header, v_posting_allowed, v_is_active
      FROM public.accounts
      WHERE id = v_account;

      IF NOT FOUND OR v_account_org IS DISTINCT FROM v_org OR v_is_header OR NOT v_posting_allowed OR NOT v_is_active THEN
        RAISE EXCEPTION 'Choose a postable account in this organization. Header accounts are for grouping only.';
      END IF;
    END IF;

    IF v_old_account IS NOT NULL THEN
      v_touched := array_append(v_touched, v_old_account);
    END IF;
    IF v_account IS NOT NULL THEN
      v_touched := array_append(v_touched, v_account);
    END IF;

    IF round(COALESCE(v_old_debit, 0), 2) = v_debit
       AND round(COALESCE(v_old_credit, 0), 2) = v_credit THEN
      v_base_dr := round(COALESCE(v_old_base_dr, v_debit * v_rate), 2);
      v_base_cr := round(COALESCE(v_old_base_cr, v_credit * v_rate), 2);
    ELSE
      v_base_dr := round(v_debit * v_rate, 2);
      v_base_cr := round(v_credit * v_rate, 2);
    END IF;

    v_base_dr_sum := v_base_dr_sum + v_base_dr;
    v_base_cr_sum := v_base_cr_sum + v_base_cr;
    v_prepared := v_prepared || jsonb_build_array(jsonb_build_object(
      'id', v_id,
      'debit', v_debit,
      'credit', v_credit,
      'base_debit', v_base_dr,
      'base_credit', v_base_cr,
      'account_id', v_account
    ));
  END LOOP;

  IF abs(v_base_dr_sum - v_base_cr_sum) > 0.02 THEN
    RAISE EXCEPTION 'Journal entry must balance: base-currency debits must equal credits';
  END IF;

  PERFORM set_config('app.journal_amount_edit', 'on', true);

  FOR v_line IN SELECT value FROM jsonb_array_elements(v_prepared)
  LOOP
    UPDATE public.journal_entry_lines
    SET debit = (v_line->>'debit')::numeric,
        credit = (v_line->>'credit')::numeric,
        base_currency_debit = (v_line->>'base_debit')::numeric,
        base_currency_credit = (v_line->>'base_credit')::numeric,
        account_id = COALESCE((v_line->>'account_id')::uuid, account_id)
    WHERE id = (v_line->>'id')::uuid
      AND journal_entry_id = p_entry_id;
  END LOOP;

  PERFORM set_config('app.journal_amount_edit', 'off', true);

  IF v_status = 'posted' THEN
    UPDATE public.accounts AS account
    SET current_balance = public.recalculate_account_balance(account.id),
        updated_at = now()
    WHERE account.id = ANY(v_touched);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_journal_entry_amounts(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_journal_entry_amounts(uuid, jsonb) TO authenticated, service_role;
