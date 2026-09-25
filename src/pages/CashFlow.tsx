import { useState, useMemo } from 'react';
import { Building2, Play, ChevronUp, ChevronDown, ChevronRight, FileText, FileSpreadsheet, Printer, CalendarDays, ArrowLeftRight, Share2, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { ReportsTabs } from '@/components/reports/ReportsTabs';
import { RealtimeIndicator } from '@/components/reports/RealtimeIndicator';
import { DivisionFilter } from '@/components/reports/DivisionFilter';
import { ExecutiveSignatureBlock } from '@/components/reports/ExecutiveSignatureBlock';
import { useFinancialReports, DateRangeFilter } from '@/hooks/useFinancialReports';
import { useComparativeFinancialReports } from '@/hooks/useComparativeFinancialReports';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfQuarter, 
  endOfQuarter, 
  subMonths,
  subYears,
  subQuarters
} from 'date-fns';
import { getFiscalYearStart, getFiscalYearEnd, getFiscalYearForDate } from '@/lib/fiscalYearUtils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import jsPDF from 'jspdf';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { exportToFormattedExcel } from '@/lib/excelExport';
import { useNpoTerminology } from '@/hooks/useNpoTerminology';

type DatePreset = 'this-month' | 'last-month' | 'this-quarter' | 'last-quarter' | 'fiscal-year-to-date' | 'last-fiscal-year' | 'custom';
type CompareType = 'periods' | 'years';

/**
 * ============================================================================
 * CASH FLOW LINE ITEM STRUCTURE - GAAP/ASPE COMPLIANT
 * ============================================================================
 * 
 * The Cash Flow Statement (Indirect Method) follows these FORMULAS:
 * 
 * BEGINNING CASH BALANCE:
 *   = Sum of cash/bank account balances at START of period
 *   = Prior period's Ending Cash Balance
 *   = Balance Sheet cash accounts at period start
 * 
 * OPERATING ACTIVITIES:
 *   Net Income (from Income Statement)
 *   + Non-cash adjustments (Depreciation, Amortization)
 *   +/- Working capital changes:
 *       - Increase in AR = USES cash (negative)
 *       - Decrease in AR = PROVIDES cash (positive)
 *       - Increase in AP = PROVIDES cash (positive)
 *       - Decrease in AP = USES cash (negative)
 *       - Increase in Inventory = USES cash (negative)
 *   = Net Cash from Operating Activities
 * 
 * INVESTING ACTIVITIES:
 *   - Purchase of fixed assets (USES cash)
 *   + Sale of fixed assets (PROVIDES cash)
 *   = Net Cash from Investing Activities
 * 
 * FINANCING ACTIVITIES:
 *   + Proceeds from borrowing (PROVIDES cash)
 *   - Debt repayments (USES cash)
 *   + Capital contributions (PROVIDES cash)
 *   - Dividends/distributions (USES cash)
 *   = Net Cash from Financing Activities
 * 
 * NET CHANGE IN CASH:
 *   = Net Operating + Net Investing + Net Financing
 * 
 * ENDING CASH BALANCE:
 *   = Beginning Cash + Net Change in Cash
 *   = Must equal Balance Sheet's cash/bank account totals
 * 
 * ============================================================================
 */
interface CashFlowLineItem {
  id: string;
  name: string;
  code?: string;
  amount: number;
  comparisonAmounts?: number[];
  isSection?: boolean;
  isSectionTotal?: boolean;
  isSubSection?: boolean;
  isSubTotal?: boolean;
  isGrandTotal?: boolean;
  indent?: number;
  isClickable?: boolean;
  children?: CashFlowLineItem[];
}

interface ComparisonSettings {
  enabled: boolean;
  type: CompareType;
  count: number;
  latestToOldest: boolean;
}

// Helper to format date in local timezone
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function CashFlow() {
  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const fiscalYearEndMonth = organization?.fiscal_year_end_month || 12;
  
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>('fiscal-year-to-date');
  
  // Initialize dates based on fiscal year settings
  const now = new Date();
  const currentFY = getFiscalYearForDate(now, fiscalYearEndMonth);
  const [dateFrom, setDateFrom] = useState<Date>(() => getFiscalYearStart(currentFY, fiscalYearEndMonth));
  const [dateTo, setDateTo] = useState<Date>(now);
  const [showZeroBalances, setShowZeroBalances] = useState(false);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Collapsible section states
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'operating-header': true,
    'investing-header': true,
    'financing-header': true,
  });
  
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };
  
  const isSectionExpanded = (sectionId: string) => {
    return expandedSections[sectionId] !== false;
  };
  
  // Comparison state - default to 2 periods for meaningful comparison
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [comparison, setComparison] = useState<ComparisonSettings>({
    enabled: false,
    type: 'years',
    count: 2,
    latestToOldest: true,
  });
  const [tempComparison, setTempComparison] = useState<ComparisonSettings>({
    enabled: false,
    type: 'years',
    count: 2,
    latestToOldest: true,
  });
  
  // Division filter (Phase: Division-aware Cash Flow)
  const [divisionIds, setDivisionIds] = useState<string[]>([]);

  // Build date filter for the hook
  const dateFilter: DateRangeFilter = useMemo(() => ({
    startDate: dateFrom,
    endDate: dateTo,
    period: 'custom',
    departmentIds: divisionIds,
  }), [dateFrom, dateTo, divisionIds]);
  
  const { getCashFlowData, isLoading, error, realtimeLastEventAt } = useFinancialReports(dateFilter);

  // Handle date preset changes - uses org's fiscal year settings
  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    const fyMonth = organization?.fiscal_year_end_month || 12;
    const currentFiscalYear = getFiscalYearForDate(now, fyMonth);
    
    switch (preset) {
      case 'this-month':
        setDateFrom(startOfMonth(now));
        setDateTo(endOfMonth(now));
        break;
      case 'last-month':
        const lastMonth = subMonths(now, 1);
        setDateFrom(startOfMonth(lastMonth));
        setDateTo(endOfMonth(lastMonth));
        break;
      case 'this-quarter':
        setDateFrom(startOfQuarter(now));
        setDateTo(endOfQuarter(now));
        break;
      case 'last-quarter':
        const lastQuarter = subQuarters(now, 1);
        setDateFrom(startOfQuarter(lastQuarter));
        setDateTo(endOfQuarter(lastQuarter));
        break;
      case 'fiscal-year-to-date':
        setDateFrom(getFiscalYearStart(currentFiscalYear, fyMonth));
        setDateTo(now);
        break;
      case 'last-fiscal-year':
        const lastFY = currentFiscalYear - 1;
        setDateFrom(getFiscalYearStart(lastFY, fyMonth));
        setDateTo(getFiscalYearEnd(lastFY, fyMonth));
        break;
      case 'custom':
        // Keep current dates
        break;
    }
  };

  // Generate comparison period labels
  const getComparisonLabels = useMemo(() => {
    if (!comparison.enabled) return [];
    
    const labels: { label: string; dateFrom: Date; dateTo: Date }[] = [];
    const periodDiff = dateTo.getTime() - dateFrom.getTime();
    
    for (let i = 1; i <= comparison.count; i++) {
      let compFrom: Date, compTo: Date;
      
      if (comparison.type === 'years') {
        compFrom = subYears(dateFrom, i);
        compTo = subYears(dateTo, i);
      } else {
        // Previous periods - calculate based on current period length
        if (datePreset === 'this-month' || datePreset === 'last-month') {
          compFrom = subMonths(dateFrom, i);
          compTo = endOfMonth(compFrom);
        } else if (datePreset === 'this-quarter' || datePreset === 'last-quarter') {
          compFrom = subQuarters(dateFrom, i);
          compTo = endOfQuarter(compFrom);
        } else {
          // Default: shift by period length
          compFrom = new Date(dateFrom.getTime() - periodDiff * i);
          compTo = new Date(dateTo.getTime() - periodDiff * i);
        }
      }
      
      labels.push({
        label: format(compFrom, 'MMM d, yyyy') + ' - ' + format(compTo, 'MMM d, yyyy'),
        dateFrom: compFrom,
        dateTo: compTo,
      });
    }
    
    return comparison.latestToOldest ? labels : labels.reverse();
  }, [comparison, dateFrom, dateTo, datePreset]);

  // Build comparison periods for comparative data (must be after getComparisonLabels)
  const comparisonPeriods = useMemo(() => {
    if (!comparison.enabled) return [];
    return getComparisonLabels.map(comp => ({
      label: comp.label,
      startDate: comp.dateFrom,
      endDate: comp.dateTo,
    }));
  }, [comparison.enabled, getComparisonLabels]);
  
  // Fetch comparative financial data when comparison is enabled
  const {
    data: comparativeData,
    isLoading: isLoadingComparative,
  } = useComparativeFinancialReports(
    { startDate: dateFrom, endDate: dateTo },
    comparisonPeriods
  );

  // Open compare dialog
  const handleOpenCompareDialog = () => {
    setTempComparison({ ...comparison, enabled: true });
    setShowCompareDialog(true);
  };

  // Apply comparison settings
  const handleApplyComparison = () => {
    setComparison(tempComparison);
    setShowCompareDialog(false);
  };

  // Clear comparison
  const handleClearComparison = () => {
    setComparison({ enabled: false, type: 'periods', count: 1, latestToOldest: true });
  };

  const { formatCurrency: formatCurrencyBase } = useCurrencyFormatter();
  const { npoTerms, isNpo } = useNpoTerminology();
  const netIncomeLabel = isNpo ? (npoTerms?.netIncome || 'Excess (Deficiency) of Revenue over Expenses') : 'Net Income';
  
  const formatCurrency = (value: number, showZero = false) => {
    if (value === 0 && !showZero) return '0.00';
    return formatCurrencyBase(value);
  };

  // Get cash flow data with safe default values
  const cashFlowData = getCashFlowData() || {
    operatingActivities: [],
    investingActivities: [],
    financingActivities: [],
    nonCashActivities: [],
    netOperating: 0,
    netInvesting: 0,
    netFinancing: 0,
    netChange: 0,
    beginningCash: 0,
    endingCash: 0,
    actualCashChange: 0,
    isReconciled: true,
    reconciliationDifference: 0,
  };

  
  // Helper to calculate cash flow data for a comparative period
  // Uses the same methodology as useFinancialReports.ts getCashFlowData() for consistency
  const calculateCashFlowForPeriod = (periodData: any) => {
    if (!periodData?.balances) return null;
    
    const toCents = (n: number) => Math.round(n * 100);
    const fromCents = (n: number) => n / 100;
    
    // Helper to check if code starts with any of the given prefixes
    const codeStartsWith = (code: string, prefixes: string[]) => 
      prefixes.some(prefix => code.startsWith(prefix));
    
    // Match the same criteria used in useFinancialReports.ts for consistency
    const nameContains = (name: string, keywords: string[]) => {
      const lowerName = name.toLowerCase();
      return keywords.some(keyword => lowerName.includes(keyword.toLowerCase()));
    };
    
    // ========== CASH ACCOUNTS ==========
    /**
     * CASH ACCOUNT DETECTION PATTERNS:
     * Supports multiple Chart of Accounts structures:
     * - DAPRO/Legacy CoA: 10xx prefixes for cash accounts
     * - Kairos/Modern CoA: 1-01-101 prefixes for cash accounts
     */
    const isCashByCode = (code: string) => {
      // Legacy numeric prefix (10xx)
      if (code.startsWith('10') && code.length >= 3 && code.length <= 5) return true;
      // Modern structured prefix (1-01-101 for cash/bank accounts)
      if (code.startsWith('1-01-101')) return true;
      return false;
    };
    
    const cashAccounts = periodData.balances.filter((a: any) => 
      a.account_type === 'asset' && !a.is_header &&
      (nameContains(a.name, ['cash', 'bank', 'chequing', 'checking', 'savings', 'petty cash', 'operating bank']) || 
       isCashByCode(a.code))
    );
    
    const beginningCashCents = cashAccounts.reduce((sum: number, a: any) => 
      sum + toCents(a.opening_balance || 0), 0);
    const endingCashCents = cashAccounts.reduce((sum: number, a: any) => 
      sum + toCents(a.calculated_balance || 0), 0);
    
    // ========== OPERATING ACTIVITIES (Indirect Method) ==========
    // Start with Net Income
    const netIncomeCents = toCents(periodData.netIncome || 0);
    let operatingTotalCents = netIncomeCents;
    
    // Add back depreciation/amortization (non-cash expenses).
    // Defensive: exclude any expense account misnamed "accumulated ..." to avoid
    // double-counting a contra-asset accidentally posted as an expense.
    const depreciationAccounts = periodData.balances.filter((a: any) => 
      a.account_type === 'expense' && !a.is_header &&
      nameContains(a.name, ['depreciation', 'amortization']) &&
      !nameContains(a.name, ['accumulated', 'accum'])
    );
    const depreciationCents = depreciationAccounts.reduce((sum: number, a: any) => 
      sum + toCents(a.calculated_balance || 0), 0);
    operatingTotalCents += depreciationCents;
    
    // Changes in Accounts Receivable (asset - increase uses cash)
    const arAccounts = periodData.balances.filter((a: any) => 
      a.account_type === 'asset' && !a.is_header &&
      (nameContains(a.name, ['receivable', 'a/r']) || codeStartsWith(a.code, ['11', '110', '111', '112']))
    );
    const arChangeCents = arAccounts.reduce((sum: number, a: any) => {
      const change = toCents((a.calculated_balance || 0) - (a.opening_balance || 0));
      return sum + change;
    }, 0);
    operatingTotalCents -= arChangeCents; // Increase in AR uses cash
    
    // Changes in Inventory (asset - increase uses cash)
    const inventoryAccounts = periodData.balances.filter((a: any) => 
      a.account_type === 'asset' && !a.is_header &&
      (nameContains(a.name, ['inventory', 'stock']) || codeStartsWith(a.code, ['12', '120', '121']))
    );
    const inventoryChangeCents = inventoryAccounts.reduce((sum: number, a: any) => 
      sum + toCents((a.calculated_balance || 0) - (a.opening_balance || 0)), 0);
    operatingTotalCents -= inventoryChangeCents; // Increase in inventory uses cash
    
    // Changes in Prepaid Expenses (asset - increase uses cash)
    const prepaidAccounts = periodData.balances.filter((a: any) => 
      a.account_type === 'asset' && !a.is_header &&
      (nameContains(a.name, ['prepaid', 'prepayment']) || codeStartsWith(a.code, ['13', '130']))
    );
    const prepaidChangeCents = prepaidAccounts.reduce((sum: number, a: any) => 
      sum + toCents((a.calculated_balance || 0) - (a.opening_balance || 0)), 0);
    operatingTotalCents -= prepaidChangeCents; // Increase in prepaid uses cash
    
    // Changes in Accounts Payable (liability - increase provides cash)
    // Exclude tax-related accounts as they're handled separately
    // Lease liability detection (ASPE §3065 / IFRS 16 / ASC 842)
    // Only classify as a lease liability when the account name explicitly names a
    // lease obligation. A code prefix alone (2-01/2-02) is NOT sufficient — bank
    // loans often live under the same prefix even when their name references a
    // leased asset (e.g. "Long-Term Bank Loan – Truck Lease").
    const isLeaseLiability = (a: any) =>
      a.account_type === 'liability' && !a.is_header && (
        nameContains(a.name, ['lease liab', 'lease obligation', 'lease payable', 'capital lease', 'finance lease']) ||
        nameContains(a.name, ['current portion of lease'])
      );
    
    const apAccounts = periodData.balances.filter((a: any) => 
      a.account_type === 'liability' && !a.is_header &&
      !isLeaseLiability(a) &&
      (nameContains(a.name, ['payable', 'a/p', 'accrued', 'wages']) || codeStartsWith(a.code, ['20', '200', '21', '210', '23'])) &&
      !nameContains(a.name, ['tax', 'gst', 'hst', 'pst', 'qst', 'cpp', 'ei', 'income tax'])
    );

    const apChangeCents = apAccounts.reduce((sum: number, a: any) => {
      const change = toCents((a.calculated_balance || 0) - (a.opening_balance || 0));
      const sign = a.normal_balance === 'credit' ? 1 : -1;
      return sum + (change * sign);
    }, 0);
    operatingTotalCents += apChangeCents; // Increase in AP provides cash
    
    // Changes in Tax Liabilities
    const taxLiabAccounts = periodData.balances.filter((a: any) => 
      a.account_type === 'liability' && !a.is_header &&
      (nameContains(a.name, ['tax', 'gst', 'hst', 'pst', 'qst', 'cpp', 'ei', 'income tax']) || codeStartsWith(a.code, ['22', '220', '221', '23']))
    );
    const taxLiabChangeCents = taxLiabAccounts.reduce((sum: number, a: any) => {
      const change = toCents((a.calculated_balance || 0) - (a.opening_balance || 0));
      const sign = a.normal_balance === 'credit' ? 1 : -1;
      return sum + (change * sign);
    }, 0);
    operatingTotalCents += taxLiabChangeCents; // Increase in tax liability provides cash
    
    // ========== INVESTING ACTIVITIES ==========
    // CRITICAL: Exclude accumulated depreciation accounts - these are NON-CASH contra-assets
    // Accumulated depreciation is already handled in Operating Activities as an add-back
    
    /**
     * CAPEX DETECTION PATTERNS:
     * Supports multiple Chart of Accounts structures:
     * - DAPRO/Legacy CoA: 15xx, 16xx, 17xx prefixes for fixed assets
     * - Kairos/Modern CoA: 1-02-xxx prefixes for fixed assets
     */
    const isFixedAssetByCode = (code: string) => {
      // Legacy numeric prefixes (15x, 16x, 17x)
      if (codeStartsWith(code, ['15', '150', '151', '152', '153', '16', '160', '17', '170'])) return true;
      // Modern structured prefixes (1-02-xxx for Property Plant Equipment, Intangibles, etc.)
      if (code.startsWith('1-02')) return true;
      return false;
    };
    
    const fixedAssetAccounts = periodData.balances.filter((a: any) =>
      a.account_type === 'asset' && !a.is_header &&
      // Must NOT be accumulated depreciation (contra-asset, non-cash)
      !nameContains(a.name, ['accumulated', 'depreciation', 'amortization', 'accum']) &&
      // Must be a fixed asset type - by code pattern, name keywords, or cash_flow_category
      (isFixedAssetByCode(a.code) ||
       a.cash_flow_category === 'investing' ||
       nameContains(a.name, ['equipment', 'property', 'vehicle', 'furniture', 'computer', 'machinery', 'building', 'land', 'fixture', 'software', 'franchise', 'license', 'patent', 'goodwill']))
    );
    let investingTotalCents = 0;
    fixedAssetAccounts.forEach((a: any) => {
      const change = toCents((a.calculated_balance || 0) - (a.opening_balance || 0));
      investingTotalCents -= change; // Increase in fixed assets = purchase = uses cash
    });
    
    // Investment accounts
    const investmentAccounts = periodData.balances.filter((a: any) => 
      a.account_type === 'asset' && !a.is_header &&
      nameContains(a.name, ['investment', 'securities', 'bonds'])
    );
    investmentAccounts.forEach((a: any) => {
      const change = toCents((a.calculated_balance || 0) - (a.opening_balance || 0));
      investingTotalCents -= change;
    });
    
    // ========== FINANCING ACTIVITIES ==========
    /**
     * LOAN/DEBT ACCOUNTS (Financing Activities)
     * Supports multiple Chart of Accounts structures:
     * - Legacy CoA: 25xx, 26xx, 27xx prefixes
     * - Modern CoA: 2-02-xxx for long-term liabilities, 2-01-108 for shareholder loans
     */
    const isLoanByCode = (code: string) => {
      // Legacy prefixes
      if (codeStartsWith(code, ['25', '250', '26', '260', '27', '270'])) return true;
      // Modern structured prefixes for long-term liabilities
      if (code.startsWith('2-02')) return true;
      // Shareholder/related party loans (often current liability classification)
      if (code.startsWith('2-01-108') || code.startsWith('2-01-106')) return true;
      return false;
    };
    
    const loanAccounts = periodData.balances.filter((a: any) =>
      a.account_type === 'liability' && !a.is_header &&
      !isLeaseLiability(a) &&
      (nameContains(a.name, ['loan', 'note', 'mortgage', 'debt', 'credit line', 'line of credit', 'shareholder', 'related party', 'due to']) || 
       isLoanByCode(a.code)) &&
      !nameContains(a.name, ['credit card'])
    );
    let financingTotalCents = 0;
    loanAccounts.forEach((a: any) => {
      const change = toCents((a.calculated_balance || 0) - (a.opening_balance || 0));
      financingTotalCents += change;
    });
    
    // Lease liabilities → Financing (with non-cash inception pairing)
    const leaseLiabilityAccounts = periodData.balances.filter((a: any) => isLeaseLiability(a));
    const nonCashItems: Array<{ name: string; amount: number }> = [];
    const removedInvestingAssetIds = new Set<string>();
    leaseLiabilityAccounts.forEach((acc: any) => {
      const change = toCents((acc.calculated_balance || 0) - (acc.opening_balance || 0));
      if (Math.abs(change) <= 0) return;
      let nonCashPortion = 0;
      if (change > 0) {
        const matchingAsset = fixedAssetAccounts.find((fa: any) => {
          const faChange = toCents((fa.calculated_balance || 0) - (fa.opening_balance || 0));
          return Math.abs(faChange - change) < 100;
        });
        if (matchingAsset) {
          nonCashPortion = change;
          nonCashItems.push({
            name: `Right-of-use assets acquired through lease obligations (${matchingAsset.name.trim()})`,
            amount: fromCents(change),
          });
          removedInvestingAssetIds.add(matchingAsset.id);
          // Adjust investing total to remove the paired asset entry
          const faChange = toCents((matchingAsset.calculated_balance || 0) - (matchingAsset.opening_balance || 0));
          investingTotalCents -= -faChange; // remove the -change we added earlier
        }
      }
      const cashChange = change - nonCashPortion;
      if (Math.abs(cashChange) > 0) {
        financingTotalCents += cashChange;
      }
    });

    
    // Equity changes (contributions, dividends, distributions, drawings)
    // MUST match useFinancialReports.ts logic for share capital detection
    const equityChangeAccounts = periodData.balances.filter((a: any) => 
      a.account_type === 'equity' && !a.is_header &&
      // Include share capital, paid-in capital, contributions, and distributions
      (nameContains(a.name, [
        'dividend', 'distribution', 'drawing', 'contribution', 'capital', 'owner',
        'stock', 'share', 'paid-in', 'paid in', 'treasury'
      ]) ||
      // Also include by account code pattern (3-00-1xx for share capital accounts)
      a.code?.startsWith('3-00-10')) &&
      // EXCLUDE retained earnings and current year earnings (not cash transactions)
      !nameContains(a.name, ['retained', 'earnings', 'current year', 'accumulated surplus'])
    );
    equityChangeAccounts.forEach((a: any) => {
      const change = toCents((a.calculated_balance || 0) - (a.opening_balance || 0));
      const isDistribution = nameContains(a.name, ['dividend', 'distribution', 'drawing', 'treasury']);
      financingTotalCents += isDistribution ? -change : change;
    });

    // Owner distributions posted directly to Retained Earnings / Accumulated Surplus.
    // ΔRE from current-period Net Income alone = +netIncome (credit-normal equity).
    // Any residual movement is a real cash transaction (owner draw / dividend /
    // prior-period adjustment) and MUST appear in Financing so the CF ties to cash.
    const retainedEarningsAccounts = periodData.balances.filter((a: any) =>
      a.account_type === 'equity' && !a.is_header &&
      nameContains(a.name, ['retained earnings', 'accumulated surplus', 'net assets', 'accumulated deficit'])
    );
    const reMovementCents = retainedEarningsAccounts.reduce((sum: number, a: any) =>
      sum + toCents((a.calculated_balance || 0) - (a.opening_balance || 0)), 0);
    const reDirectMovementCents = reMovementCents - netIncomeCents;
    if (Math.abs(reDirectMovementCents) > 0) {
      financingTotalCents += reDirectMovementCents;
    }
    
    // ========== VERIFICATION: Cash Flow Identity ==========
    // Net Change = Operating + Investing + Financing
    // Use ACTUAL cash change from GL (like useFinancialReports.ts) to ensure balance sheet tie-out
    const actualCashChangeCents = endingCashCents - beginningCashCents;
    // (finalCalculatedChangeCents is computed below after building financingItems.)
    
    // Build individual line item arrays for comparative display
    const depreciationItems = depreciationAccounts.map((a: any) => ({
      name: a.name,
      amount: fromCents(toCents(a.calculated_balance || 0)),
    }));

    const investingItems: Array<{ name: string; amount: number }> = [];
    fixedAssetAccounts.forEach((a: any) => {
      if (removedInvestingAssetIds.has(a.id)) return;
      const change = toCents((a.calculated_balance || 0) - (a.opening_balance || 0));
      if (Math.abs(change) > 0) {
        investingItems.push({ name: a.name, amount: fromCents(-change) });
      }
    });
    investmentAccounts.forEach((a: any) => {
      const change = toCents((a.calculated_balance || 0) - (a.opening_balance || 0));
      if (Math.abs(change) > 0) {
        investingItems.push({ name: a.name, amount: fromCents(-change) });
      }
    });

    const financingItems: Array<{ name: string; amount: number }> = [];
    loanAccounts.forEach((a: any) => {
      const change = toCents((a.calculated_balance || 0) - (a.opening_balance || 0));
      if (Math.abs(change) > 0) {
        financingItems.push({
          name: change > 0 ? `Proceeds from ${a.name}` : `Repayment of ${a.name}`,
          amount: fromCents(change),
        });
      }
    });
    leaseLiabilityAccounts.forEach((acc: any) => {
      const change = toCents((acc.calculated_balance || 0) - (acc.opening_balance || 0));
      if (Math.abs(change) <= 0) return;
      const matchingAsset = fixedAssetAccounts.find((fa: any) => {
        const faChange = toCents((fa.calculated_balance || 0) - (fa.opening_balance || 0));
        return Math.abs(faChange - change) < 100;
      });
      const nonCashPortion = change > 0 && matchingAsset ? change : 0;
      const cashChange = change - nonCashPortion;
      if (Math.abs(cashChange) > 0) {
        financingItems.push({
          name: cashChange < 0 ? 'Principal payments on lease obligations' : 'Proceeds from new lease obligations',
          amount: fromCents(cashChange),
        });
      }
    });
    equityChangeAccounts.forEach((a: any) => {
      const change = toCents((a.calculated_balance || 0) - (a.opening_balance || 0));
      if (Math.abs(change) > 0) {
        const isDistribution = nameContains(a.name, ['dividend', 'distribution', 'drawing', 'treasury']);
        financingItems.push({ name: a.name, amount: fromCents(isDistribution ? -change : change) });
      }
    });
    if (Math.abs(reDirectMovementCents) > 0) {
      financingItems.push({
        name: reDirectMovementCents < 0
          ? 'Owner distributions / dividends (posted to Retained Earnings)'
          : 'Owner contributions (posted to Retained Earnings)',
        amount: fromCents(reDirectMovementCents),
      });
    }

    // Recompute after RE reclassification changed financingTotalCents
    const finalCalculatedChangeCents = operatingTotalCents + investingTotalCents + financingTotalCents;


    return {
      beginningCash: fromCents(beginningCashCents),
      endingCash: fromCents(endingCashCents),
      netChange: fromCents(actualCashChangeCents),
      netIncome: fromCents(netIncomeCents),
      netOperating: fromCents(operatingTotalCents),
      arChange: fromCents(-arChangeCents),
      apChange: fromCents(apChangeCents),
      taxLiabChange: fromCents(taxLiabChangeCents),
      netInvesting: fromCents(investingTotalCents),
      netFinancing: fromCents(financingTotalCents),
      calculatedChange: fromCents(finalCalculatedChangeCents),
      isReconciled: Math.abs(actualCashChangeCents - finalCalculatedChangeCents) < 1,
      // Individual line items for comparative display
      depreciation: fromCents(depreciationCents),
      depreciationItems,
      investingItems,
      financingItems,
      nonCashItems,

      inventoryChange: fromCents(-inventoryChangeCents),
      prepaidChange: fromCents(-prepaidChangeCents),
    };
  };

  // Build line items for the table
  const lineItems = useMemo((): CashFlowLineItem[] => {
    const items: CashFlowLineItem[] = [];
    
    // Calculate comparison amounts if comparison is enabled
    const comparisonAmounts = comparativeData?.slice(1).map(pd => {
      const cfData = calculateCashFlowForPeriod(pd);
      return cfData;
    }) || [];
    
    // Beginning Cash Balance
    items.push({
      id: 'beginning-cash',
      name: 'Beginning Cash Balance',
      amount: cashFlowData.beginningCash,
      comparisonAmounts: comparisonAmounts.map(c => c?.beginningCash || 0),
      isGrandTotal: true,
    });
    
    // Operating Activities Section
    items.push({
      id: 'operating-header',
      name: 'Cash Flow from Operating Activities',
      amount: 0,
      isSection: true,
    });
    
    // Net Income first (in operating activities)
    const netIncomeItem = cashFlowData.operatingActivities.find(a => a.name === 'Net Income');
    if (netIncomeItem) {
      items.push({
        id: 'net-income',
        name: netIncomeLabel,
        amount: netIncomeItem.amount,
        comparisonAmounts: comparisonAmounts.map(c => c?.netIncome || 0),
        indent: 1,
        isClickable: true,
      });
    }
    
    // Non-cash adjustments subsection
    const nonCashItems = cashFlowData.operatingActivities.filter(a => 
      a.name.toLowerCase().includes('depreciation') || 
      a.name.toLowerCase().includes('amortization') ||
      a.name.toLowerCase().includes('add:')
    );
    
    // Check if comparative periods have depreciation items
    const hasComparativeDepreciation = comparisonAmounts.some(c => 
      c?.depreciationItems && c.depreciationItems.length > 0
    );

    if (nonCashItems.length > 0 || hasComparativeDepreciation) {
      items.push({
        id: 'non-cash-header',
        name: 'Non-cash adjustments',
        amount: 0,
        isSubSection: true,
        indent: 1,
      });
      
      const currentNonCashNames = new Set<string>();
      nonCashItems.forEach((item, idx) => {
        const itemName = item.name.replace('Add: ', '');
        currentNonCashNames.add(itemName);
        const compAmounts = comparisonAmounts.map(c => {
          if (!c?.depreciationItems) return 0;
          const match = c.depreciationItems.find((d: any) => d.name === itemName || d.name === item.name);
          return match?.amount || 0;
        });
        items.push({
          id: `non-cash-${idx}`,
          name: itemName,
          amount: item.amount,
          comparisonAmounts: compAmounts,
          indent: 2,
          isClickable: true,
        });
      });

      // Add depreciation items that only exist in comparative periods
      const comparativeOnlyDepNames = new Set<string>();
      comparisonAmounts.forEach(c => {
        c?.depreciationItems?.forEach((item: any) => {
          if (!currentNonCashNames.has(item.name)) {
            comparativeOnlyDepNames.add(item.name);
          }
        });
      });
      comparativeOnlyDepNames.forEach(name => {
        const compAmounts = comparisonAmounts.map(c => {
          if (!c?.depreciationItems) return 0;
          const match = c.depreciationItems.find((d: any) => d.name === name);
          return match?.amount || 0;
        });
        if (compAmounts.some(a => Math.abs(a) > 0.01)) {
          items.push({
            id: `non-cash-comp-${name}`,
            name,
            amount: 0,
            comparisonAmounts: compAmounts,
            indent: 2,
            isClickable: true,
          });
        }
      });
      
      const nonCashTotal = nonCashItems.reduce((sum, item) => sum + item.amount, 0);
      items.push({
        id: 'non-cash-total',
        name: 'Non-cash adjustments Total',
        amount: nonCashTotal,
        comparisonAmounts: comparisonAmounts.map(c => c?.depreciation || 0),
        isSubTotal: true,
        indent: 1,
      });
    }
    
    // Working capital changes - with comparative amounts
    const workingCapitalItems = cashFlowData.operatingActivities.filter(a => 
      a.name !== 'Net Income' && 
      !a.name.toLowerCase().includes('depreciation') && 
      !a.name.toLowerCase().includes('amortization') &&
      !a.name.toLowerCase().includes('add:')
    );
    
    workingCapitalItems.forEach((item, idx) => {
      // Map working capital items to comparative data
      let compAmounts: number[] = [];
      const lowerName = item.name.toLowerCase();
      if (lowerName.includes('receivable')) {
        compAmounts = comparisonAmounts.map(c => c?.arChange || 0);
      } else if (lowerName.includes('inventory')) {
        compAmounts = comparisonAmounts.map(c => c?.inventoryChange || 0);
      } else if (lowerName.includes('prepaid')) {
        compAmounts = comparisonAmounts.map(c => c?.prepaidChange || 0);
      } else if (lowerName.includes('payable') && !lowerName.includes('tax')) {
        compAmounts = comparisonAmounts.map(c => c?.apChange || 0);
      } else if (lowerName.includes('tax')) {
        compAmounts = comparisonAmounts.map(c => c?.taxLiabChange || 0);
      }
      
      items.push({
        id: `working-capital-${idx}`,
        name: item.name,
        amount: item.amount,
        comparisonAmounts: compAmounts,
        indent: 1,
        isClickable: true,
      });
    });
    
    // Net cash provided by Operating Activities
    items.push({
      id: 'operating-total',
      name: 'Net cash provided by Operating Activities',
      amount: cashFlowData.netOperating,
      comparisonAmounts: comparisonAmounts.map(c => c?.netOperating || 0),
      isSectionTotal: true,
    });
    
    // Investing Activities Section
    items.push({
      id: 'investing-header',
      name: 'Cash Flow from Investing Activities',
      amount: 0,
      isSection: true,
    });
    
    // Group investing activities by asset category
    const investingByCategory = new Map<string, { items: typeof cashFlowData.investingActivities; total: number }>();
    cashFlowData.investingActivities.forEach(item => {
      // Extract base asset name (remove "Purchase of" or "Sale of" prefix)
      const baseName = item.name.replace(/^(Purchase of |Sale of )/, '');
      if (!investingByCategory.has(baseName)) {
        investingByCategory.set(baseName, { items: [], total: 0 });
      }
      const category = investingByCategory.get(baseName)!;
      category.items.push(item);
      category.total += item.amount;
    });
    
    investingByCategory.forEach((category, baseName) => {
      // Build comparison amounts for this asset category
      const compAmounts = comparisonAmounts.map(c => {
        if (!c?.investingItems) return 0;
        return c.investingItems
          .filter((i: any) => i.name === baseName || i.name.includes(baseName) || baseName.includes(i.name))
          .reduce((sum: number, i: any) => sum + i.amount, 0);
      });

      if (category.items.length === 1) {
        items.push({
          id: `investing-${baseName}`,
          name: baseName,
          amount: category.items[0].amount,
          comparisonAmounts: compAmounts,
          indent: 1,
          isClickable: true,
        });
      } else {
        // Multiple items - show as expandable group
        items.push({
          id: `investing-group-${baseName}`,
          name: baseName,
          amount: 0,
          indent: 1,
          isClickable: true,
        });
        
        category.items.forEach((item, idx) => {
          const subName = item.name.startsWith('Purchase') ? 'Purchases' : 
                         item.name.startsWith('Sale') ? 'Sales' : item.name;
          items.push({
            id: `investing-${baseName}-${idx}`,
            name: subName,
            amount: item.amount,
            indent: 2,
            isClickable: true,
          });
        });
        
        items.push({
          id: `investing-${baseName}-total`,
          name: `Total for ${baseName}`,
          amount: category.total,
          isSubTotal: true,
          indent: 1,
        });
      }
    });

    // Add investing items that only exist in comparative periods (not in current period)
    const currentInvestingNames = new Set(
      Array.from(investingByCategory.keys())
    );
    const comparativeOnlyInvestingNames = new Set<string>();
    comparisonAmounts.forEach(c => {
      c?.investingItems?.forEach((item: any) => {
        if (!currentInvestingNames.has(item.name)) {
          comparativeOnlyInvestingNames.add(item.name);
        }
      });
    });
    comparativeOnlyInvestingNames.forEach(name => {
      const compAmounts = comparisonAmounts.map(c => {
        if (!c?.investingItems) return 0;
        const match = c.investingItems.find((i: any) => i.name === name);
        return match?.amount || 0;
      });
      // Only show if at least one comparative period has a non-zero amount
      if (compAmounts.some(a => Math.abs(a) > 0.01)) {
        items.push({
          id: `investing-comp-${name}`,
          name,
          amount: 0,
          comparisonAmounts: compAmounts,
          indent: 1,
          isClickable: true,
        });
      }
    });
    
    // Net cash provided by Investing Activities
    items.push({
      id: 'investing-total',
      name: 'Net cash provided by Investing Activities',
      amount: cashFlowData.netInvesting,
      comparisonAmounts: comparisonAmounts.map(c => c?.netInvesting || 0),
      isSectionTotal: true,
    });
    
    // Financing Activities Section
    items.push({
      id: 'financing-header',
      name: 'Cash Flow from Financing Activities',
      amount: 0,
      isSection: true,
    });
    
    cashFlowData.financingActivities.forEach((item, idx) => {
      const compAmounts = comparisonAmounts.map(c => {
        if (!c?.financingItems) return 0;
        const match = c.financingItems.find((f: any) => f.name === item.name);
        return match?.amount || 0;
      });
      items.push({
        id: `financing-${idx}`,
        name: item.name,
        amount: item.amount,
        comparisonAmounts: compAmounts,
        indent: 1,
        isClickable: true,
      });
    });

    // Add financing items that only exist in comparative periods
    const currentFinancingNames = new Set(
      cashFlowData.financingActivities.map(item => item.name)
    );
    const comparativeOnlyFinancingNames = new Set<string>();
    comparisonAmounts.forEach(c => {
      c?.financingItems?.forEach((item: any) => {
        if (!currentFinancingNames.has(item.name)) {
          comparativeOnlyFinancingNames.add(item.name);
        }
      });
    });
    comparativeOnlyFinancingNames.forEach(name => {
      const compAmounts = comparisonAmounts.map(c => {
        if (!c?.financingItems) return 0;
        const match = c.financingItems.find((f: any) => f.name === name);
        return match?.amount || 0;
      });
      if (compAmounts.some(a => Math.abs(a) > 0.01)) {
        items.push({
          id: `financing-comp-${name}`,
          name,
          amount: 0,
          comparisonAmounts: compAmounts,
          indent: 1,
          isClickable: true,
        });
      }
    });
    
    // Net cash provided by Financing Activities
    items.push({
      id: 'financing-total',
      name: 'Net cash provided by Financing Activities',
      amount: cashFlowData.netFinancing,
      comparisonAmounts: comparisonAmounts.map(c => c?.netFinancing || 0),
      isSectionTotal: true,
    });
    
    // Net Change in cash
    items.push({
      id: 'net-change',
      name: 'Net Change in cash',
      amount: cashFlowData.netChange,
      comparisonAmounts: comparisonAmounts.map(c => c?.netChange || 0),
      isGrandTotal: true,
    });
    
    // Ending Cash Balance - use actual ending cash from GL, not calculated
    items.push({
      id: 'ending-cash',
      name: 'Ending Cash Balance',
      amount: cashFlowData.endingCash,
      comparisonAmounts: comparisonAmounts.map(c => c?.endingCash || 0),
      isGrandTotal: true,
    });
    
    // ===== Supplemental Disclosure of Non-Cash Investing and Financing Activities =====
    // Required under ASPE §1540.46 / IAS 7.43 / ASC 230-10-50-3
    const currentNonCash = cashFlowData.nonCashActivities || [];
    const hasCurrentNonCash = currentNonCash.length > 0;
    const hasCompNonCash = comparisonAmounts.some(c => (c?.nonCashItems?.length ?? 0) > 0);
    
    if (hasCurrentNonCash || hasCompNonCash) {
      items.push({
        id: 'noncash-header',
        name: 'Supplemental Disclosure of Non-Cash Investing and Financing Activities',
        amount: 0,
        isSection: true,
      });
      
      // Union of names across current + comparative
      const nonCashNames = new Set<string>();
      currentNonCash.forEach(i => nonCashNames.add(i.name));
      comparisonAmounts.forEach(c => c?.nonCashItems?.forEach((i: any) => nonCashNames.add(i.name)));
      
      nonCashNames.forEach(name => {
        const currentAmt = currentNonCash.find(i => i.name === name)?.amount || 0;
        const compAmts = comparisonAmounts.map(c => c?.nonCashItems?.find((i: any) => i.name === name)?.amount || 0);
        items.push({
          id: `noncash-${name}`,
          name,
          amount: currentAmt,
          comparisonAmounts: compAmts,
          indent: 1,
        });
      });
    }
    

    
    return items;
  }, [cashFlowData, comparativeData]);

  // Export functions
  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(10);
    doc.setTextColor(128);
    doc.text(organization?.name?.toUpperCase() || 'ORGANIZATION', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text('Statement of Cash Flows', pageWidth / 2, 30, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(128);
    doc.text(`From ${formatLocalDate(dateFrom)} To ${formatLocalDate(dateTo)}`, pageWidth / 2, 38, { align: 'center' });
    
    let yPos = 50;
    const leftMargin = 20;
    const amountCol = 150;
    
    lineItems.forEach(item => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      
      const indent = (item.indent || 0) * 10;
      
      if (item.isSection) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
      } else if (item.isSectionTotal || item.isGrandTotal) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
      } else if (item.isSubSection || item.isSubTotal) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
      }
      
      doc.setTextColor(item.isClickable ? 0 : 0, item.isClickable ? 102 : 0, item.isClickable ? 204 : 0);
      doc.text(item.name, leftMargin + indent, yPos);
      
      if (!item.isSection || item.amount !== 0) {
        doc.setTextColor(0);
        doc.text(formatCurrency(item.amount), amountCol, yPos, { align: 'right' });
      }
      
      yPos += 7;
    });
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(`**Amount is displayed in your base currency CAD`, leftMargin, 285);
    
    doc.save(`cash-flow-statement-${formatLocalDate(new Date())}.pdf`);
  };

  const handleExportExcel = () => {
    // Build comparison period headers
    const compPeriods = comparison.enabled ? comparisonPeriods : [];
    const headers = ['Account', format(dateFrom, 'MMM yyyy').toUpperCase()];
    compPeriods.forEach(period => {
      headers.push(format(period.startDate, 'MMM yyyy').toUpperCase());
    });
    
    // Build rows with proper formatting
    const rows: (string | number)[][] = lineItems.map(item => {
      const indent = '  '.repeat(item.indent || 0);
      const row: (string | number)[] = [
        indent + item.name,
        item.isSection && item.amount === 0 ? '' : item.amount
      ];
      
      // Add comparison amounts
      if (comparison.enabled && item.comparisonAmounts) {
        item.comparisonAmounts.forEach(amt => {
          row.push(amt);
        });
      }
      
      return row;
    });
    
    // Export with formatted Excel
    exportToFormattedExcel({
      title: 'Statement of Cash Flows',
      organizationName: organization?.name,
      dateRange: `From ${formatLocalDate(dateFrom)} To ${formatLocalDate(dateTo)}`,
      headers,
      rows,
      totals: [
        { label: 'Net Change in Cash', value: cashFlowData.netChange },
        { label: 'Ending Cash Balance', value: cashFlowData.endingCash },
      ],
    });
  };

  const handlePrint = () => {
    window.print();
  };

  // Loading state
  if (orgLoading || isLoading || (comparison.enabled && isLoadingComparative)) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  // No organization state
  if (!organization) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Building2 className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Organization Found</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Create an organization to view cash flow statements.
        </p>
        <Button onClick={() => setShowOrgDialog(true)}>Create Organization</Button>
        <CreateOrganizationDialog open={showOrgDialog} onOpenChange={setShowOrgDialog} />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Building2 className="w-16 h-16 text-destructive" />
        <h2 className="text-xl font-semibold">Error Loading Data</h2>
        <p className="text-muted-foreground text-center max-w-md">
          {error instanceof Error ? error.message : 'Failed to load financial data. Please try refreshing the page.'}
        </p>
      </div>
    );
  }

  // Format period label to show date range for header (e.g., "Jan 1 - Jan 31, 2025")
  const periodLabel = `${format(dateFrom, 'MMM d')} - ${format(dateTo, 'MMM d, yyyy')}`.toUpperCase();

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Tabs Navigation */}
      <div className="flex items-center justify-between gap-3 print:hidden">
        <ReportsTabs />
        <RealtimeIndicator lastEventAt={realtimeLastEventAt} />
      </div>

      {/* Show Zero Balances Toggle */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground print:hidden">
        <Switch
          checked={showZeroBalances}
          onCheckedChange={setShowZeroBalances}
          id="show-zero-balances"
        />
        <Label htmlFor="show-zero-balances" className="cursor-pointer">Show Zero Balances</Label>
      </div>

      {/* Filter Bar - Zoho Style */}
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        {/* Date Preset Dropdown */}
        <Select value={datePreset} onValueChange={(v) => handlePresetChange(v as DatePreset)}>
          <SelectTrigger className="w-36 h-9 bg-background border-border rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fiscal-year-to-date">Fiscal Year to Date</SelectItem>
            <SelectItem value="last-fiscal-year">Last Fiscal Year</SelectItem>
            <SelectItem value="this-month">This Month</SelectItem>
            <SelectItem value="last-month">Last Month</SelectItem>
            <SelectItem value="this-quarter">This Quarter</SelectItem>
            <SelectItem value="last-quarter">Last Quarter</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>

        {/* Date Range Button */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2 rounded-full border-border">
              <CalendarDays className="w-4 h-4" />
              {format(dateFrom, 'MMM d, yyyy')} - {format(dateTo, 'MMM d, yyyy')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4" align="start">
            <div className="flex gap-4">
              <div className="space-y-2">
                <Label>From</Label>
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={(date) => {
                    if (date) {
                      setDateFrom(date);
                      setDatePreset('custom');
                    }
                  }}
                  initialFocus
                  className="pointer-events-auto"
                />
              </div>
              <div className="space-y-2">
                <Label>To</Label>
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={(date) => {
                    if (date) {
                      setDateTo(date);
                      setDatePreset('custom');
                    }
                  }}
                  className="pointer-events-auto"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Division Filter */}
        <DivisionFilter value={divisionIds} onChange={setDivisionIds} />

        {/* Run Report Button */}
        <Button size="sm" className="h-9 bg-primary hover:bg-primary/90 rounded-md gap-1">
          <Play className="w-3 h-3" />
          Run Report
        </Button>

        {/* Compare Button */}
        {comparison.enabled ? (
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 gap-2 rounded-md border-primary text-primary"
            onClick={handleOpenCompareDialog}
          >
            <ArrowLeftRight className="w-4 h-4" />
            Comparing: {comparison.count} {comparison.type === 'years' ? 'Year' : 'Period'}{comparison.count > 1 ? 's' : ''}
            <X 
              className="w-3 h-3 ml-1 hover:text-destructive" 
              onClick={(e) => {
                e.stopPropagation();
                handleClearComparison();
              }}
            />
          </Button>
        ) : (
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 gap-2 rounded-md"
            onClick={handleOpenCompareDialog}
          >
            <ArrowLeftRight className="w-4 h-4" />
            Compare
          </Button>
        )}

        {/* Export Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2 rounded-md">
              <FileText className="w-4 h-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportPDF}>
              <FileText className="w-4 h-4 mr-2" />
              Export as PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportExcel}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Export as Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Share Button */}
        <Button variant="outline" size="sm" className="h-9 gap-2 rounded-md">
          <Share2 className="w-4 h-4" />
          Share
        </Button>

        {/* Print Button */}
        <Button variant="outline" size="sm" className="h-9 gap-2 rounded-md" onClick={handlePrint}>
          <Printer className="w-4 h-4" />
          Print
        </Button>
      </div>

      {/* Compare With Dialog */}
      <Dialog open={showCompareDialog} onOpenChange={setShowCompareDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Compare With</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Compare current period with previous periods or years
            </p>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="compare-type">Compare Based on Period/Year</Label>
              <Select 
                value={tempComparison.type} 
                onValueChange={(v) => setTempComparison(prev => ({ ...prev, type: v as CompareType }))}
              >
                <SelectTrigger id="compare-type" className="w-full border-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="periods">Previous Period(s)</SelectItem>
                  <SelectItem value="years">Previous Year(s)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="compare-count">
                Number of {tempComparison.type === 'years' ? 'Year' : 'Period'}(s)
              </Label>
              <Input
                id="compare-count"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={tempComparison.count}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  const num = parseInt(val) || 1;
                  setTempComparison(prev => ({ ...prev, count: Math.min(Math.max(num, 1), 999) }));
                }}
                className="w-full"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="latest-to-oldest"
                checked={tempComparison.latestToOldest}
                onCheckedChange={(checked) => 
                  setTempComparison(prev => ({ ...prev, latestToOldest: checked === true }))
                }
              />
              <Label htmlFor="latest-to-oldest" className="text-sm cursor-pointer">
                Arrange period/year from latest to oldest
              </Label>
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setShowCompareDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleApplyComparison} className="bg-primary hover:bg-primary/90">
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Content */}
      <Card className="overflow-hidden">
        {/* Report Header */}
        <div className="text-center py-6 border-b border-border bg-card">
          <p className="text-xs text-muted-foreground tracking-wider uppercase mb-2">
            {organization?.name}
          </p>
          <h1 className="text-xl font-semibold text-foreground">Statement of Cash Flows</h1>
        </div>

        {/* Report Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border">
                <TableHead className="w-[50%]">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                  >
                    ACCOUNT
                    {sortDirection === 'asc' ? (
                      <ChevronUp className="w-3 h-3 ml-1" />
                    ) : (
                      <ChevronDown className="w-3 h-3 ml-1" />
                    )}
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <div className="text-right text-muted-foreground text-xs">
                    {periodLabel}
                  </div>
                  <div className="text-right text-muted-foreground text-xs font-medium mt-1">
                    TOTAL
                  </div>
                </TableHead>
                {comparison.enabled && getComparisonLabels.map((comp, idx) => (
                  <TableHead key={idx} className="text-right">
                    <div className="text-right text-muted-foreground text-xs">
                      {format(comp.dateFrom, 'MMM yyyy').toUpperCase()}
                    </div>
                    <div className="text-right text-muted-foreground text-xs font-medium mt-1">
                      TOTAL
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.map((item) => {
                // Track which section each item belongs to for collapse filtering
                const isOperatingItem = item.id.includes('operating') || item.id.includes('net-income') || item.id.includes('non-cash') || item.id.includes('working-capital');
                const isInvestingItem = item.id.includes('investing');
                const isFinancingItem = item.id.includes('financing');
                
                // Skip non-section items if their section is collapsed
                if (!item.isSection && !item.isSectionTotal && !item.isGrandTotal) {
                  if (isOperatingItem && !isSectionExpanded('operating-header')) return null;
                  if (isInvestingItem && !isSectionExpanded('investing-header')) return null;
                  if (isFinancingItem && !isSectionExpanded('financing-header')) return null;
                }
                
                // Get section total for collapsed display
                const sectionTotal = item.isSection ? (
                  item.id === 'operating-header' ? cashFlowData.netOperating :
                  item.id === 'investing-header' ? cashFlowData.netInvesting :
                  item.id === 'financing-header' ? cashFlowData.netFinancing : 0
                ) : 0;
                
                const isExpanded = item.isSection ? isSectionExpanded(item.id) : true;
                
                return (
                <TableRow 
                  key={item.id}
                  className={cn(
                    "hover:bg-muted/30 border-0",
                    item.isSection && "bg-transparent cursor-pointer hover:bg-muted/40",
                    item.isSectionTotal && "border-t border-border",
                    item.isGrandTotal && "border-t border-border bg-muted/20"
                  )}
                  onClick={item.isSection ? () => toggleSection(item.id) : undefined}
                >
                  <TableCell 
                    className={cn(
                      "py-2",
                      item.isSection && "font-semibold text-foreground pt-4",
                      item.isSubSection && "font-medium text-foreground",
                      item.isSectionTotal && "font-semibold text-foreground",
                      item.isSubTotal && "font-medium text-muted-foreground",
                      item.isGrandTotal && "font-semibold text-foreground",
                      item.isClickable && !item.isSection && "text-primary cursor-pointer hover:underline"
                    )}
                    style={{ paddingLeft: `${16 + (item.indent || 0) * 24}px` }}
                  >
                    <span className="flex items-center gap-1">
                      {item.isSection && (
                        isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )
                      )}
                      {item.isClickable && !item.isSection && !item.isSubSection && (
                        <span className="text-primary">● </span>
                      )}
                      {item.name}
                    </span>
                  </TableCell>
                  <TableCell 
                    className={cn(
                      "py-2 text-right font-mono tabular-nums",
                      item.isSection && item.amount === 0 && "text-transparent",
                      item.isSectionTotal && "font-semibold",
                      item.isSubTotal && "font-medium",
                      item.isGrandTotal && "font-semibold",
                      item.amount < 0 && "text-foreground"
                    )}
                  >
                    {item.isSection && item.amount === 0 ? '' : formatCurrency(item.amount)}
                  </TableCell>
                  {comparison.enabled && getComparisonLabels.map((_, idx) => (
                    <TableCell 
                      key={idx}
                      className={cn(
                        "py-2 text-right font-mono tabular-nums",
                        item.isSection && item.amount === 0 && "text-transparent",
                        item.isSectionTotal && "font-semibold",
                        item.isGrandTotal && "font-semibold",
                        (item.comparisonAmounts?.[idx] ?? 0) < 0 && "text-foreground"
                      )}
                    >
                      {item.isSection && item.amount === 0 ? '' : formatCurrency(item.comparisonAmounts?.[idx] ?? 0)}
                    </TableCell>
                  ))}
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border bg-muted/20">
          <p className="text-xs text-muted-foreground">
            **Amount is displayed in your base currency{' '}
            <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0 bg-success/20 text-success border-success/30">
              CAD
            </Badge>
          </p>
        </div>
      </Card>

      <ExecutiveSignatureBlock
        statementType="cash_flow"
        statementTitle="Statement of Cash Flows"
        periodStart={dateFrom}
        periodEnd={dateTo}
      />
    </div>
  );
}
