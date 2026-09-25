-- ============================================================================
-- FISCAL YEAR CLOSE MECHANISM - GAAP/IFRS/ASPE COMPLIANT
-- ============================================================================
-- This implements the year-end closing process that transfers net income
-- from temporary accounts (Income/Expense) to Retained Earnings (permanent).
-- This is required per GAAP to properly close the books each fiscal year.
-- ============================================================================

-- Table to track fiscal year closes
CREATE TABLE public.fiscal_year_closes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  fiscal_year_start DATE NOT NULL,
  fiscal_year_end DATE NOT NULL,
  net_income NUMERIC NOT NULL,
  retained_earnings_account_id UUID NOT NULL REFERENCES public.accounts(id),
  closing_journal_entry_id UUID REFERENCES public.journal_entries(id),
  closed_by UUID REFERENCES auth.users(id),
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, fiscal_year)
);

-- Enable RLS
ALTER TABLE public.fiscal_year_closes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view fiscal year closes for their organizations"
  ON public.fiscal_year_closes
  FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Users can create fiscal year closes for their organizations"
  ON public.fiscal_year_closes
  FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Users can update fiscal year closes for their organizations"
  ON public.fiscal_year_closes
  FOR UPDATE
  USING (public.is_org_member(auth.uid(), organization_id));

-- Function to perform fiscal year close
CREATE OR REPLACE FUNCTION public.close_fiscal_year(
  p_organization_id UUID,
  p_fiscal_year INTEGER,
  p_fiscal_year_start DATE,
  p_fiscal_year_end DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  net_income NUMERIC,
  closing_entry_id UUID,
  fiscal_year_close_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  -- Get current user
  v_user_id := auth.uid();
  
  -- Check if year is already closed
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
  
  -- Find Retained Earnings account (code 3-00-201 or name contains 'Retained Earnings')
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
  -- Sum all income account activity (credits - debits, normalized)
  -- Sum all expense account activity (debits - credits, normalized)
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
      a.normal_balance,
      SUM(COALESCE(jel.debit, 0)) as total_debit,
      SUM(COALESCE(jel.credit, 0)) as total_credit
    FROM public.journal_entry_lines jel
    JOIN posted_entries pe ON pe.id = jel.journal_entry_id
    JOIN public.accounts a ON a.id = jel.account_id
    WHERE a.account_type IN ('income', 'expense')
      AND a.is_header = false
    GROUP BY a.account_type, a.normal_balance
  )
  SELECT 
    COALESCE(SUM(CASE WHEN account_type = 'income' THEN total_credit - total_debit ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN account_type = 'expense' THEN total_debit - total_credit ELSE 0 END), 0)
  INTO v_income_total, v_expense_total
  FROM account_activity;
  
  v_net_income := v_income_total - v_expense_total;
  
  -- Create closing journal entry
  -- DR/CR all income accounts to zero
  -- DR/CR all expense accounts to zero
  -- DR/CR Retained Earnings for the net effect
  INSERT INTO public.journal_entries (
    organization_id,
    entry_date,
    reference,
    description,
    status,
    source,
    created_by
  ) VALUES (
    p_organization_id,
    p_fiscal_year_end,
    format('CLOSE-%s', p_fiscal_year),
    format('Fiscal Year %s Closing Entry - Transfer net income to Retained Earnings', p_fiscal_year),
    'posted',
    'system',
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
    AND je.id != v_journal_entry_id
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
    AND je.id != v_journal_entry_id
  GROUP BY a.id, a.name
  HAVING ABS(SUM(COALESCE(jel.debit, 0)) - SUM(COALESCE(jel.credit, 0))) > 0.001;
  
  -- Insert the offsetting entry to Retained Earnings
  -- If net income is positive (profit), credit Retained Earnings
  -- If net income is negative (loss), debit Retained Earnings
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
$$;

-- Function to check if a fiscal year needs closing (has unclosed prior-year income/expense)
CREATE OR REPLACE FUNCTION public.get_unclosed_fiscal_years(p_organization_id UUID)
RETURNS TABLE(
  fiscal_year INTEGER,
  fiscal_year_start DATE,
  fiscal_year_end DATE,
  net_income NUMERIC,
  is_closed BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_year INTEGER;
  v_earliest_year INTEGER;
BEGIN
  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  
  -- Find earliest transaction year
  SELECT EXTRACT(YEAR FROM MIN(je.entry_date))::INTEGER
  INTO v_earliest_year
  FROM public.journal_entries je
  WHERE je.organization_id = p_organization_id
    AND je.status = 'posted';
  
  IF v_earliest_year IS NULL THEN
    RETURN;
  END IF;
  
  -- Return each fiscal year from earliest to previous year
  FOR fiscal_year IN v_earliest_year..(v_current_year - 1) LOOP
    RETURN QUERY
    WITH year_activity AS (
      SELECT 
        a.account_type,
        SUM(CASE WHEN a.account_type = 'income' 
            THEN COALESCE(jel.credit, 0) - COALESCE(jel.debit, 0)
            ELSE COALESCE(jel.debit, 0) - COALESCE(jel.credit, 0) END) as activity
      FROM public.journal_entry_lines jel
      JOIN public.journal_entries je ON je.id = jel.journal_entry_id
      JOIN public.accounts a ON a.id = jel.account_id
      WHERE je.organization_id = p_organization_id
        AND je.status = 'posted'
        AND EXTRACT(YEAR FROM je.entry_date) = fiscal_year
        AND a.account_type IN ('income', 'expense')
        AND a.is_header = false
      GROUP BY a.account_type
    ),
    closed_check AS (
      SELECT fyc.id
      FROM public.fiscal_year_closes fyc
      WHERE fyc.organization_id = p_organization_id
        AND fyc.fiscal_year = get_unclosed_fiscal_years.fiscal_year
    )
    SELECT 
      get_unclosed_fiscal_years.fiscal_year,
      make_date(get_unclosed_fiscal_years.fiscal_year, 1, 1),
      make_date(get_unclosed_fiscal_years.fiscal_year, 12, 31),
      COALESCE((SELECT activity FROM year_activity WHERE account_type = 'income'), 0) -
      COALESCE((SELECT activity FROM year_activity WHERE account_type = 'expense'), 0),
      EXISTS(SELECT 1 FROM closed_check);
  END LOOP;
END;
$$;

-- Add index for performance
CREATE INDEX idx_fiscal_year_closes_org_year ON public.fiscal_year_closes(organization_id, fiscal_year);

-- Add updated_at trigger
CREATE TRIGGER update_fiscal_year_closes_updated_at
  BEFORE UPDATE ON public.fiscal_year_closes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();