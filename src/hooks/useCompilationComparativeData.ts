/**
 * ============================================================================
 * USE COMPILATION COMPARATIVE DATA HOOK
 * ============================================================================
 * 
 * Specialized hook for fetching and preparing comparative financial data
 * specifically for CSRS 4200 compilation reports with side-by-side display.
 */

import { useMemo } from 'react';

/** Merges current and prior account lists so prior-only accounts are not dropped. */
function mergeISAccounts(
  currentAccounts: Array<{ name: string; calculated_balance: number }>,
  priorAccounts?: Array<{ name: string; calculated_balance: number }>
): Array<{ name: string; currentBalance: number; priorBalance: number }> {
  const merged = new Map<string, { currentBalance: number; priorBalance: number }>();
  for (const a of currentAccounts) {
    const existing = merged.get(a.name);
    if (existing) {
      existing.currentBalance += a.calculated_balance;
    } else {
      merged.set(a.name, { currentBalance: a.calculated_balance, priorBalance: 0 });
    }
  }
  if (priorAccounts) {
    for (const a of priorAccounts) {
      const existing = merged.get(a.name);
      if (existing) {
        existing.priorBalance += a.calculated_balance;
      } else {
        merged.set(a.name, { currentBalance: 0, priorBalance: a.calculated_balance });
      }
    }
  }
  return Array.from(merged.entries()).map(([name, b]) => ({ name, ...b }));
}
import { useFinancialReports } from './useFinancialReports';
import { useComparativeFinancialReports } from './useComparativeFinancialReports';
import { 
  alignAccounts, 
  buildFinancialSection, 
  analyzeVariances,
  validateBalanceSheetEquation,
  categorizeByCurrentNonCurrent,
  generatePeriodLabels,
  defaultDisplaySettings,
} from '@/lib/comparativeFinancialUtils';
import { ComparativeExportData, ComparativeDisplaySettings } from '@/types/comparativeFinancials';

interface UseCompilationComparativeDataProps {
  currentPeriodStart: string;
  currentPeriodEnd: string;
  priorPeriodStart: string;
  priorPeriodEnd: string;
  includeComparative: boolean;
  periodType: 'annual' | 'interim' | 'quarterly';
}

export function useCompilationComparativeData({
  currentPeriodStart,
  currentPeriodEnd,
  priorPeriodStart,
  priorPeriodEnd,
  includeComparative,
  periodType,
}: UseCompilationComparativeDataProps) {
  // Fetch current period data
  const currentPeriod = useFinancialReports({
    startDate: new Date(currentPeriodStart),
    endDate: new Date(currentPeriodEnd),
    period: 'custom',
  });

  // Fetch comparative periods data
  const comparisonPeriods = includeComparative ? [{
    label: 'Prior',
    startDate: new Date(priorPeriodStart),
    endDate: new Date(priorPeriodEnd),
  }] : [];

  const comparativeData = useComparativeFinancialReports(
    { startDate: new Date(currentPeriodStart), endDate: new Date(currentPeriodEnd) },
    comparisonPeriods
  );

  // Get current and prior period data
  const currentBS = currentPeriod.getBalanceSheetData();
  const currentIS = currentPeriod.getIncomeStatementData();

  // Build comparative export data structure
  const exportData = useMemo((): ComparativeExportData | null => {
    if (currentPeriod.isLoading) return null;

    const { currentLabel, priorLabel, asAtDate, periodEndedLabel } = generatePeriodLabels(
      currentPeriodEnd,
      periodType
    );

    // Get comparative data if available
    const comparativeTotals = comparativeData.getComparativeTotals();
    const priorTotals = comparativeTotals.length > 1 ? comparativeTotals[1] : null;
    
    // For detailed account data, we need to get from the comparative hook
    const comparativeIncome = comparativeData.getComparativeIncomeStatement();
    const priorIncome = comparativeIncome && comparativeIncome.length > 1 ? comparativeIncome[1] : null;

    // Build aligned accounts for each section
    const alignedAssets = alignAccounts(
      currentBS.assets.map(a => ({
        ...a,
        normal_balance: 'debit',
      })),
      [], // Will be populated from comparative data when available
      'asset'
    );

    const alignedLiabilities = alignAccounts(
      currentBS.liabilities.map(a => ({
        ...a,
        normal_balance: 'credit',
      })),
      [],
      'liability'
    );

    const alignedEquity = alignAccounts(
      currentBS.equity.map(a => ({
        ...a,
        normal_balance: 'credit',
      })),
      [],
      'equity'
    );

    // Categorize assets and liabilities
    const { current: currentAssets, nonCurrent: nonCurrentAssets } = categorizeByCurrentNonCurrent(alignedAssets.alignedAccounts);
    const { current: currentLiabilities, nonCurrent: nonCurrentLiabilities } = categorizeByCurrentNonCurrent(alignedLiabilities.alignedAccounts);

    // Build sections
    const currentAssetsSection = buildFinancialSection('Current Assets', 'assets', true, currentAssets);
    const nonCurrentAssetsSection = buildFinancialSection('Non-current Assets', 'assets', false, nonCurrentAssets);
    const currentLiabilitiesSection = buildFinancialSection('Current Liabilities', 'liabilities', true, currentLiabilities);
    const nonCurrentLiabilitiesSection = buildFinancialSection('Non-current Liabilities', 'liabilities', false, nonCurrentLiabilities);
    const equitySection = buildFinancialSection('Equity', 'equity', false, alignedEquity.alignedAccounts);

    // Income statement sections
    const revenueSection = buildFinancialSection(
      'Revenue',
      'revenue',
      false,
      mergeISAccounts(currentIS.income, priorIncome?.income).map((item, idx) => ({
        accountId: `inc-${idx}`,
        accountCode: '',
        accountName: item.name,
        aspeCategory: 'revenue',
        presentationOrder: idx,
        isTotal: false,
        isSubtotal: false,
        isHeader: false,
        isCurrent: true,
        normalBalance: 'credit' as const,
        currentPeriodAmount: item.currentBalance,
        priorPeriodAmount: item.priorBalance,
        varianceAmount: 0,
        variancePercent: 0,
        varianceType: 'neutral' as const,
        isMissingInCurrent: item.currentBalance === 0,
        isMissingInPrior: item.priorBalance === 0,
        isNewAccount: false,
        isClosedAccount: false,
        requiresDisclosure: false,
      }))
    );

    const cogsSection = buildFinancialSection(
      'Cost of Goods Sold',
      'cogs',
      false,
      mergeISAccounts(currentIS.cogs, priorIncome?.cogs).map((item, idx) => ({
        accountId: `cogs-${idx}`,
        accountCode: '',
        accountName: item.name,
        aspeCategory: 'cogs',
        presentationOrder: idx,
        isTotal: false,
        isSubtotal: false,
        isHeader: false,
        isCurrent: true,
        normalBalance: 'debit' as const,
        currentPeriodAmount: item.currentBalance,
        priorPeriodAmount: item.priorBalance,
        varianceAmount: 0,
        variancePercent: 0,
        varianceType: 'neutral' as const,
        isMissingInCurrent: item.currentBalance === 0,
        isMissingInPrior: item.priorBalance === 0,
        isNewAccount: false,
        isClosedAccount: false,
        requiresDisclosure: false,
      }))
    );

    const expensesSection = buildFinancialSection(
      'Operating Expenses',
      'expenses',
      false,
      mergeISAccounts(currentIS.expenses, priorIncome?.expenses).map((item, idx) => ({
        accountId: `exp-${idx}`,
        accountCode: '',
        accountName: item.name,
        aspeCategory: 'expenses',
        presentationOrder: idx,
        isTotal: false,
        isSubtotal: false,
        isHeader: false,
        isCurrent: true,
        normalBalance: 'debit' as const,
        currentPeriodAmount: item.currentBalance,
        priorPeriodAmount: item.priorBalance,
        varianceAmount: 0,
        variancePercent: 0,
        varianceType: 'neutral' as const,
        isMissingInCurrent: item.currentBalance === 0,
        isMissingInPrior: item.priorBalance === 0,
        isNewAccount: false,
        isClosedAccount: false,
        requiresDisclosure: false,
      }))
    );

    // Analyze variances
    const allAlignedAccounts = [
      ...alignedAssets.alignedAccounts,
      ...alignedLiabilities.alignedAccounts,
      ...alignedEquity.alignedAccounts,
    ];
    const varianceAnalyses = analyzeVariances(allAlignedAccounts);

    // Validate balance sheet equation
    const totalAssets = { current: currentBS.totalAssets, prior: priorTotals?.totalAssets ?? 0 };
    const totalLiabilities = { current: currentBS.totalLiabilities, prior: priorTotals?.totalLiabilities ?? 0 };
    const totalEquity = { current: currentBS.totalEquity, prior: priorTotals?.totalEquity ?? 0 };
    const currentYearEarnings = { current: currentIS.netIncome, prior: priorTotals?.netIncome ?? 0 };
    
    const validation = validateBalanceSheetEquation(totalAssets, totalLiabilities, totalEquity, currentYearEarnings);

    // Collect suggested disclosures
    const suggestedDisclosures = varianceAnalyses
      .filter(v => v.priority === 'high' || v.priority === 'medium')
      .map(v => v.suggestedDisclosure);

    const displaySettings: ComparativeDisplaySettings = {
      ...defaultDisplaySettings,
      periodLabels: { current: currentLabel, prior: priorLabel },
    };

    return {
      organizationName: '',
      reportTitle: periodType === 'annual' ? 'Financial Statements' : 'Interim Financial Statements',
      asAtDate,
      periodEndedLabel,
      periodLabels: { current: currentLabel, prior: priorLabel },

      balanceSheet: {
        currentPeriodLabel: currentLabel,
        priorPeriodLabel: priorLabel,
        asAtDate,
        priorAsAtDate: `December 31, ${parseInt(currentLabel) - 1}`,
        currentAssets: currentAssetsSection,
        nonCurrentAssets: nonCurrentAssetsSection,
        totalAssets: {
          current: currentBS.totalAssets,
          prior: priorTotals?.totalAssets ?? 0,
          variance: currentBS.totalAssets - (priorTotals?.totalAssets ?? 0),
          variancePercent: priorTotals?.totalAssets ? ((currentBS.totalAssets - priorTotals.totalAssets) / Math.abs(priorTotals.totalAssets)) * 100 : 0,
        },
        currentLiabilities: currentLiabilitiesSection,
        nonCurrentLiabilities: nonCurrentLiabilitiesSection,
        totalLiabilities: {
          current: currentBS.totalLiabilities,
          prior: priorTotals?.totalLiabilities ?? 0,
          variance: currentBS.totalLiabilities - (priorTotals?.totalLiabilities ?? 0),
          variancePercent: priorTotals?.totalLiabilities ? ((currentBS.totalLiabilities - priorTotals.totalLiabilities) / Math.abs(priorTotals.totalLiabilities)) * 100 : 0,
        },
        equity: equitySection,
        currentYearEarnings: {
          current: currentIS.netIncome,
          prior: priorTotals?.netIncome ?? 0,
          variance: currentIS.netIncome - (priorTotals?.netIncome ?? 0),
          variancePercent: priorTotals?.netIncome ? ((currentIS.netIncome - priorTotals.netIncome) / Math.abs(priorTotals.netIncome)) * 100 : 0,
        },
        totalEquity: {
          current: currentBS.totalEquity + currentIS.netIncome,
          prior: (priorTotals?.totalEquity ?? 0) + (priorTotals?.netIncome ?? 0),
          variance: (currentBS.totalEquity + currentIS.netIncome) - ((priorTotals?.totalEquity ?? 0) + (priorTotals?.netIncome ?? 0)),
          variancePercent: 0,
        },
        currentPeriodBalanced: validation.currentBalanced,
        priorPeriodBalanced: validation.priorBalanced,
        balanceDifferenceCurrent: validation.currentDiff,
        balanceDifferencePrior: validation.priorDiff,
      },

      incomeStatement: {
        currentPeriodLabel: currentLabel,
        priorPeriodLabel: priorLabel,
        periodEndedDate: asAtDate,
        priorPeriodEndedDate: `December 31, ${parseInt(currentLabel) - 1}`,
        revenue: revenueSection,
        costOfGoodsSold: cogsSection,
        grossProfit: {
          current: currentIS.grossProfit,
          prior: priorIncome?.grossProfit ?? 0,
          variance: currentIS.grossProfit - (priorIncome?.grossProfit ?? 0),
          variancePercent: priorIncome?.grossProfit ? ((currentIS.grossProfit - priorIncome.grossProfit) / Math.abs(priorIncome.grossProfit)) * 100 : 0,
        },
        grossProfitMargin: {
          current: currentIS.totalRevenue > 0 ? (currentIS.grossProfit / currentIS.totalRevenue) * 100 : 0,
          prior: (priorIncome?.totalRevenue ?? 0) > 0 ? ((priorIncome?.grossProfit ?? 0) / (priorIncome?.totalRevenue ?? 1)) * 100 : 0,
          variance: 0,
        },
        operatingExpenses: expensesSection,
        operatingIncome: {
          current: currentIS.operatingIncome,
          prior: priorIncome?.operatingIncome ?? 0,
          variance: currentIS.operatingIncome - (priorIncome?.operatingIncome ?? 0),
          variancePercent: priorIncome?.operatingIncome ? ((currentIS.operatingIncome - priorIncome.operatingIncome) / Math.abs(priorIncome.operatingIncome)) * 100 : 0,
        },
        otherIncome: buildFinancialSection('Other Income', 'other_income', false, []),
        otherExpenses: buildFinancialSection('Other Expenses', 'other_expenses', false, []),
        profitBeforeTax: {
          current: currentIS.operatingIncome,
          prior: priorIncome?.operatingIncome ?? 0,
          variance: currentIS.operatingIncome - (priorIncome?.operatingIncome ?? 0),
          variancePercent: 0,
        },
        netIncome: {
          current: currentIS.netIncome,
          prior: priorIncome?.netIncome ?? 0,
          variance: currentIS.netIncome - (priorIncome?.netIncome ?? 0),
          variancePercent: priorIncome?.netIncome ? ((currentIS.netIncome - priorIncome.netIncome) / Math.abs(priorIncome.netIncome)) * 100 : 0,
        },
        netProfitMargin: {
          current: currentIS.totalRevenue > 0 ? (currentIS.netIncome / currentIS.totalRevenue) * 100 : 0,
          prior: (priorIncome?.totalRevenue ?? 0) > 0 ? ((priorIncome?.netIncome ?? 0) / (priorIncome?.totalRevenue ?? 1)) * 100 : 0,
          variance: 0,
        },
      },

      changesInEquity: {
        currentPeriodLabel: currentLabel,
        priorPeriodLabel: priorLabel,
        openingShareCapital: { current: 0, prior: 0 },
        shareCapitalChanges: [],
        closingShareCapital: { current: 0, prior: 0 },
        openingRetainedEarnings: { current: 0, prior: 0 },
        netIncome: { current: currentIS.netIncome, prior: priorIncome?.netIncome ?? 0 },
        dividends: { current: 0, prior: 0 },
        otherAdjustments: [],
        closingRetainedEarnings: { current: 0, prior: 0 },
        openingTotalEquity: { current: 0, prior: 0 },
        totalChanges: { current: currentIS.netIncome, prior: priorIncome?.netIncome ?? 0 },
        closingTotalEquity: { current: currentBS.totalEquity + currentIS.netIncome, prior: (priorTotals?.totalEquity ?? 0) + (priorTotals?.netIncome ?? 0) },
      },

      varianceAnalyses,
      suggestedDisclosures,
      displaySettings,
      isCurrentPeriodBalanced: validation.currentBalanced,
      isPriorPeriodBalanced: validation.priorBalanced,
      hasSignificantVariances: varianceAnalyses.some(v => v.priority === 'high'),
      hasMissingComparatives: !includeComparative,
    };
  }, [
    currentPeriod.isLoading,
    currentBS,
    currentIS,
    currentPeriodEnd,
    periodType,
    comparativeData,
    includeComparative,
  ]);

  return {
    isLoading: currentPeriod.isLoading || comparativeData.isLoading,
    exportData,
    currentPeriodData: {
      balanceSheet: currentBS,
      incomeStatement: currentIS,
    },
    comparativeData,
    refetch: () => {
      currentPeriod.refetch();
      comparativeData.refetch();
    },
  };
}
