import { useMemo, useState, useEffect } from 'react';
import { Building2, Check, BookOpen, AlertTriangle, ChevronRight, ChevronDown, RefreshCw, ShieldCheck } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ReportsTabs } from '@/components/reports/ReportsTabs';
import { RealtimeIndicator } from '@/components/reports/RealtimeIndicator';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ReportActions, ReportData } from '@/components/reports/ReportActions';
import { useFinancialReports } from '@/hooks/useFinancialReports';
import { useComparativeFinancialReports } from '@/hooks/useComparativeFinancialReports';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useReportFilters } from '@/hooks/useReportFilters';
import { useNpoTerminology } from '@/hooks/useNpoTerminology';
import { useFiscalYearClose } from '@/hooks/useFiscalYearClose';
import { FiscalYearCloseDialog } from '@/components/reports/FiscalYearCloseDialog';
import { useRetainedEarningsStatement } from '@/hooks/useRetainedEarningsStatement';
import { getFiscalYearForDate, getFiscalYearStart } from '@/lib/fiscalYearUtils';
import { useIntegrityScan } from '@/hooks/useIntegrityScan';
import { SubledgerReconciliationDialog } from '@/components/reports/SubledgerReconciliationDialog';
import { useTaxExceptions } from '@/hooks/useTaxExceptions';
import { Link } from 'react-router-dom';
import { AmountDrilldownDialog } from '@/components/reports/AmountDrilldownDialog';
import { DivisionFilter } from '@/components/reports/DivisionFilter';
import { ExecutiveSignatureBlock } from '@/components/reports/ExecutiveSignatureBlock';

/**
 * ============================================================================
 * BALANCE SHEET (STATEMENT OF FINANCIAL POSITION) - GAAP/ASPE COMPLIANT
 * ============================================================================
 * 
 * The Balance Sheet follows the fundamental ACCOUNTING EQUATION:
 *   ASSETS = LIABILITIES + EQUITY
 * 
 * ASSETS (Debit-normal):
 *   = Sum of all asset accounts (1xxx-1999 codes)
 *   = Current Assets + Fixed Assets + Other Assets
 *   - Contra assets (Accumulated Depreciation) subtract from total
 * 
 * LIABILITIES (Credit-normal):
 *   = Sum of all liability accounts (2xxx codes)
 *   = Current Liabilities + Long-Term Liabilities
 *   - Contra liabilities subtract from total
 * 
 * EQUITY (Credit-normal):
 *   = Sum of all equity accounts (3xxx codes)
 *   = Common Shares + Retained Earnings + Other Equity
 *   - Contra equity (Owner's Drawings) subtracts from total
 * 
 * RETAINED EARNINGS (displayed in Shareholders' Equity):
 *   = Closing balance from Statement of Retained Earnings
 *   = Opening RE + Net Income - Dividends
 *   - This already includes Current Year Earnings (Net Income)
 * 
 * KEY RELATIONSHIPS:
 *   - Retained Earnings closing balance links to Statement of RE
 *   - Current Year Earnings is shown in Statement of RE, NOT as separate equity line
 *   - Total Equity must match Changes in Equity closing balance
 *   - Cash/Bank accounts must match Cash Flow Statement ending cash
 * 
 * BALANCE CHECK:
 *   |Assets - (Liabilities + Equity)| < 0.01
 *   The Balance Sheet MUST balance. If not, there's a data integrity issue.
 * 
 * ============================================================================
 */

// Helper to format date in local timezone (avoids UTC conversion issues)
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
};

interface AccountWithBalance {
  id: string;
  code: string;
  name: string;
  account_type: string;
  normal_balance: string;
  is_header: boolean;
  parent_id: string | null;
  calculated_balance: number;
}

interface BalanceSheetRow {
  id: string;
  name: string;
  code: string;
  amount: number;
  comparativeAmounts?: number[]; // Pre-calculated comparative amounts for each period
  previousAmount?: number;
  isHeader?: boolean;
  isSectionTotal?: boolean;
  isGrandTotal?: boolean;
  indent: number;
  isClickable?: boolean;
  hasChildren?: boolean;
  headerSubtotal?: number; // Subtotal for header rows (used when collapsed)
  headerCompSubtotals?: number[]; // Comparative subtotals for header rows
  parentHeaderId?: string; // Parent header ID for tracking expansion
}

// Helper to determine if an account is a contra account for its section
const isContraAccount = (account: AccountWithBalance): boolean => {
  const expectedNormal = account.account_type === 'asset' ? 'debit' : 'credit';
  return account.normal_balance !== expectedNormal;
};

// Helper to get display amount with proper sign for contra accounts
const getDisplayAmount = (account: AccountWithBalance): number => {
  const sign = isContraAccount(account) ? -1 : 1;
  return account.calculated_balance * sign;
};

// Cash & bank accounts must always remain in Assets, even when overdrawn.
// Identified by Cash & Cash Equivalents code range (1-01-101-*) or by name.
const isCashOrBankAccount = (account: AccountWithBalance): boolean => {
  if (account.account_type !== 'asset') return false;
  const code = account.code || '';
  if (code.startsWith('1-01-101')) return true;
  const name = (account.name || '').toLowerCase();
  return name.includes('bank') || name.includes('cash') || name.includes('petty');
};

export default function BalanceSheet() {
  // Use shared report filters
  const { 
    startDate, 
    endDate, 
    showZeroBalances, 
    compareSettings,
    collapseSubAccounts,
    fiscalYearEndMonth,
    setDateRange,
    setShowZeroBalances,
    setCompareSettings,
    setCollapseSubAccounts,
    setFiscalYearEndMonth
  } = useReportFilters();
  
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [showFiscalCloseDialog, setShowFiscalCloseDialog] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  
  const queryClient = useQueryClient();
  const { findings: integrityFindings, runScan, isScanning } = useIntegrityScan();
  const criticalFinding = integrityFindings.find((f) => f.severity === 'critical');
  const warningFindings = integrityFindings.filter((f) => f.severity === 'warning').slice(0, 5);

  const handleRecalculateBalances = async () => {
    if (!organization?.id) return;
    setIsRecalculating(true);
    try {
      const { error: rpcError } = await supabase.rpc('recalculate_all_account_balances', {
        p_organization_id: organization.id,
      });
      if (rpcError) throw rpcError;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['financial-reports'] }),
        queryClient.invalidateQueries({ queryKey: ['journal-entries'] }),
        queryClient.invalidateQueries({ queryKey: ['retained-earnings-statement'] }),
        queryClient.invalidateQueries({ queryKey: ['comparative-financial-reports'] }),
      ]);
      refetch();
      reRefetch?.();
      toast.success('Account balances recalculated successfully');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Recalculation failed: ${message}`);
    } finally {
      setIsRecalculating(false);
    }
  };
  
  // Collapsible section states
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    assets: true,
    liabilities: true,
    equities: true,
    retainedEarnings: true,
  });
  
  // Collapsible header account states - track which header accounts are expanded
  const [expandedHeaders, setExpandedHeaders] = useState<Record<string, boolean>>({});
  
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };
  
  const toggleHeader = (headerId: string) => {
    setExpandedHeaders(prev => ({ ...prev, [headerId]: !prev[headerId] }));
  };
  
  // Check if a header is expanded (default to true if not explicitly set)
  const isHeaderExpanded = (headerId: string) => {
    return expandedHeaders[headerId] !== false;
  };
  
  const expandAllSections = () => {
    setExpandedSections({ assets: true, liabilities: true, equities: true, retainedEarnings: true });
    setExpandedHeaders({}); // Reset all headers to default (expanded)
  };
  
  const collapseAllSections = () => {
    setExpandedSections({ assets: false, liabilities: false, equities: false, retainedEarnings: false });
  };
  
  // Collapse all header accounts within sections (but keep sections expanded)
  const _collapseAllHeaders = () => {
    // Collect all header IDs from account data
    const headerIds = (allAccounts || [])
      .filter(a => a.is_header)
      .reduce((acc, h) => ({ ...acc, [h.id]: false }), {});
    setExpandedHeaders(headerIds);
  };
  
  const _allExpanded = Object.values(expandedSections).every(v => v);
  const _allCollapsed = Object.values(expandedSections).every(v => !v);
  
  // Fiscal year close hook - checks for unclosed years causing imbalance
  const { yearsNeedingClose } = useFiscalYearClose();

  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  
  // Sync fiscal year end month from organization
  useEffect(() => {
    if (organization?.fiscal_year_end_month) {
      setFiscalYearEndMonth(organization.fiscal_year_end_month);
    }
  }, [organization?.fiscal_year_end_month, setFiscalYearEndMonth]);
  
  const [divisionIds, setDivisionIds] = useState<string[]>([]);
  const { error, getBalanceSheetData, dateRange, accountBalances, refetch, realtimeLastEventAt, isLoading: accountsLoading, isFetching: accountsFetching } = useFinancialReports({
    startDate,
    endDate,
    departmentIds: divisionIds,
  });

  // Drilldown state — double-click an amount to see underlying journal entries.
  const [drilldown, setDrilldown] = useState<{ accountId: string; name: string; code?: string } | null>(null);

  // Auto-open drilldown from share link (?drill=1&acc=...&name=...&code=...)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('drill') === '1' && p.get('acc')) {
      setDrilldown({
        accountId: p.get('acc')!,
        name: p.get('name') || 'Account',
        code: p.get('code') || undefined,
      });
    }
  }, []);
  
  /**
   * ============================================================================
   * BALANCE SHEET CALCULATION - CANONICAL GAAP EQUATION
   * ============================================================================
   * 
   * The Balance Sheet MUST always balance per the accounting equation:
   *   Assets = Liabilities + Equity
   * 
   * Retained Earnings now uses the CLOSING BALANCE from the Statement of
   * Retained Earnings, which already includes Current Year Earnings (Net Income).
   * Therefore, we no longer add netIncome separately to totalEquity.
   * 
   * The isBalanced flag checks: |Assets - (Liabilities + Equity + Net Income)| < 0.01
   * This is still valid because the hook's totalEquity excludes CYE account.
   * ============================================================================
   */
  const balanceSheetData = getBalanceSheetData();
  const allAccounts = accountBalances;

  // Hook's canonical raw totals (before abnormal-balance reclassification).
  const rawTotalAssets = balanceSheetData.totalAssets;
  const rawTotalLiabilities = balanceSheetData.totalLiabilities;
  const netIncome = balanceSheetData.netIncome ?? 0;

  // No account reclassification. Each account stays in its assigned section
  // exactly as recorded in the chart of accounts. Empty stubs preserve the
  // existing call sites without altering any totals.
  const reclassification = {
    liabToAsset: [] as AccountWithBalance[],
    equityToAsset: [] as AccountWithBalance[],
    assetToLiab: [] as AccountWithBalance[],
    liabToAssetIds: new Set<string>(),
    equityToAssetIds: new Set<string>(),
    assetToLiabIds: new Set<string>(),
    liabToAssetAmt: 0,
    equityToAssetAmt: 0,
    assetToLiabAmt: 0,
  };
  const computePeriodReclass = (_balances: AccountWithBalance[] | undefined) => ({
    liabToAssetIds: new Set<string>(),
    equityToAssetIds: new Set<string>(),
    assetToLiabIds: new Set<string>(),
    liabToAssetAmt: 0,
    equityToAssetAmt: 0,
    assetToLiabAmt: 0,
  });

  // Displayed totals equal raw hook totals (no reclassification applied).
  const totalAssets = rawTotalAssets;
  const totalLiabilities = rawTotalLiabilities;
  
  // NOTE: hookIsBalanced and hookDifference are intentionally NOT used here.
  // The canonical isBalanced check is computed below using the display totals.

  const handleDateRangeChange = (start: Date, end: Date) => {
    setDateRange(start, end);
  };

  const handleRunReport = () => {
    refetch();
    reRefetch?.();
  };

  // Generate comparison periods based on settings
  const comparisonPeriods = useMemo((): { label: string; startDate: Date; endDate: Date }[] => {
    if (!compareSettings) return [];
    
    const periods: { label: string; startDate: Date; endDate: Date }[] = [];
    const count = compareSettings.numberOfPeriods;
    
    for (let i = 1; i <= count; i++) {
      let periodStart: Date;
      let periodEnd: Date;
      let label: string;
      
      if (compareSettings.compareType === 'year') {
        // Previous years (same date, different year)
        periodStart = new Date(startDate.getFullYear() - i, startDate.getMonth(), startDate.getDate());
        periodEnd = new Date(endDate.getFullYear() - i, endDate.getMonth(), endDate.getDate());
        label = formatLocalDate(periodEnd);
      } else {
        // Previous periods (same duration)
        const durationMs = endDate.getTime() - startDate.getTime();
        periodEnd = new Date(startDate.getTime() - (i - 1) * durationMs - 1);
        periodStart = new Date(periodEnd.getTime() - durationMs);
        label = formatLocalDate(periodEnd);
      }
      
      periods.push({ label, startDate: periodStart, endDate: periodEnd });
    }
    
    // Sort based on latestToOldest setting
    if (!compareSettings.latestToOldest) {
      periods.reverse();
    }
    
    return periods;
  }, [compareSettings, startDate, endDate]);

  // Fetch comparative data for all periods
  const { 
    data: comparativeData, 
    getComparativeTotals 
  } = useComparativeFinancialReports(
    { startDate, endDate },
    comparisonPeriods
  );

  // Get comparative totals for display, then adjust each period's totals for
  // abnormal-balance reclassification so comparative L+E ties to comparative Assets.
  // For ASPE display we derive Equity = Assets - Liabilities (per period) so the
  // displayed equation always balances, matching the on-screen totals.
  const rawComparativeTotals = getComparativeTotals();
  const comparativeTotals = useMemo(() => {
    return rawComparativeTotals.map((ct: any) => {
      const adjAssets = ct.totalAssets ?? 0;
      const adjLiabs = ct.totalLiabilities ?? 0;
      const adjEquity = ct.totalEquity ?? 0;
      const diff = Math.abs(adjAssets - (adjLiabs + adjEquity));
      return {
        ...ct,
        totalAssets: adjAssets,
        totalLiabilities: adjLiabs,
        totalEquity: adjEquity,
        isBalanced: diff < 0.02,
      };
    });
  }, [rawComparativeTotals]);

  // Balance Sheet is a point-in-time report, so retained earnings must be
  // rolled forward from the fiscal-year start that contains each column's as-of
  // date. Do not use the report filter start date here: a custom range that
  // spans prior fiscal years would double-count prior-year income in RE.
  const retainedEarningsCurrentPeriod = useMemo(() => {
    const fiscalYear = getFiscalYearForDate(endDate, fiscalYearEndMonth);
    return {
      startDate: getFiscalYearStart(fiscalYear, fiscalYearEndMonth),
      endDate,
    };
  }, [endDate, fiscalYearEndMonth]);

  const retainedEarningsComparisonPeriods = useMemo(() => {
    return comparisonPeriods.map((period) => {
      const fiscalYear = getFiscalYearForDate(period.endDate, fiscalYearEndMonth);
      return {
        ...period,
        startDate: getFiscalYearStart(fiscalYear, fiscalYearEndMonth),
      };
    });
  }, [comparisonPeriods, fiscalYearEndMonth]);

  // Fetch Statement of Retained Earnings data for current and comparative periods
  const {
    currentStatement: reCurrentStatement,
    comparativeStatements: reComparativeStatements,
    isLoading: reLoading,
    refetch: reRefetch,
  } = useRetainedEarningsStatement(
    retainedEarningsCurrentPeriod,
    retainedEarningsComparisonPeriods
  );

  // Get RE closing balance from Statement of Retained Earnings
  // This already includes Net Income, so we do NOT add netIncome separately
  const reClosingBalance = (reCurrentStatement?.data?.closingBalance ?? 0);
  
  // Calculate equity account balances EXCLUDING CYE and RE accounts
  // because RE will use the Statement of RE closing balance
  const equityAccountsExcludingREandCYE = allAccounts
    .filter(a => a.account_type === 'equity')
    .filter(a => {
      const code = a.code;
      const nameLower = a.name?.toLowerCase() || '';
      // Exclude CYE account (3-00-202) and ASNPO equivalents
      if (code === '3-00-202' || nameLower.includes('current year earnings') || nameLower.includes('current year excess') || nameLower.includes('current year surplus') || nameLower.includes('excess (deficiency)')) return false;
      // Exclude RE account (3-00-201) and ASNPO equivalents - we use Statement of RE closing balance instead
      if (code === '3-00-201' || nameLower === 'retained earnings' || nameLower.includes('accumulated deficit') || nameLower.includes('unrestricted net assets') || nameLower.includes('accumulated surplus') || nameLower.includes('unrestricted funds') || nameLower.includes('accumulated funds')) return false;
      // Exclude equity accounts that have been reclassified to Assets (abnormal debit balance)
      if (reclassification.equityToAssetIds.has(a.id)) return false;
      return true;
    })
    .reduce((sum, a) => {
      const expectedNormal = 'credit';
      const isContra = a.normal_balance !== expectedNormal;
      const sign = isContra ? -1 : 1;
      return sum + (a.calculated_balance * sign);
    }, 0);
  
  // Total Equity = Other Equity Accounts (e.g., Share Capital) + RE Closing Balance (from Statement of RE)
  // The Statement of RE closing balance already includes Net Income, so no double-counting
  const totalEquity = equityAccountsExcludingREandCYE + reClosingBalance;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
  
  /**
   * ============================================================================
   * BALANCE CHECK — DISPLAYED TOTALS ARE THE SOURCE OF TRUTH
   * ============================================================================
   * Per ASPE/GAAP the Statement of Financial Position must always preserve:
   *   Assets = Liabilities + Equity
   *
   * The Balanced / Out of Balance indicator is derived strictly from the totals
   * shown on screen. If the visible Assets do not tie to Liabilities + Equity
   * (within a 2-cent rounding tolerance), the report is reported as out of
   * balance. We do not rely on any backend RPC that may use a different
   * formula than what is rendered.
   * ============================================================================
   */
  const reIsLoading = reLoading && !reCurrentStatement;
  const accountsNotReady = accountsLoading || accountsFetching || (accountBalances?.length ?? 0) === 0;

  const displayDifference = Math.abs(totalAssets - totalLiabilitiesAndEquity);
  const balanceDifference = displayDifference;
  const isBalanced = (reIsLoading || accountsNotReady)
    ? true
    : displayDifference < 0.02;

  // Self-healing: if displayed totals don't tie after data loaded, attempt one recalculation.
  const [autoHealAttempted, setAutoHealAttempted] = useState(false);
  useEffect(() => {
    if (reIsLoading || accountsNotReady) return;
    if (autoHealAttempted) return;
    if (isBalanced) return;
    if (!organization?.id) return;
    setAutoHealAttempted(true);
    void handleRecalculateBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reIsLoading, accountsNotReady, isBalanced, organization?.id, autoHealAttempted]);

  useEffect(() => {
    setAutoHealAttempted(false);
  }, [organization?.id, startDate, endDate]);

  const { formatCurrency: formatCurrencyBase } = useCurrencyFormatter();
  const { npoTerms, isNpo } = useNpoTerminology();
  const bsTitle = isNpo ? (npoTerms?.balanceSheet || 'Statement of Financial Position') : 'Balance Sheet';
  const equityLabel = isNpo ? (npoTerms?.equity || 'Net Assets') : 'Equity';
  
  const formatCurrency = (value: number) => {
    if (value === 0) return '0.00';
    return formatCurrencyBase(value);
  };

  const formatCurrencyOrDash = (value: number) => {
    if (value === 0) return '-';
    return formatCurrencyBase(value);
  };

  /**
   * Identify the database "Current Year Earnings" equity bucket (often 3-00-202).
   * We do NOT show this as a standalone equity line because the Balance Sheet
   * already shows a separate dynamic "Current Year Earnings" line (Net Income).
   *
   * Instead, its static balance (when present) is treated as UN-CLOSED prior
   * earnings and merged into the Retained Earnings display line to maintain
   * ASPE year-to-year continuity.
   */
  const isCurrentYearEarningsAccount = (account: AccountWithBalance): boolean => {
    const nameLower = account.name?.toLowerCase() || '';
    return (
      account.code === '3-00-202' ||
      nameLower.includes('current year earnings') ||
      nameLower.includes('current year earning') ||
      nameLower.includes('current earnings') ||
      nameLower === 'current year net income' ||
      nameLower === 'current year income' ||
      // ASNPO equivalents
      nameLower.includes('current year excess') ||
      nameLower.includes('current year surplus') ||
      nameLower.includes('excess (deficiency)')
    );
  };

  /**
   * Identify Retained Earnings account (3-00-201) - ASPE/IFRS requires this
   * to ALWAYS be displayed in Shareholders' Equity section, even if zero.
   */
  const isRetainedEarningsAccount = (account: AccountWithBalance): boolean => {
    const nameLower = account.name?.toLowerCase() || '';
    return (
      account.code === '3-00-201' ||
      nameLower === 'retained earnings' ||
      nameLower === 'retained profits' ||
      nameLower.includes('accumulated deficit') ||
      nameLower.includes('accumulated earnings') ||
      // ASNPO equivalents
      nameLower.includes('unrestricted net assets') ||
      nameLower.includes('accumulated surplus') ||
      nameLower.includes('unrestricted funds') ||
      nameLower.includes('accumulated funds')
    );
  };


  /**
   * ============================================================================
   * ASPE-COMPLIANT EQUITY CONTINUITY FORMULA
   * ============================================================================
   * 
   * This implementation follows the PURE FORMULA approach - NO static values.
   * All amounts are derived from journal entries via the double-entry system.
   * 
   * RETAINED EARNINGS CONTINUITY:
   *   Opening RE (Year N) = Closing RE (Year N-1)
   *   Closing RE (Year N) = Opening RE (Year N) + Net Income (Year N) - Dividends
   * 
   * The Retained Earnings balance displayed in Shareholders' Equity uses the
   * CLOSING BALANCE from the Statement of Retained Earnings, which already
   * includes Current Year Earnings (Net Income). This eliminates the need for
   * a separate "Current Year Earnings" line in the equity section.
   * 
   * TOTAL EQUITY:
   *   = Sum of all equity accounts (Share Capital, Retained Earnings, etc.)
   *   - Retained Earnings uses the Statement of RE closing balance
   * 
   * The database stores all equity activity via journal entries. The 3-00-202
   * (Current Year Earnings) account is excluded from display since net income
   * is already reflected in the Retained Earnings closing balance.
   * 
   * ASPE/IFRS PRESENTATION REQUIREMENTS:
   *   - Retained Earnings MUST always appear (even if zero)
   *   - Share Capital (Common Stock) always appears
   *   - Statement of Retained Earnings appears below the Balance Sheet
   * ============================================================================
   */
  const buildHierarchicalRows = (
    accountType: 'asset' | 'liability' | 'equity'
  ): BalanceSheetRow[] => {
    const rows: BalanceSheetRow[] = [];
    
    // Filter accounts by type.
    // For equity, EXCLUDE the CYE bucket (e.g., 3-00-202) since net income is
    // already included in the Retained Earnings closing balance from Statement of RE.
    let accounts = allAccounts.filter(a => a.account_type === accountType);
    if (accountType === 'equity') {
      accounts = accounts.filter(a => !isCurrentYearEarningsAccount(a));
    }
    // Suppress accounts that have been reclassified to the opposite section
    // (abnormal-balance presentation per ASPE 1521 / IFRS IAS 1).
    accounts = accounts.filter(a => {
      if (accountType === 'asset' && reclassification.assetToLiabIds.has(a.id)) return false;
      if (accountType === 'liability' && reclassification.liabToAssetIds.has(a.id)) return false;
      if (accountType === 'equity' && reclassification.equityToAssetIds.has(a.id)) return false;
      return true;
    });
    
    // Create lookup maps
    const accountsById = new Map(accounts.map(a => [a.id, a]));
    const headerAccounts = accounts.filter(a => a.is_header);
    const detailAccounts = accounts.filter(a => !a.is_header);
    
    // Group all accounts (headers and details) by their parent
    const accountsByParent = new Map<string | null, AccountWithBalance[]>();
    accounts.forEach(acc => {
      const parentId = acc.parent_id;
      if (!accountsByParent.has(parentId)) {
        accountsByParent.set(parentId, []);
      }
      accountsByParent.get(parentId)!.push(acc);
    });

    // Helper to get display amount for a comparative period account
    const getCompDisplayAmount = (account: any): number => {
      if (!account) return 0;
      const expectedNormal = accountType === 'asset' ? 'debit' : 'credit';
      const isContra = account.normal_balance !== expectedNormal;
      const sign = isContra ? -1 : 1;
      return (account.calculated_balance ?? 0) * sign;
    };

    // Calculate total for a header by recursively summing all descendant detail accounts.
    // NOTE: Do NOT merge 3-00-202 (CYE bucket) here - the dynamic Current Year Earnings
    // is added separately in equityRows useMemo to avoid double-counting.
    const calculateSubtotal = (headerId: string): number => {
      let total = 0;
      const children = accountsByParent.get(headerId) || [];
      
      for (const child of children) {
        if (child.is_header) {
          total += calculateSubtotal(child.id);
        } else {
          const childAmount = getDisplayAmount(child);
          total += childAmount;
        }
      }
      
      return total;
    };

    // Calculate comparative subtotal for a header from comparative data.
    // NOTE: Do NOT merge 3-00-202 (CYE bucket) here - the dynamic Current Year Earnings
    // is added separately in equityRows useMemo to avoid double-counting.
    const calculateCompSubtotal = (headerId: string, compBalances: any[]): number => {
      let total = 0;
      const children = accountsByParent.get(headerId) || [];
      
      for (const child of children) {
        if (child.is_header) {
          total += calculateCompSubtotal(child.id, compBalances);
        } else {
          const compAccount = compBalances.find(a => a.id === child.id);
          const compAmount = getCompDisplayAmount(compAccount);
          total += compAmount;
        }
      }
      
      return total;
    };

    // Check if a header has any non-zero descendant accounts
    const hasNonZeroDescendants = (headerId: string): boolean => {
      const children = accountsByParent.get(headerId) || [];
      
      for (const child of children) {
        if (child.is_header) {
          if (hasNonZeroDescendants(child.id)) return true;
        } else {
          if (getDisplayAmount(child) !== 0) return true;
        }
      }
      
      return false;
    };

    // Get number of comparison periods
    const numCompPeriods = comparisonPeriods.length;

    // Recursively build rows for a header and its children
    const buildRowsForHeader = (header: AccountWithBalance, baseIndent: number, parentId?: string): void => {
      const subtotal = calculateSubtotal(header.id);
      const hasContent = showZeroBalances || subtotal !== 0 || hasNonZeroDescendants(header.id);
      
      if (!hasContent) return;
      
      const children = accountsByParent.get(header.id) || [];
      const childHeaders = children.filter(c => c.is_header).sort((a, b) => a.code.localeCompare(b.code));
      const childDetails = children.filter(c => !c.is_header).sort((a, b) => a.code.localeCompare(b.code));
      
      // Calculate comparative subtotals for this header
      const compSubtotals: number[] = [];
      for (let i = 0; i < numCompPeriods; i++) {
        const compPeriodIndex = i + 1;
        const compPeriodData = comparativeData?.[compPeriodIndex];
        const compBalances = compPeriodData?.balances ?? [];
        const subtotalValue = calculateCompSubtotal(header.id, compBalances);
        compSubtotals.push(subtotalValue);
      }
      
      // Add header row with subtotal info for collapsed display
      rows.push({
        id: header.id,
        name: header.name,
        code: header.code,
        amount: 0,
        isHeader: true,
        indent: baseIndent,
        hasChildren: children.length > 0,
        headerSubtotal: subtotal,
        headerCompSubtotals: compSubtotals,
        parentHeaderId: parentId,
      });

      // Process child headers first (nested structure)
      for (const childHeader of childHeaders) {
        buildRowsForHeader(childHeader, baseIndent + 1, header.id);
      }

      // Then add child detail accounts (unless collapsed)
      // NOTE: Do NOT merge 3-00-202 into RE here - CYE is displayed as a separate line
      if (!collapseSubAccounts) {
        for (const child of childDetails) {
          const displayAmount = getDisplayAmount(child);
          
          // Calculate comparative amounts for this detail account
          // NOTE: Do NOT merge 3-00-202 into RE here - CYE is displayed as a separate line
          const compAmounts: number[] = [];
          for (let i = 0; i < numCompPeriods; i++) {
            const compPeriodIndex = i + 1;
            const compPeriodData = comparativeData?.[compPeriodIndex];
            const compAccount = compPeriodData?.balances.find(a => a.id === child.id);
            const compAmount = getCompDisplayAmount(compAccount);
            compAmounts.push(compAmount);
          }
          
          // ASPE/IFRS: Retained Earnings MUST always appear, even if zero
          // Also show account if ANY comparative period has a non-zero balance
          const isRetainedEarnings = isRetainedEarningsAccount(child);
          const hasNonZeroComparative = compAmounts.some(amt => amt !== 0);
          const shouldShow = showZeroBalances || displayAmount !== 0 || isRetainedEarnings || hasNonZeroComparative;
          if (!shouldShow) continue;
          
          rows.push({
            id: child.id,
            name: child.name,
            code: child.code,
            amount: displayAmount,
            comparativeAmounts: compAmounts,
            indent: baseIndent + 1,
            isClickable: true,
            parentHeaderId: header.id,
          });
        }
      }

      // Add "Total for [Header]" row if this header has any children
      if (children.length > 0) {
        // Calculate comparative subtotals (pure account sums - no ytdNetIncome here)
        // ytdNetIncome is added ONLY to the final equity total in equityRows useMemo
        const compSubtotals: number[] = [];
        for (let i = 0; i < numCompPeriods; i++) {
          const compPeriodIndex = i + 1;
          const compPeriodData = comparativeData?.[compPeriodIndex];
          const compBalances = compPeriodData?.balances ?? [];
          const subtotalValue = calculateCompSubtotal(header.id, compBalances);
          compSubtotals.push(subtotalValue);
        }
        
        rows.push({
          id: `${header.id}-total`,
          name: `Total for ${header.name}`,
          code: '',
          amount: subtotal,
          comparativeAmounts: compSubtotals,
          isSectionTotal: true,
          indent: baseIndent,
          parentHeaderId: header.id,
        });
      }
    };

    // Find root-level headers (those with no parent or parent outside this section)
    const rootHeaders = headerAccounts
      .filter(h => !h.parent_id || !accountsById.has(h.parent_id))
      .sort((a, b) => a.code.localeCompare(b.code));

    // Build rows starting from root headers
    for (const rootHeader of rootHeaders) {
      buildRowsForHeader(rootHeader, 1);
    }

    // Handle orphan detail accounts (no parent or parent doesn't exist in our data)
    const orphanAccounts = detailAccounts.filter(a => {
      if (!a.parent_id) return true;
      return !accountsById.has(a.parent_id);
    });
    
    if (!collapseSubAccounts) {
      for (const acc of orphanAccounts.sort((a, b) => a.code.localeCompare(b.code))) {
        const displayAmount = getDisplayAmount(acc);
        
        // Calculate comparative amounts for orphan accounts
        const compAmounts: number[] = [];
        for (let i = 0; i < numCompPeriods; i++) {
          const compPeriodIndex = i + 1;
          const compPeriodData = comparativeData?.[compPeriodIndex];
          const compAccount = compPeriodData?.balances.find(a => a.id === acc.id);
          compAmounts.push(getCompDisplayAmount(compAccount));
        }
        
        // ASPE/IFRS: Always show Retained Earnings even if zero
        // Also show if any comparative period has a non-zero balance
        const isRE = isRetainedEarningsAccount(acc);
        const hasNonZeroComp = compAmounts.some(amt => amt !== 0);
        if (!showZeroBalances && displayAmount === 0 && !isRE && !hasNonZeroComp) continue;
        
        rows.push({
          id: acc.id,
          name: acc.name,
          code: acc.code,
          amount: displayAmount,
          comparativeAmounts: compAmounts,
          indent: 1,
          isClickable: true,
        });
      }
    }

    // No abnormal-balance reclassification rows are added. Accounts always
    // remain in their chart-of-accounts section, displayed at their signed
    // calculated balance.

    return rows;
  };

  // Build all rows for Assets section
  const assetRows = useMemo(() => {
    return buildHierarchicalRows('asset');
  }, [allAccounts, showZeroBalances, collapseSubAccounts, comparativeData, comparisonPeriods]);

  // Build all rows for Liabilities section
  const liabilityRows = useMemo(() => {
    return buildHierarchicalRows('liability');
  }, [allAccounts, showZeroBalances, collapseSubAccounts, comparativeData, comparisonPeriods]);

  // Build all rows for Equity section
  // Current Year Earnings is now shown within the Statement of Retained Earnings section,
  // NOT as a separate line in Shareholders' Equity. The Retained Earnings account balance
  // is replaced with the Closing RE from the Statement of Retained Earnings.
  const equityRows = useMemo(() => {
    const baseRows = buildHierarchicalRows('equity');
    const result = [...baseRows];
    
    // Get the closing RE balance from the Statement of Retained Earnings
    const closingRECurrent = reCurrentStatement?.data.closingBalance ?? 0;
    
    // Get comparative closing RE balances
    const closingREComparative: number[] = reComparativeStatements.map(
      stmt => stmt?.data.closingBalance ?? 0
    );
    
    // Replace the Retained Earnings account balance with the Statement of RE closing balance
    // Uses the same isRetainedEarningsAccount helper which includes ASNPO terms
    for (let i = 0; i < result.length; i++) {
      const row = result[i];
      // Find Retained Earnings detail row (not header, not total)
      if (!row.isHeader && !row.isSectionTotal && !row.isGrandTotal) {
        const isRE = isRetainedEarningsAccount(row as unknown as AccountWithBalance);
        
        if (isRE) {
          // Replace with Statement of RE closing balance
          result[i] = {
            ...row,
            amount: closingRECurrent,
            comparativeAmounts: closingREComparative,
          };
          break;
        }
      }
    }
    
    // Recalculate ALL section total rows to reflect the updated RE balance
    // This ensures intermediate subtotals (e.g., "Total for NET ASSETS / EQUITY") also update
    for (let i = 0; i < result.length; i++) {
      if (result[i].isSectionTotal) {
        // Sum all detail rows that belong to this subtotal's parent header
        const parentHeaderId = result[i].parentHeaderId;
        let subtotal = 0;
        const compSubtotals: number[] = Array.from({ length: comparisonPeriods.length }, () => 0);
        
        for (const row of result) {
          if (!row.isHeader && !row.isSectionTotal && !row.isGrandTotal && row.parentHeaderId === parentHeaderId) {
            subtotal += row.amount ?? 0;
            (row.comparativeAmounts ?? []).forEach((amt, idx) => {
              compSubtotals[idx] += amt ?? 0;
            });
          }
        }
        
        result[i] = {
          ...result[i],
          amount: subtotal,
          comparativeAmounts: compSubtotals,
          headerSubtotal: subtotal,
          headerCompSubtotals: compSubtotals,
        };
      }
    }
    
    // Also update the header row's headerSubtotal for collapsed display
    for (let i = 0; i < result.length; i++) {
      if (result[i].isHeader) {
        const headerId = result[i].id;
        // Find the matching section total
        const matchingTotal = result.find(r => r.isSectionTotal && r.parentHeaderId === headerId);
        if (matchingTotal) {
          result[i] = {
            ...result[i],
            headerSubtotal: matchingTotal.amount,
            headerCompSubtotals: matchingTotal.comparativeAmounts,
          };
        }
      }
    }
    
    return result;
  }, [allAccounts, showZeroBalances, collapseSubAccounts, comparativeData, comparisonPeriods, reCurrentStatement, reComparativeStatements]);

  // Build report data for export with comparative columns
  const reportData: ReportData = useMemo(() => {
    // Build headers with comparison periods
    const headers = ['Account', `As of ${formatLocalDate(dateRange.endDate)}`];
    comparisonPeriods.forEach(period => {
      headers.push(period.label);
    });
    
    const rows: (string | number)[][] = [];
    
    // Helper to format amount - always show value, even if zero
    const formatAmount = (amount: number): string => {
      return amount === 0 ? '0.00' : formatCurrency(amount);
    };

    // Get comparative amounts (skip first which is current period)
    const compTotals = comparativeTotals.slice(1);
    
    // Assets section
    rows.push(['Assets', '', ...compTotals.map(() => '')]);
    assetRows.forEach(row => {
      const indent = '  '.repeat(row.indent);
      const currentAmount = row.isHeader ? '' : formatAmount(row.amount);
      // Use pre-calculated comparative amounts from row data (calculated in buildHierarchicalRows)
      const compAmounts = row.comparativeAmounts?.map((amt) => 
        row.isHeader ? '' : formatAmount(amt)
      ) ?? compTotals.map(() => row.isHeader ? '' : formatAmount(0));
      rows.push([`${indent}${row.name}`, currentAmount, ...compAmounts]);
    });
    
    // Total Assets with comparative data
    const compAssetTotals = compTotals.map(ct => formatAmount(ct.totalAssets));
    rows.push(['Total for Assets', formatAmount(totalAssets), ...compAssetTotals]);
    
    rows.push(['', '', ...compTotals.map(() => '')]);
    
    // Liabilities & Equities section
    rows.push(['Liabilities & Equities', '', ...compTotals.map(() => '')]);
    rows.push(['  Liabilities', '', ...compTotals.map(() => '')]);
    liabilityRows.forEach(row => {
      const indent = '  '.repeat(row.indent + 1);
      const currentAmount = row.isHeader ? '' : formatAmount(row.amount);
      // Use pre-calculated comparative amounts from row data
      const compAmounts = row.comparativeAmounts?.map((amt) => 
        row.isHeader ? '' : formatAmount(amt)
      ) ?? compTotals.map(() => row.isHeader ? '' : formatAmount(0));
      rows.push([`${indent}${row.name}`, currentAmount, ...compAmounts]);
    });
    
    // Total Liabilities with comparative data
    const compLiabTotals = compTotals.map(ct => formatAmount(ct.totalLiabilities));
    rows.push(['  Total for Liabilities', formatAmount(totalLiabilities), ...compLiabTotals]);
    
    rows.push(['', '', ...compTotals.map(() => '')]);
    rows.push(['  Equities', '', ...compTotals.map(() => '')]);
    equityRows.forEach(row => {
      const indent = '  '.repeat(row.indent + 1);
      const currentAmount = row.isHeader ? '' : formatAmount(row.amount);
      // Use pre-calculated comparative amounts from row data
      const compAmounts = row.comparativeAmounts?.map((amt) => 
        row.isHeader ? '' : formatAmount(amt)
      ) ?? compTotals.map(() => row.isHeader ? '' : formatAmount(0));
      rows.push([`${indent}${row.name}`, currentAmount, ...compAmounts]);
    });
    
    // Total Equities with comparative data (equity + period netIncome for Balance Sheet equation)
    // Total Equities - comparative equity already equals (Assets - Liabilities) per period
    const compEquityTotals = compTotals.map(ct => formatAmount(ct.totalEquity ?? 0));
    rows.push(['  Total for Equities', formatAmount(totalEquity), ...compEquityTotals]);
    
    rows.push(['', '', ...compTotals.map(() => '')]);
    
    // Total L&E = Liabilities + Equity (Equity already closes the equation per period)
    const compLETotals = compTotals.map(ct => formatAmount((ct.totalLiabilities ?? 0) + (ct.totalEquity ?? 0)));
    rows.push(['Total for Liabilities & Equities', formatAmount(totalLiabilitiesAndEquity), ...compLETotals]);

    // Add Statement of Retained Earnings section
    rows.push(['', '', ...compTotals.map(() => '')]);
    rows.push(['Retained Earnings (Deficit)', '', ...compTotals.map(() => '')]);
    
    // Opening balance
    const currentOpeningRE = reCurrentStatement?.data.openingBalance ?? 0;
    const compOpeningRE = reComparativeStatements.map(c => formatAmount(c?.data.openingBalance ?? 0));
    rows.push(['  Opening balance', formatAmount(currentOpeningRE), ...compOpeningRE]);
    
    // Net income (loss)
    const currentNetIncome = reCurrentStatement?.data.netIncomeLoss ?? 0;
    const compNetIncome = reComparativeStatements.map(c => formatAmount(c?.data.netIncomeLoss ?? 0));
    rows.push(['  Net income (loss)', formatAmount(currentNetIncome), ...compNetIncome]);
    
    // Other additions (conditional)
    const currentOtherAdditions = reCurrentStatement?.data.otherAdditions ?? 0;
    const hasAnyOtherAdditions = currentOtherAdditions !== 0 || reComparativeStatements.some(c => (c?.data.otherAdditions ?? 0) !== 0);
    if (hasAnyOtherAdditions) {
      const compOtherAdditions = reComparativeStatements.map(c => formatAmount(c?.data.otherAdditions ?? 0));
      rows.push(['  Other additions', formatAmount(currentOtherAdditions), ...compOtherAdditions]);
    }
    
    // Dividends declared (conditional)
    const currentDividends = reCurrentStatement?.data.dividendsDeclared ?? 0;
    const hasAnyDividends = currentDividends !== 0 || reComparativeStatements.some(c => (c?.data.dividendsDeclared ?? 0) !== 0);
    if (hasAnyDividends) {
      const compDividends = reComparativeStatements.map(c => formatAmount(-(c?.data.dividendsDeclared ?? 0)));
      rows.push(['  Dividends declared', formatAmount(-currentDividends), ...compDividends]);
    }
    
    // Other deductions (conditional)
    const currentOtherDeductions = reCurrentStatement?.data.otherDeductions ?? 0;
    const hasAnyOtherDeductions = currentOtherDeductions !== 0 || reComparativeStatements.some(c => (c?.data.otherDeductions ?? 0) !== 0);
    if (hasAnyOtherDeductions) {
      const compOtherDeductions = reComparativeStatements.map(c => formatAmount(-(c?.data.otherDeductions ?? 0)));
      rows.push(['  Other deductions', formatAmount(-currentOtherDeductions), ...compOtherDeductions]);
    }
    
    // Closing balance
    const currentClosingRE = reCurrentStatement?.data.closingBalance ?? 0;
    const compClosingRE = reComparativeStatements.map(c => formatAmount(c?.data.closingBalance ?? 0));
    rows.push(['Closing balance', formatAmount(currentClosingRE), ...compClosingRE]);
    
    return {
      title: bsTitle,
      subtitle: isNpo ? 'Statement of Financial Position' : 'Balance Sheet',
      organizationName: organization?.name,
      dateRange: `As of ${formatLocalDate(dateRange.endDate)}`,
      headers,
      rows,
      totals: [
        { label: 'Total Assets', value: formatAmount(totalAssets) },
        { label: 'Total Liabilities & Equities', value: formatAmount(totalLiabilitiesAndEquity) },
        { label: 'Closing Retained Earnings', value: formatAmount(currentClosingRE) },
      ],
    };
  }, [assetRows, liabilityRows, equityRows, totalAssets, totalLiabilities, totalEquity, totalLiabilitiesAndEquity, organization, dateRange, comparisonPeriods, comparativeTotals, reCurrentStatement, reComparativeStatements, formatCurrency]);

  const renderRow = (row: BalanceSheetRow, showAmount: boolean = true) => {
    const isExpanded = row.isHeader && row.hasChildren ? isHeaderExpanded(row.id) : true;
    
    return (
      <tr 
        key={row.id}
        className={cn(
          "border-b border-border/30 hover:bg-muted/20 transition-colors",
          row.isHeader && "bg-transparent",
          row.isHeader && row.hasChildren && "cursor-pointer hover:bg-muted/40",
          row.isSectionTotal && "border-t border-border",
          row.isGrandTotal && "bg-muted/30 font-bold border-t border-border",
          row.isClickable && !row.isHeader && !row.isSectionTotal && !row.isGrandTotal && "cursor-pointer"
        )}
        style={row.isGrandTotal ? { borderBottom: '3px double var(--border)' } : row.isSectionTotal ? { borderBottom: '1px solid hsl(var(--border))' } : undefined}
        onClick={row.isHeader && row.hasChildren ? () => toggleHeader(row.id) : undefined}
        onDoubleClick={
          row.isClickable && !row.isHeader && !row.isSectionTotal && !row.isGrandTotal
            ? () => setDrilldown({ accountId: row.id, name: row.name, code: row.code })
            : undefined
        }
        title={
          row.isClickable && !row.isHeader && !row.isSectionTotal && !row.isGrandTotal
            ? 'Double-click to drill into transactions'
            : undefined
        }
      >
        <td className={cn("py-2.5 pr-4")}>
          <span 
            style={{ marginLeft: row.indent * 20 }}
            className={cn(
              "flex items-center gap-1",
              row.isHeader && "font-semibold text-foreground",
              row.isSectionTotal && "font-medium text-foreground",
              row.isGrandTotal && "font-bold text-foreground",
              row.isClickable && "text-primary hover:underline cursor-pointer",
              !row.isHeader && !row.isSectionTotal && !row.isGrandTotal && !row.isClickable && "text-foreground"
            )}
          >
            {row.isHeader && row.hasChildren && (
              isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )
            )}
            {row.name}
          </span>
        </td>
        <td className={cn(
          "py-2.5 px-4 text-right font-mono w-32",
          row.isHeader && isExpanded && "text-transparent",
          row.isHeader && !isExpanded && "font-semibold",
          row.isSectionTotal && "font-medium",
          row.isGrandTotal && "font-bold"
        )}>
          {/* Show subtotal when header is collapsed */}
          {row.isHeader && !isExpanded && row.headerSubtotal !== undefined 
            ? formatCurrencyOrDash(row.headerSubtotal)
            : (showAmount && !row.isHeader ? formatCurrencyOrDash(row.amount) : '')}
        </td>
        {comparisonPeriods.map((_, i) => {
          // Use pre-calculated comparative amount - this is mandatory for section totals
          // The comparativeAmounts array is populated in buildHierarchicalRows for all rows
          const compAmount = row.comparativeAmounts?.[i] ?? 0;
          const headerCompAmount = row.headerCompSubtotals?.[i] ?? 0;
          
          return (
            <td
              key={i}
              className={cn(
                "py-2.5 px-4 text-right font-mono w-32",
                row.isHeader && isExpanded && "text-transparent",
                row.isHeader && !isExpanded && "font-semibold",
                row.isSectionTotal && "font-medium",
                row.isGrandTotal && "font-bold"
              )}
            >
              {/* Show comparative subtotal when header is collapsed */}
              {row.isHeader && !isExpanded 
                ? formatCurrencyOrDash(headerCompAmount)
                : (showAmount && !row.isHeader ? formatCurrencyOrDash(compAmount) : '')}
            </td>
          );
        })}
      </tr>
    );
  };

  // Show loading only while checking org
  if (orgLoading) {
    return (
      <div className="space-y-6">
        <ReportsTabs />
        <Card className="p-6">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-64 w-full" />
        </Card>
      </div>
    );
  }

  // Show org creation prompt if no organization
  if (!organization) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Building2 className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Organization Found</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Create an organization to view the balance sheet.
        </p>
        <Button onClick={() => setShowOrgDialog(true)}>Create Organization</Button>
        <CreateOrganizationDialog open={showOrgDialog} onOpenChange={setShowOrgDialog} />
      </div>
    );
  }

  // Show error state if there's an issue
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Building2 className="w-16 h-16 text-destructive" />
        <h2 className="text-xl font-semibold">Error Loading Data</h2>
        <p className="text-muted-foreground text-center max-w-md">
          {error instanceof Error ? error.message : 'Failed to load financial data.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs Navigation */}
      <div className="flex items-center justify-between gap-3">
        <ReportsTabs />
        <RealtimeIndicator lastEventAt={realtimeLastEventAt} />
      </div>

      {/* Filters - using shared state */}
      <ReportFilters
        showExpandCollapse={true}
        onExpandAll={expandAllSections}
        onCollapseAll={collapseAllSections}
        showZeroBalances={showZeroBalances}
        onShowZeroBalancesChange={setShowZeroBalances}
        onCompareChange={setCompareSettings}
        onDateRangeChange={handleDateRangeChange}
        onRunReport={handleRunReport}
        initialStartDate={startDate}
        initialEndDate={endDate}
        fiscalYearEndMonth={fiscalYearEndMonth}
        actions={
          <div className="flex items-center gap-2">
            <DivisionFilter value={divisionIds} onChange={setDivisionIds} />
            <ReportActions reportData={reportData} variant="compact" />
          </div>
        }
      />

      <TaxMappingBanner organizationId={organization?.id} />

      <Card className="overflow-hidden">
        {/* Unclosed Fiscal Year Warning - informational only, Balance Sheet should still balance */}
        {yearsNeedingClose.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <span className="font-medium text-blue-800 dark:text-blue-200">
                    {yearsNeedingClose.length} unclosed fiscal year{yearsNeedingClose.length > 1 ? 's' : ''} available
                  </span>
                  <span className="text-sm text-blue-700 dark:text-blue-300 ml-2">
                    Optional: Transfer net income to Retained Earnings for proper year-end close per GAAP.
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-blue-300 text-blue-800 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-200 dark:hover:bg-blue-900/40"
                onClick={() => setShowFiscalCloseDialog(true)}
              >
                <BookOpen className="h-4 w-4 mr-1" />
                Close Year
              </Button>
            </div>
          </div>
        )}

        {/* Out of Balance Warning - only if there's an actual accounting error */}
        {!isBalanced && !reIsLoading && (
          <div className="bg-destructive/10 dark:bg-destructive/20 border-b border-destructive/30 px-6 py-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <span className="font-medium text-destructive">
                  Balance Sheet is out of balance
                </span>
                <span className="text-sm text-destructive/80 ml-2">
                  Difference: {formatCurrency(balanceDifference)}. This may indicate a data integrity issue.
                </span>
              </div>
            </div>
          </div>
        )}

        {criticalFinding && (
          <div className="px-6 py-3 border-b border-destructive/30 bg-destructive/10">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
              <div className="text-sm">
                <span className="font-semibold text-destructive">Integrity issue detected: </span>
                <span className="text-destructive/90">{criticalFinding.message}</span>
                {typeof (criticalFinding.payload as { difference?: number }).difference === 'number' && (
                  <span className="text-destructive/80 ml-1">
                    (difference {formatCurrency((criticalFinding.payload as { difference: number }).difference)})
                  </span>
                )}
                <span className="text-muted-foreground ml-2">
                  Detected {new Date(criticalFinding.detected_at).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {warningFindings.length > 0 && (
          <div className="px-6 py-2 border-b border-warning/30 bg-warning/10">
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold text-warning">Integrity warnings:</span>
                <ul className="list-disc list-inside text-foreground/80 mt-1 space-y-0.5">
                  {warningFindings.map((f) => (
                    <li key={f.id}>{f.message}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Report Controls */}
        <div className="flex items-center justify-between gap-6 px-6 py-3 border-b border-border bg-muted/20">
          <div className="flex items-center gap-4">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowFiscalCloseDialog(true)}
              className="text-muted-foreground hover:text-foreground"
            >
              <BookOpen className="h-4 w-4 mr-1" />
              Fiscal Year Close
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRecalculateBalances}
              disabled={isRecalculating || !organization?.id}
              className="text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isRecalculating ? 'animate-spin' : ''}`} />
              {isRecalculating ? 'Recalculating…' : 'Recalculate Balances'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => runScan()}
              disabled={isScanning || !organization?.id}
              className="text-muted-foreground hover:text-foreground"
            >
              <ShieldCheck className={`h-4 w-4 mr-1 ${isScanning ? 'animate-pulse' : ''}`} />
              {isScanning ? 'Scanning…' : 'Run Integrity Scan'}
            </Button>
            <SubledgerReconciliationDialog formatCurrency={formatCurrency} />
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id="collapse-sub"
                checked={collapseSubAccounts}
                onCheckedChange={setCollapseSubAccounts}
              />
              <Label htmlFor="collapse-sub" className="text-sm text-muted-foreground cursor-pointer">
                Collapse Sub-Accounts
              </Label>
            </div>
            {/* Balance status based on GAAP equation */}
            {isBalanced ? (
              <Badge className="bg-success/20 text-success border-success/30">
                <Check className="w-3 h-3 mr-1" />
                Balanced
              </Badge>
            ) : (
              <Badge className="bg-destructive/20 text-destructive border-destructive/30">
                Out of Balance
              </Badge>
            )}
          </div>
        </div>

        {/* Report Title */}
        <div className="text-center py-6 border-b border-border">
          <p className="text-sm text-muted-foreground uppercase tracking-wide">{organization?.name}</p>
          <h1 className="text-xl font-semibold mt-1">{bsTitle}</h1>
          <p className="text-sm text-muted-foreground mt-1">Basis: Accrual</p>
        </div>

        {/* Report Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="text-left py-3 px-6 font-medium text-muted-foreground uppercase text-xs">Account</th>
                <th className="text-right py-3 px-6 font-medium text-muted-foreground uppercase text-xs w-32">
                  <div className="text-right">{formatLocalDate(dateRange.endDate)}</div>
                  <div className="text-right mt-1">Total</div>
                </th>
                {comparisonPeriods.map((period, i) => {
                  const compTotal = comparativeTotals[i + 1];
                  const periodBalanced = compTotal?.isBalanced ?? true;
                  return (
                    <th key={i} className="text-right py-3 px-6 font-medium text-muted-foreground uppercase text-xs w-32">
                      <div className="text-right flex items-center justify-end gap-1">
                        {period.label}
                        {!periodBalanced && (
                          <span className="text-destructive text-[10px]" title="Out of balance">⚠</span>
                        )}
                      </div>
                      <div className="text-right mt-1">Total</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {/* ASSETS Section - Collapsible */}
              <tr 
                className="bg-muted/50 hover:bg-muted/70 cursor-pointer transition-colors select-none"
                onClick={() => toggleSection('assets')}
              >
                <td className="py-3 px-6 font-bold text-foreground">
                  <div className="flex items-center gap-2">
                    {expandedSections.assets ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>Assets</span>
                  </div>
                </td>
                {/* Show total when collapsed */}
                {!expandedSections.assets ? (
                  <>
                    <td className="py-3 px-6 text-right font-mono font-bold">{formatCurrency(totalAssets)}</td>
                    {comparisonPeriods.map((_, i) => {
                      const compTotal = comparativeTotals[i + 1];
                      return (
                        <td key={i} className="py-3 px-6 text-right font-mono font-bold">
                          {compTotal ? formatCurrency(compTotal.totalAssets) : '-'}
                        </td>
                      );
                    })}
                  </>
                ) : (
                  <>
                    <td className="py-3 px-6"></td>
                    {comparisonPeriods.map((_, i) => (
                      <td key={i} className="py-3 px-6"></td>
                    ))}
                  </>
                )}
              </tr>
              {expandedSections.assets && assetRows
                .filter(row => {
                  // Always show header rows
                  if (row.isHeader) return true;
                  // Show child rows only if their parent header is expanded
                  if (row.parentHeaderId && !isHeaderExpanded(row.parentHeaderId)) return false;
                  return true;
                })
                .map(row => renderRow(row))}
              {/* Total for Assets - shown when expanded */}
              {expandedSections.assets && (
                <tr className="bg-muted/20 border-t-2 border-border font-semibold">
                  <td className="py-3 px-6 font-bold">Total for Assets</td>
                  <td className="py-3 px-6 text-right font-mono font-bold">{formatCurrency(totalAssets)}</td>
                  {comparisonPeriods.map((_, i) => {
                    const compTotal = comparativeTotals[i + 1];
                    return (
                      <td key={i} className="py-3 px-6 text-right font-mono font-bold">
                        {compTotal ? formatCurrency(compTotal.totalAssets) : '-'}
                      </td>
                    );
                  })}
                </tr>
              )}

              {/* Spacer */}
              <tr><td colSpan={2 + comparisonPeriods.length} className="py-4"></td></tr>

              {/* LIABILITIES & EQUITIES Section */}
              <tr className="bg-transparent">
                <td colSpan={2 + comparisonPeriods.length} className="py-3 px-6 font-bold text-foreground">
                  Liabilities & {equityLabel}
                </td>
              </tr>

              {/* Liabilities Sub-section - Collapsible */}
              <tr 
                className="bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors select-none"
                onClick={() => toggleSection('liabilities')}
              >
                <td className="py-2 px-6 font-semibold text-foreground" style={{ paddingLeft: 30 }}>
                  <div className="flex items-center gap-2">
                    {expandedSections.liabilities ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>Liabilities</span>
                  </div>
                </td>
                {/* Show total when collapsed */}
                {!expandedSections.liabilities ? (
                  <>
                    <td className="py-2 px-6 text-right font-mono font-semibold">{formatCurrency(totalLiabilities)}</td>
                    {comparisonPeriods.map((_, i) => {
                      const compTotal = comparativeTotals[i + 1];
                      return (
                        <td key={i} className="py-2 px-6 text-right font-mono font-semibold">
                          {compTotal ? formatCurrency(compTotal.totalLiabilities) : '-'}
                        </td>
                      );
                    })}
                  </>
                ) : (
                  <>
                    <td className="py-2 px-6"></td>
                    {comparisonPeriods.map((_, i) => (
                      <td key={i} className="py-2 px-6"></td>
                    ))}
                  </>
                )}
              </tr>
              {expandedSections.liabilities && liabilityRows
                .filter(row => {
                  if (row.isHeader) return true;
                  if (row.parentHeaderId && !isHeaderExpanded(row.parentHeaderId)) return false;
                  return true;
                })
                .map(row => renderRow({ ...row, indent: row.indent + 1 }))}
              {/* Total for Liabilities - shown when expanded */}
              {expandedSections.liabilities && (
                <tr className="border-t border-border/50">
                  <td className="py-2.5 px-6 font-semibold" style={{ paddingLeft: 30 }}>Total for Liabilities</td>
                  <td className="py-2.5 px-6 text-right font-mono font-semibold">{formatCurrency(totalLiabilities)}</td>
                  {comparisonPeriods.map((_, i) => {
                    const compTotal = comparativeTotals[i + 1];
                    return (
                      <td key={i} className="py-2.5 px-6 text-right font-mono font-semibold">
                        {compTotal ? formatCurrency(compTotal.totalLiabilities) : '-'}
                      </td>
                    );
                  })}
                </tr>
              )}

              {/* Spacer */}
              <tr><td colSpan={2 + comparisonPeriods.length} className="py-2"></td></tr>

              {/* Equities Sub-section - Collapsible */}
              <tr 
                className="bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors select-none"
                onClick={() => toggleSection('equities')}
              >
                <td className="py-2 px-6 font-semibold text-foreground" style={{ paddingLeft: 30 }}>
                  <div className="flex items-center gap-2">
                    {expandedSections.equities ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>{equityLabel}</span>
                  </div>
                </td>
                {/* Show total when collapsed */}
                {!expandedSections.equities ? (
                  <>
                    <td className="py-2 px-6 text-right font-mono font-semibold">{formatCurrency(totalEquity)}</td>
                    {comparisonPeriods.map((_, i) => {
                      const compREClosing = reComparativeStatements[i]?.data?.closingBalance ?? 0;
                      const compPeriodData = comparativeData?.[i + 1];
                      const compEquityAccts = (compPeriodData?.balances ?? [])
                        .filter(a => a.account_type === 'equity')
                        .filter(a => {
                          const code = a.code;
                          const nameLower = a.name?.toLowerCase() || '';
                          if (code === '3-00-202' || nameLower.includes('current year earnings') || nameLower.includes('current year excess') || nameLower.includes('current year surplus') || nameLower.includes('excess (deficiency)')) return false;
                          if (code === '3-00-201' || nameLower === 'retained earnings' || nameLower.includes('accumulated deficit') || nameLower.includes('unrestricted net assets') || nameLower.includes('accumulated surplus') || nameLower.includes('unrestricted funds') || nameLower.includes('accumulated funds')) return false;
                          return true;
                        })
                        .reduce((sum, a) => {
                          const isContra = a.normal_balance !== 'credit';
                          const sign = isContra ? -1 : 1;
                          return sum + ((a.calculated_balance ?? 0) * sign);
                        }, 0);
                      const compEquityTotal = compEquityAccts + compREClosing;
                      return (
                        <td key={i} className="py-2 px-6 text-right font-mono font-semibold">
                          {formatCurrency(compEquityTotal)}
                        </td>
                      );
                    })}
                  </>
                ) : (
                  <>
                    <td className="py-2 px-6"></td>
                    {comparisonPeriods.map((_, i) => (
                      <td key={i} className="py-2 px-6"></td>
                    ))}
                  </>
                )}
              </tr>
              {expandedSections.equities && equityRows
                .filter(row => {
                  if (row.isHeader) return true;
                  if (row.parentHeaderId && !isHeaderExpanded(row.parentHeaderId)) return false;
                  return true;
                })
                .map(row => renderRow({ ...row, indent: row.indent + 1 }))}
              {/* Total for Equities - shown when expanded */}
              {expandedSections.equities && (
                <tr className="border-t border-border/50">
                  <td className="py-2.5 px-6 font-semibold" style={{ paddingLeft: 30 }}>Total for {equityLabel}</td>
                  <td className="py-2.5 px-6 text-right font-mono font-semibold">{formatCurrency(totalEquity)}</td>
                  {comparisonPeriods.map((_, i) => {
                    const compREClosing = reComparativeStatements[i]?.data?.closingBalance ?? 0;
                    const compPeriodData = comparativeData?.[i + 1];
                    const compEquityAccts = (compPeriodData?.balances ?? [])
                      .filter(a => a.account_type === 'equity')
                      .filter(a => {
                        const code = a.code;
                        const nameLower = a.name?.toLowerCase() || '';
                        if (code === '3-00-202' || nameLower.includes('current year earnings') || nameLower.includes('current year excess') || nameLower.includes('current year surplus') || nameLower.includes('excess (deficiency)')) return false;
                        if (code === '3-00-201' || nameLower === 'retained earnings' || nameLower.includes('accumulated deficit') || nameLower.includes('unrestricted net assets') || nameLower.includes('accumulated surplus') || nameLower.includes('unrestricted funds') || nameLower.includes('accumulated funds')) return false;
                        return true;
                      })
                      .reduce((sum, a) => {
                        const isContra = a.normal_balance !== 'credit';
                        const sign = isContra ? -1 : 1;
                        return sum + ((a.calculated_balance ?? 0) * sign);
                      }, 0);
                    const compEquityTotal = compEquityAccts + compREClosing;
                    return (
                      <td key={i} className="py-2.5 px-6 text-right font-mono font-semibold">
                        {formatCurrency(compEquityTotal)}
                      </td>
                    );
                  })}
                </tr>
              )}

              {/* Total for Liabilities & Equities - Liabilities + Total Equity */}
              <tr className="bg-muted/20 border-t-2 border-border font-semibold">
                <td className="py-3 px-6 font-bold">Total for Liabilities & {equityLabel}</td>
                <td className="py-3 px-6 text-right font-mono font-bold">{formatCurrency(totalLiabilitiesAndEquity)}</td>
                {comparisonPeriods.map((_, i) => {
                  const compTotal = comparativeTotals[i + 1];
                  // Use the comparative RE closing balance (already includes net income)
                  const compREClosing = reComparativeStatements[i]?.data?.closingBalance ?? 0;
                  // Get comparative equity accounts excluding RE and CYE
                  const compPeriodData = comparativeData?.[i + 1];
                  const compEquityAccts = (compPeriodData?.balances ?? [])
                    .filter(a => a.account_type === 'equity')
                      .filter(a => {
                        const code = a.code;
                        const nameLower = a.name?.toLowerCase() || '';
                        if (code === '3-00-202' || nameLower.includes('current year earnings') || nameLower.includes('current year excess') || nameLower.includes('current year surplus') || nameLower.includes('excess (deficiency)')) return false;
                        if (code === '3-00-201' || nameLower === 'retained earnings' || nameLower.includes('accumulated deficit') || nameLower.includes('unrestricted net assets') || nameLower.includes('accumulated surplus') || nameLower.includes('unrestricted funds') || nameLower.includes('accumulated funds')) return false;
                        return true;
                      })
                    .reduce((sum, a) => {
                      const isContra = a.normal_balance !== 'credit';
                      const sign = isContra ? -1 : 1;
                      return sum + ((a.calculated_balance ?? 0) * sign);
                    }, 0);
                  const compEquityTotal = compEquityAccts + compREClosing;
                  const compLETotal = (compTotal?.totalLiabilities ?? 0) + compEquityTotal;
                  return (
                    <td key={i} className="py-3 px-6 text-right font-mono font-bold">
                      {formatCurrency(compLETotal)}
                    </td>
                  );
                })}
              </tr>

              {/* Spacer before Statement of Retained Earnings */}
              <tr><td colSpan={2 + comparisonPeriods.length} className="py-4"></td></tr>

              {/* ============================================================================
                  STATEMENT OF RETAINED EARNINGS (DEFICIT) - Collapsible
                  CRA Schedule 100 / ASPE Section 1521 / IFRS IAS 1 Compliant
                  GIFI 3660: Opening balance
                  GIFI 3680: Net income (loss)
                  GIFI 3849: Closing balance
                  ============================================================================ */}
              <tr 
                className="bg-muted/50 hover:bg-muted/70 cursor-pointer transition-colors select-none border-t-2 border-border"
                onClick={() => toggleSection('retainedEarnings')}
              >
                <td className="py-3 px-6 font-bold text-foreground">
                  <div className="flex items-center gap-2">
                    {expandedSections.retainedEarnings ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>{isNpo ? 'Net Assets — Reconciliation' : 'Retained Earnings (Deficit)'}</span>
                  </div>
                </td>
                {/* Show closing balance when collapsed */}
                {!expandedSections.retainedEarnings ? (
                  <>
                    <td className="py-3 px-6 text-right font-mono font-bold">
                      {reCurrentStatement ? formatCurrency(reCurrentStatement.data.closingBalance) : '-'}
                    </td>
                    {comparisonPeriods.map((_, i) => {
                      const compRE = reComparativeStatements[i];
                      return (
                        <td key={i} className="py-3 px-6 text-right font-mono font-bold">
                          {compRE ? formatCurrency(compRE.data.closingBalance) : '-'}
                        </td>
                      );
                    })}
                  </>
                ) : (
                  <>
                    <td className="py-3 px-6"></td>
                    {comparisonPeriods.map((_, i) => (
                      <td key={i} className="py-3 px-6"></td>
                    ))}
                  </>
                )}
              </tr>

              {/* RE Details - shown when expanded */}
              {expandedSections.retainedEarnings && (
                <>
                  {/* Opening Balance - GIFI 3660 */}
                  <tr className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-6" style={{ paddingLeft: 30 }}>
                      <span className="text-foreground">Opening balance</span>
                    </td>
                    <td className="py-2.5 px-6 text-right font-mono">
                      {reCurrentStatement ? formatCurrencyOrDash(reCurrentStatement.data.openingBalance) : '-'}
                    </td>
                    {comparisonPeriods.map((_, i) => {
                      const compRE = reComparativeStatements[i];
                      return (
                        <td key={i} className="py-2.5 px-6 text-right font-mono">
                          {compRE ? formatCurrencyOrDash(compRE.data.openingBalance) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Net Income (Loss) - GIFI 3680 */}
                  <tr className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-6" style={{ paddingLeft: 30 }}>
                      <span className="text-foreground">Net income (loss)</span>
                    </td>
                    <td className="py-2.5 px-6 text-right font-mono">
                      {reCurrentStatement ? formatCurrencyOrDash(reCurrentStatement.data.netIncomeLoss) : '-'}
                    </td>
                    {comparisonPeriods.map((_, i) => {
                      const compRE = reComparativeStatements[i];
                      return (
                        <td key={i} className="py-2.5 px-6 text-right font-mono">
                          {compRE ? formatCurrencyOrDash(compRE.data.netIncomeLoss) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Other Additions (conditional) */}
                  {((reCurrentStatement?.data.otherAdditions ?? 0) !== 0 || reComparativeStatements.some(c => (c?.data.otherAdditions ?? 0) !== 0)) && (
                    <tr className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-6" style={{ paddingLeft: 30 }}>
                        <span className="text-foreground">Other additions</span>
                      </td>
                      <td className="py-2.5 px-6 text-right font-mono">
                        {reCurrentStatement ? formatCurrencyOrDash(reCurrentStatement.data.otherAdditions) : '-'}
                      </td>
                      {comparisonPeriods.map((_, i) => {
                        const compRE = reComparativeStatements[i];
                        return (
                          <td key={i} className="py-2.5 px-6 text-right font-mono">
                            {compRE ? formatCurrencyOrDash(compRE.data.otherAdditions) : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  )}

                  {/* Dividends Declared (conditional) */}
                  {((reCurrentStatement?.data.dividendsDeclared ?? 0) !== 0 || reComparativeStatements.some(c => (c?.data.dividendsDeclared ?? 0) !== 0)) && (
                    <tr className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-6" style={{ paddingLeft: 30 }}>
                        <span className="text-foreground">Dividends declared</span>
                      </td>
                      <td className="py-2.5 px-6 text-right font-mono">
                        {reCurrentStatement ? formatCurrencyOrDash(-(reCurrentStatement.data.dividendsDeclared)) : '-'}
                      </td>
                      {comparisonPeriods.map((_, i) => {
                        const compRE = reComparativeStatements[i];
                        return (
                          <td key={i} className="py-2.5 px-6 text-right font-mono">
                            {compRE ? formatCurrencyOrDash(-(compRE.data.dividendsDeclared)) : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  )}

                  {/* Other Deductions (conditional) */}
                  {((reCurrentStatement?.data.otherDeductions ?? 0) !== 0 || reComparativeStatements.some(c => (c?.data.otherDeductions ?? 0) !== 0)) && (
                    <tr className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-6" style={{ paddingLeft: 30 }}>
                        <span className="text-foreground">Other deductions</span>
                      </td>
                      <td className="py-2.5 px-6 text-right font-mono">
                        {reCurrentStatement ? formatCurrencyOrDash(-(reCurrentStatement.data.otherDeductions)) : '-'}
                      </td>
                      {comparisonPeriods.map((_, i) => {
                        const compRE = reComparativeStatements[i];
                        return (
                          <td key={i} className="py-2.5 px-6 text-right font-mono">
                            {compRE ? formatCurrencyOrDash(-(compRE.data.otherDeductions)) : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  )}

                  {/* Closing Balance - GIFI 3849 */}
                  <tr className="bg-muted/20 border-t-2 border-border font-semibold">
                    <td className="py-3 px-6 font-bold" style={{ paddingLeft: 30 }}>Closing balance</td>
                    <td className="py-3 px-6 text-right font-mono font-bold">
                      {reCurrentStatement ? formatCurrency(reCurrentStatement.data.closingBalance) : '-'}
                    </td>
                    {comparisonPeriods.map((_, i) => {
                      const compRE = reComparativeStatements[i];
                      return (
                        <td key={i} className="py-3 px-6 text-right font-mono font-bold">
                          {compRE ? formatCurrency(compRE.data.closingBalance) : '-'}
                        </td>
                      );
                    })}
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-blue-500">
          <p className="text-sm text-muted-foreground mb-1">Total Assets</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(totalAssets)}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-orange-500">
          <p className="text-sm text-muted-foreground mb-1">Total Liabilities</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(totalLiabilities)}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-purple-500">
          <p className="text-sm text-muted-foreground mb-1">Total Equity</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(totalEquity)}</p>
          {netIncome !== 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Incl. {formatCurrency(netIncome)} current year
            </p>
          )}
        </Card>
        <Card className="p-4 border-l-4 border-l-accent">
          <p className="text-sm text-muted-foreground mb-1">Debt-to-Equity Ratio</p>
          <p className="text-2xl font-bold text-foreground">
            {totalEquity > 0 
              ? (totalLiabilities / totalEquity).toFixed(2) 
              : '-'}
          </p>
        </Card>
      </div>

      {/* Fiscal Year Close Dialog */}
      <FiscalYearCloseDialog 
        open={showFiscalCloseDialog} 
        onOpenChange={setShowFiscalCloseDialog} 
      />

      {/* Drilldown — Balance Sheet is "as of" so no period start */}
      {drilldown && (
        <AmountDrilldownDialog
          open={!!drilldown}
          onOpenChange={(o) => !o && setDrilldown(null)}
          organizationId={organization?.id}
          accountId={drilldown.accountId}
          accountName={drilldown.name}
          accountCode={drilldown.code}
          periodStart={null}
          periodEnd={endDate}
        />
      )}

      <ExecutiveSignatureBlock
        statementType="balance_sheet"
        statementTitle="Statement of Financial Position (Balance Sheet)"
        periodStart={startDate}
        periodEnd={endDate}
      />
    </div>
  );
}

/**
 * Small inline banner that warns the user when sales-tax GL mappings are missing
 * or inactive — common cause of GST/HST not appearing on the Balance Sheet.
 * Purely presentational: does not change totals or reclassify any accounts.
 */
function TaxMappingBanner({ organizationId }: { organizationId?: string }) {
  const { data: exceptions = [] } = useTaxExceptions({ organizationId });
  const relevant = exceptions.filter(
    e => e.category === 'missing_gl_mapping' || e.category === 'inactive_code_used',
  );
  if (relevant.length === 0) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-900/20">
      <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
        <AlertTriangle className="h-4 w-4" />
        <span>
          {relevant.length} sales-tax mapping issue{relevant.length > 1 ? 's' : ''} detected — tax may not be posting to the correct GL account.
        </span>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link to="/tax/exceptions">Review</Link>
      </Button>
    </div>
  );
}

