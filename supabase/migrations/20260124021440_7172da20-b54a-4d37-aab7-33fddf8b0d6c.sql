-- ============================================
-- DETAILED LEDGER ARCHITECTURE - Phase 1
-- Dimension Tables & Extended Journal Lines
-- ============================================

-- 1. Cost Centers Table
CREATE TABLE IF NOT EXISTS public.cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES public.cost_centers(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, code)
);

-- 2. Departments Table
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  manager_id UUID REFERENCES public.employees(id),
  parent_id UUID REFERENCES public.departments(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, code)
);

-- 3. Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  customer_id UUID REFERENCES public.customers(id),
  start_date DATE,
  end_date DATE,
  budget_amount DECIMAL(15,2),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  is_billable BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, code)
);

-- 4. Funds Table (for NPO/Government accounting)
CREATE TABLE IF NOT EXISTS public.funds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  fund_type VARCHAR(50) NOT NULL DEFAULT 'general',
  restriction_level VARCHAR(50) DEFAULT 'unrestricted',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, code)
);

-- 5. Locations Table
CREATE TABLE IF NOT EXISTS public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  province_state VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, code)
);

-- 6. Segments Table (for multi-dimensional COA)
CREATE TABLE IF NOT EXISTS public.segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  segment_type VARCHAR(50) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, segment_type, code)
);

-- 7. Extend journal_entry_lines with dimension columns
ALTER TABLE public.journal_entry_lines
  ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.cost_centers(id),
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id),
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id),
  ADD COLUMN IF NOT EXISTS fund_id UUID REFERENCES public.funds(id),
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id),
  ADD COLUMN IF NOT EXISTS segment_id UUID REFERENCES public.segments(id),
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id),
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id),
  ADD COLUMN IF NOT EXISTS tax_code_id UUID REFERENCES public.tax_codes(id),
  ADD COLUMN IF NOT EXISTS source_document_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS source_document_id UUID,
  ADD COLUMN IF NOT EXISTS currency CHAR(3) DEFAULT 'CAD',
  ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(15,6) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS base_currency_debit DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS base_currency_credit DECIMAL(15,2);

-- 8. Enable RLS on new tables
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies for dimension tables (using organization_members)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cost_centers' AND policyname = 'Users can view cost centers in their org') THEN
    CREATE POLICY "Users can view cost centers in their org" ON public.cost_centers
      FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cost_centers' AND policyname = 'Users can manage cost centers in their org') THEN
    CREATE POLICY "Users can manage cost centers in their org" ON public.cost_centers
      FOR ALL USING (
        organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'departments' AND policyname = 'Users can view departments in their org') THEN
    CREATE POLICY "Users can view departments in their org" ON public.departments
      FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'departments' AND policyname = 'Users can manage departments in their org') THEN
    CREATE POLICY "Users can manage departments in their org" ON public.departments
      FOR ALL USING (
        organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Users can view projects in their org') THEN
    CREATE POLICY "Users can view projects in their org" ON public.projects
      FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Users can manage projects in their org') THEN
    CREATE POLICY "Users can manage projects in their org" ON public.projects
      FOR ALL USING (
        organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'funds' AND policyname = 'Users can view funds in their org') THEN
    CREATE POLICY "Users can view funds in their org" ON public.funds
      FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'funds' AND policyname = 'Users can manage funds in their org') THEN
    CREATE POLICY "Users can manage funds in their org" ON public.funds
      FOR ALL USING (
        organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'locations' AND policyname = 'Users can view locations in their org') THEN
    CREATE POLICY "Users can view locations in their org" ON public.locations
      FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'locations' AND policyname = 'Users can manage locations in their org') THEN
    CREATE POLICY "Users can manage locations in their org" ON public.locations
      FOR ALL USING (
        organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'segments' AND policyname = 'Users can view segments in their org') THEN
    CREATE POLICY "Users can view segments in their org" ON public.segments
      FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'segments' AND policyname = 'Users can manage segments in their org') THEN
    CREATE POLICY "Users can manage segments in their org" ON public.segments
      FOR ALL USING (
        organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- 10. Performance Indexes for detailed ledger queries
CREATE INDEX IF NOT EXISTS idx_jel_cost_center ON public.journal_entry_lines(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_jel_department ON public.journal_entry_lines(department_id);
CREATE INDEX IF NOT EXISTS idx_jel_project ON public.journal_entry_lines(project_id);
CREATE INDEX IF NOT EXISTS idx_jel_fund ON public.journal_entry_lines(fund_id);
CREATE INDEX IF NOT EXISTS idx_jel_location ON public.journal_entry_lines(location_id);
CREATE INDEX IF NOT EXISTS idx_jel_vendor ON public.journal_entry_lines(vendor_id);
CREATE INDEX IF NOT EXISTS idx_jel_customer ON public.journal_entry_lines(customer_id);
CREATE INDEX IF NOT EXISTS idx_jel_source_doc ON public.journal_entry_lines(source_document_type, source_document_id);
CREATE INDEX IF NOT EXISTS idx_je_org_date ON public.journal_entries(organization_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_je_org_period ON public.journal_entries(organization_id, status, entry_date);

-- 11. Create detailed_ledger_view for analytics (using correct column names)
CREATE OR REPLACE VIEW public.detailed_ledger_view AS
SELECT
  je.id AS journal_entry_id,
  je.organization_id,
  je.entry_date AS txn_date,
  TO_CHAR(je.entry_date, 'YYYY-MM') AS posting_period,
  je.journal_type AS source_module,
  je.reference AS reference_no,
  je.description AS entry_description,
  je.status,
  je.created_by,
  je.created_at,
  
  jel.id AS line_id,
  jel.account_id,
  a.code AS account_code,
  a.name AS account_name,
  a.account_type,
  a.normal_balance,
  
  jel.debit,
  jel.credit,
  (COALESCE(jel.debit, 0) - COALESCE(jel.credit, 0)) AS net_amount,
  
  jel.description AS line_memo,
  
  -- Dimensions
  jel.cost_center_id,
  cc.code AS cost_center_code,
  cc.name AS cost_center_name,
  
  jel.department_id,
  dept.code AS department_code,
  dept.name AS department_name,
  
  jel.project_id,
  proj.code AS project_code,
  proj.name AS project_name,
  
  jel.fund_id,
  fund.code AS fund_code,
  fund.name AS fund_name,
  
  jel.location_id,
  loc.code AS location_code,
  loc.name AS location_name,
  
  jel.vendor_id,
  v.name AS vendor_name,
  
  jel.customer_id,
  cust.name AS customer_name,
  
  jel.tax_code_id,
  tc.code AS tax_code,
  tc.rate AS tax_rate,
  
  -- Currency
  COALESCE(jel.currency, 'CAD') AS currency,
  COALESCE(jel.exchange_rate, 1.0) AS exchange_rate,
  COALESCE(jel.base_currency_debit, jel.debit) AS base_debit,
  COALESCE(jel.base_currency_credit, jel.credit) AS base_credit,
  
  -- Source document tracking
  jel.source_document_type,
  jel.source_document_id

FROM public.journal_entries je
JOIN public.journal_entry_lines jel ON je.id = jel.journal_entry_id
JOIN public.accounts a ON jel.account_id = a.id
LEFT JOIN public.cost_centers cc ON jel.cost_center_id = cc.id
LEFT JOIN public.departments dept ON jel.department_id = dept.id
LEFT JOIN public.projects proj ON jel.project_id = proj.id
LEFT JOIN public.funds fund ON jel.fund_id = fund.id
LEFT JOIN public.locations loc ON jel.location_id = loc.id
LEFT JOIN public.vendors v ON jel.vendor_id = v.id
LEFT JOIN public.customers cust ON jel.customer_id = cust.id
LEFT JOIN public.tax_codes tc ON jel.tax_code_id = tc.id
WHERE je.status = 'posted';

-- 12. Function to calculate running balance for an account
CREATE OR REPLACE FUNCTION public.get_account_running_balance(
  p_organization_id UUID,
  p_account_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE(
  txn_date DATE,
  journal_entry_id UUID,
  reference_no VARCHAR,
  description TEXT,
  debit NUMERIC,
  credit NUMERIC,
  net_amount NUMERIC,
  running_balance NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_opening_balance NUMERIC;
  v_normal_balance TEXT;
BEGIN
  -- Get account properties
  SELECT a.normal_balance, COALESCE(a.opening_balance, 0)
  INTO v_normal_balance, v_opening_balance
  FROM accounts a
  WHERE a.id = p_account_id;
  
  -- Calculate opening balance including all transactions before start date
  IF p_start_date IS NOT NULL THEN
    SELECT v_opening_balance + COALESCE(SUM(
      CASE WHEN v_normal_balance = 'debit' 
           THEN COALESCE(jel.debit, 0) - COALESCE(jel.credit, 0)
           ELSE COALESCE(jel.credit, 0) - COALESCE(jel.debit, 0) END
    ), 0)
    INTO v_opening_balance
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    WHERE jel.account_id = p_account_id
      AND je.organization_id = p_organization_id
      AND je.status = 'posted'
      AND je.entry_date < p_start_date;
  END IF;
  
  RETURN QUERY
  WITH ledger_data AS (
    SELECT 
      je.entry_date::DATE AS txn_date,
      je.id AS journal_entry_id,
      je.reference AS reference_no,
      COALESCE(jel.description, je.description) AS description,
      COALESCE(jel.debit, 0) AS debit,
      COALESCE(jel.credit, 0) AS credit,
      CASE WHEN v_normal_balance = 'debit' 
           THEN COALESCE(jel.debit, 0) - COALESCE(jel.credit, 0)
           ELSE COALESCE(jel.credit, 0) - COALESCE(jel.debit, 0) END AS net_amount,
      ROW_NUMBER() OVER (ORDER BY je.entry_date, je.created_at, jel.line_order) AS rn
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    WHERE jel.account_id = p_account_id
      AND je.organization_id = p_organization_id
      AND je.status = 'posted'
      AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
      AND (p_end_date IS NULL OR je.entry_date <= p_end_date)
  )
  SELECT 
    ld.txn_date,
    ld.journal_entry_id,
    ld.reference_no::VARCHAR,
    ld.description::TEXT,
    ld.debit::NUMERIC,
    ld.credit::NUMERIC,
    ld.net_amount::NUMERIC,
    (v_opening_balance + SUM(ld.net_amount) OVER (ORDER BY ld.rn))::NUMERIC AS running_balance
  FROM ledger_data ld
  ORDER BY ld.txn_date, ld.rn;
END;
$$;

-- 13. Trigger to auto-calculate base currency amounts
CREATE OR REPLACE FUNCTION public.calculate_base_currency_amounts()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.base_currency_debit := COALESCE(NEW.debit, 0) * COALESCE(NEW.exchange_rate, 1.0);
  NEW.base_currency_credit := COALESCE(NEW.credit, 0) * COALESCE(NEW.exchange_rate, 1.0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_calculate_base_currency ON public.journal_entry_lines;
CREATE TRIGGER trigger_calculate_base_currency
  BEFORE INSERT OR UPDATE OF debit, credit, exchange_rate
  ON public.journal_entry_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_base_currency_amounts();

-- 14. Update timestamps triggers for new tables
DROP TRIGGER IF EXISTS update_cost_centers_updated_at ON public.cost_centers;
CREATE TRIGGER update_cost_centers_updated_at
  BEFORE UPDATE ON public.cost_centers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_departments_updated_at ON public.departments;
CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_funds_updated_at ON public.funds;
CREATE TRIGGER update_funds_updated_at
  BEFORE UPDATE ON public.funds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_locations_updated_at ON public.locations;
CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();