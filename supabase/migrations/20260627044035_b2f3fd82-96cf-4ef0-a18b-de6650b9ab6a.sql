
CREATE OR REPLACE FUNCTION public.close_fiscal_year(
  p_organization_id uuid,
  p_fiscal_year integer,
  p_fiscal_year_start date,
  p_fiscal_year_end date,
  p_notes text DEFAULT NULL::text
)
RETURNS TABLE(
  success boolean,
  message text,
  net_income numeric,
  closing_entry_id uuid,
  fiscal_year_close_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_retained_earnings_id UUID;
  v_re_account_name TEXT;
  v_net_income NUMERIC;
  v_journal_entry_id UUID;
  v_fiscal_close_id UUID;
  v_income_total NUMERIC;
  v_expense_total NUMERIC;
  v_user_id UUID;
  v_existing_close UUID;
  v_framework TEXT;
  v_is_npo BOOLEAN;
  v_new_code TEXT;
  v_new_name TEXT;
BEGIN
  v_user_id := auth.uid();

  -- Already closed?
  SELECT id INTO v_existing_close
  FROM public.fiscal_year_closes
  WHERE organization_id = p_organization_id
    AND fiscal_year = p_fiscal_year;

  IF v_existing_close IS NOT NULL THEN
    RETURN QUERY SELECT
      FALSE::BOOLEAN,
      format('Fiscal year %s is already closed', p_fiscal_year)::TEXT,
      0::NUMERIC, NULL::UUID, v_existing_close;
    RETURN;
  END IF;

  -- Determine framework (NPO vs for-profit) for naming/auto-create
  SELECT UPPER(COALESCE(default_accounting_framework, accounting_standard, ''))
  INTO v_framework
  FROM public.organizations
  WHERE id = p_organization_id;

  v_is_npo := v_framework IN ('ASNPO', 'NFP', 'NPO', 'IFRS-NFP');

  -- Tiered lookup for the equity rollup account
  SELECT id, name INTO v_retained_earnings_id, v_re_account_name
  FROM public.accounts
  WHERE organization_id = p_organization_id
    AND account_type = 'equity'
    AND is_header = false
    AND COALESCE(posting_allowed, true) = true
  ORDER BY
    CASE
      WHEN code = '3-00-201' THEN 1
      WHEN name ILIKE '%retained earnings%' AND NOT v_is_npo THEN 2
      WHEN name ILIKE '%unrestricted net assets%' THEN 3
      WHEN name ILIKE '%net assets without donor restrictions%' THEN 4
      WHEN name ILIKE '%accumulated surplus%' OR name ILIKE '%accumulated deficit%' THEN 5
      WHEN name ILIKE '%retained earnings%' THEN 6
      ELSE 99
    END,
    code
  LIMIT 1;

  -- Auto-create if not found
  IF v_retained_earnings_id IS NULL THEN
    IF v_is_npo THEN
      v_new_name := 'Unrestricted Net Assets';
    ELSE
      v_new_name := 'Retained Earnings';
    END IF;
    v_new_code := '3-00-201';

    -- Avoid duplicate code collisions
    IF EXISTS (SELECT 1 FROM public.accounts WHERE organization_id = p_organization_id AND code = v_new_code) THEN
      v_new_code := '3-00-2' || lpad((floor(random()*900 + 100))::text, 2, '0');
    END IF;

    INSERT INTO public.accounts (
      organization_id, code, name, account_type, normal_balance,
      is_header, is_active, posting_allowed, description
    ) VALUES (
      p_organization_id, v_new_code, v_new_name, 'equity', 'credit',
      false, true, true,
      'Auto-created equity rollup account for fiscal year close'
    )
    RETURNING id, name INTO v_retained_earnings_id, v_re_account_name;
  END IF;

  -- Net income for the period
  WITH posted_entries AS (
    SELECT je.id
    FROM public.journal_entries je
    WHERE je.organization_id = p_organization_id
      AND je.status = 'posted'
      AND je.entry_date >= p_fiscal_year_start
      AND je.entry_date <= p_fiscal_year_end
  ),
  account_activity AS (
    SELECT a.account_type,
           SUM(COALESCE(jel.debit, 0)) AS total_debit,
           SUM(COALESCE(jel.credit, 0)) AS total_credit
    FROM public.journal_entry_lines jel
    JOIN posted_entries pe ON pe.id = jel.journal_entry_id
    JOIN public.accounts a ON a.id = jel.account_id
    WHERE a.account_type IN ('income', 'expense')
      AND a.is_header = false
    GROUP BY a.account_type
  )
  SELECT
    COALESCE(SUM(CASE WHEN account_type = 'income' THEN total_credit - total_debit ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN account_type = 'expense' THEN total_debit - total_credit ELSE 0 END), 0)
  INTO v_income_total, v_expense_total
  FROM account_activity;

  v_net_income := v_income_total - v_expense_total;

  -- Closing JE (draft → posted)
  INSERT INTO public.journal_entries (
    organization_id, entry_date, reference, description,
    status, journal_type, created_by
  ) VALUES (
    p_organization_id, p_fiscal_year_end,
    format('CLOSE-%s', p_fiscal_year),
    format('Fiscal Year %s Closing Entry - Transfer net result to %s', p_fiscal_year, v_re_account_name),
    'draft', 'adjustment', v_user_id
  )
  RETURNING id INTO v_journal_entry_id;

  -- Close income accounts
  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
  SELECT v_journal_entry_id, a.id,
         format('Close %s to %s', a.name, v_re_account_name),
         CASE WHEN (SUM(COALESCE(jel.credit, 0)) - SUM(COALESCE(jel.debit, 0))) > 0
              THEN (SUM(COALESCE(jel.credit, 0)) - SUM(COALESCE(jel.debit, 0))) ELSE 0 END,
         CASE WHEN (SUM(COALESCE(jel.credit, 0)) - SUM(COALESCE(jel.debit, 0))) < 0
              THEN ABS(SUM(COALESCE(jel.credit, 0)) - SUM(COALESCE(jel.debit, 0))) ELSE 0 END
  FROM public.accounts a
  JOIN public.journal_entry_lines jel ON jel.account_id = a.id
  JOIN public.journal_entries je ON je.id = jel.journal_entry_id
  WHERE a.organization_id = p_organization_id
    AND a.account_type = 'income'
    AND a.is_header = false
    AND je.status = 'posted'
    AND je.entry_date >= p_fiscal_year_start
    AND je.entry_date <= p_fiscal_year_end
  GROUP BY a.id, a.name
  HAVING ABS(SUM(COALESCE(jel.credit, 0)) - SUM(COALESCE(jel.debit, 0))) > 0.001;

  -- Close expense accounts
  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
  SELECT v_journal_entry_id, a.id,
         format('Close %s to %s', a.name, v_re_account_name),
         CASE WHEN (SUM(COALESCE(jel.debit, 0)) - SUM(COALESCE(jel.credit, 0))) < 0
              THEN ABS(SUM(COALESCE(jel.debit, 0)) - SUM(COALESCE(jel.credit, 0))) ELSE 0 END,
         CASE WHEN (SUM(COALESCE(jel.debit, 0)) - SUM(COALESCE(jel.credit, 0))) > 0
              THEN (SUM(COALESCE(jel.debit, 0)) - SUM(COALESCE(jel.credit, 0))) ELSE 0 END
  FROM public.accounts a
  JOIN public.journal_entry_lines jel ON jel.account_id = a.id
  JOIN public.journal_entries je ON je.id = jel.journal_entry_id
  WHERE a.organization_id = p_organization_id
    AND a.account_type = 'expense'
    AND a.is_header = false
    AND je.status = 'posted'
    AND je.entry_date >= p_fiscal_year_start
    AND je.entry_date <= p_fiscal_year_end
  GROUP BY a.id, a.name
  HAVING ABS(SUM(COALESCE(jel.debit, 0)) - SUM(COALESCE(jel.credit, 0))) > 0.001;

  -- Offsetting equity line
  IF v_net_income >= 0 THEN
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
    VALUES (v_journal_entry_id, v_retained_earnings_id,
            format('Transfer FY%s Net Result to %s', p_fiscal_year, v_re_account_name),
            0, v_net_income);
  ELSE
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
    VALUES (v_journal_entry_id, v_retained_earnings_id,
            format('Transfer FY%s Net Loss to %s', p_fiscal_year, v_re_account_name),
            ABS(v_net_income), 0);
  END IF;

  -- Post the entry (triggers validate balance)
  UPDATE public.journal_entries
  SET status = 'posted', posted_at = now(), posted_by = v_user_id
  WHERE id = v_journal_entry_id;

  -- Record close
  INSERT INTO public.fiscal_year_closes (
    organization_id, fiscal_year, fiscal_year_start, fiscal_year_end,
    net_income, retained_earnings_account_id, closing_journal_entry_id,
    closed_by, notes
  ) VALUES (
    p_organization_id, p_fiscal_year, p_fiscal_year_start, p_fiscal_year_end,
    v_net_income, v_retained_earnings_id, v_journal_entry_id, v_user_id, p_notes
  )
  RETURNING id INTO v_fiscal_close_id;

  PERFORM public.recalculate_all_account_balances(p_organization_id);

  RETURN QUERY SELECT
    TRUE::BOOLEAN,
    format('Successfully closed fiscal year %s. Net result of %s transferred to %s.',
           p_fiscal_year, v_net_income, v_re_account_name)::TEXT,
    v_net_income, v_journal_entry_id, v_fiscal_close_id;
END;
$function$;

COMMENT ON FUNCTION public.close_fiscal_year IS
'Closes a fiscal year by creating closing entries to transfer net income to the equity rollup account (Retained Earnings for for-profit, Unrestricted Net Assets for NPO). Auto-creates the account if missing. GAAP/IFRS/ASPE/ASNPO compliant.';
