// Budget Module Types for EFINSUITE Globe

export type BudgetType = 
  | 'operating' 
  | 'capital' 
  | 'revenue' 
  | 'payroll' 
  | 'cash_flow' 
  | 'rolling_forecast'
  | 'project' 
  | 'department' 
  | 'grant_fund'
  | 'master_production' 
  | 'production_volume' 
  | 'direct_materials' 
  | 'direct_labor'
  | 'manufacturing_overhead' 
  | 'wip' 
  | 'production_cost_unit' 
  | 'production_variance' 
  | 'production_capacity';

export type BudgetStatus = 'draft' | 'pending_approval' | 'approved' | 'active' | 'closed' | 'archived';

export type PeriodType = 'monthly' | 'quarterly' | 'weekly' | 'annual';

export type ScenarioType = 'base' | 'optimistic' | 'pessimistic' | 'demand_surge' | 'supply_disruption' | 'labor_shortage' | 'fx_volatility' | 'custom';

export type DriverType = 
  | 'volume' 
  | 'units_per_shift' 
  | 'machine_runtime' 
  | 'labor_efficiency'
  | 'scrap_rate' 
  | 'yield_percentage' 
  | 'energy_consumption' 
  | 'headcount'
  | 'square_footage' 
  | 'revenue_percentage' 
  | 'custom';

export type AssumptionCategory = 
  | 'inflation' 
  | 'fx_rate' 
  | 'interest_rate' 
  | 'wage_increase' 
  | 'material_cost'
  | 'energy_cost' 
  | 'capacity_utilization' 
  | 'yield_rate' 
  | 'custom';

export type VarianceType = 'volume' | 'price' | 'efficiency' | 'fx' | 'capacity' | 'mixed';

export type HierarchyLevel = 'global' | 'entity' | 'country' | 'facility' | 'department' | 'cost_center' | 'production_line';

export interface BudgetMaster {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  budget_type: BudgetType;
  fiscal_year: string;
  period_type: PeriodType;
  start_date: string;
  end_date: string;
  currency: string;
  base_currency?: string;
  status: BudgetStatus;
  version: number;
  parent_budget_id?: string;
  facility_id?: string;
  department_id?: string;
  cost_center_id?: string;
  country_id?: string;
  total_amount: number;
  ai_generated: boolean;
  ai_confidence_score?: number;
  ai_model_used?: string;
  created_by?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetVersion {
  id: string;
  budget_master_id: string;
  version_number: number;
  version_name: string;
  scenario_type?: ScenarioType;
  description?: string;
  is_active: boolean;
  total_amount: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetLineItem {
  id: string;
  budget_master_id: string;
  budget_version_id?: string;
  account_id?: string;
  cost_object_type?: string;
  cost_object_id?: string;
  line_description: string;
  period_1: number;
  period_2: number;
  period_3: number;
  period_4: number;
  period_5: number;
  period_6: number;
  period_7: number;
  period_8: number;
  period_9: number;
  period_10: number;
  period_11: number;
  period_12: number;
  annual_total: number;
  unit_of_measure?: string;
  quantity?: number;
  unit_cost?: number;
  driver_id?: string;
  notes?: string;
  ai_suggested: boolean;
  ai_confidence?: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  account_name?: string;
  account_code?: string;
}

export interface BudgetDriver {
  id: string;
  organization_id: string;
  driver_name: string;
  driver_type: DriverType;
  description?: string;
  base_value?: number;
  unit_of_measure?: string;
  is_ai_discovered: boolean;
  sensitivity_score?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BudgetAssumption {
  id: string;
  budget_master_id?: string;
  organization_id?: string;
  assumption_category: AssumptionCategory;
  assumption_name: string;
  assumption_value: number;
  effective_from?: string;
  effective_to?: string;
  source?: string;
  ai_recommended: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductionBom {
  id: string;
  organization_id: string;
  product_service_id?: string;
  bom_name: string;
  bom_code: string;
  version: string;
  effective_from: string;
  effective_to?: string;
  yield_percentage: number;
  standard_batch_size: number;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined
  items?: ProductionBomItem[];
}

export interface ProductionBomItem {
  id: string;
  bom_id: string;
  item_type: 'raw_material' | 'component' | 'sub_assembly' | 'packaging' | 'consumable';
  inventory_item_id?: string;
  item_name: string;
  item_code?: string;
  quantity_per_unit: number;
  unit_of_measure: string;
  standard_cost?: number;
  scrap_percentage: number;
  lead_time_days: number;
  supplier_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductionRouting {
  id: string;
  bom_id?: string;
  organization_id: string;
  routing_name: string;
  routing_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  steps?: ProductionRoutingStep[];
}

export interface ProductionRoutingStep {
  id: string;
  routing_id: string;
  step_number: number;
  step_name: string;
  work_center?: string;
  skill_level?: 'entry' | 'intermediate' | 'skilled' | 'expert';
  standard_hours: number;
  setup_hours: number;
  machine_hours: number;
  labor_rate?: number;
  overhead_rate?: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductionCapacity {
  id: string;
  organization_id: string;
  facility_name: string;
  work_center?: string;
  production_line?: string;
  capacity_type: 'machine_hours' | 'labor_hours' | 'units' | 'shifts';
  available_capacity: number;
  utilized_capacity: number;
  utilization_percentage: number;
  period_start: string;
  period_end: string;
  shift_pattern?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BudgetActual {
  id: string;
  budget_line_item_id: string;
  period_number: number;
  budget_amount: number;
  actual_amount: number;
  variance_amount: number;
  variance_percentage?: number;
  variance_type?: VarianceType;
  ai_explanation?: string;
  ai_recommendation?: string;
  snapshot_date: string;
  created_at: string;
}

export interface BudgetAiForecast {
  id: string;
  organization_id?: string;
  budget_master_id?: string;
  forecast_type: 'time_series' | 'driver_based' | 'ml_prediction' | 'hybrid';
  model_name?: string;
  forecast_horizon_months: number;
  forecast_data?: Record<string, number[]>;
  confidence_interval_lower?: Record<string, number[]>;
  confidence_interval_upper?: Record<string, number[]>;
  accuracy_score?: number;
  mape?: number;
  rmse?: number;
  key_drivers?: string[];
  recommendations?: string[];
  generated_at: string;
  expires_at?: string;
  created_at: string;
}

export interface BudgetHierarchy {
  id: string;
  organization_id: string;
  hierarchy_level: HierarchyLevel;
  parent_id?: string;
  name: string;
  code?: string;
  country_id?: string;
  currency?: string;
  is_consolidation_point: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  children?: BudgetHierarchy[];
}

// Budget Type Categories for UI
export const BUDGET_TYPE_CATEGORIES = {
  financial: [
    { value: 'operating', label: 'Operating Budget (OPEX)', icon: 'Wallet' },
    { value: 'capital', label: 'Capital Budget (CAPEX)', icon: 'Building2' },
    { value: 'revenue', label: 'Revenue / Sales Budget', icon: 'TrendingUp' },
    { value: 'payroll', label: 'Payroll Budget', icon: 'Users' },
    { value: 'cash_flow', label: 'Cash Flow Budget', icon: 'Banknote' },
    { value: 'rolling_forecast', label: 'Rolling Forecast', icon: 'RefreshCw' },
  ],
  program: [
    { value: 'project', label: 'Project Budget', icon: 'FolderKanban' },
    { value: 'department', label: 'Department / Cost Center Budget', icon: 'Building' },
    { value: 'grant_fund', label: 'Grant / Fund Budget (NPO)', icon: 'HandHeart' },
  ],
  production: [
    { value: 'master_production', label: 'Master Production Budget', icon: 'Factory' },
    { value: 'production_volume', label: 'Production Volume Budget', icon: 'BarChart3' },
    { value: 'direct_materials', label: 'Direct Materials Budget', icon: 'Package' },
    { value: 'direct_labor', label: 'Direct Labor Budget', icon: 'HardHat' },
    { value: 'manufacturing_overhead', label: 'Manufacturing Overhead Budget', icon: 'Settings' },
    { value: 'wip', label: 'Work-in-Progress (WIP) Budget', icon: 'Clock' },
    { value: 'production_cost_unit', label: 'Production Cost per Unit Budget', icon: 'Calculator' },
    { value: 'production_variance', label: 'Production Variance Budget', icon: 'GitCompare' },
    { value: 'production_capacity', label: 'Production Capacity Budget', icon: 'Gauge' },
  ],
} as const;

export const BUDGET_STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-muted text-muted-foreground' },
  pending_approval: { label: 'Pending Approval', color: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Approved', color: 'bg-blue-100 text-blue-800' },
  active: { label: 'Active', color: 'bg-green-100 text-green-800' },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-800' },
  archived: { label: 'Archived', color: 'bg-red-100 text-red-800' },
} as const;

export const SCENARIO_TYPE_CONFIG = {
  base: { label: 'Base Case', color: 'bg-blue-100 text-blue-800' },
  optimistic: { label: 'Optimistic', color: 'bg-green-100 text-green-800' },
  pessimistic: { label: 'Pessimistic', color: 'bg-red-100 text-red-800' },
  demand_surge: { label: 'Demand Surge', color: 'bg-purple-100 text-purple-800' },
  supply_disruption: { label: 'Supply Disruption', color: 'bg-orange-100 text-orange-800' },
  labor_shortage: { label: 'Labor Shortage', color: 'bg-amber-100 text-amber-800' },
  fx_volatility: { label: 'FX Volatility', color: 'bg-cyan-100 text-cyan-800' },
  custom: { label: 'Custom', color: 'bg-gray-100 text-gray-800' },
} as const;
