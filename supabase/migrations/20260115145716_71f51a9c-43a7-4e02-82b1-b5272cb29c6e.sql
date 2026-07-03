-- =============================================
-- EFINSUITE GLOBE: AI-ENABLED BUDGET MODULE
-- Full Production Budget Framework
-- =============================================

-- Budget Master Table (Parent for all budget types)
CREATE TABLE public.budget_masters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  budget_type TEXT NOT NULL CHECK (budget_type IN (
    'operating', 'capital', 'revenue', 'payroll', 'cash_flow', 'rolling_forecast',
    'project', 'department', 'grant_fund',
    'master_production', 'production_volume', 'direct_materials', 'direct_labor',
    'manufacturing_overhead', 'wip', 'production_cost_unit', 'production_variance', 'production_capacity'
  )),
  fiscal_year TEXT NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'monthly' CHECK (period_type IN ('monthly', 'quarterly', 'weekly', 'annual')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CAD',
  base_currency TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'active', 'closed', 'archived')),
  version INTEGER NOT NULL DEFAULT 1,
  parent_budget_id UUID REFERENCES public.budget_masters(id),
  facility_id UUID,
  department_id UUID,
  cost_center_id UUID,
  country_id UUID REFERENCES public.countries(id),
  total_amount NUMERIC(18,2) DEFAULT 0,
  ai_generated BOOLEAN DEFAULT FALSE,
  ai_confidence_score NUMERIC(5,2),
  ai_model_used TEXT,
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Budget Versions (for scenario planning)
CREATE TABLE public.budget_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_master_id UUID NOT NULL REFERENCES public.budget_masters(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  version_name TEXT NOT NULL,
  scenario_type TEXT CHECK (scenario_type IN ('base', 'optimistic', 'pessimistic', 'demand_surge', 'supply_disruption', 'labor_shortage', 'fx_volatility', 'custom')),
  description TEXT,
  is_active BOOLEAN DEFAULT FALSE,
  total_amount NUMERIC(18,2) DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(budget_master_id, version_number)
);

-- Budget Line Items
CREATE TABLE public.budget_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_master_id UUID NOT NULL REFERENCES public.budget_masters(id) ON DELETE CASCADE,
  budget_version_id UUID REFERENCES public.budget_versions(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id),
  cost_object_type TEXT CHECK (cost_object_type IN ('gl_account', 'cost_center', 'project', 'product', 'production_line', 'bom_item', 'labor_category', 'overhead')),
  cost_object_id UUID,
  line_description TEXT NOT NULL,
  period_1 NUMERIC(18,2) DEFAULT 0,
  period_2 NUMERIC(18,2) DEFAULT 0,
  period_3 NUMERIC(18,2) DEFAULT 0,
  period_4 NUMERIC(18,2) DEFAULT 0,
  period_5 NUMERIC(18,2) DEFAULT 0,
  period_6 NUMERIC(18,2) DEFAULT 0,
  period_7 NUMERIC(18,2) DEFAULT 0,
  period_8 NUMERIC(18,2) DEFAULT 0,
  period_9 NUMERIC(18,2) DEFAULT 0,
  period_10 NUMERIC(18,2) DEFAULT 0,
  period_11 NUMERIC(18,2) DEFAULT 0,
  period_12 NUMERIC(18,2) DEFAULT 0,
  annual_total NUMERIC(18,2) GENERATED ALWAYS AS (
    COALESCE(period_1, 0) + COALESCE(period_2, 0) + COALESCE(period_3, 0) + 
    COALESCE(period_4, 0) + COALESCE(period_5, 0) + COALESCE(period_6, 0) + 
    COALESCE(period_7, 0) + COALESCE(period_8, 0) + COALESCE(period_9, 0) + 
    COALESCE(period_10, 0) + COALESCE(period_11, 0) + COALESCE(period_12, 0)
  ) STORED,
  unit_of_measure TEXT,
  quantity NUMERIC(18,4),
  unit_cost NUMERIC(18,4),
  driver_id UUID,
  notes TEXT,
  ai_suggested BOOLEAN DEFAULT FALSE,
  ai_confidence NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Budget Drivers (for driver-based budgeting)
CREATE TABLE public.budget_drivers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  driver_name TEXT NOT NULL,
  driver_type TEXT NOT NULL CHECK (driver_type IN (
    'volume', 'units_per_shift', 'machine_runtime', 'labor_efficiency',
    'scrap_rate', 'yield_percentage', 'energy_consumption', 'headcount',
    'square_footage', 'revenue_percentage', 'custom'
  )),
  description TEXT,
  base_value NUMERIC(18,6),
  unit_of_measure TEXT,
  is_ai_discovered BOOLEAN DEFAULT FALSE,
  sensitivity_score NUMERIC(5,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Budget Assumptions
CREATE TABLE public.budget_assumptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_master_id UUID REFERENCES public.budget_masters(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  assumption_category TEXT NOT NULL CHECK (assumption_category IN (
    'inflation', 'fx_rate', 'interest_rate', 'wage_increase', 'material_cost',
    'energy_cost', 'capacity_utilization', 'yield_rate', 'custom'
  )),
  assumption_name TEXT NOT NULL,
  assumption_value NUMERIC(18,6) NOT NULL,
  effective_from DATE,
  effective_to DATE,
  source TEXT,
  ai_recommended BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Production Bill of Materials (BoM)
CREATE TABLE public.production_boms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_service_id UUID REFERENCES public.products_services(id),
  bom_name TEXT NOT NULL,
  bom_code TEXT NOT NULL,
  version TEXT DEFAULT '1.0',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  yield_percentage NUMERIC(5,2) DEFAULT 100,
  standard_batch_size NUMERIC(18,4) DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BoM Line Items (Materials)
CREATE TABLE public.production_bom_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bom_id UUID NOT NULL REFERENCES public.production_boms(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('raw_material', 'component', 'sub_assembly', 'packaging', 'consumable')),
  inventory_item_id UUID,
  item_name TEXT NOT NULL,
  item_code TEXT,
  quantity_per_unit NUMERIC(18,6) NOT NULL,
  unit_of_measure TEXT NOT NULL,
  standard_cost NUMERIC(18,4),
  scrap_percentage NUMERIC(5,2) DEFAULT 0,
  lead_time_days INTEGER DEFAULT 0,
  supplier_id UUID REFERENCES public.vendors(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Production Routings (Labor Steps)
CREATE TABLE public.production_routings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bom_id UUID REFERENCES public.production_boms(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  routing_name TEXT NOT NULL,
  routing_code TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Routing Steps
CREATE TABLE public.production_routing_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  routing_id UUID NOT NULL REFERENCES public.production_routings(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  work_center TEXT,
  skill_level TEXT CHECK (skill_level IN ('entry', 'intermediate', 'skilled', 'expert')),
  standard_hours NUMERIC(10,4) NOT NULL,
  setup_hours NUMERIC(10,4) DEFAULT 0,
  machine_hours NUMERIC(10,4) DEFAULT 0,
  labor_rate NUMERIC(10,4),
  overhead_rate NUMERIC(10,4),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Production Capacity
CREATE TABLE public.production_capacity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_name TEXT NOT NULL,
  work_center TEXT,
  production_line TEXT,
  capacity_type TEXT NOT NULL CHECK (capacity_type IN ('machine_hours', 'labor_hours', 'units', 'shifts')),
  available_capacity NUMERIC(18,4) NOT NULL,
  utilized_capacity NUMERIC(18,4) DEFAULT 0,
  utilization_percentage NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN available_capacity > 0 THEN (utilized_capacity / available_capacity * 100) ELSE 0 END
  ) STORED,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  shift_pattern TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Budget vs Actual Snapshots
CREATE TABLE public.budget_actuals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_line_item_id UUID NOT NULL REFERENCES public.budget_line_items(id) ON DELETE CASCADE,
  period_number INTEGER NOT NULL CHECK (period_number BETWEEN 1 AND 12),
  budget_amount NUMERIC(18,2) NOT NULL,
  actual_amount NUMERIC(18,2) NOT NULL,
  variance_amount NUMERIC(18,2) GENERATED ALWAYS AS (actual_amount - budget_amount) STORED,
  variance_percentage NUMERIC(8,2),
  variance_type TEXT CHECK (variance_type IN ('volume', 'price', 'efficiency', 'fx', 'capacity', 'mixed')),
  ai_explanation TEXT,
  ai_recommendation TEXT,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI Forecast Outputs
CREATE TABLE public.budget_ai_forecasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  budget_master_id UUID REFERENCES public.budget_masters(id) ON DELETE CASCADE,
  forecast_type TEXT NOT NULL CHECK (forecast_type IN ('time_series', 'driver_based', 'ml_prediction', 'hybrid')),
  model_name TEXT,
  forecast_horizon_months INTEGER DEFAULT 12,
  forecast_data JSONB,
  confidence_interval_lower JSONB,
  confidence_interval_upper JSONB,
  accuracy_score NUMERIC(5,2),
  mape NUMERIC(8,4),
  rmse NUMERIC(18,4),
  key_drivers JSONB,
  recommendations JSONB,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Budget Approval Workflow
CREATE TABLE public.budget_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_master_id UUID NOT NULL REFERENCES public.budget_masters(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  approver_role TEXT NOT NULL,
  approver_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'escalated')),
  threshold_amount NUMERIC(18,2),
  comments TEXT,
  action_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Budget Audit Log
CREATE TABLE public.budget_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_master_id UUID REFERENCES public.budget_masters(id) ON DELETE CASCADE,
  budget_line_item_id UUID REFERENCES public.budget_line_items(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'approve', 'reject', 'submit', 'ai_generate', 'ai_override')),
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  performed_by UUID,
  ip_address TEXT,
  user_agent TEXT,
  ai_recommendation_followed BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Budget Hierarchy (for consolidation)
CREATE TABLE public.budget_hierarchy (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  hierarchy_level TEXT NOT NULL CHECK (hierarchy_level IN ('global', 'entity', 'country', 'facility', 'department', 'cost_center', 'production_line')),
  parent_id UUID REFERENCES public.budget_hierarchy(id),
  name TEXT NOT NULL,
  code TEXT,
  country_id UUID REFERENCES public.countries(id),
  currency TEXT,
  is_consolidation_point BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.budget_masters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_assumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_boms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_bom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_routings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_routing_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_capacity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_actuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_ai_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_hierarchy ENABLE ROW LEVEL SECURITY;

-- RLS Policies for budget_masters
CREATE POLICY "Users can view budget masters for their organizations"
ON public.budget_masters FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create budget masters for their organizations"
ON public.budget_masters FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update budget masters for their organizations"
ON public.budget_masters FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete budget masters for their organizations"
ON public.budget_masters FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

-- RLS Policies for budget_versions
CREATE POLICY "Users can view budget versions"
ON public.budget_versions FOR SELECT
USING (
  budget_master_id IN (
    SELECT id FROM public.budget_masters WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can manage budget versions"
ON public.budget_versions FOR ALL
USING (
  budget_master_id IN (
    SELECT id FROM public.budget_masters WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
);

-- RLS Policies for budget_line_items
CREATE POLICY "Users can view budget line items"
ON public.budget_line_items FOR SELECT
USING (
  budget_master_id IN (
    SELECT id FROM public.budget_masters WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can manage budget line items"
ON public.budget_line_items FOR ALL
USING (
  budget_master_id IN (
    SELECT id FROM public.budget_masters WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
);

-- RLS Policies for budget_drivers
CREATE POLICY "Users can view budget drivers"
ON public.budget_drivers FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage budget drivers"
ON public.budget_drivers FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

-- RLS Policies for budget_assumptions
CREATE POLICY "Users can view budget assumptions"
ON public.budget_assumptions FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
  OR budget_master_id IN (
    SELECT id FROM public.budget_masters WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can manage budget assumptions"
ON public.budget_assumptions FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

-- RLS Policies for production_boms
CREATE POLICY "Users can view production BOMs"
ON public.production_boms FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage production BOMs"
ON public.production_boms FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

-- RLS Policies for production_bom_items
CREATE POLICY "Users can view BOM items"
ON public.production_bom_items FOR SELECT
USING (
  bom_id IN (
    SELECT id FROM public.production_boms WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can manage BOM items"
ON public.production_bom_items FOR ALL
USING (
  bom_id IN (
    SELECT id FROM public.production_boms WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
);

-- RLS Policies for production_routings
CREATE POLICY "Users can view production routings"
ON public.production_routings FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage production routings"
ON public.production_routings FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

-- RLS Policies for production_routing_steps
CREATE POLICY "Users can view routing steps"
ON public.production_routing_steps FOR SELECT
USING (
  routing_id IN (
    SELECT id FROM public.production_routings WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can manage routing steps"
ON public.production_routing_steps FOR ALL
USING (
  routing_id IN (
    SELECT id FROM public.production_routings WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
);

-- RLS Policies for production_capacity
CREATE POLICY "Users can view production capacity"
ON public.production_capacity FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage production capacity"
ON public.production_capacity FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

-- RLS Policies for budget_actuals
CREATE POLICY "Users can view budget actuals"
ON public.budget_actuals FOR SELECT
USING (
  budget_line_item_id IN (
    SELECT id FROM public.budget_line_items WHERE budget_master_id IN (
      SELECT id FROM public.budget_masters WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Users can manage budget actuals"
ON public.budget_actuals FOR ALL
USING (
  budget_line_item_id IN (
    SELECT id FROM public.budget_line_items WHERE budget_master_id IN (
      SELECT id FROM public.budget_masters WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
    )
  )
);

-- RLS Policies for budget_ai_forecasts
CREATE POLICY "Users can view AI forecasts"
ON public.budget_ai_forecasts FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage AI forecasts"
ON public.budget_ai_forecasts FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

-- RLS Policies for budget_approvals
CREATE POLICY "Users can view budget approvals"
ON public.budget_approvals FOR SELECT
USING (
  budget_master_id IN (
    SELECT id FROM public.budget_masters WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can manage budget approvals"
ON public.budget_approvals FOR ALL
USING (
  budget_master_id IN (
    SELECT id FROM public.budget_masters WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
);

-- RLS Policies for budget_audit_logs
CREATE POLICY "Users can view budget audit logs"
ON public.budget_audit_logs FOR SELECT
USING (
  budget_master_id IN (
    SELECT id FROM public.budget_masters WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can create budget audit logs"
ON public.budget_audit_logs FOR INSERT
WITH CHECK (
  budget_master_id IN (
    SELECT id FROM public.budget_masters WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
);

-- RLS Policies for budget_hierarchy
CREATE POLICY "Users can view budget hierarchy"
ON public.budget_hierarchy FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage budget hierarchy"
ON public.budget_hierarchy FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

-- Indexes for performance
CREATE INDEX idx_budget_masters_org ON public.budget_masters(organization_id);
CREATE INDEX idx_budget_masters_type ON public.budget_masters(budget_type);
CREATE INDEX idx_budget_masters_status ON public.budget_masters(status);
CREATE INDEX idx_budget_line_items_master ON public.budget_line_items(budget_master_id);
CREATE INDEX idx_budget_line_items_account ON public.budget_line_items(account_id);
CREATE INDEX idx_production_boms_org ON public.production_boms(organization_id);
CREATE INDEX idx_production_capacity_org ON public.production_capacity(organization_id);
CREATE INDEX idx_budget_ai_forecasts_org ON public.budget_ai_forecasts(organization_id);
CREATE INDEX idx_budget_hierarchy_org ON public.budget_hierarchy(organization_id);

-- Trigger for updated_at
CREATE TRIGGER update_budget_masters_updated_at
BEFORE UPDATE ON public.budget_masters
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_budget_versions_updated_at
BEFORE UPDATE ON public.budget_versions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_budget_line_items_updated_at
BEFORE UPDATE ON public.budget_line_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_budget_drivers_updated_at
BEFORE UPDATE ON public.budget_drivers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_budget_assumptions_updated_at
BEFORE UPDATE ON public.budget_assumptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_production_boms_updated_at
BEFORE UPDATE ON public.production_boms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_production_bom_items_updated_at
BEFORE UPDATE ON public.production_bom_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_production_routings_updated_at
BEFORE UPDATE ON public.production_routings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_production_routing_steps_updated_at
BEFORE UPDATE ON public.production_routing_steps
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_production_capacity_updated_at
BEFORE UPDATE ON public.production_capacity
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_budget_hierarchy_updated_at
BEFORE UPDATE ON public.budget_hierarchy
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();