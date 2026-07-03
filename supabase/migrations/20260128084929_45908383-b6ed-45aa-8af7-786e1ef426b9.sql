-- ============================================================================
-- ASPE Statement of Changes in Equity - Schema Updates
-- ============================================================================

-- 1. Add equity_category to accounts table (maps to existing equity_type)
-- Note: accounts table already has equity_type, but adding explicit category for ASPE
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS equity_category VARCHAR(50);

-- Update existing accounts to set equity_category based on equity_type
UPDATE public.accounts 
SET equity_category = CASE 
    WHEN equity_type = 'share_capital' THEN 'COMMON_STOCK'
    WHEN equity_type = 'retained_earnings' THEN 'RETAINED_EARNINGS'
    WHEN equity_type = 'reserves' THEN 'CONTRIBUTED_SURPLUS'
    WHEN equity_type = 'dividends' THEN 'DIVIDENDS'
    WHEN code = '3-00-201' THEN 'RETAINED_EARNINGS'
    WHEN code LIKE '3-00-1%' THEN 'COMMON_STOCK'
    WHEN name ILIKE '%retained earnings%' THEN 'RETAINED_EARNINGS'
    WHEN name ILIKE '%common stock%' OR name ILIKE '%share capital%' THEN 'COMMON_STOCK'
    WHEN name ILIKE '%dividend%' OR name ILIKE '%drawing%' THEN 'DIVIDENDS'
    ELSE NULL
END
WHERE account_type = 'equity';

-- 2. Create equity_movements table (ASPE-Specific)
CREATE TABLE IF NOT EXISTS public.equity_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    fiscal_year INT NOT NULL,
    equity_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN (
        'OPENING_BALANCE',
        'NET_INCOME',
        'DIVIDENDS',
        'DRAWINGS',
        'PRIOR_PERIOD_ADJUSTMENT',
        'SHARE_ISSUANCE',
        'CLOSING_BALANCE'
    )),
    amount DECIMAL(18,2) NOT NULL,
    currency CHAR(3) DEFAULT 'CAD',
    source_module VARCHAR(50),
    source_reference UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(organization_id, fiscal_year, equity_account_id, movement_type)
);

-- Enable RLS on equity_movements
ALTER TABLE public.equity_movements ENABLE ROW LEVEL SECURITY;

-- RLS policies for equity_movements
CREATE POLICY "Users can view equity movements for their organizations"
ON public.equity_movements FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = equity_movements.organization_id
        AND om.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert equity movements for their organizations"
ON public.equity_movements FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = equity_movements.organization_id
        AND om.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update equity movements for their organizations"
ON public.equity_movements FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = equity_movements.organization_id
        AND om.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete equity movements for their organizations"
ON public.equity_movements FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = equity_movements.organization_id
        AND om.user_id = auth.uid()
    )
);

-- 3. Create Net Income by Year View
CREATE OR REPLACE VIEW public.vw_net_income_by_year AS
SELECT
    je.organization_id,
    EXTRACT(YEAR FROM je.entry_date)::INT AS fiscal_year,
    SUM(
        CASE
            WHEN a.account_type = 'income' THEN 
                CASE WHEN a.normal_balance = 'credit' 
                     THEN jel.credit - jel.debit 
                     ELSE -(jel.debit - jel.credit) END
            WHEN a.account_type = 'expense' THEN 
                CASE WHEN a.normal_balance = 'debit' 
                     THEN -(jel.debit - jel.credit)
                     ELSE jel.credit - jel.debit END
            ELSE 0
        END
    ) AS net_income
FROM public.journal_entry_lines jel
JOIN public.journal_entries je ON je.id = jel.journal_entry_id
JOIN public.accounts a ON a.id = jel.account_id
WHERE je.status = 'posted'
  AND je.reference NOT LIKE 'CLOSE-%'
  AND a.account_type IN ('income', 'expense')
  AND a.is_header = false
GROUP BY je.organization_id, EXTRACT(YEAR FROM je.entry_date);

-- 4. Create Opening Retained Earnings View
CREATE OR REPLACE VIEW public.vw_opening_retained_earnings AS
SELECT
    organization_id,
    fiscal_year + 1 AS fiscal_year,
    SUM(amount) AS opening_retained_earnings
FROM public.equity_movements
WHERE movement_type != 'OPENING_BALANCE'
GROUP BY organization_id, fiscal_year;

-- 5. Create Closing Retained Earnings View
CREATE OR REPLACE VIEW public.vw_retained_earnings_closing AS
SELECT
    em.organization_id,
    em.fiscal_year,
    SUM(em.amount) AS closing_retained_earnings
FROM public.equity_movements em
JOIN public.accounts a ON a.id = em.equity_account_id
WHERE a.equity_category = 'RETAINED_EARNINGS'
GROUP BY em.organization_id, em.fiscal_year;

-- 6. Create SOCE ASPE Detail View
CREATE OR REPLACE VIEW public.vw_soce_aspe_detail AS
SELECT
    em.organization_id,
    em.fiscal_year,
    a.equity_category,
    a.name AS account_name,
    em.movement_type,
    em.amount
FROM public.equity_movements em
JOIN public.accounts a ON a.id = em.equity_account_id;

-- 7. Create Comparative SOCE View (ASPE Format)
CREATE OR REPLACE VIEW public.vw_soce_aspe_comparative AS
SELECT
    organization_id,
    fiscal_year,
    equity_category,
    SUM(CASE WHEN movement_type = 'OPENING_BALANCE' THEN amount ELSE 0 END) AS opening_balance,
    SUM(CASE WHEN movement_type = 'SHARE_ISSUANCE' THEN amount ELSE 0 END) AS contributions,
    SUM(CASE WHEN movement_type = 'NET_INCOME' THEN amount ELSE 0 END) AS net_income,
    SUM(CASE WHEN movement_type IN ('DIVIDENDS', 'DRAWINGS') THEN amount ELSE 0 END) AS distributions,
    SUM(CASE WHEN movement_type = 'PRIOR_PERIOD_ADJUSTMENT' THEN amount ELSE 0 END) AS prior_period_adjustments,
    SUM(amount) AS closing_balance
FROM public.vw_soce_aspe_detail
GROUP BY organization_id, fiscal_year, equity_category
ORDER BY fiscal_year, equity_category;

-- 8. Function to populate equity movements for a fiscal year
CREATE OR REPLACE FUNCTION public.populate_equity_movements(
    p_organization_id UUID,
    p_fiscal_year INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_re_account_id UUID;
    v_net_income NUMERIC;
    v_opening_re NUMERIC;
    v_dividends NUMERIC;
    v_fiscal_start DATE;
    v_fiscal_end DATE;
BEGIN
    v_fiscal_start := make_date(p_fiscal_year, 1, 1);
    v_fiscal_end := make_date(p_fiscal_year, 12, 31);

    -- Get Retained Earnings account
    SELECT id INTO v_re_account_id
    FROM public.accounts
    WHERE organization_id = p_organization_id
      AND equity_category = 'RETAINED_EARNINGS'
      AND is_header = false
    LIMIT 1;

    IF v_re_account_id IS NULL THEN
        RAISE EXCEPTION 'No Retained Earnings account found';
    END IF;

    -- Calculate opening RE
    v_opening_re := public.calculate_opening_retained_earnings(p_organization_id, p_fiscal_year);

    -- Calculate net income
    v_net_income := public.calculate_period_net_income(p_organization_id, v_fiscal_start, v_fiscal_end);

    -- Calculate dividends
    SELECT COALESCE(SUM(
        CASE WHEN a.normal_balance = 'debit' THEN jel.debit - jel.credit ELSE jel.credit - jel.debit END
    ), 0) INTO v_dividends
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    JOIN public.accounts a ON a.id = jel.account_id
    WHERE je.organization_id = p_organization_id
      AND je.status = 'posted'
      AND je.entry_date >= v_fiscal_start
      AND je.entry_date <= v_fiscal_end
      AND a.equity_category = 'DIVIDENDS'
      AND a.is_header = false;

    -- Delete existing movements for this year
    DELETE FROM public.equity_movements
    WHERE organization_id = p_organization_id
      AND fiscal_year = p_fiscal_year
      AND equity_account_id = v_re_account_id;

    -- Insert Opening Balance
    INSERT INTO public.equity_movements (organization_id, fiscal_year, equity_account_id, movement_type, amount, source_module)
    VALUES (p_organization_id, p_fiscal_year, v_re_account_id, 'OPENING_BALANCE', COALESCE(v_opening_re, 0), 'SYSTEM');

    -- Insert Net Income
    INSERT INTO public.equity_movements (organization_id, fiscal_year, equity_account_id, movement_type, amount, source_module)
    VALUES (p_organization_id, p_fiscal_year, v_re_account_id, 'NET_INCOME', COALESCE(v_net_income, 0), 'GL');

    -- Insert Dividends (as negative)
    IF v_dividends != 0 THEN
        INSERT INTO public.equity_movements (organization_id, fiscal_year, equity_account_id, movement_type, amount, source_module)
        VALUES (p_organization_id, p_fiscal_year, v_re_account_id, 'DIVIDENDS', -ABS(v_dividends), 'GL');
    END IF;

    -- Insert Closing Balance
    INSERT INTO public.equity_movements (organization_id, fiscal_year, equity_account_id, movement_type, amount, source_module)
    VALUES (p_organization_id, p_fiscal_year, v_re_account_id, 'CLOSING_BALANCE', 
            COALESCE(v_opening_re, 0) + COALESCE(v_net_income, 0) - ABS(COALESCE(v_dividends, 0)), 'SYSTEM');
END;
$$;

-- 9. Function to get ASPE SOCE data for a range of years
CREATE OR REPLACE FUNCTION public.get_soce_aspe_data(
    p_organization_id UUID,
    p_start_year INT DEFAULT NULL,
    p_end_year INT DEFAULT NULL
)
RETURNS TABLE(
    fiscal_year INT,
    equity_category VARCHAR(50),
    opening_balance NUMERIC,
    contributions NUMERIC,
    net_income NUMERIC,
    distributions NUMERIC,
    prior_period_adjustments NUMERIC,
    closing_balance NUMERIC
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_start_year INT;
    v_end_year INT;
BEGIN
    -- Default to all years with data
    SELECT MIN(EXTRACT(YEAR FROM je.entry_date))::INT INTO v_start_year
    FROM public.journal_entries je
    WHERE je.organization_id = p_organization_id AND je.status = 'posted';

    v_start_year := COALESCE(p_start_year, v_start_year);
    v_end_year := COALESCE(p_end_year, EXTRACT(YEAR FROM CURRENT_DATE)::INT);

    RETURN QUERY
    SELECT
        s.fiscal_year,
        s.equity_category,
        s.opening_balance,
        s.contributions,
        s.net_income,
        s.distributions,
        s.prior_period_adjustments,
        s.closing_balance
    FROM public.vw_soce_aspe_comparative s
    WHERE s.organization_id = p_organization_id
      AND s.fiscal_year BETWEEN v_start_year AND v_end_year
    ORDER BY s.fiscal_year, s.equity_category;
END;
$$;

-- 10. Create index for performance
CREATE INDEX IF NOT EXISTS idx_equity_movements_org_year 
ON public.equity_movements(organization_id, fiscal_year);

CREATE INDEX IF NOT EXISTS idx_equity_movements_account 
ON public.equity_movements(equity_account_id);

CREATE INDEX IF NOT EXISTS idx_accounts_equity_category 
ON public.accounts(equity_category) WHERE equity_category IS NOT NULL;