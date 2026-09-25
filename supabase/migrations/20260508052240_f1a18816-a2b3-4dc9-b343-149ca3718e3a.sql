
INSERT INTO public.accounts (organization_id, code, name, account_type, is_active)
SELECT DISTINCT ba.organization_id, '4-91-101', 'Foreign Exchange Gain', 'income'::account_type, true
FROM public.bank_accounts ba
JOIN public.organizations o ON o.id = ba.organization_id
WHERE ba.currency <> o.currency
  AND NOT EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.organization_id = ba.organization_id
      AND (a.code = '4-91-101' OR (a.name ILIKE '%foreign exchange gain%' AND a.account_type = 'income'))
  );

UPDATE public.organizations o
SET realized_fx_account_id = (
  SELECT id FROM public.accounts
  WHERE organization_id = o.id AND code = '4-91-101'
  LIMIT 1
)
WHERE o.id = '1f8d9dc0-b4c1-4b40-b67d-b1d396d74b83';

DO $$
DECLARE
  v_org uuid := '1f8d9dc0-b4c1-4b40-b67d-b1d396d74b83';
  v_base text := 'CAD';
  v_plug_acct uuid := 'cbbaf0da-f716-4009-865c-e2f700d33561';
  rec record;
  v_rate numeric;
BEGIN
  ALTER TABLE public.journal_entry_lines DISABLE TRIGGER enforce_balanced_journal_entry;
  ALTER TABLE public.journal_entry_lines DISABLE TRIGGER enforce_balanced_journal_entry_trigger;
  ALTER TABLE public.journal_entry_lines DISABLE TRIGGER trigger_enforce_balanced_journal_entry;
  ALTER TABLE public.journal_entry_lines DISABLE TRIGGER check_journal_balance_on_line_change;
  ALTER TABLE public.journal_entry_lines DISABLE TRIGGER trigger_validate_journal_balance;
  ALTER TABLE public.journal_entry_lines DISABLE TRIGGER trigger_prevent_posted_line_modification;

  FOR rec IN
    SELECT DISTINCT je.id AS je_id, je.entry_date, ba.currency AS fc, ba.gl_account_id AS bank_gl
    FROM public.journal_entries je
    JOIN public.bank_transactions bt ON bt.journal_entry_id = je.id
    JOIN public.bank_accounts ba ON ba.id = bt.bank_account_id
    WHERE je.organization_id = v_org AND ba.currency <> v_base
  LOOP
    SELECT exchange_rate INTO v_rate
    FROM public.journal_entry_lines
    WHERE journal_entry_id = rec.je_id AND account_id = rec.bank_gl AND exchange_rate IS NOT NULL
    LIMIT 1;

    IF v_rate IS NULL THEN
      SELECT rate INTO v_rate
      FROM public.exchange_rates
      WHERE organization_id = v_org AND from_currency = rec.fc AND to_currency = v_base
        AND effective_date <= rec.entry_date
      ORDER BY effective_date DESC LIMIT 1;
    END IF;

    IF v_rate IS NULL OR v_rate = 0 THEN CONTINUE; END IF;

    DELETE FROM public.journal_entry_lines
    WHERE journal_entry_id = rec.je_id AND account_id = v_plug_acct;

    UPDATE public.journal_entry_lines
    SET currency = rec.fc, exchange_rate = v_rate
    WHERE journal_entry_id = rec.je_id AND account_id = rec.bank_gl;

    UPDATE public.journal_entry_lines
    SET debit = ROUND(debit * v_rate, 2),
        credit = ROUND(credit * v_rate, 2),
        currency = v_base,
        exchange_rate = 1
    WHERE journal_entry_id = rec.je_id
      AND account_id <> rec.bank_gl
      AND (currency IS NULL OR currency = v_base);
  END LOOP;

  ALTER TABLE public.journal_entry_lines ENABLE TRIGGER enforce_balanced_journal_entry;
  ALTER TABLE public.journal_entry_lines ENABLE TRIGGER enforce_balanced_journal_entry_trigger;
  ALTER TABLE public.journal_entry_lines ENABLE TRIGGER trigger_enforce_balanced_journal_entry;
  ALTER TABLE public.journal_entry_lines ENABLE TRIGGER check_journal_balance_on_line_change;
  ALTER TABLE public.journal_entry_lines ENABLE TRIGGER trigger_validate_journal_balance;
  ALTER TABLE public.journal_entry_lines ENABLE TRIGGER trigger_prevent_posted_line_modification;

  PERFORM public.recalculate_account_balance(a.id)
  FROM public.accounts a
  WHERE a.organization_id = v_org;
END $$;
