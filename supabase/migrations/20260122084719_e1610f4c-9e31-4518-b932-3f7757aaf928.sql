-- ============================================================================
-- DAPRO FINANCIAL REPORTING LOGIC - Database Functions
-- ============================================================================
-- These functions enforce GAAP/ASPE compliant financial calculations:
-- 1. Balance Sheet equation: Assets = Liabilities + Equity + Current Year Earnings
-- 2. Retained Earnings rollforward: Opening RE (Year N) = Closing RE (Year N-1)
-- 3. Period-specific Net Income calculation (excluding CLOSE-* entries)
-- ============================================================================

-- Function to calculate period-specific Net Income
-- Excludes CLOSE-* entries to show actual P&L activity
CREATE OR REPLACE FUNCTION public.calculate_period_net_income(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_net_income NUMERIC;
BEGIN
  SELECT 
    COALESCE(SUM(
      CASE 
        WHEN a.account_type = 'income' THEN 
          CASE WHEN a.normal_balance = 'credit' 
               THEN jel.credit - jel.debit 
               ELSE jel.debit - jel.credit END
        WHEN a.account_type = 'expense' THEN 
          -1 * CASE WHEN a.normal_balance = 'debit' 
                    THEN jel.debit - jel.credit 
                    ELSE jel.credit - jel.debit END
        ELSE 0
      END
    ), 0)
  INTO v_net_income
  FROM journal_entry_lines jel
  JOIN journal_entries je ON jel.journal_entry_id = je.id
  JOIN accounts a ON jel.account_id = a.id
  WHERE je.organization_id = p_organization_id
    AND je.status = 'posted'
    AND je.entry_date >= p_start_date
    AND je.entry_date <= p_end_date
    AND je.reference NOT LIKE 'CLOSE-%'  -- Exclude closing entries
    AND a.account_type IN ('income', 'expense')
    AND a.is_header = false;
  
  RETURN v_net_income;
END;
$$;

-- Function to calculate total equity (excluding CYE account to avoid double-counting)
CREATE OR REPLACE FUNCTION public.calculate_total_equity(
  p_organization_id UUID,
  p_as_of_date DATE
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_equity NUMERIC;
BEGIN
  SELECT 
    COALESCE(SUM(
      CASE WHEN a.normal_balance = 'credit' THEN 1 ELSE -1 END *
      (COALESCE(a.opening_balance, 0) + COALESCE(
        (SELECT SUM(
          CASE WHEN a.normal_balance = 'credit' 
               THEN jel2.credit - jel2.debit 
               ELSE jel2.debit - jel2.credit END
        )
        FROM journal_entry_lines jel2
        JOIN journal_entries je2 ON jel2.journal_entry_id = je2.id
        WHERE je2.status = 'posted' 
          AND jel2.account_id = a.id 
          AND je2.entry_date <= p_as_of_date
          -- For Retained Earnings, exclude same-year CLOSE-* entries
          AND NOT (
            a.code = '3-00-201' 
            AND je2.reference LIKE 'CLOSE-%'
            AND EXTRACT(YEAR FROM je2.entry_date) = EXTRACT(YEAR FROM p_as_of_date)
          )
        ), 0))
    ), 0)
  INTO v_total_equity
  FROM accounts a
  WHERE a.organization_id = p_organization_id
    AND a.account_type = 'equity'
    AND a.is_header = false
    -- Exclude CYE bucket account (3-00-202) as it's calculated dynamically
    AND a.code != '3-00-202'
    AND NOT (a.name ILIKE '%current year earnings%');
  
  RETURN v_total_equity;
END;
$$;

-- Function to calculate total assets
CREATE OR REPLACE FUNCTION public.calculate_total_assets(
  p_organization_id UUID,
  p_as_of_date DATE
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_assets NUMERIC;
BEGIN
  SELECT 
    COALESCE(SUM(
      CASE WHEN a.normal_balance = 'debit' THEN 1 ELSE -1 END *
      (COALESCE(a.opening_balance, 0) + COALESCE(
        (SELECT SUM(
          CASE WHEN a.normal_balance = 'debit' 
               THEN jel2.debit - jel2.credit 
               ELSE jel2.credit - jel2.debit END
        )
        FROM journal_entry_lines jel2
        JOIN journal_entries je2 ON jel2.journal_entry_id = je2.id
        WHERE je2.status = 'posted' 
          AND jel2.account_id = a.id 
          AND je2.entry_date <= p_as_of_date
        ), 0))
    ), 0)
  INTO v_total_assets
  FROM accounts a
  WHERE a.organization_id = p_organization_id
    AND a.account_type = 'asset'
    AND a.is_header = false;
  
  RETURN v_total_assets;
END;
$$;

-- Function to calculate total liabilities
CREATE OR REPLACE FUNCTION public.calculate_total_liabilities(
  p_organization_id UUID,
  p_as_of_date DATE
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_liabilities NUMERIC;
BEGIN
  SELECT 
    COALESCE(SUM(
      CASE WHEN a.normal_balance = 'credit' THEN 1 ELSE -1 END *
      (COALESCE(a.opening_balance, 0) + COALESCE(
        (SELECT SUM(
          CASE WHEN a.normal_balance = 'credit' 
               THEN jel2.credit - jel2.debit 
               ELSE jel2.debit - jel2.credit END
        )
        FROM journal_entry_lines jel2
        JOIN journal_entries je2 ON jel2.journal_entry_id = je2.id
        WHERE je2.status = 'posted' 
          AND jel2.account_id = a.id 
          AND je2.entry_date <= p_as_of_date
        ), 0))
    ), 0)
  INTO v_total_liabilities
  FROM accounts a
  WHERE a.organization_id = p_organization_id
    AND a.account_type = 'liability'
    AND a.is_header = false;
  
  RETURN v_total_liabilities;
END;
$$;

-- Function to validate Balance Sheet equation
-- Returns TRUE if Assets = Liabilities + Equity + Current Year Earnings
CREATE OR REPLACE FUNCTION public.validate_balance_sheet_equation(
  p_organization_id UUID,
  p_fiscal_year_start DATE,
  p_as_of_date DATE
)
RETURNS TABLE(
  is_balanced BOOLEAN,
  total_assets NUMERIC,
  total_liabilities NUMERIC,
  total_equity NUMERIC,
  current_year_earnings NUMERIC,
  total_liabilities_equity NUMERIC,
  difference NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_assets NUMERIC;
  v_liabilities NUMERIC;
  v_equity NUMERIC;
  v_cye NUMERIC;
  v_le_total NUMERIC;
  v_diff NUMERIC;
BEGIN
  -- Calculate all components
  v_assets := public.calculate_total_assets(p_organization_id, p_as_of_date);
  v_liabilities := public.calculate_total_liabilities(p_organization_id, p_as_of_date);
  v_equity := public.calculate_total_equity(p_organization_id, p_as_of_date);
  v_cye := public.calculate_period_net_income(p_organization_id, p_fiscal_year_start, p_as_of_date);
  
  -- Calculate L&E total
  v_le_total := v_liabilities + v_equity + v_cye;
  
  -- Calculate difference
  v_diff := ABS(v_assets - v_le_total);
  
  RETURN QUERY SELECT 
    (v_diff < 0.01)::BOOLEAN,
    ROUND(v_assets, 2),
    ROUND(v_liabilities, 2),
    ROUND(v_equity, 2),
    ROUND(v_cye, 2),
    ROUND(v_le_total, 2),
    ROUND(v_diff, 2);
END;
$$;

-- Function to get comparative Balance Sheet data for a specific period
CREATE OR REPLACE FUNCTION public.get_balance_sheet_data(
  p_organization_id UUID,
  p_fiscal_year_start DATE,
  p_as_of_date DATE
)
RETURNS TABLE(
  total_assets NUMERIC,
  total_liabilities NUMERIC,
  total_equity NUMERIC,
  net_income NUMERIC,
  total_shareholders_equity NUMERIC,
  total_liabilities_and_equity NUMERIC,
  is_balanced BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_assets NUMERIC;
  v_liabilities NUMERIC;
  v_equity NUMERIC;
  v_net_income NUMERIC;
  v_total_sh_equity NUMERIC;
  v_total_le NUMERIC;
BEGIN
  -- Calculate components
  v_assets := public.calculate_total_assets(p_organization_id, p_as_of_date);
  v_liabilities := public.calculate_total_liabilities(p_organization_id, p_as_of_date);
  v_equity := public.calculate_total_equity(p_organization_id, p_as_of_date);
  v_net_income := public.calculate_period_net_income(p_organization_id, p_fiscal_year_start, p_as_of_date);
  
  -- Total Shareholders' Equity = Equity + Current Year Earnings
  v_total_sh_equity := v_equity + v_net_income;
  
  -- Total L&E = Liabilities + Total Shareholders' Equity
  v_total_le := v_liabilities + v_total_sh_equity;
  
  RETURN QUERY SELECT 
    ROUND(v_assets, 2),
    ROUND(v_liabilities, 2),
    ROUND(v_equity, 2),
    ROUND(v_net_income, 2),
    ROUND(v_total_sh_equity, 2),
    ROUND(v_total_le, 2),
    (ABS(v_assets - v_total_le) < 0.01)::BOOLEAN;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION public.calculate_period_net_income IS 
'DAPRO Logic: Calculates period-specific Net Income (Revenue - Expenses) excluding CLOSE-* entries. Used for Current Year Earnings on Balance Sheet.';

COMMENT ON FUNCTION public.calculate_total_equity IS 
'DAPRO Logic: Calculates total equity excluding the CYE bucket account (3-00-202) to avoid double-counting with dynamic Net Income.';

COMMENT ON FUNCTION public.validate_balance_sheet_equation IS 
'DAPRO Logic: Validates Assets = Liabilities + Equity + Current Year Earnings with 0.01 tolerance.';

COMMENT ON FUNCTION public.get_balance_sheet_data IS 
'DAPRO Logic: Returns all Balance Sheet components for a given period. Total Shareholders Equity = Equity Accounts + Net Income.';