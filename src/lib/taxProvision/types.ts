// Phase 14: Tax Provisioning (ASC 740 / IAS 12) — Types

export type ProvisionFramework = 'asc740' | 'ias12' | 'aspe3465';
export type ProvisionStatus = 'draft' | 'review' | 'final' | 'filed';
export type ProvisionPeriodType = 'annual' | 'interim' | 'quarterly';
export type TempDiffCategory =
  | 'depreciation'
  | 'accruals'
  | 'reserves'
  | 'deferred_revenue'
  | 'nol'
  | 'tax_credit'
  | 'intangibles'
  | 'other';
export type DifferenceType = 'taxable' | 'deductible';
export type AdjustmentType =
  | 'permanent_difference'
  | 'discrete_item'
  | 'tax_credit'
  | 'prior_year_adjustment'
  | 'rate_change';
export type JurisdictionType = 'federal' | 'state' | 'provincial' | 'local' | 'foreign';

export interface ProvisionPeriod {
  id: string;
  organization_id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  period_type: ProvisionPeriodType;
  status: ProvisionStatus;
  reporting_framework: ProvisionFramework;
  pretax_book_income_cents: number;
  current_tax_expense_cents: number;
  deferred_tax_expense_cents: number;
  total_tax_provision_cents: number;
  effective_tax_rate: number;
  notes: string | null;
}

export interface JurisdictionRate {
  id: string;
  organization_id: string;
  jurisdiction_name: string;
  jurisdiction_type: JurisdictionType;
  country_code: string;
  region_code: string | null;
  statutory_rate: number;
  effective_from: string;
  effective_to: string | null;
  is_primary: boolean;
}

export interface TemporaryDifference {
  id: string;
  organization_id: string;
  name: string;
  category: TempDiffCategory;
  difference_type: DifferenceType;
  gl_account_id: string | null;
  description: string | null;
  is_active: boolean;
}

export interface TempDiffMovement {
  id: string;
  provision_period_id: string;
  temp_diff_id: string;
  opening_balance_cents: number;
  originating_cents: number;
  reversing_cents: number;
  closing_balance_cents: number;
  applied_rate: number;
  deferred_tax_balance_cents: number;
  deferred_tax_movement_cents: number;
  notes: string | null;
}

export interface ProvisionAdjustment {
  id: string;
  provision_period_id: string;
  adjustment_type: AdjustmentType;
  description: string;
  amount_cents: number;
  tax_impact_cents: number;
  applied_rate: number | null;
}

export interface NolCarryforward {
  id: string;
  organization_id: string;
  origin_year: number;
  origin_jurisdiction: string;
  original_amount_cents: number;
  utilized_amount_cents: number;
  remaining_amount_cents: number;
  expiry_date: string | null;
  is_indefinite: boolean;
  valuation_allowance_pct: number;
  notes: string | null;
}

export interface EtrLine {
  id: string;
  provision_period_id: string;
  line_order: number;
  description: string;
  amount_cents: number;
  rate_pct: number;
  line_type: 'statutory' | 'item' | 'subtotal' | 'effective';
}

export interface ProvisionComputation {
  pretaxBookIncome: number;
  permanentDiffs: number;
  taxableTempOriginating: number;
  taxableTempReversing: number;
  deductibleTempOriginating: number;
  deductibleTempReversing: number;
  taxableIncome: number;
  blendedRate: number;
  currentTax: number;
  deferredTax: number;
  totalProvision: number;
  effectiveTaxRate: number;
}
