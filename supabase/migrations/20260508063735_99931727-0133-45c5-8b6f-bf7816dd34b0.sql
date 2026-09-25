
DO $$
DECLARE
  v_org uuid := '1f8d9dc0-b4c1-4b40-b67d-b1d396d74b83';
  v_ngn uuid := 'e0ff1866-a409-49f5-baff-f7494f9903bd'; -- Expedier-NGN
  v_cad uuid := 'ac7e169f-23ae-47fb-9ec5-4e7235968b10'; -- Expedier-CAD
  v_usd uuid := '615b88a8-3968-4689-93b2-25172ee0652a'; -- Expedier-USD
  v_sales_cad uuid := '6bb6512b-404b-40b9-a08f-c3c55624fbde'; -- 4-00-105
  v_sales_ngn uuid := '4fe95772-dea2-4874-bba2-de6650e018d4'; -- 4-00-106
  v_fx uuid := 'c8f238b3-6883-4e13-bb0a-9f747f98b250';        -- 4-91-101
  r record;
  v_rate_ngn numeric(20,10);
  v_rate_cur numeric(20,10);
  v_acct_cur text;
  v_acct_id uuid;
  v_dr_sum numeric(20,4);
  v_cr_sum numeric(20,4);
  v_diff numeric(20,4);
BEGIN
  -- Disable user triggers that block updates to posted entries
  ALTER TABLE journal_entry_lines DISABLE TRIGGER USER;

  ----------------------------------------------------------------
  -- PASS A: NGN bank <-> Sales (4-00-105 or 4-00-106), 2 lines, balanced in nominal
  ----------------------------------------------------------------
  FOR r IN
    SELECT je.id, je.entry_date, je.reference
    FROM journal_entries je
    WHERE je.organization_id = v_org
      AND je.status IN ('posted','reversed')
      AND je.reference LIKE 'BANK-%'
      AND EXISTS (SELECT 1 FROM journal_entry_lines jel
                  WHERE jel.journal_entry_id=je.id AND jel.account_id=v_ngn)
      AND NOT EXISTS (SELECT 1 FROM journal_entry_lines jel
                      WHERE jel.journal_entry_id=je.id AND jel.account_id=v_fx)
      AND NOT EXISTS (SELECT 1 FROM journal_entry_lines jel
                      WHERE jel.journal_entry_id=je.id
                        AND jel.account_id NOT IN (v_ngn, v_sales_cad, v_sales_ngn))
      AND (SELECT ABS(SUM(debit)-SUM(credit)) FROM journal_entry_lines
           WHERE journal_entry_id=je.id) < 0.01
  LOOP
    SELECT rate INTO v_rate_ngn FROM exchange_rates
    WHERE organization_id=v_org AND from_currency='NGN' AND to_currency='CAD'
      AND effective_date <= r.entry_date
    ORDER BY effective_date DESC LIMIT 1;
    IF v_rate_ngn IS NULL THEN CONTINUE; END IF;

    UPDATE journal_entry_lines SET
      currency='NGN',
      exchange_rate=v_rate_ngn,
      base_currency_debit  = ROUND(debit  * v_rate_ngn, 2),
      base_currency_credit = ROUND(credit * v_rate_ngn, 2)
    WHERE journal_entry_id=r.id;
  END LOOP;

  ----------------------------------------------------------------
  -- PASS B: NGN bank <-> CAD or USD bank (cross-currency transfers)
  -- Each leg priced in its own bank currency; insert FX plug.
  ----------------------------------------------------------------
  FOR r IN
    SELECT je.id, je.entry_date, je.reference
    FROM journal_entries je
    WHERE je.organization_id = v_org
      AND je.status IN ('posted','reversed')
      AND je.reference LIKE 'BANK-%'
      AND EXISTS (SELECT 1 FROM journal_entry_lines jel
                  WHERE jel.journal_entry_id=je.id AND jel.account_id=v_ngn)
      AND EXISTS (SELECT 1 FROM journal_entry_lines jel
                  WHERE jel.journal_entry_id=je.id AND jel.account_id IN (v_cad, v_usd))
      AND NOT EXISTS (SELECT 1 FROM journal_entry_lines jel
                      WHERE jel.journal_entry_id=je.id AND jel.account_id=v_fx)
  LOOP
    SELECT rate INTO v_rate_ngn FROM exchange_rates
    WHERE organization_id=v_org AND from_currency='NGN' AND to_currency='CAD'
      AND effective_date <= r.entry_date
    ORDER BY effective_date DESC LIMIT 1;
    IF v_rate_ngn IS NULL THEN CONTINUE; END IF;

    -- NGN leg
    UPDATE journal_entry_lines SET
      currency='NGN',
      exchange_rate=v_rate_ngn,
      base_currency_debit  = ROUND(debit  * v_rate_ngn, 2),
      base_currency_credit = ROUND(credit * v_rate_ngn, 2)
    WHERE journal_entry_id=r.id AND account_id=v_ngn;

    -- CAD leg(s)
    UPDATE journal_entry_lines SET
      currency='CAD', exchange_rate=1.0,
      base_currency_debit=debit, base_currency_credit=credit
    WHERE journal_entry_id=r.id AND account_id=v_cad;

    -- USD leg(s) — use USD->CAD rate on entry_date
    SELECT rate INTO v_rate_cur FROM exchange_rates
    WHERE organization_id=v_org AND from_currency='USD' AND to_currency='CAD'
      AND effective_date <= r.entry_date
    ORDER BY effective_date DESC LIMIT 1;
    IF v_rate_cur IS NOT NULL THEN
      UPDATE journal_entry_lines SET
        currency='USD',
        exchange_rate=v_rate_cur,
        base_currency_debit  = ROUND(debit  * v_rate_cur, 2),
        base_currency_credit = ROUND(credit * v_rate_cur, 2)
      WHERE journal_entry_id=r.id AND account_id=v_usd;
    END IF;

    -- Compute base imbalance and insert FX plug
    SELECT COALESCE(SUM(base_currency_debit),0), COALESCE(SUM(base_currency_credit),0)
      INTO v_dr_sum, v_cr_sum
    FROM journal_entry_lines WHERE journal_entry_id=r.id;
    v_diff := ROUND(v_dr_sum - v_cr_sum, 2);

    IF ABS(v_diff) >= 0.01 THEN
      IF v_diff > 0 THEN
        -- debits exceed credits -> credit FX (gain)
        INSERT INTO journal_entry_lines
          (journal_entry_id, account_id, debit, credit, currency, exchange_rate,
           base_currency_debit, base_currency_credit, line_order, description)
        VALUES (r.id, v_fx, 0, v_diff, 'CAD', 1.0, 0, v_diff,
                (SELECT COALESCE(MAX(line_order),0)+1 FROM journal_entry_lines WHERE journal_entry_id=r.id),
                'Realized FX gain (legacy repair)');
      ELSE
        INSERT INTO journal_entry_lines
          (journal_entry_id, account_id, debit, credit, currency, exchange_rate,
           base_currency_debit, base_currency_credit, line_order, description)
        VALUES (r.id, v_fx, -v_diff, 0, 'CAD', 1.0, -v_diff, 0,
                (SELECT COALESCE(MAX(line_order),0)+1 FROM journal_entry_lines WHERE journal_entry_id=r.id),
                'Realized FX loss (legacy repair)');
      END IF;
    END IF;
  END LOOP;

  ALTER TABLE journal_entry_lines ENABLE TRIGGER USER;
END $$;

-- Recalc account balances for the affected accounts
SELECT recalculate_account_balance(id) FROM accounts
WHERE organization_id='1f8d9dc0-b4c1-4b40-b67d-b1d396d74b83'
  AND code IN ('1-01-101-0003','1-01-101-0004','1-01-101-0005','4-00-105','4-00-106','4-91-101');
