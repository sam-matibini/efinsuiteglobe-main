
-- ============================================================================
-- MIGRATION: Balance Sheet Integrity + Organizations Localization
-- ============================================================================

-- 1. Add timezone column to organizations (for localized date math)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Toronto';

-- 2. Add accounting_standard validation (safe: only add if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'organizations'
      AND table_schema = 'public'
      AND constraint_name = 'organizations_accounting_standard_check'
      AND constraint_type = 'CHECK'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'organizations'
        AND column_name = 'accounting_standard'
        AND table_schema = 'public'
    ) THEN
      ALTER TABLE public.organizations
        ADD CONSTRAINT organizations_accounting_standard_check
        CHECK (accounting_standard IN ('ASPE', 'IFRS', 'ASNPO'));
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END$$;

-- 3. Add composite index on accounts for faster financial report queries
CREATE INDEX IF NOT EXISTS idx_accounts_org_type_header
  ON public.accounts (organization_id, account_type, is_header);

CREATE INDEX IF NOT EXISTS idx_accounts_org_active
  ON public.accounts (organization_id, is_active)
  WHERE is_active = true;

-- 4. Replace calculate_period_net_income to be future-proof for cogs/other_income/other_expense
CREATE OR REPLACE FUNCTION public.calculate_period_net_income(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_net_income NUMERIC;
BEGIN
  SELECT 
    COALESCE(SUM(
      CASE 
        WHEN a.account_type::text IN ('income', 'other_income') THEN 
          CASE WHEN a.normal_balance = 'credit' 
               THEN jel.credit - jel.debit
               ELSE -(jel.debit - jel.credit)
          END
        WHEN a.account_type::text IN ('expense', 'cogs', 'other_expense') THEN 
          CASE WHEN a.normal_balance = 'debit' 
               THEN -(jel.debit - jel.credit)
               ELSE jel.credit - jel.debit
          END
        ELSE 0
      END
    ), 0)
  INTO v_net_income
  FROM public.journal_entry_lines jel
  JOIN public.journal_entries je ON jel.journal_entry_id = je.id
  JOIN public.accounts a ON jel.account_id = a.id
  WHERE je.organization_id = p_organization_id
    AND je.status = 'posted'
    AND je.entry_date >= p_start_date
    AND je.entry_date <= p_end_date
    AND je.reference NOT LIKE 'CLOSE-%'
    AND a.account_type::text IN ('income', 'expense', 'cogs', 'other_income', 'other_expense')
    AND a.is_header = false;
  
  RETURN COALESCE(v_net_income, 0);
END;
$$;

-- 5. Drop overloaded validate_trial_balance and replace with improved single-arg version
DROP FUNCTION IF EXISTS public.validate_trial_balance(UUID);
DROP FUNCTION IF EXISTS public.validate_trial_balance(UUID, DATE);

CREATE OR REPLACE FUNCTION public.validate_trial_balance(
  p_organization_id UUID,
  p_as_of_date DATE DEFAULT CURRENT_DATE
) RETURNS TABLE(
  is_balanced BOOLEAN,
  total_debits NUMERIC,
  total_credits NUMERIC,
  difference NUMERIC,
  account_count INTEGER,
  checked_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_total_debits NUMERIC := 0;
  v_total_credits NUMERIC := 0;
  v_account_count INTEGER := 0;
BEGIN
  -- Real-time trial balance validation from live JE data (not stale current_balance cache).
  -- Includes both 'posted' AND 'reversed' statuses: reversals net to zero by design.
  SELECT
    COALESCE(SUM(jel.debit), 0),
    COALESCE(SUM(jel.credit), 0),
    COUNT(DISTINCT jel.account_id)
  INTO v_total_debits, v_total_credits, v_account_count
  FROM public.journal_entry_lines jel
  JOIN public.journal_entries je ON jel.journal_entry_id = je.id
  WHERE je.organization_id = p_organization_id
    AND je.status IN ('posted', 'reversed')
    AND je.entry_date <= p_as_of_date;

  RETURN QUERY
  SELECT
    ABS(v_total_debits - v_total_credits) < 0.01 AS is_balanced,
    ROUND(v_total_debits, 2) AS total_debits,
    ROUND(v_total_credits, 2) AS total_credits,
    ROUND(ABS(v_total_debits - v_total_credits), 2) AS difference,
    v_account_count::INTEGER AS account_count,
    NOW() AS checked_at;
END;
$$;

COMMENT ON FUNCTION public.validate_trial_balance IS
  'Real-time trial balance integrity check using live JE data. Includes posted and reversed entries (reversals net to zero by design). Tolerance: < $0.01.';
