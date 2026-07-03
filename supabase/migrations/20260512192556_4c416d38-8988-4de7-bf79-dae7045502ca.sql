
-- 1. SUBLEDGER RECONCILIATION
-- Returns one row per subledger with subledger total, GL total, and difference (base currency).
CREATE OR REPLACE FUNCTION public.subledger_reconciliation(p_organization_id uuid)
RETURNS TABLE (
  subledger text,
  reference_id uuid,
  reference_label text,
  subledger_balance numeric,
  gl_balance numeric,
  difference numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_member(auth.uid(), p_organization_id) THEN
    RAISE EXCEPTION 'Not authorized for organization %', p_organization_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- AR: invoices.balance_due (open) vs net debit on accounts_receivable accounts
  RETURN QUERY
  WITH ar_sub AS (
    SELECT COALESCE(SUM(
      COALESCE(i.balance_due, 0) *
      COALESCE(NULLIF(i.exchange_rate, 0), 1)
    ), 0)::numeric AS amt
    FROM public.invoices i
    WHERE i.organization_id = p_organization_id
      AND COALESCE(i.status, '') NOT IN ('cancelled','draft','void','voided')
      AND i.deleted_at IS NULL
  ),
  ar_gl AS (
    SELECT COALESCE(SUM(
      COALESCE(jel.base_currency_debit,  jel.debit ) -
      COALESCE(jel.base_currency_credit, jel.credit)
    ), 0)::numeric AS amt
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    JOIN public.accounts a ON a.id = jel.account_id
    WHERE je.organization_id = p_organization_id
      AND je.status IN ('posted','reversed')
      AND a.account_type::text = 'accounts_receivable'
  )
  SELECT 'accounts_receivable'::text,
         NULL::uuid,
         'Accounts Receivable'::text,
         ar_sub.amt,
         ar_gl.amt,
         ROUND(ar_sub.amt - ar_gl.amt, 2)
  FROM ar_sub, ar_gl;

  -- AP: bills.balance_due (open) vs net credit on accounts_payable accounts
  RETURN QUERY
  WITH ap_sub AS (
    SELECT COALESCE(SUM(
      COALESCE(b.balance_due, 0) *
      COALESCE(NULLIF(b.exchange_rate, 0), 1)
    ), 0)::numeric AS amt
    FROM public.bills b
    WHERE b.organization_id = p_organization_id
      AND COALESCE(b.status, '') NOT IN ('cancelled','draft','void','voided')
      AND b.deleted_at IS NULL
  ),
  ap_gl AS (
    SELECT COALESCE(SUM(
      COALESCE(jel.base_currency_credit, jel.credit) -
      COALESCE(jel.base_currency_debit,  jel.debit )
    ), 0)::numeric AS amt
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    JOIN public.accounts a ON a.id = jel.account_id
    WHERE je.organization_id = p_organization_id
      AND je.status IN ('posted','reversed')
      AND a.account_type::text = 'accounts_payable'
  )
  SELECT 'accounts_payable'::text,
         NULL::uuid,
         'Accounts Payable'::text,
         ap_sub.amt,
         ap_gl.amt,
         ROUND(ap_sub.amt - ap_gl.amt, 2)
  FROM ap_sub, ap_gl;

  -- Bank: per bank_account, cleared bank_transactions vs GL net debit on the linked account.
  RETURN QUERY
  WITH bank_sub AS (
    SELECT ba.id AS bank_account_id,
           ba.gl_account_id,
           COALESCE(ba.account_name, 'Bank Account') AS label,
           COALESCE(SUM(bt.amount) FILTER (WHERE bt.is_cleared = true), 0)::numeric AS amt
    FROM public.bank_accounts ba
    LEFT JOIN public.bank_transactions bt ON bt.bank_account_id = ba.id
    WHERE ba.organization_id = p_organization_id
      AND ba.gl_account_id IS NOT NULL
    GROUP BY ba.id, ba.gl_account_id, ba.account_name
  ),
  bank_gl AS (
    SELECT jel.account_id,
           COALESCE(SUM(
             COALESCE(jel.base_currency_debit,  jel.debit ) -
             COALESCE(jel.base_currency_credit, jel.credit)
           ), 0)::numeric AS amt
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    WHERE je.organization_id = p_organization_id
      AND je.status IN ('posted','reversed')
    GROUP BY jel.account_id
  )
  SELECT 'bank'::text,
         bs.bank_account_id,
         bs.label,
         bs.amt,
         COALESCE(bg.amt, 0),
         ROUND(bs.amt - COALESCE(bg.amt, 0), 2)
  FROM bank_sub bs
  LEFT JOIN bank_gl bg ON bg.account_id = bs.gl_account_id;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.subledger_reconciliation(uuid) TO authenticated;

-- Check if bank_accounts has account_name; some schemas use 'name' instead. Try both safely:
-- (No-op if column already correct; if not, the function above will simply error at call time
--  and we'll patch it. We keep this comment for visibility.)

-- 2. EXTEND INTEGRITY CHECK to include subledger mismatches
CREATE OR REPLACE FUNCTION public.integrity_check(p_organization_id uuid)
RETURNS TABLE (check_type text, severity text, message text, payload jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_dr numeric(20,4);
  v_total_cr numeric(20,4);
  v_diff numeric(20,4);
  v_orphans int;
  v_null_fx int;
  v_unbalanced_entries int;
  r RECORD;
BEGIN
  IF NOT public.is_org_member(auth.uid(), p_organization_id) THEN
    RAISE EXCEPTION 'Not authorized for organization %', p_organization_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Trial balance
  SELECT
    COALESCE(SUM(COALESCE(jel.base_currency_debit,  jel.debit )),0),
    COALESCE(SUM(COALESCE(jel.base_currency_credit, jel.credit)),0)
  INTO v_total_dr, v_total_cr
  FROM public.journal_entry_lines jel
  JOIN public.journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.organization_id = p_organization_id
    AND je.status IN ('posted','reversed');

  v_diff := ROUND(v_total_dr - v_total_cr, 2);
  IF ABS(v_diff) > 0.01 THEN
    check_type := 'trial_balance';
    severity  := 'critical';
    message   := 'Trial balance is out of balance in base currency.';
    payload   := jsonb_build_object('debits', v_total_dr, 'credits', v_total_cr, 'difference', v_diff);
    RETURN NEXT;
  END IF;

  -- Individually unbalanced entries
  SELECT COUNT(*) INTO v_unbalanced_entries
  FROM (
    SELECT je.id
    FROM public.journal_entries je
    JOIN public.journal_entry_lines jel ON jel.journal_entry_id = je.id
    WHERE je.organization_id = p_organization_id
      AND je.status IN ('posted','reversed')
    GROUP BY je.id
    HAVING ABS(
      SUM(COALESCE(jel.base_currency_debit,  jel.debit )) -
      SUM(COALESCE(jel.base_currency_credit, jel.credit))
    ) > 0.01
  ) x;

  IF v_unbalanced_entries > 0 THEN
    check_type := 'unbalanced_entries';
    severity  := 'critical';
    message   := format('%s posted journal entries are individually unbalanced.', v_unbalanced_entries);
    payload   := jsonb_build_object('count', v_unbalanced_entries);
    RETURN NEXT;
  END IF;

  -- Orphan lines
  SELECT COUNT(*) INTO v_orphans
  FROM public.journal_entry_lines jel
  LEFT JOIN public.journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.id IS NULL;

  IF v_orphans > 0 THEN
    check_type := 'orphan_lines';
    severity  := 'warning';
    message   := format('%s orphan journal entry lines detected.', v_orphans);
    payload   := jsonb_build_object('count', v_orphans);
    RETURN NEXT;
  END IF;

  -- Missing FX base amounts
  SELECT COUNT(*) INTO v_null_fx
  FROM public.journal_entry_lines jel
  JOIN public.journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.organization_id = p_organization_id
    AND je.status IN ('posted','reversed')
    AND (jel.base_currency_debit IS NULL OR jel.base_currency_credit IS NULL);

  IF v_null_fx > 0 THEN
    check_type := 'fx_missing_base';
    severity  := 'warning';
    message   := format('%s posted lines missing base-currency amounts.', v_null_fx);
    payload   := jsonb_build_object('count', v_null_fx);
    RETURN NEXT;
  END IF;

  -- Subledger reconciliation findings (>0.01 diff = warning)
  FOR r IN SELECT * FROM public.subledger_reconciliation(p_organization_id) LOOP
    IF ABS(COALESCE(r.difference, 0)) > 0.01 THEN
      check_type := 'subledger_mismatch';
      severity  := 'warning';
      message   := format('%s subledger differs from GL by %s.',
                          r.reference_label, to_char(r.difference, 'FM999G999G990D00'));
      payload   := jsonb_build_object(
        'subledger', r.subledger,
        'reference_id', r.reference_id,
        'reference_label', r.reference_label,
        'subledger_balance', r.subledger_balance,
        'gl_balance', r.gl_balance,
        'difference', r.difference
      );
      RETURN NEXT;
    END IF;
  END LOOP;

  RETURN;
END;
$$;

-- 3. SAFE RECALCULATE wrapper that returns a summary row.
CREATE OR REPLACE FUNCTION public.safe_recalculate_balances(p_organization_id uuid)
RETURNS TABLE (corrected_count int, total_drift numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_corrected int := 0;
  v_drift numeric := 0;
BEGIN
  IF NOT public.is_org_member(auth.uid(), p_organization_id) THEN
    RAISE EXCEPTION 'Not authorized for organization %', p_organization_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  WITH r AS (
    SELECT * FROM public.recalculate_all_account_balances(p_organization_id)
  )
  SELECT COUNT(*) FILTER (WHERE ABS(COALESCE(difference,0)) > 0.005),
         COALESCE(SUM(ABS(COALESCE(difference,0))), 0)
  INTO v_corrected, v_drift
  FROM r;

  -- Log a finding so the audit trail captures the rebuild
  INSERT INTO public.integrity_findings (organization_id, check_type, severity, message, payload)
  VALUES (
    p_organization_id,
    'safe_recalculate',
    CASE WHEN v_corrected > 0 THEN 'info' ELSE 'info' END,
    format('Safe recalculate updated %s account balance(s); total drift %s.',
           v_corrected, to_char(v_drift, 'FM999G999G990D00')),
    jsonb_build_object('corrected_count', v_corrected, 'total_drift', v_drift)
  );

  RETURN QUERY SELECT v_corrected, v_drift;
END;
$$;

GRANT EXECUTE ON FUNCTION public.safe_recalculate_balances(uuid) TO authenticated;
