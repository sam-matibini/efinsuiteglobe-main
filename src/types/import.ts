// Types for Trial Balance & Opening Balance Import Engine

export type ImportType = 'trial_balance' | 'opening_balance';
export type PostingMode = 'opening_balance' | 'journal_entry';
export type FxSource = 'source' | 'system' | 'manual';
export type ValidationStatus = 'pending' | 'valid' | 'invalid' | 'warnings';
export type ImportStatus = 'draft' | 'validating' | 'validated' | 'posting' | 'posted' | 'reversed' | 'failed';
export type MatchType = 'exact' | 'alias' | 'fuzzy' | 'manual' | 'unmatched' | 'create_new';

export interface ImportBatch {
  id: string;
  organization_id: string;
  
  // Import configuration
  import_type: ImportType;
  posting_mode: PostingMode;
  source_system: string | null;
  
  // Period information
  fiscal_year: string;
  period_start: string | null;
  period_end: string | null;
  as_of_date: string;
  
  // Currency & FX
  base_currency: string;
  source_currency: string | null;
  exchange_rate: number;
  fx_source: FxSource | null;
  
  // Entity information
  entity_id: string | null;
  country_id: string | null;
  
  // File information
  original_filename: string | null;
  file_hash: string | null;
  file_size_bytes: number | null;
  total_rows: number;
  
  // Mapping configuration
  column_mappings: ImportColumnMapping[] | null;
  date_format: string;
  number_format: string;
  invert_signs: boolean;
  treat_brackets_as_negative: boolean;
  
  // Validation results
  validation_status: ValidationStatus;
  validation_errors: ValidationError[];
  validation_warnings: ValidationWarning[];
  
  // Reconciliation totals
  source_total_debits: number;
  source_total_credits: number;
  source_balance_difference: number;
  
  // Posted totals
  posted_total_debits: number;
  posted_total_credits: number;
  
  // Status & workflow
  status: ImportStatus;
  
  // Audit
  created_by: string | null;
  created_at: string;
  updated_at: string;
  posted_at: string | null;
  posted_by: string | null;
  reversed_at: string | null;
  reversed_by: string | null;
  reversal_reason: string | null;
  
  // Journal entries created
  journal_entry_ids: string[];
  reversal_journal_entry_ids: string[];
}

export interface ImportBatchRow {
  id: string;
  batch_id: string;
  row_number: number;
  
  // Raw data from file
  raw_data: Record<string, unknown>;
  
  // Parsed values
  account_code: string | null;
  account_name: string | null;
  debit_amount: number;
  credit_amount: number;
  net_balance: number;
  
  // Currency info
  currency: string | null;
  source_amount: number | null;
  converted_amount: number | null;
  exchange_rate: number | null;
  
  // Optional dimensions
  department: string | null;
  cost_center: string | null;
  project: string | null;
  fund: string | null;
  location: string | null;
  program: string | null;
  
  // Account matching
  matched_account_id: string | null;
  match_type: MatchType | null;
  match_confidence: number | null;
  match_suggestions: AccountSuggestion[];
  
  // Validation
  is_valid: boolean;
  validation_errors: ValidationError[];
  validation_warnings: ValidationWarning[];
  
  // Posting status
  is_posted: boolean;
  posted_at: string | null;
  journal_entry_line_id: string | null;
  
  created_at: string;
  updated_at: string;
}

export interface ImportColumnMapping {
  id: string;
  sourceColumn: string;
  targetField: ImportTargetField;
  transform?: 'none' | 'trim' | 'uppercase' | 'lowercase' | 'abs' | 'negate';
  dateFormat?: string;
  numberFormat?: string;
}

export type ImportTargetField = 
  | 'account_code'
  | 'account_name'
  | 'debit'
  | 'credit'
  | 'balance'
  | 'currency'
  | 'department'
  | 'cost_center'
  | 'project'
  | 'fund'
  | 'location'
  | 'program';

export interface ValidationError {
  row?: number;
  field?: string;
  code: string;
  message: string;
}

export interface ValidationWarning {
  row?: number;
  field?: string;
  code: string;
  message: string;
}

export interface AccountSuggestion {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  confidence: number;
  match_reason: string;
}

export interface AccountAlias {
  id: string;
  organization_id: string;
  account_id: string;
  alias_code: string;
  alias_name: string | null;
  source_system: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ImportMappingTemplate {
  id: string;
  organization_id: string;
  name: string;
  import_type: ImportType;
  source_system: string | null;
  mappings: ImportColumnMapping[];
  date_format: string;
  number_format: string;
  invert_signs: boolean;
  treat_brackets_as_negative: boolean;
  default_currency: string | null;
  default_entity_id: string | null;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportAuditLog {
  id: string;
  batch_id: string;
  action: string;
  details: Record<string, unknown> | null;
  performed_by: string | null;
  performed_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

// UI-specific types
export interface ImportWizardState {
  step: 'config' | 'upload' | 'mapping' | 'matching' | 'validation' | 'preview' | 'posting' | 'complete';
  importType: ImportType;
  postingMode: PostingMode;
  fiscalYear: string;
  asOfDate: Date;
  periodStart?: Date;
  periodEnd?: Date;
  baseCurrency: string;
  sourceCurrency?: string;
  exchangeRate: number;
  fxSource: FxSource;
  sourceSystem?: string;
  entityId?: string;
  countryId?: string;
}

export interface ParsedImportRow {
  rowNumber: number;
  rawData: Record<string, unknown>;
  accountCode: string;
  accountName?: string;
  debit: number;
  credit: number;
  balance: number;
  currency?: string;
  department?: string;
  costCenter?: string;
  project?: string;
  fund?: string;
  location?: string;
  program?: string;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ImportReconciliation {
  totalDebits: number;
  totalCredits: number;
  difference: number;
  isBalanced: boolean;
  rowCount: number;
  validRowCount: number;
  invalidRowCount: number;
  unmatchedCount: number;
  byEntity?: Record<string, { debits: number; credits: number; difference: number }>;
  byCurrency?: Record<string, { debits: number; credits: number; difference: number }>;
}

export const SOURCE_SYSTEMS = [
  { value: 'quickbooks', label: 'QuickBooks' },
  { value: 'sage', label: 'Sage' },
  { value: 'xero', label: 'Xero' },
  { value: 'sap', label: 'SAP' },
  { value: 'oracle', label: 'Oracle' },
  { value: 'dynamics', label: 'Microsoft Dynamics' },
  { value: 'freshbooks', label: 'FreshBooks' },
  { value: 'wave', label: 'Wave' },
  { value: 'zoho', label: 'Zoho Books' },
  { value: 'custom', label: 'Custom / Other ERP' },
] as const;

export const IMPORT_TARGET_FIELDS: { 
  id: ImportTargetField; 
  label: string; 
  required: boolean; 
  group: 'required' | 'amounts' | 'dimensions' | 'integration';
  description: string;
}[] = [
  // Required fields
  { id: 'account_code', label: 'Account Code', required: true, group: 'required', description: 'GL account code/number' },
  { id: 'account_name', label: 'Account Name', required: false, group: 'required', description: 'Account name (helps with matching)' },
  // Amount fields (double-entry)
  { id: 'debit', label: 'Debit Amount', required: false, group: 'amounts', description: 'Debit balance column' },
  { id: 'credit', label: 'Credit Amount', required: false, group: 'amounts', description: 'Credit balance column' },
  { id: 'balance', label: 'Net Balance', required: false, group: 'amounts', description: 'Single balance column (+/-)' },
  // Integration & source tracking
  { id: 'currency', label: 'Currency', required: false, group: 'integration', description: 'Currency code (if multi-currency)' },
  // Dimensions
  { id: 'department', label: 'Department', required: false, group: 'dimensions', description: 'Department dimension' },
  { id: 'cost_center', label: 'Cost Center', required: false, group: 'dimensions', description: 'Cost center dimension' },
  { id: 'project', label: 'Project', required: false, group: 'dimensions', description: 'Project dimension' },
  { id: 'fund', label: 'Fund', required: false, group: 'dimensions', description: 'Fund dimension' },
  { id: 'location', label: 'Location', required: false, group: 'dimensions', description: 'Location dimension' },
  { id: 'program', label: 'Program', required: false, group: 'dimensions', description: 'Program dimension' },
];
