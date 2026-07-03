
-- ============================================================================
-- RETAINED EARNINGS CORE ACCOUNTING LOGIC - GAAP/ASPE/IFRS COMPLIANT
-- ============================================================================

-- 1. Create equity_type ENUM
DO $$ BEGIN
  CREATE TYPE public.equity_type AS ENUM (
    'share_capital',
    'retained_earnings', 
    'current_earnings',
    'dividends',
    'reserves',
    'other_equity'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add equity_type and closes_to_account_id to accounts table
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS equity_type public.equity_type NULL;

ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS closes_to_account_id UUID NULL REFERENCES public.accounts(id);

-- 3. Create retained_earnings_rollforward table for audit trail
CREATE TABLE IF NOT EXISTS public.retained_earnings_rollforward (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  fiscal_year_start DATE NOT NULL,
  fiscal_year_end DATE NOT NULL,
  retained_earnings_account_id UUID NOT NULL REFERENCES public.accounts(id),
  opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_income NUMERIC(15,2) NOT NULL DEFAULT 0,
  dividends NUMERIC(15,2) NOT NULL DEFAULT 0,
  prior_period_adjustments NUMERIC(15,2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  fiscal_year_close_id UUID REFERENCES public.fiscal_year_closes(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, fiscal_year)
);

-- Enable RLS on retained_earnings_rollforward
ALTER TABLE public.retained_earnings_rollforward ENABLE ROW LEVEL SECURITY;

-- RLS policies for retained_earnings_rollforward
CREATE POLICY "Users can view their org rollforward" 
ON public.retained_earnings_rollforward 
FOR SELECT 
USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Users can insert rollforward for their org" 
ON public.retained_earnings_rollforward 
FOR INSERT 
WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Users can update rollforward for their org" 
ON public.retained_earnings_rollforward 
FOR UPDATE 
USING (public.is_org_member(auth.uid(), organization_id));

-- 4. Auto-populate equity_type based on existing account patterns
UPDATE public.accounts
SET equity_type = CASE
  WHEN code = '3-00-101' OR name ILIKE '%common stock%' OR name ILIKE '%share capital%' 
    OR account_sub_group ILIKE '%capital stock%' THEN 'share_capital'::public.equity_type
  WHEN code = '3-00-201' OR (name ILIKE '%retained earnings%' AND name NOT ILIKE '%current%')
    OR account_sub_group = 'Retained Earnings' THEN 'retained_earnings'::public.equity_type
  WHEN code = '3-00-202' OR name ILIKE '%current year earnings%' OR name ILIKE '%current earnings%'
    THEN 'current_earnings'::public.equity_type
  WHEN code = '3-00-301' OR name ILIKE '%dividend%' OR name ILIKE '%drawing%'
    OR account_sub_group ILIKE '%dividend%' THEN 'dividends'::public.equity_type
  WHEN name ILIKE '%reserve%' OR account_sub_group ILIKE '%reserve%' THEN 'reserves'::public.equity_type
  ELSE 'other_equity'::public.equity_type
END
WHERE account_type = 'equity' AND is_header = false AND equity_type IS NULL;

-- 5. Set closes_to_account_id for Current Year Earnings accounts
-- Link each CYE account to its org's Retained Earnings account
UPDATE public.accounts cye
SET closes_to_account_id = re.id
FROM public.accounts re
WHERE cye.equity_type = 'current_earnings'
  AND re.equity_type = 'retained_earnings'
  AND cye.organization_id = re.organization_id
  AND cye.closes_to_account_id IS NULL;

-- 6. Function to calculate RE rollforward for a fiscal year
CREATE OR REPLACE FUNCTION public.calculate_retained_earnings_rollforward(
  p_organization_id UUID,
  p_fiscal_year INTEGER,
  p_fiscal_year_start DATE,
  p_fiscal_year_end DATE
) RETURNS TABLE(
  opening_balance NUMERIC,
  net_income NUMERIC,
  dividends NUMERIC,
  prior_period_adjustments NUMERIC,
  closing_balance NUMERIC
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_re_account_id UUID;
  v_opening NUMERIC;
  v_net_inc NUMERIC;
  v_divs NUMERIC;
  v_adj NUMERIC;
BEGIN
  -- Get retained earnings account
  SELECT id INTO v_re_account_id
  FROM public.accounts
  WHERE organization_id = p_organization_id
    AND (equity_type = 'retained_earnings' OR code = '3-00-201')
    AND is_header = false
  LIMIT 1;
  
  IF v_re_account_id IS NULL THEN
    RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;
  
  -- Opening balance = RE balance as of start of fiscal year (from prior close entries)
  SELECT COALESCE(SUM(
    CASE WHEN a.normal_balance = 'credit' 
         THEN jel.credit - jel.debit 
         ELSE jel.debit - jel.credit END
  ), 0) + COALESCE(a.opening_balance, 0)
  INTO v_opening
  FROM public.accounts a
  LEFT JOIN public.journal_entry_lines jel ON jel.account_id = a.id
  LEFT JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    AND je.status = 'posted'
    AND je.entry_date < p_fiscal_year_start
  WHERE a.id = v_re_account_id;
  
  -- Net income from temporary accounts (excluding CLOSE-* entries)
  v_net_inc := public.calculate_period_net_income(p_organization_id, p_fiscal_year_start, p_fiscal_year_end);
  
  -- Dividends (debit entries to dividend accounts during the period)
  SELECT COALESCE(SUM(jel.debit - jel.credit), 0)
  INTO v_divs
  FROM public.journal_entry_lines jel
  JOIN public.journal_entries je ON je.id = jel.journal_entry_id
  JOIN public.accounts a ON a.id = jel.account_id
  WHERE je.organization_id = p_organization_id
    AND je.status = 'posted'
    AND je.entry_date >= p_fiscal_year_start
    AND je.entry_date <= p_fiscal_year_end
    AND (a.equity_type = 'dividends' OR a.name ILIKE '%dividend%' OR a.name ILIKE '%drawing%')
    AND a.is_header = false;
  
  -- Prior period adjustments (entries to RE that are NOT closing entries)
  SELECT COALESCE(SUM(
    CASE WHEN a.normal_balance = 'credit' 
         THEN jel.credit - jel.debit 
         ELSE jel.debit - jel.credit END
  ), 0)
  INTO v_adj
  FROM public.journal_entry_lines jel
  JOIN public.journal_entries je ON je.id = jel.journal_entry_id
  JOIN public.accounts a ON a.id = jel.account_id
  WHERE a.id = v_re_account_id
    AND je.status = 'posted'
    AND je.entry_date >= p_fiscal_year_start
    AND je.entry_date <= p_fiscal_year_end
    AND je.reference NOT LIKE 'CLOSE-%';
  
  RETURN QUERY SELECT 
    ROUND(COALESCE(v_opening, 0), 2),
    ROUND(COALESCE(v_net_inc, 0), 2),
    ROUND(COALESCE(v_divs, 0), 2),
    ROUND(COALESCE(v_adj, 0), 2),
    ROUND(COALESCE(v_opening, 0) + COALESCE(v_net_inc, 0) - COALESCE(v_divs, 0) + COALESCE(v_adj, 0), 2);
END;
$$;

-- 7. Function to record RE rollforward after fiscal year close
CREATE OR REPLACE FUNCTION public.record_retained_earnings_rollforward(
  p_organization_id UUID,
  p_fiscal_year INTEGER,
  p_fiscal_year_start DATE,
  p_fiscal_year_end DATE,
  p_fiscal_year_close_id UUID DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_re_account_id UUID;
  v_rollforward RECORD;
  v_rollforward_id UUID;
BEGIN
  -- Get retained earnings account
  SELECT id INTO v_re_account_id
  FROM public.accounts
  WHERE organization_id = p_organization_id
    AND (equity_type = 'retained_earnings' OR code = '3-00-201')
    AND is_header = false
  LIMIT 1;
  
  IF v_re_account_id IS NULL THEN
    RAISE EXCEPTION 'No Retained Earnings account found for organization';
  END IF;
  
  -- Calculate rollforward
  SELECT * INTO v_rollforward
  FROM public.calculate_retained_earnings_rollforward(
    p_organization_id, p_fiscal_year, p_fiscal_year_start, p_fiscal_year_end
  );
  
  -- Insert or update rollforward record
  INSERT INTO public.retained_earnings_rollforward (
    organization_id,
    fiscal_year,
    fiscal_year_start,
    fiscal_year_end,
    retained_earnings_account_id,
    opening_balance,
    net_income,
    dividends,
    prior_period_adjustments,
    closing_balance,
    fiscal_year_close_id,
    created_by
  ) VALUES (
    p_organization_id,
    p_fiscal_year,
    p_fiscal_year_start,
    p_fiscal_year_end,
    v_re_account_id,
    v_rollforward.opening_balance,
    v_rollforward.net_income,
    v_rollforward.dividends,
    v_rollforward.prior_period_adjustments,
    v_rollforward.closing_balance,
    p_fiscal_year_close_id,
    auth.uid()
  )
  ON CONFLICT (organization_id, fiscal_year) 
  DO UPDATE SET
    opening_balance = EXCLUDED.opening_balance,
    net_income = EXCLUDED.net_income,
    dividends = EXCLUDED.dividends,
    prior_period_adjustments = EXCLUDED.prior_period_adjustments,
    closing_balance = EXCLUDED.closing_balance,
    fiscal_year_close_id = EXCLUDED.fiscal_year_close_id,
    updated_at = now()
  RETURNING id INTO v_rollforward_id;
  
  RETURN v_rollforward_id;
END;
$$;

-- 8. Trigger to auto-record rollforward when fiscal year is closed
CREATE OR REPLACE FUNCTION public.trigger_record_re_rollforward()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  -- Record the RE rollforward for audit trail
  PERFORM public.record_retained_earnings_rollforward(
    NEW.organization_id,
    NEW.fiscal_year,
    NEW.fiscal_year_start,
    NEW.fiscal_year_end,
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_record_re_rollforward ON public.fiscal_year_closes;
CREATE TRIGGER trigger_record_re_rollforward
AFTER INSERT ON public.fiscal_year_closes
FOR EACH ROW
EXECUTE FUNCTION public.trigger_record_re_rollforward();

-- 9. Function to validate RE rollforward consistency
CREATE OR REPLACE FUNCTION public.validate_retained_earnings_continuity(
  p_organization_id UUID
) RETURNS TABLE(
  fiscal_year INTEGER,
  prior_closing NUMERIC,
  current_opening NUMERIC,
  is_continuous BOOLEAN,
  gap NUMERIC
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  RETURN QUERY
  WITH ordered_rollforward AS (
    SELECT 
      r.fiscal_year,
      r.opening_balance,
      r.closing_balance,
      LAG(r.closing_balance) OVER (ORDER BY r.fiscal_year) as prior_closing
    FROM public.retained_earnings_rollforward r
    WHERE r.organization_id = p_organization_id
    ORDER BY r.fiscal_year
  )
  SELECT 
    o.fiscal_year,
    COALESCE(o.prior_closing, 0)::NUMERIC,
    o.opening_balance::NUMERIC,
    (o.prior_closing IS NULL OR ABS(o.prior_closing - o.opening_balance) < 0.01)::BOOLEAN,
    COALESCE(o.opening_balance - o.prior_closing, 0)::NUMERIC
  FROM ordered_rollforward o
  WHERE o.prior_closing IS NOT NULL;
END;
$$;

-- 10. Function to get RE balance for any point in time (GAAP compliant)
CREATE OR REPLACE FUNCTION public.get_retained_earnings_balance(
  p_organization_id UUID,
  p_as_of_date DATE
) RETURNS NUMERIC LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_re_account_id UUID;
  v_balance NUMERIC;
  v_fiscal_year INTEGER;
  v_fiscal_year_start DATE;
BEGIN
  -- Get the fiscal year for the as_of_date
  v_fiscal_year := EXTRACT(YEAR FROM p_as_of_date)::INTEGER;
  v_fiscal_year_start := make_date(v_fiscal_year, 1, 1);
  
  -- Get retained earnings account
  SELECT id INTO v_re_account_id
  FROM public.accounts
  WHERE organization_id = p_organization_id
    AND (equity_type = 'retained_earnings' OR code = '3-00-201')
    AND is_header = false
  LIMIT 1;
  
  IF v_re_account_id IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Calculate RE balance: opening + all entries up to as_of_date
  -- EXCLUDING same-year CLOSE-* entries (handled by Current Year Earnings)
  SELECT 
    COALESCE(a.opening_balance, 0) + COALESCE(SUM(
      CASE WHEN a.normal_balance = 'credit' 
           THEN jel.credit - jel.debit 
           ELSE jel.debit - jel.credit END
    ), 0)
  INTO v_balance
  FROM public.accounts a
  LEFT JOIN public.journal_entry_lines jel ON jel.account_id = a.id
  LEFT JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    AND je.status = 'posted'
    AND je.entry_date <= p_as_of_date
    -- Exclude same-year CLOSE entries to prevent double-counting with CYE
    AND NOT (
      je.reference LIKE 'CLOSE-%'
      AND EXTRACT(YEAR FROM je.entry_date) = v_fiscal_year
    )
  WHERE a.id = v_re_account_id
  GROUP BY a.id, a.opening_balance;
  
  RETURN ROUND(COALESCE(v_balance, 0), 2);
END;
$$;

-- 11. Add index for performance
CREATE INDEX IF NOT EXISTS idx_accounts_equity_type ON public.accounts(equity_type) WHERE equity_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_re_rollforward_org_year ON public.retained_earnings_rollforward(organization_id, fiscal_year);
