/**
 * ============================================================================
 * COMPARATIVE FINANCIAL UTILITIES
 * ============================================================================
 * 
 * Utility functions for building side-by-side comparative financial statements
 * with proper account alignment, variance detection, and ASPE compliance.
 */

import {
  AlignedAccount,
  FinancialSection,
  VarianceAnalysis,
  AccountAlignmentResult,
  ComparativeDisplaySettings,
} from '@/types/comparativeFinancials';

// Default display settings
export const defaultDisplaySettings: ComparativeDisplaySettings = {
  showSideBySide: true,
  periodLabels: { current: '2025', prior: '2024' },
  hideZeroLines: false,
  expandSections: true,
  roundingRule: 'nearest',
  showVarianceColumn: false,
  showVariancePercent: false,
  highlightSignificantVariances: true,
  significanceThreshold: 10, // 10% change
  negativeValueFormat: 'brackets',
  currencySeparator: 'comma',
  decimalPlaces: 0,
};

/**
 * Calculate variance between two amounts
 */
export function calculateVariance(
  currentAmount: number,
  priorAmount: number
): { amount: number; percent: number; type: 'favorable' | 'unfavorable' | 'neutral' } {
  const varianceAmount = currentAmount - priorAmount;
  const variancePercent = priorAmount !== 0 
    ? ((currentAmount - priorAmount) / Math.abs(priorAmount)) * 100 
    : currentAmount !== 0 ? 100 : 0;

  // For assets and expenses, increase is neutral/unfavorable depending on context
  // For liabilities, increase could be unfavorable
  // For revenue, increase is favorable
  // Simplified: positive variance = neutral, negative revenue variance = unfavorable
  let varianceType: 'favorable' | 'unfavorable' | 'neutral' = 'neutral';
  if (Math.abs(varianceAmount) < 0.01) {
    varianceType = 'neutral';
  }

  return {
    amount: varianceAmount,
    percent: variancePercent,
    type: varianceType,
  };
}

/**
 * Format currency amount for display
 */
export function formatCurrencyForReport(
  amount: number,
  settings: ComparativeDisplaySettings,
  includeDollarSign: boolean = false
): string {
  const absAmount = Math.abs(amount);
  
  let displayAmount = absAmount;
  let suffix = '';
  
  // Apply rounding rule
  if (settings.roundingRule === 'thousands') {
    displayAmount = absAmount / 1000;
    suffix = 'K';
  } else if (settings.roundingRule === 'millions') {
    displayAmount = absAmount / 1000000;
    suffix = 'M';
  }
  
  // Format with separator
  const separator = settings.currencySeparator === 'comma' ? ',' : ' ';
  const formatted = displayAmount.toLocaleString('en-CA', {
    minimumFractionDigits: settings.decimalPlaces,
    maximumFractionDigits: settings.decimalPlaces,
  }).replace(/,/g, separator);
  
  const prefix = includeDollarSign ? '$' : '';
  const value = `${prefix}${formatted}${suffix}`;
  
  // Apply negative format
  if (amount < 0) {
    if (settings.negativeValueFormat === 'brackets') {
      return `(${value})`;
    }
    return `-${value}`;
  }
  
  return value;
}

/**
 * Align accounts between current and prior periods
 * Ensures consistent presentation order and handles missing accounts
 */
export function alignAccounts(
  currentAccounts: Array<{
    id: string;
    code: string;
    name: string;
    account_type: string;
    calculated_balance: number;
    is_current?: boolean;
    normal_balance: string;
  }>,
  priorAccounts: Array<{
    id: string;
    code: string;
    name: string;
    account_type: string;
    calculated_balance: number;
    is_current?: boolean;
    normal_balance: string;
  }>,
  accountType: string
): AccountAlignmentResult {
  const alignedAccounts: AlignedAccount[] = [];
  const newAccountsInCurrent: string[] = [];
  const closedAccountsInPrior: string[] = [];
  const alignmentWarnings: string[] = [];

  // Create a map of prior accounts by code for matching
  const priorAccountMap = new Map(
    priorAccounts.map(a => [a.code, a])
  );
  const priorAccountNameMap = new Map(
    priorAccounts.map(a => [a.name.toLowerCase(), a])
  );

  // Track which prior accounts have been matched
  const matchedPriorIds = new Set<string>();

  // First pass: align current accounts with prior
  currentAccounts.forEach((currentAcc, index) => {
    // Try to match by code first, then by name
    let priorAcc = priorAccountMap.get(currentAcc.code);
    if (!priorAcc) {
      priorAcc = priorAccountNameMap.get(currentAcc.name.toLowerCase());
    }

    const priorAmount = priorAcc?.calculated_balance ?? 0;
    const variance = calculateVariance(currentAcc.calculated_balance, priorAmount);

    const aligned: AlignedAccount = {
      accountId: currentAcc.id,
      accountCode: currentAcc.code,
      accountName: currentAcc.name,
      aspeCategory: accountType,
      presentationOrder: index,
      isTotal: false,
      isSubtotal: false,
      isHeader: false,
      isCurrent: currentAcc.is_current ?? true,
      normalBalance: currentAcc.normal_balance as 'debit' | 'credit',
      currentPeriodAmount: currentAcc.calculated_balance,
      priorPeriodAmount: priorAmount,
      varianceAmount: variance.amount,
      variancePercent: variance.percent,
      varianceType: variance.type,
      isMissingInCurrent: false,
      isMissingInPrior: !priorAcc,
      isNewAccount: !priorAcc && currentAcc.calculated_balance !== 0,
      isClosedAccount: false,
      requiresDisclosure: Math.abs(variance.percent) > 50,
      disclosureReason: Math.abs(variance.percent) > 50 
        ? `${currentAcc.name} changed by ${Math.abs(variance.percent).toFixed(0)}% year-over-year`
        : undefined,
    };

    if (!priorAcc && currentAcc.calculated_balance !== 0) {
      newAccountsInCurrent.push(currentAcc.id);
    }

    if (priorAcc) {
      matchedPriorIds.add(priorAcc.id);
    }

    alignedAccounts.push(aligned);
  });

  // Second pass: add prior accounts that weren't matched (closed accounts)
  priorAccounts.forEach(priorAcc => {
    if (!matchedPriorIds.has(priorAcc.id) && priorAcc.calculated_balance !== 0) {
      closedAccountsInPrior.push(priorAcc.id);
      
      alignedAccounts.push({
        accountId: priorAcc.id,
        accountCode: priorAcc.code,
        accountName: priorAcc.name,
        aspeCategory: accountType,
        presentationOrder: alignedAccounts.length,
        isTotal: false,
        isSubtotal: false,
        isHeader: false,
        isCurrent: priorAcc.is_current ?? true,
        normalBalance: priorAcc.normal_balance as 'debit' | 'credit',
        currentPeriodAmount: 0,
        priorPeriodAmount: priorAcc.calculated_balance,
        varianceAmount: -priorAcc.calculated_balance,
        variancePercent: -100,
        varianceType: 'neutral',
        isMissingInCurrent: true,
        isMissingInPrior: false,
        isNewAccount: false,
        isClosedAccount: true,
        requiresDisclosure: true,
        disclosureReason: `${priorAcc.name} was closed/removed in current period`,
      });

      alignmentWarnings.push(
        `Account "${priorAcc.name}" (${priorAcc.code}) exists in prior year but not in current year`
      );
    }
  });

  // Sort by presentation order
  alignedAccounts.sort((a, b) => a.presentationOrder - b.presentationOrder);

  return {
    alignedAccounts,
    newAccountsInCurrent,
    closedAccountsInPrior,
    reclassifiedAccounts: [],
    alignmentWarnings,
  };
}

/**
 * Build a financial section with aligned accounts
 */
export function buildFinancialSection(
  sectionName: string,
  sectionType: FinancialSection['sectionType'],
  isCurrentSection: boolean,
  alignedAccounts: AlignedAccount[]
): FinancialSection {
  const currentTotal = alignedAccounts.reduce((sum, a) => sum + a.currentPeriodAmount, 0);
  const priorTotal = alignedAccounts.reduce((sum, a) => sum + a.priorPeriodAmount, 0);
  const variance = calculateVariance(currentTotal, priorTotal);

  return {
    sectionId: `section-${sectionType}`,
    sectionName,
    sectionType,
    isCurrentSection,
    accounts: alignedAccounts,
    currentPeriodTotal: currentTotal,
    priorPeriodTotal: priorTotal,
    varianceAmount: variance.amount,
    variancePercent: variance.percent,
  };
}

/**
 * Analyze variances and generate AI recommendations
 */
export function analyzeVariances(
  alignedAccounts: AlignedAccount[],
  significanceThreshold: number = 10
): VarianceAnalysis[] {
  const analyses: VarianceAnalysis[] = [];

  alignedAccounts.forEach(account => {
    const isSignificant = Math.abs(account.variancePercent) >= significanceThreshold ||
      account.isNewAccount || account.isClosedAccount;

    if (!isSignificant) return;

    let analysisType: VarianceAnalysis['analysisType'] = 'increase';
    if (account.isNewAccount) {
      analysisType = 'new_account';
    } else if (account.isClosedAccount) {
      analysisType = 'closed_account';
    } else if (account.varianceAmount < 0) {
      analysisType = 'decrease';
    }

    let suggestedDisclosure = '';
    let priority: VarianceAnalysis['priority'] = 'low';

    if (Math.abs(account.variancePercent) >= 100) {
      priority = 'high';
      suggestedDisclosure = `${account.accountName} showed a ${account.variancePercent > 0 ? 'significant increase' : 'significant decrease'} of ${Math.abs(account.variancePercent).toFixed(0)}% year-over-year. Consider note disclosure explaining the change.`;
    } else if (Math.abs(account.variancePercent) >= 50) {
      priority = 'medium';
      suggestedDisclosure = `${account.accountName} changed by ${Math.abs(account.variancePercent).toFixed(0)}%. Management should review for potential disclosure.`;
    } else if (account.isNewAccount) {
      priority = 'medium';
      suggestedDisclosure = `New account "${account.accountName}" appeared in current period with balance of $${account.currentPeriodAmount.toLocaleString()}.`;
    } else if (account.isClosedAccount) {
      priority = 'medium';
      suggestedDisclosure = `Account "${account.accountName}" from prior year (balance: $${account.priorPeriodAmount.toLocaleString()}) no longer appears in current period.`;
    }

    analyses.push({
      accountId: account.accountId,
      accountName: account.accountName,
      currentAmount: account.currentPeriodAmount,
      priorAmount: account.priorPeriodAmount,
      varianceAmount: account.varianceAmount,
      variancePercent: account.variancePercent,
      isSignificant,
      significanceThreshold,
      analysisType,
      suggestedDisclosure,
      priority,
    });
  });

  // Sort by priority and variance percent
  analyses.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return Math.abs(b.variancePercent) - Math.abs(a.variancePercent);
  });

  return analyses;
}

/**
 * Validate balance sheet equation for both periods
 */
export function validateBalanceSheetEquation(
  totalAssets: { current: number; prior: number },
  totalLiabilities: { current: number; prior: number },
  totalEquity: { current: number; prior: number },
  currentYearEarnings: { current: number; prior: number }
): { currentBalanced: boolean; priorBalanced: boolean; currentDiff: number; priorDiff: number } {
  // Assets = Liabilities + Equity + Current Year Earnings
  const currentDiff = totalAssets.current - totalLiabilities.current - totalEquity.current - currentYearEarnings.current;
  const priorDiff = totalAssets.prior - totalLiabilities.prior - totalEquity.prior - currentYearEarnings.prior;

  return {
    currentBalanced: Math.abs(currentDiff) < 1, // Allow $1 tolerance
    priorBalanced: Math.abs(priorDiff) < 1,
    currentDiff,
    priorDiff,
  };
}

/**
 * Categorize accounts into current vs non-current
 */
export function categorizeByCurrentNonCurrent(
  accounts: AlignedAccount[]
): { current: AlignedAccount[]; nonCurrent: AlignedAccount[] } {
  const current: AlignedAccount[] = [];
  const nonCurrent: AlignedAccount[] = [];

  accounts.forEach(account => {
    const name = account.accountName.toLowerCase();
    const code = account.accountCode;

    // Determine if current based on name patterns and account codes
    const isNonCurrent = 
      name.includes('property') ||
      name.includes('equipment') ||
      name.includes('accumulated') ||
      name.includes('intangible') ||
      name.includes('goodwill') ||
      name.includes('long-term') ||
      name.includes('long term') ||
      (code.startsWith('15') || code.startsWith('16') || code.startsWith('17')) || // Fixed asset codes
      (code.startsWith('22') || code.startsWith('23') || code.startsWith('24')); // Long-term liability codes

    if (isNonCurrent) {
      nonCurrent.push(account);
    } else {
      current.push(account);
    }
  });

  return { current, nonCurrent };
}

/**
 * Generate period labels based on fiscal year end
 */
export function generatePeriodLabels(
  fiscalYearEnd: string,
  periodType: 'annual' | 'interim' | 'quarterly'
): { currentLabel: string; priorLabel: string; asAtDate: string; periodEndedLabel: string } {
  const endDate = new Date(fiscalYearEnd);
  const year = endDate.getFullYear();
  
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  
  const monthName = months[endDate.getMonth()];
  const day = endDate.getDate();
  
  const asAtDate = `${monthName} ${day}, ${year}`;
  
  let periodEndedLabel: string;
  if (periodType === 'annual') {
    periodEndedLabel = `Year Ended ${asAtDate}`;
  } else if (periodType === 'quarterly') {
    periodEndedLabel = `Quarter Ended ${asAtDate}`;
  } else {
    periodEndedLabel = `Period Ended ${asAtDate}`;
  }

  return {
    currentLabel: String(year),
    priorLabel: String(year - 1),
    asAtDate,
    periodEndedLabel,
  };
}
