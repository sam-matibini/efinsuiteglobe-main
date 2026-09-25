/**
 * Nigerian Tax Engine — shared types.
 *
 * All tax calculations flow through this module. Rates and brackets are
 * loaded from `ng_tax_definitions` + `ng_tax_rate_versions` — never hard-coded
 * at the call site.
 */

export type NgTaxCategory = 'sales' | 'payroll' | 'withholding' | 'corporate' | 'levy';
export type NgCalculationMethod =
  | 'flat'
  | 'percentage'
  | 'progressive'
  | 'formula'
  | 'tiered_turnover';

export interface NgTaxDefinition {
  id: string;
  organization_id: string | null;
  code: string;
  name: string;
  tax_category: NgTaxCategory;
  jurisdiction_level: 'federal' | 'state' | 'lga';
  jurisdiction_code: string | null;
  filing_frequency: string;
  remittance_due_offset_days: number;
  default_debit_account_code: string | null;
  default_credit_account_code: string | null;
  is_active: boolean;
}

export interface NgTaxBracket {
  min: number;
  max: number | null;
  rate: number; // percentage
}

export interface NgTaxRateVersion {
  id: string;
  definition_id: string;
  effective_from: string;
  effective_to: string | null;
  calculation_method: NgCalculationMethod;
  rate: number | null;
  brackets: NgTaxBracket[];
  formula: Record<string, unknown>;
  min_threshold: number | null;
  max_cap: number | null;
  source_reference: string | null;
}

export interface NgServiceClassification {
  id: string;
  code: string;
  name: string;
  definition_id: string;
  resident_rate: number;
  non_resident_rate: number | null;
  min_threshold: number | null;
  effective_from: string;
  effective_to: string | null;
}

export interface NgTaxRelief {
  id: string;
  code: string;
  name: string;
  relief_type: 'cra' | 'pension' | 'nhf' | 'nhis' | 'life_assurance' | 'gratuity' | 'other';
  formula: Record<string, unknown>;
  effective_from: string;
  effective_to: string | null;
}

export interface NgCalculationBreakdown {
  formula_used: string;
  inputs: Record<string, number>;
  steps: Array<{ label: string; value: number }>;
  source_reference: string | null;
}

export interface NgCalculationResult {
  definition_code: string;
  definition_id: string;
  rate_version_id: string;
  taxable_base: number;
  tax_rate: number | null;
  tax_amount: number;
  currency: string;
  breakdown: NgCalculationBreakdown;
  /** Suggested journal template (debit / credit account codes + amount). */
  journal_template: {
    debit_account_code: string | null;
    credit_account_code: string | null;
    amount: number;
    memo: string;
  };
}

export type NgLedgerSourceType =
  | 'invoice_line'
  | 'bill_line'
  | 'expense_line'
  | 'payroll_line'
  | 'journal_line'
  | 'manual';

export interface NgLedgerWriteInput {
  organization_id: string;
  result: NgCalculationResult;
  source_type: NgLedgerSourceType;
  source_id?: string | null;
  source_parent_id?: string | null;
  transaction_date: string; // ISO
  service_classification_id?: string | null;
  journal_entry_id?: string | null;
  journal_entry_line_id?: string | null;
}
