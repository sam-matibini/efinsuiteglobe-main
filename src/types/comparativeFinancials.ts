/**
 * ============================================================================
 * COMPARATIVE FINANCIAL STATEMENTS TYPES
 * ============================================================================
 * 
 * Type definitions for side-by-side comparative financial statements
 * supporting CSRS 4200 compliant compilation reports.
 */

// Period structure for report periods
export interface ReportPeriod {
  periodId: string;
  startDate: string;
  endDate: string;
  label: string;
  isComparative: boolean;
}

// Account alignment structure for comparative display
export interface AlignedAccount {
  accountId: string;
  accountCode: string;
  accountName: string;
  aspeCategory: string;
  presentationOrder: number;
  isTotal: boolean;
  isSubtotal: boolean;
  isHeader: boolean;
  isCurrent: boolean;
  normalBalance: 'debit' | 'credit';
  currentPeriodAmount: number;
  priorPeriodAmount: number;
  varianceAmount: number;
  variancePercent: number;
  varianceType: 'favorable' | 'unfavorable' | 'neutral';
  isMissingInCurrent: boolean;
  isMissingInPrior: boolean;
  isNewAccount: boolean;
  isClosedAccount: boolean;
  requiresDisclosure: boolean;
  disclosureReason?: string;
}

// Section grouping for ASPE presentation
export interface FinancialSection {
  sectionId: string;
  sectionName: string;
  sectionType: 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses' | 'cogs' | 'other_income' | 'other_expenses';
  isCurrentSection: boolean;
  accounts: AlignedAccount[];
  currentPeriodTotal: number;
  priorPeriodTotal: number;
  varianceAmount: number;
  variancePercent: number;
}

// Complete comparative balance sheet data
export interface ComparativeBalanceSheet {
  currentPeriodLabel: string;
  priorPeriodLabel: string;
  asAtDate: string;
  priorAsAtDate: string;
  
  // Asset sections
  currentAssets: FinancialSection;
  nonCurrentAssets: FinancialSection;
  totalAssets: {
    current: number;
    prior: number;
    variance: number;
    variancePercent: number;
  };
  
  // Liability sections
  currentLiabilities: FinancialSection;
  nonCurrentLiabilities: FinancialSection;
  totalLiabilities: {
    current: number;
    prior: number;
    variance: number;
    variancePercent: number;
  };
  
  // Equity section
  equity: FinancialSection;
  currentYearEarnings: {
    current: number;
    prior: number;
    variance: number;
    variancePercent: number;
  };
  totalEquity: {
    current: number;
    prior: number;
    variance: number;
    variancePercent: number;
  };
  
  // Validation
  currentPeriodBalanced: boolean;
  priorPeriodBalanced: boolean;
  balanceDifferenceCurrent: number;
  balanceDifferencePrior: number;
}

// Complete comparative income statement data
export interface ComparativeIncomeStatement {
  currentPeriodLabel: string;
  priorPeriodLabel: string;
  periodEndedDate: string;
  priorPeriodEndedDate: string;
  
  revenue: FinancialSection;
  costOfGoodsSold: FinancialSection;
  grossProfit: {
    current: number;
    prior: number;
    variance: number;
    variancePercent: number;
  };
  grossProfitMargin: {
    current: number;
    prior: number;
    variance: number;
  };
  
  operatingExpenses: FinancialSection;
  operatingIncome: {
    current: number;
    prior: number;
    variance: number;
    variancePercent: number;
  };
  
  otherIncome: FinancialSection;
  otherExpenses: FinancialSection;
  
  profitBeforeTax: {
    current: number;
    prior: number;
    variance: number;
    variancePercent: number;
  };
  
  netIncome: {
    current: number;
    prior: number;
    variance: number;
    variancePercent: number;
  };
  netProfitMargin: {
    current: number;
    prior: number;
    variance: number;
  };
}

// Comparative changes in equity data
export interface ComparativeChangesInEquity {
  currentPeriodLabel: string;
  priorPeriodLabel: string;
  
  openingShareCapital: { current: number; prior: number };
  shareCapitalChanges: AlignedAccount[];
  closingShareCapital: { current: number; prior: number };
  
  openingRetainedEarnings: { current: number; prior: number };
  netIncome: { current: number; prior: number };
  dividends: { current: number; prior: number };
  otherAdjustments: AlignedAccount[];
  closingRetainedEarnings: { current: number; prior: number };
  
  openingTotalEquity: { current: number; prior: number };
  totalChanges: { current: number; prior: number };
  closingTotalEquity: { current: number; prior: number };
}

// AI variance analysis result
export interface VarianceAnalysis {
  accountId: string;
  accountName: string;
  currentAmount: number;
  priorAmount: number;
  varianceAmount: number;
  variancePercent: number;
  isSignificant: boolean;
  significanceThreshold: number;
  analysisType: 'increase' | 'decrease' | 'new_account' | 'closed_account' | 'reclassification';
  suggestedDisclosure: string;
  priority: 'high' | 'medium' | 'low';
}

// Compilation report settings for comparative display
export interface ComparativeDisplaySettings {
  showSideBySide: boolean;
  periodLabels: {
    current: string;
    prior: string;
  };
  hideZeroLines: boolean;
  expandSections: boolean;
  roundingRule: 'nearest' | 'thousands' | 'millions';
  showVarianceColumn: boolean;
  showVariancePercent: boolean;
  highlightSignificantVariances: boolean;
  significanceThreshold: number;
  negativeValueFormat: 'brackets' | 'minus';
  currencySeparator: 'comma' | 'space';
  decimalPlaces: 0 | 2;
}

// Export data structure for PDF/Word generation
export interface ComparativeExportData {
  organizationName: string;
  reportTitle: string;
  asAtDate: string;
  periodEndedLabel: string;
  periodLabels: {
    current: string;
    prior: string;
  };
  
  balanceSheet: ComparativeBalanceSheet;
  incomeStatement: ComparativeIncomeStatement;
  changesInEquity: ComparativeChangesInEquity;
  
  varianceAnalyses: VarianceAnalysis[];
  suggestedDisclosures: string[];
  
  displaySettings: ComparativeDisplaySettings;
  
  // Validation results
  isCurrentPeriodBalanced: boolean;
  isPriorPeriodBalanced: boolean;
  hasSignificantVariances: boolean;
  hasMissingComparatives: boolean;
}

// Account alignment algorithm result
export interface AccountAlignmentResult {
  alignedAccounts: AlignedAccount[];
  newAccountsInCurrent: string[];
  closedAccountsInPrior: string[];
  reclassifiedAccounts: Array<{
    accountId: string;
    fromCategory: string;
    toCategory: string;
  }>;
  alignmentWarnings: string[];
}
