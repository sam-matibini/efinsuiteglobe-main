// Banking Rules Types for AI-enabled transaction categorization

export type RuleConditionField = 
  | 'description'
  | 'amount'
  | 'type'
  | 'date'
  | 'payee_payor'
  | 'reference';

export type RuleConditionOperator = 
  | 'contains'
  | 'not_contains'
  | 'equals'
  | 'not_equals'
  | 'starts_with'
  | 'ends_with'
  | 'contains_words'    // All words must be present (order-independent)
  | 'contains_any_word' // At least one word present
  | 'fuzzy_match'       // Fuzzy matching with similarity threshold
  | 'matches_regex'     // Regex pattern matching
  | 'greater_than'
  | 'less_than'
  | 'between'
  | 'is_deposit'
  | 'is_withdrawal';

export interface RuleCondition {
  id: string;
  field: RuleConditionField;
  operator: RuleConditionOperator;
  value: string;
  value2?: string; // For 'between' operator
}

export type RuleLogicOperator = 'AND' | 'OR';

export interface RuleAction {
  type: 'categorize' | 'post_to_gl' | 'add_memo' | 'flag_review';
  category?: string;
  glAccountId?: string;
  glAccountName?: string;
  memo?: string;
  // Sales tax fields
  taxCodeId?: string;
  taxCode?: string;
  taxRate?: number;
  // DEPRECATED: Use taxCollectedGlAccountId/taxPaidGlAccountId instead
  taxGlAccountId?: string;
  taxGlAccountName?: string;
  // Split GL accounts for correct tax posting
  taxCollectedGlAccountId?: string; // For deposits (sales) - GST/HST Payable
  taxPaidGlAccountId?: string;      // For withdrawals (expenses) - GST/HST ITC
  // Division / Department tagging (multidimensional accounting)
  departmentId?: string;
  departmentName?: string;
}

export interface TransactionRule {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  priority: number;
  conditions: RuleCondition[];
  logicOperator: RuleLogicOperator;
  actions: RuleAction[];
  isAISuggested?: boolean;
  matchCount: number;
  lastMatched?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AICategorizationResult {
  transactionId: string;
  suggestedCategory: string;
  suggestedGLAccount: {
    id: string;
    code: string;
    name: string;
  };
  confidence: number;
  reasoning: string;
  suggestedRule?: Partial<TransactionRule>;
}
