
-- Re-create the close_fiscal_year function to ensure it's properly registered
DROP FUNCTION IF EXISTS public.close_fiscal_year(uuid, integer, date, date, text);

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
  v_net_income NUMERIC;
  v_journal_entry_id UUID;
  v_fiscal_close_id UUID;
  v_income_total NUMERIC;
  v_expense_total NUMERIC;
  v_user_id UUID;
  v_existing_close UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Check if already closed
  SELECT id INTO v_existing_close
  FROM public.fiscal_year_closes
  WHERE organization_id = p_organization_id
    AND fiscal_year = p_fiscal_year;
  
  IF v_existing_close IS NOT NULL THEN
    RETURN QUERY SELECT 
      FALSE::BOOLEAN,
      format('Fiscal year %s is already closed', p_fiscal_year)::TEXT,
      0::NUMERIC,
      NULL::UUID,
      v_existing_close;
    RETURN;
  END IF;
  
  -- Find Retained Earnings account
  SELECT id INTO v_retained_earnings_id
  FROM public.accounts
  WHERE organization_id = p_organization_id
    AND account_type = 'equity'
    AND is_header = false
    AND (code = '3-00-201' OR name ILIKE '%retained earnings%')
  ORDER BY code
  LIMIT 1;
  
  IF v_retained_earnings_id IS NULL THEN
    RETURN QUERY SELECT 
      FALSE::BOOLEAN,
      'No Retained Earnings account found. Please create an equity account named "Retained Earnings" first.'::TEXT,
      0::NUMERIC,
      NULL::UUID,
      NULL::UUID;
    RETURN;
  END IF;
  
  -- Calculate net income for the fiscal year
  WITH posted_entries AS (
    SELECT je.id
    FROM public.journal_entries je
    WHERE je.organization_id = p_organization_id
      AND je.status = 'posted'
      AND je.entry_date >= p_fiscal_year_start
      AND je.entry_date <= p_fiscal_year_end
  ),
  account_activity AS (
    SELECT 
      a.account_type,
      SUM(COALESCE(jel.debit, 0)) as total_debit,
      SUM(COALESCE(jel.credit, 0)) as total_credit
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
  
  -- Create closing journal entry as DRAFT first
  INSERT INTO public.journal_entries (
    organization_id,
    entry_date,
    reference,
    description,
    status,
    journal_type,
    created_by
  ) VALUES (
    p_organization_id,
    p_fiscal_year_end,
    format('CLOSE-%s', p_fiscal_year),
    format('Fiscal Year %s Closing Entry - Transfer net income to Retained Earnings', p_fiscal_year),
    'draft',
    'adjustment',
    v_user_id
  )
  RETURNING id INTO v_journal_entry_id;
  
  -- Insert closing lines for all income accounts (debit to close credit balances)
  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
  SELECT 
    v_journal_entry_id,
    a.id,
    format('Close %s to Retained Earnings', a.name),
    CASE WHEN (SUM(COALESCE(jel.credit, 0)) - SUM(COALESCE(jel.debit, 0))) > 0 
         THEN (SUM(COALESCE(jel.credit, 0)) - SUM(COALESCE(jel.debit, 0))) 
         ELSE 0 END,
    CASE WHEN (SUM(COALESCE(jel.credit, 0)) - SUM(COALESCE(jel.debit, 0))) < 0 
         THEN ABS(SUM(COALESCE(jel.credit, 0)) - SUM(COALESCE(jel.debit, 0))) 
         ELSE 0 END
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
  
  -- Insert closing lines for all expense accounts (credit to close debit balances)
  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
  SELECT 
    v_journal_entry_id,
    a.id,
    format('Close %s to Retained Earnings', a.name),
    CASE WHEN (SUM(COALESCE(jel.debit, 0)) - SUM(COALESCE(jel.credit, 0))) < 0 
         THEN ABS(SUM(COALESCE(jel.debit, 0)) - SUM(COALESCE(jel.credit, 0))) 
         ELSE 0 END,
    CASE WHEN (SUM(COALESCE(jel.debit, 0)) - SUM(COALESCE(jel.credit, 0))) > 0 
         THEN (SUM(COALESCE(jel.debit, 0)) - SUM(COALESCE(jel.credit, 0))) 
         ELSE 0 END
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
  
  -- Insert the offsetting entry to Retained Earnings
  IF v_net_income >= 0 THEN
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
    VALUES (v_journal_entry_id, v_retained_earnings_id, 
            format('Transfer FY%s Net Income to Retained Earnings', p_fiscal_year), 
            0, v_net_income);
  ELSE
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
    VALUES (v_journal_entry_id, v_retained_earnings_id, 
            format('Transfer FY%s Net Loss to Retained Earnings', p_fiscal_year), 
            ABS(v_net_income), 0);
  END IF;
  
  -- NOW update to 'posted' - triggers will validate the complete, balanced entry
  UPDATE public.journal_entries
  SET status = 'posted', posted_at = now(), posted_by = v_user_id
  WHERE id = v_journal_entry_id;
  
  -- Record the fiscal year close
  INSERT INTO public.fiscal_year_closes (
    organization_id,
    fiscal_year,
    fiscal_year_start,
    fiscal_year_end,
    net_income,
    retained_earnings_account_id,
    closing_journal_entry_id,
    closed_by,
    notes
  ) VALUES (
    p_organization_id,
    p_fiscal_year,
    p_fiscal_year_start,
    p_fiscal_year_end,
    v_net_income,
    v_retained_earnings_id,
    v_journal_entry_id,
    v_user_id,
    p_notes
  )
  RETURNING id INTO v_fiscal_close_id;
  
  -- Recalculate affected account balances
  PERFORM public.recalculate_all_account_balances(p_organization_id);
  
  RETURN QUERY SELECT 
    TRUE::BOOLEAN,
    format('Successfully closed fiscal year %s. Net income of %s transferred to Retained Earnings.', 
           p_fiscal_year, v_net_income)::TEXT,
    v_net_income,
    v_journal_entry_id,
    v_fiscal_close_id;
END;
$function$;

COMMENT ON FUNCTION public.close_fiscal_year IS 
'Closes a fiscal year by creating closing entries to transfer net income to Retained Earnings.
Creates a balanced journal entry as draft, adds all lines, then posts. GAAP/IFRS/ASPE compliant.'
