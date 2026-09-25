
DO $$
DECLARE
  v_org uuid := '1f8d9dc0-b4c1-4b40-b67d-b1d396d74b83';
  r RECORD;
  v_year text;
  v_ngn_per_usd numeric;
BEGIN
  FOR r IN
    SELECT effective_date, rate AS usd_to_cad
    FROM exchange_rates
    WHERE from_currency='USD' AND to_currency='CAD'
      AND effective_date BETWEEN '2024-01-01' AND CURRENT_DATE
  LOOP
    v_year := to_char(r.effective_date, 'YYYY');
    v_ngn_per_usd := CASE v_year WHEN '2024' THEN 900 WHEN '2025' THEN 1500 ELSE 1550 END;

    INSERT INTO exchange_rates (organization_id, from_currency, to_currency, rate, effective_date, source)
    VALUES (v_org, 'NGN', 'CAD', (1.0 / v_ngn_per_usd) * r.usd_to_cad, r.effective_date, 'fallback (USD pivot)')
    ON CONFLICT DO NOTHING;
    INSERT INTO exchange_rates (organization_id, from_currency, to_currency, rate, effective_date, source)
    VALUES (v_org, 'CAD', 'NGN', v_ngn_per_usd / r.usd_to_cad, r.effective_date, 'fallback (USD pivot)')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_nearest_fx_rate(
  p_org uuid, p_from text, p_to text, p_date date
) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rate FROM exchange_rates
  WHERE organization_id = p_org AND from_currency = p_from
    AND to_currency = p_to AND effective_date <= p_date
  ORDER BY effective_date DESC LIMIT 1
$$;

DO $$
DECLARE
  v_org uuid := '1f8d9dc0-b4c1-4b40-b67d-b1d396d74b83';
  v_base text := 'CAD';
  v_fx_account uuid := 'cbbaf0da-f716-4009-865c-e2f700d33561';
  je_row RECORD;
  ln_row RECORD;
  v_rate numeric;
  v_base_debit_total numeric;
  v_base_credit_total numeric;
  v_diff numeric;
  v_max_line_order int;
BEGIN
  ALTER TABLE journal_entry_lines DISABLE TRIGGER USER;
  ALTER TABLE journal_entries DISABLE TRIGGER USER;

  FOR je_row IN
    SELECT DISTINCT j.id AS je_id, j.entry_date
    FROM journal_entries j
    JOIN bank_transactions bt ON bt.journal_entry_id = j.id
    JOIN bank_accounts ba ON ba.id = bt.bank_account_id
    WHERE j.organization_id = v_org AND ba.currency <> v_base
  LOOP
    FOR ln_row IN
      SELECT jel.id AS line_id, jel.debit, jel.credit, ba.currency AS line_cur
      FROM journal_entry_lines jel
      JOIN bank_accounts ba ON ba.gl_account_id = jel.account_id AND ba.organization_id = v_org
      WHERE jel.journal_entry_id = je_row.je_id
    LOOP
      IF ln_row.line_cur = v_base THEN
        v_rate := 1.0;
      ELSE
        v_rate := public.get_nearest_fx_rate(v_org, ln_row.line_cur, v_base, je_row.entry_date);
        IF v_rate IS NULL THEN v_rate := 1.0; END IF;
      END IF;

      UPDATE journal_entry_lines
      SET currency = ln_row.line_cur,
          exchange_rate = v_rate,
          base_currency_debit  = ROUND(COALESCE(ln_row.debit,0)  * v_rate, 2),
          base_currency_credit = ROUND(COALESCE(ln_row.credit,0) * v_rate, 2)
      WHERE id = ln_row.line_id;
    END LOOP;

    DELETE FROM journal_entry_lines
    WHERE journal_entry_id = je_row.je_id
      AND account_id = v_fx_account
      AND description = 'FX gain/loss on cross-currency transfer';

    SELECT COALESCE(SUM(base_currency_debit),0), COALESCE(SUM(base_currency_credit),0),
           COALESCE(MAX(line_order),0)
    INTO v_base_debit_total, v_base_credit_total, v_max_line_order
    FROM journal_entry_lines WHERE journal_entry_id = je_row.je_id;

    v_diff := ROUND(v_base_debit_total - v_base_credit_total, 2);

    IF ABS(v_diff) >= 0.01 THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, account_id, debit, credit, description, line_order,
        currency, exchange_rate, base_currency_debit, base_currency_credit
      ) VALUES (
        je_row.je_id, v_fx_account,
        CASE WHEN v_diff < 0 THEN ABS(v_diff) ELSE 0 END,
        CASE WHEN v_diff > 0 THEN v_diff ELSE 0 END,
        'FX gain/loss on cross-currency transfer',
        v_max_line_order + 1,
        v_base, 1.0,
        CASE WHEN v_diff < 0 THEN ABS(v_diff) ELSE 0 END,
        CASE WHEN v_diff > 0 THEN v_diff ELSE 0 END
      );
    END IF;
  END LOOP;

  ALTER TABLE journal_entry_lines ENABLE TRIGGER USER;
  ALTER TABLE journal_entries ENABLE TRIGGER USER;
END $$;

DO $$
DECLARE
  acc RECORD;
BEGIN
  FOR acc IN SELECT id FROM accounts WHERE organization_id = '1f8d9dc0-b4c1-4b40-b67d-b1d396d74b83'
  LOOP
    BEGIN
      PERFORM public.recalculate_account_balance(acc.id);
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
  END LOOP;
END $$;
