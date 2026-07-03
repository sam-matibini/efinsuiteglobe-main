-- ============================================================================
-- STATEMENT OF RETAINED EARNINGS - Multi-Country/Multi-Organization Support
-- ASPE Section 1521 / IFRS IAS 1 / CRA Schedule 100 Compliant
-- ============================================================================

-- Add GIFI codes mapping for CRA compliance (Schedule 100)
-- These codes map to the Statement of Retained Earnings section
CREATE TABLE IF NOT EXISTS public.retained_earnings_statement (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  fiscal_year_start DATE NOT NULL,
  fiscal_year_end DATE NOT NULL,
  
  -- GIFI 3660: Opening balance of retained earnings
  opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  
  -- GIFI 3680: Net income (loss) for the period
  net_income_loss NUMERIC(15,2) NOT NULL DEFAULT 0,
  
  -- GIFI 3690: Other additions (prior period adjustments, etc.)
  other_additions NUMERIC(15,2) NOT NULL DEFAULT 0,
  
  -- GIFI 3695: Dividends declared
  dividends_declared NUMERIC(15,2) NOT NULL DEFAULT 0,
  
  -- GIFI 3700: Other deductions
  other_deductions NUMERIC(15,2) NOT NULL DEFAULT 0,
  
  -- GIFI 3849: Closing balance of retained earnings (computed column)
  closing_balance NUMERIC(15,2) GENERATED ALWAYS AS (
    opening_balance + net_income_loss + other_additions - dividends_declared - other_deductions
  ) STORED,
  
  -- Audit trail
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Multi-country support
  country_code VARCHAR(2) DEFAULT 'CA',
  currency_code VARCHAR(3) DEFAULT 'CAD',
  
  -- Link to the closing entry if the year was formally closed
  fiscal_year_close_id UUID REFERENCES public.fiscal_year_closes(id),
  
  -- Ensure one statement per org per fiscal year
  UNIQUE(organization_id, fiscal_year)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_retained_earnings_statement_org_year 
  ON public.retained_earnings_statement(organization_id, fiscal_year);

-- Enable RLS
ALTER TABLE public.retained_earnings_statement ENABLE ROW LEVEL SECURITY;

-- RLS Policies using organization_members (correct table name)
CREATE POLICY "Users can view RE statements for their organization"
  ON public.retained_earnings_statement FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert RE statements for their organization"
  ON public.retained_earnings_statement FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update RE statements for their organization"
  ON public.retained_earnings_statement FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete RE statements for their organization"
  ON public.retained_earnings_statement FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Add trigger for updated_at
CREATE TRIGGER update_retained_earnings_statement_updated_at
  BEFORE UPDATE ON public.retained_earnings_statement
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- DATABASE FUNCTION: Calculate Statement of Retained Earnings (Dynamic)
-- This function dynamically calculates the RE statement for any period
-- ============================================================================
CREATE OR REPLACE FUNCTION public.calculate_retained_earnings_statement(
  p_organization_id UUID,
  p_fiscal_year_start DATE,
  p_fiscal_year_end DATE
)
RETURNS TABLE (
  opening_balance NUMERIC,
  net_income_loss NUMERIC,
  other_additions NUMERIC,
  dividends_declared NUMERIC,
  other_deductions NUMERIC,
  closing_balance NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opening_balance NUMERIC := 0;
  v_net_income NUMERIC := 0;
  v_dividends NUMERIC := 0;
  v_other_additions NUMERIC := 0;
  v_other_deductions NUMERIC := 0;
  v_fiscal_year INTEGER;
BEGIN
  v_fiscal_year := EXTRACT(YEAR FROM p_fiscal_year_end);
  
  -- Calculate Opening Balance using the existing calculate_opening_retained_earnings function
  v_opening_balance := public.calculate_opening_retained_earnings(p_organization_id, v_fiscal_year);
  
  -- Calculate Net Income for the period using existing calculate_period_net_income
  v_net_income := public.calculate_period_net_income(p_organization_id, p_fiscal_year_start, p_fiscal_year_end);
  
  -- Calculate Dividends declared during the period
  SELECT COALESCE(SUM(
    CASE WHEN a.normal_balance = 'debit' THEN jel.debit - jel.credit ELSE jel.credit - jel.debit END
  ), 0) INTO v_dividends
  FROM journal_entry_lines jel
  JOIN journal_entries je ON jel.journal_entry_id = je.id
  JOIN accounts a ON jel.account_id = a.id
  WHERE a.organization_id = p_organization_id
    AND (a.equity_type = 'dividends' OR LOWER(a.name) LIKE '%dividend%' OR LOWER(a.name) LIKE '%drawing%')
    AND a.is_header = false
    AND je.status = 'posted'
    AND je.entry_date >= p_fiscal_year_start
    AND je.entry_date <= p_fiscal_year_end;
  
  -- Return the statement values
  RETURN QUERY SELECT 
    ROUND(v_opening_balance, 2),
    ROUND(v_net_income, 2),
    ROUND(v_other_additions, 2),
    ROUND(v_dividends, 2),
    ROUND(v_other_deductions, 2),
    ROUND(v_opening_balance + v_net_income + v_other_additions - v_dividends - v_other_deductions, 2);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.calculate_retained_earnings_statement(UUID, DATE, DATE) TO authenticated;