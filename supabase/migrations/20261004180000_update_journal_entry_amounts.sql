-- Save debit and credit edits from a drilldown journal entry in one transaction.
-- Posted entries check balance after every line, so the check pauses until every
-- line in the entry has its new amount.

CREATE OR REPLACE FUNCTION public.enforce_balanced_journal_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_debits NUMERIC;
  v_total_credits NUMERIC;
  v_total_base_debits NUMERIC;
  v_total_base_credits NUMERIC;
  v_difference NUMERIC;
  v_base_difference NUMERIC;
  v_entry_status TEXT;
  v_tolerance NUMERIC := 0.02;
BEGIN
  IF COALESCE(current_setting('app.journal_amount_edit', true), '') = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT status INTO v_entry_status
  FROM journal_entries
  WHERE id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);

  SELECT
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0),
    COALESCE(SUM(base_currency_debit), 0),
    COALESCE(SUM(base_currency_credit), 0)
  INTO v_total_debits, v_total_credits, v_total_base_debits, v_total_base_credits
  FROM journal_entry_lines
  WHERE journal_entry_id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);

  v_difference := ABS(v_total_debits - v_total_credits);
  v_base_difference := ABS(v_total_base_debits - v_total_base_credits);

  IF v_entry_status = 'posted' AND v_base_difference > v_tolerance THEN
    RAISE EXCEPTION 'Double-entry violation: Journal entry is out of balance in base currency. Base Debits: %, Base Credits: %, Difference: %.',
      v_total_base_debits, v_total_base_credits, v_base_difference;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_journal_entry_balance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  bd NUMERIC;
  bc NUMERIC;
  s TEXT;
BEGIN
  IF COALESCE(current_setting('app.journal_amount_edit', true), '') = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT status INTO s FROM public.journal_entries WHERE id = NEW.journal_entry_id;
  IF s = 'posted' THEN
    SELECT COALESCE(SUM(base_currency_debit),0), COALESCE(SUM(base_currency_credit),0)
    INTO bd, bc FROM public.journal_entry_lines
    WHERE journal_entry_id = NEW.journal_entry_id;
    IF ABS(bd - bc) > 0.02 THEN
      RAISE EXCEPTION 'Journal entry is not balanced in base currency. Base debits (%) must equal base credits (%)', bd, bc;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

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
           jel.base_currency_debit, jel.base_currency_credit
      INTO v_old_debit, v_old_credit, v_rate, v_old_base_dr, v_old_base_cr
    FROM public.journal_entry_lines jel
    WHERE jel.id = v_id
      AND jel.journal_entry_id = p_entry_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Journal line does not belong to this entry';
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
      'base_credit', v_base_cr
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
        base_currency_credit = (v_line->>'base_credit')::numeric
    WHERE id = (v_line->>'id')::uuid
      AND journal_entry_id = p_entry_id;
  END LOOP;

  PERFORM set_config('app.journal_amount_edit', 'off', true);
END;
$$;

REVOKE ALL ON FUNCTION public.update_journal_entry_amounts(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_journal_entry_amounts(uuid, jsonb) TO authenticated, service_role;
