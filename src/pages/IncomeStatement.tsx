import { useMemo, useState, useEffect } from 'react';
import { Building2, ChevronRight, ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ReportsTabs } from '@/components/reports/ReportsTabs';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ReportActions, ReportData } from '@/components/reports/ReportActions';
import { useFinancialReports } from '@/hooks/useFinancialReports';
import { RealtimeIndicator } from '@/components/reports/RealtimeIndicator';
import { useComparativeFinancialReports } from '@/hooks/useComparativeFinancialReports';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useReportFilters } from '@/hooks/useReportFilters';
import { useNpoTerminology } from '@/hooks/useNpoTerminology';
import { AmountDrilldownDialog } from '@/components/reports/AmountDrilldownDialog';
import { DivisionFilter } from '@/components/reports/DivisionFilter';
import { ExecutiveSignatureBlock } from '@/components/reports/ExecutiveSignatureBlock';

// Helper to format date in local timezone (avoids UTC conversion issues)
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
};

// Helper to format date as MMM YYYY in local timezone
const formatLocalMonthYear = (date: Date): string => {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
};

/**
 * ============================================================================
 * INCOME STATEMENT (PROFIT & LOSS) - GAAP/ASPE COMPLIANT
 * ============================================================================
 * 
 * The Income Statement follows these FORMULAS per Canadian GAAP:
 * 
 * OPERATING INCOME (Revenue):
 *   = Sum of all 4xxx account balances
 *   = Sales + Service Revenue + Interest Income
 * 
 * COST OF GOODS SOLD (COGS):
 *   = Sum of all 5xxx account balances
 *   = Direct costs of producing goods sold
 * 
 * GROSS PROFIT:
 *   = Operating Income - COGS
 * 
 * OPERATING EXPENSES:
 *   = Sum of all 6xxx account balances
 *   = Rent + Utilities + Wages + Depreciation + etc.
 * 
 * OPERATING PROFIT (Operating Income):
 *   = Gross Profit - Operating Expenses
 * 
 * NON-OPERATING INCOME:
 *   = Sum of all 7xxx income account balances
 *   = Gains on sale of assets + Other income
 * 
 * NON-OPERATING EXPENSES:
 *   = Sum of all 7xxx-9xxx expense account balances
 *   = Interest expense + Losses + Extraordinary items
 * 
 * NET PROFIT/LOSS:
 *   = Operating Profit + Non-Operating Income - Non-Operating Expenses
 * 
 * KEY RELATIONSHIPS:
 *   - Net Profit/Loss → Balance Sheet's "Current Year Earnings"
 *   - Net Profit/Loss → Cash Flow Statement's starting point (Operating Activities)
 *   - Net Profit/Loss → Changes in Equity statement
 * 
 * ============================================================================
 */

export default function IncomeStatement() {
  // Use shared report filters
  const { 
    startDate, 
    endDate, 
    showZeroBalances, 
    compareSettings,
    fiscalYearEndMonth,
    setDateRange,
    setShowZeroBalances,
    setCompareSettings,
    setFiscalYearEndMonth
  } = useReportFilters();
  
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  
  // Collapsible section states
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    operatingIncome: true,
    cogs: true,
    operatingExpense: true,
    nonOperatingIncome: true,
    nonOperatingExpense: true,
    incomeTax: true,
  });
  
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };
  
  const expandAllSections = () => {
    setExpandedSections({ operatingIncome: true, cogs: true, operatingExpense: true, nonOperatingIncome: true, nonOperatingExpense: true, incomeTax: true });
  };
  
  const collapseAllSections = () => {
    setExpandedSections({ operatingIncome: false, cogs: false, operatingExpense: false, nonOperatingIncome: false, nonOperatingExpense: false, incomeTax: false });
  };
  
  const { organization, isLoading: orgLoading } = useCurrentOrganization();

  // Drilldown state — double-click an amount to see underlying journal entries.
  const [drilldown, setDrilldown] = useState<{ accountId: string; name: string } | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('drill') === '1' && p.get('acc')) {
      setDrilldown({ accountId: p.get('acc')!, name: p.get('name') || 'Account' });
    }
  }, []);
  
  // Sync fiscal year end month from organization
  useEffect(() => {
    if (organization?.fiscal_year_end_month) {
      setFiscalYearEndMonth(organization.fiscal_year_end_month);
    }
  }, [organization?.fiscal_year_end_month, setFiscalYearEndMonth]);
  
  const [divisionIds, setDivisionIds] = useState<string[]>([]);
  const { error, getIncomeStatementData, dateRange, refetch, realtimeLastEventAt } = useFinancialReports({
    startDate,
    endDate,
    departmentIds: divisionIds,
  });
  const incomeData = getIncomeStatementData();

  const handleDateRangeChange = (start: Date, end: Date) => {
    setDateRange(start, end);
  };

  const handleRunReport = () => {
    refetch();
  };

  const { formatCurrency } = useCurrencyFormatter();
  const { npoTerms, isNpo } = useNpoTerminology();

  // NPO-aware labels (ASNPO Sections 4400–4470)
  // ASNPO uses Revenue / Expenses / Excess (Deficiency) — no Gross Profit, COGS, or Operating Income subtotals.
  const reportTitle = isNpo ? (npoTerms?.incomeStatement || 'Statement of Operations') : 'Profit and Loss';
  const netIncomeLabel = isNpo ? (npoTerms?.netIncome || 'Excess (Deficiency) of Revenue over Expenses') : 'Net Profit/Loss';
  const operatingIncomeLabel = isNpo ? 'Revenue' : 'Operating Income';
  const totalRevenueLabel = isNpo ? (npoTerms?.totalRevenue || 'Total Revenue') : 'Total for Operating Income';
  const operatingExpenseLabel = isNpo ? (npoTerms?.operatingExpenses || 'Expenses') : 'Operating Expense';
  const totalExpensesLabel = isNpo ? 'Total Expenses' : 'Total Operating Expenses';
  const grossProfitLabel = isNpo ? '' : 'Gross Profit';
  const operatingProfitLabel = isNpo ? '' : 'Operating Profit';

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
        // Previous years
        periodStart = new Date(startDate.getFullYear() - i, startDate.getMonth(), startDate.getDate());
        periodEnd = new Date(endDate.getFullYear() - i, endDate.getMonth(), endDate.getDate());
        label = `${formatLocalMonthYear(periodStart)} - ${formatLocalMonthYear(periodEnd)}`;
      } else {
        // Previous periods (same duration)
        const durationMs = endDate.getTime() - startDate.getTime();
        periodEnd = new Date(startDate.getTime() - (i - 1) * durationMs - 1);
        periodStart = new Date(periodEnd.getTime() - durationMs);
        label = `${formatLocalMonthYear(periodStart)} - ${formatLocalMonthYear(periodEnd)}`;
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
    getComparativeIncomeStatement,
    isLoading: comparativeLoading 
  } = useComparativeFinancialReports(
    { startDate, endDate },
    comparisonPeriods
  );

  // Get comparative income statement data
  const comparativeIncomeData = getComparativeIncomeStatement();

  /**
   * GAAP/IFRS/ASPE COMPLIANCE: Merge accounts from ALL comparison periods
   * --------------------------------------------------------------------
   * When displaying comparative statements, we must show all accounts that have
   * activity in ANY displayed period, not just the current period. This ensures:
   * 1. Line item totals mathematically equal section totals
   * 2. Users can see historical accounts even if they have no current activity
   * 3. Financial statements are complete and auditable
   */
  const mergedAccountLists = useMemo(() => {
    if (!comparativeIncomeData || comparativeIncomeData.length === 0) {
      return {
        income: incomeData.income,
        cogs: incomeData.cogs,
        expenses: incomeData.expenses,
        otherIncome: incomeData.otherIncome,
        otherExpenses: incomeData.otherExpenses,
        nonOperatingExpenses: incomeData.nonOperatingExpenses ?? [],
        incomeTaxExpenses: incomeData.incomeTaxExpenses ?? [],
      };
    }

    // Helper to merge accounts from all periods, keeping unique by ID
    const mergeAccountsFromPeriods = (
      currentAccounts: typeof incomeData.income,
      getAccountsFromPeriod: (period: typeof comparativeIncomeData[0]) => typeof currentAccounts
    ) => {
      const accountMap = new Map<string, typeof currentAccounts[0]>();
      
      // Add current period accounts first (these have current balances)
      currentAccounts.forEach(acc => {
        accountMap.set(acc.id, acc);
      });
      
      // Add accounts from comparison periods that aren't in current period
      // These accounts have zero current balance but may have comparative balances
      comparativeIncomeData.forEach(periodData => {
        const periodAccounts = getAccountsFromPeriod(periodData);
        periodAccounts.forEach(acc => {
          if (!accountMap.has(acc.id)) {
            // Account exists in comparison period but not current - add with zero current balance
            accountMap.set(acc.id, {
              ...acc,
              calculated_balance: 0, // Zero in current period
            });
          }
        });
      });
      
      // Sort by account code for consistent display
      return Array.from(accountMap.values()).sort((a, b) => a.code.localeCompare(b.code));
    };

    return {
      income: mergeAccountsFromPeriods(incomeData.income, p => p.income),
      cogs: mergeAccountsFromPeriods(incomeData.cogs, p => p.cogs),
      expenses: mergeAccountsFromPeriods(incomeData.expenses, p => p.expenses),
      otherIncome: mergeAccountsFromPeriods(incomeData.otherIncome, p => p.otherIncome),
      otherExpenses: mergeAccountsFromPeriods(incomeData.otherExpenses, p => p.otherExpenses),
      nonOperatingExpenses: mergeAccountsFromPeriods(incomeData.nonOperatingExpenses ?? [], p => (p as any).nonOperatingExpenses ?? []),
      incomeTaxExpenses: mergeAccountsFromPeriods(incomeData.incomeTaxExpenses ?? [], p => (p as any).incomeTaxExpenses ?? []),
    };
  }, [incomeData, comparativeIncomeData]);

  /**
   * FORMULA: Operating Profit = Gross Profit - Operating Expenses
   * This represents income from core business operations before non-operating items.
   */
  const operatingProfit = incomeData.grossProfit - incomeData.totalExpenses;

  // Check if sections have data - check merged lists for comprehensive view
  const hasOperatingIncome = mergedAccountLists.income.some(a => !a.is_header && (showZeroBalances || a.calculated_balance !== 0));
  const hasCOGS = mergedAccountLists.cogs.some(a => !a.is_header && (showZeroBalances || a.calculated_balance !== 0));
  const hasOperatingExpense = mergedAccountLists.expenses.some(a => !a.is_header && (showZeroBalances || a.calculated_balance !== 0));
  const hasNonOperatingIncome = mergedAccountLists.otherIncome.some(a => !a.is_header && (showZeroBalances || a.calculated_balance !== 0));
  const hasNonOperatingExpense = mergedAccountLists.nonOperatingExpenses.some(a => !a.is_header && (showZeroBalances || a.calculated_balance !== 0));
  const hasIncomeTax = mergedAccountLists.incomeTaxExpenses.some(a => !a.is_header && (showZeroBalances || a.calculated_balance !== 0));

  // Build report data for export with comparative columns
  const reportData: ReportData = useMemo(() => {
    // Build headers with comparison periods
    const currentPeriodLabel = `${formatLocalMonthYear(dateRange.startDate)} - ${formatLocalMonthYear(dateRange.endDate)}`;
    const headers = ['Account', currentPeriodLabel];
    comparisonPeriods.forEach(period => {
      headers.push(period.label);
    });
    
    const rows: (string | number)[][] = [];
    
    // Helper to format amount - always show value, even if zero
    const formatAmount = (amount: number): string => {
      return formatCurrency(amount);
    };

    // Get comparative data (skip first which is current period)
    const compData = comparativeIncomeData?.slice(1) ?? [];
    
    // Operating Income - use merged account lists for comprehensive comparative view
    rows.push(['Operating Income', '', ...compData.map(() => '')]);
    mergedAccountLists.income.filter(a => !a.is_header).forEach(account => {
      const compAmounts = compData.map(cd => {
        const compAcc = cd.income.find(a => a.id === account.id);
        return formatAmount(compAcc?.calculated_balance ?? 0);
      });
      rows.push([`  ${account.name}`, formatAmount(account.calculated_balance), ...compAmounts]);
    });
    const compTotalRevenue = compData.map(cd => formatAmount(cd.totalRevenue));
    rows.push([totalRevenueLabel, formatAmount(incomeData.totalRevenue), ...compTotalRevenue]);
    
    // COGS - omitted for NPOs (ASNPO classifies all costs as functional Expenses)
    if (!isNpo) {
      rows.push(['', '', ...compData.map(() => '')]);
      rows.push(['Cost of Goods Sold', '', ...compData.map(() => '')]);
      mergedAccountLists.cogs.filter(a => !a.is_header).forEach(account => {
        const compAmounts = compData.map(cd => {
          const compAcc = cd.cogs.find(a => a.id === account.id);
          return formatAmount(compAcc?.calculated_balance ?? 0);
        });
        rows.push([`  ${account.name}`, formatAmount(account.calculated_balance), ...compAmounts]);
      });
      const compTotalCOGS = compData.map(cd => formatAmount(cd.totalCOGS));
      rows.push(['Total for Cost of Goods Sold', formatAmount(incomeData.totalCOGS), ...compTotalCOGS]);
      
      rows.push(['', '', ...compData.map(() => '')]);
      const compGrossProfit = compData.map(cd => formatAmount(cd.grossProfit));
      rows.push(['Gross Profit', formatAmount(incomeData.grossProfit), ...compGrossProfit]);
    }
    
    // Expense section (functional for NPO, operating for for-profit)
    rows.push(['', '', ...compData.map(() => '')]);
    rows.push([operatingExpenseLabel, '', ...compData.map(() => '')]);
    mergedAccountLists.expenses.filter(a => !a.is_header).forEach(account => {
      const compAmounts = compData.map(cd => {
        const compAcc = cd.expenses.find(a => a.id === account.id);
        return formatAmount(compAcc?.calculated_balance ?? 0);
      });
      rows.push([`  ${account.name}`, formatAmount(account.calculated_balance), ...compAmounts]);
    });
    const compTotalExpenses = compData.map(cd => formatAmount(cd.totalExpenses));
    rows.push([totalExpensesLabel, formatAmount(incomeData.totalExpenses), ...compTotalExpenses]);
    
    if (!isNpo) {
      rows.push(['', '', ...compData.map(() => '')]);
      const compOperatingProfit = compData.map(cd => formatAmount(cd.operatingIncome));
      rows.push(['Operating Income', formatAmount(operatingProfit), ...compOperatingProfit]);
    }
    
    // Non-operating Income - use merged account lists
    rows.push(['', '', ...compData.map(() => '')]);
    rows.push(['Non-operating Income', '', ...compData.map(() => '')]);
    mergedAccountLists.otherIncome.filter(a => !a.is_header).forEach(account => {
      const compAmounts = compData.map(cd => {
        const compAcc = cd.otherIncome.find(a => a.id === account.id);
        return formatAmount(compAcc?.calculated_balance ?? 0);
      });
      rows.push([`  ${account.name}`, formatAmount(account.calculated_balance), ...compAmounts]);
    });
    const compTotalOtherIncome = compData.map(cd => formatAmount(cd.totalOtherIncome));
    rows.push(['Total for Non-operating Income', formatAmount(incomeData.totalOtherIncome), ...compTotalOtherIncome]);
    
    // Non-operating Expenses (7xxx-8xxx) - exclude income tax
    rows.push(['', '', ...compData.map(() => '')]);
    rows.push(['Non-operating Expenses', '', ...compData.map(() => '')]);
    mergedAccountLists.nonOperatingExpenses.filter(a => !a.is_header).forEach(account => {
      const compAmounts = compData.map(cd => {
        const compAcc = ((cd as any).nonOperatingExpenses ?? []).find((a: any) => a.id === account.id);
        return formatAmount(compAcc?.calculated_balance ?? 0);
      });
      rows.push([`  ${account.name}`, formatAmount(account.calculated_balance), ...compAmounts]);
    });
    const compTotalNonOpEx = compData.map(cd => formatAmount((cd as any).totalNonOperatingExpenses ?? 0));
    rows.push(['Total for Non-operating Expenses', formatAmount(incomeData.totalNonOperatingExpenses), ...compTotalNonOpEx]);

    // Income Before Income Taxes
    rows.push(['', '', ...compData.map(() => '')]);
    const compIncomeBeforeTax = compData.map(cd => formatAmount((cd as any).incomeBeforeTax ?? 0));
    rows.push(['Income Before Income Taxes', formatAmount(incomeData.incomeBeforeTax), ...compIncomeBeforeTax]);

    // Income Tax Expense (9xxx)
    rows.push(['', '', ...compData.map(() => '')]);
    rows.push(['Income Tax Expense', '', ...compData.map(() => '')]);
    mergedAccountLists.incomeTaxExpenses.filter(a => !a.is_header).forEach(account => {
      const compAmounts = compData.map(cd => {
        const compAcc = ((cd as any).incomeTaxExpenses ?? []).find((a: any) => a.id === account.id);
        return formatAmount(compAcc?.calculated_balance ?? 0);
      });
      rows.push([`  ${account.name}`, formatAmount(account.calculated_balance), ...compAmounts]);
    });
    const compTotalTax = compData.map(cd => formatAmount((cd as any).totalIncomeTax ?? 0));
    rows.push(['Total Income Tax Expense', formatAmount(incomeData.totalIncomeTax), ...compTotalTax]);
    
    rows.push(['', '', ...compData.map(() => '')]);
    const compNetIncome = compData.map(cd => formatAmount(cd.netIncome));
    rows.push([netIncomeLabel, formatAmount(incomeData.netIncome), ...compNetIncome]);

    return {
      title: reportTitle,
      subtitle: isNpo ? (npoTerms?.incomeStatement || 'Statement of Operations') : 'Income Statement',
      organizationName: organization?.name,
      dateRange: `${formatLocalMonthYear(dateRange.startDate)} - ${formatLocalMonthYear(dateRange.endDate)}`,
      headers,
      rows,
      totals: isNpo
        ? [
            { label: totalRevenueLabel, value: formatAmount(incomeData.totalRevenue) },
            { label: totalExpensesLabel, value: formatAmount(incomeData.totalExpenses) },
            { label: netIncomeLabel, value: formatAmount(incomeData.netIncome) },
          ]
        : [
            { label: 'Total Revenue', value: formatAmount(incomeData.totalRevenue) },
            { label: grossProfitLabel, value: formatAmount(incomeData.grossProfit) },
            { label: 'Operating Income', value: formatAmount(operatingProfit) },
            { label: 'Income Before Income Taxes', value: formatAmount(incomeData.incomeBeforeTax) },
            { label: netIncomeLabel, value: formatAmount(incomeData.netIncome) },
          ],
    };
  }, [incomeData, organization, dateRange, operatingProfit, comparisonPeriods, comparativeIncomeData, formatCurrency, mergedAccountLists, isNpo, totalRevenueLabel, totalExpensesLabel, grossProfitLabel, netIncomeLabel, operatingExpenseLabel]);

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
          Create an organization to view the income statement.
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

  // Render a collapsible section header row
  const renderSectionHeader = (title: string, sectionKey: string, totalAmount: number, compTotals: number[] = []) => (
    <tr 
      key={`header-${title}`} 
      className="border-t border-border bg-muted/50 hover:bg-muted/70 cursor-pointer transition-colors select-none"
      onClick={() => toggleSection(sectionKey)}
    >
      <td className="py-3 px-4 font-semibold text-foreground">
        <div className="flex items-center gap-2">
          {expandedSections[sectionKey] ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span>{title}</span>
        </div>
      </td>
      {/* Show total when collapsed */}
      {!expandedSections[sectionKey] ? (
        <>
          <td className="py-3 px-4 text-right font-mono font-semibold">{formatCurrency(totalAmount)}</td>
          {compTotals.map((amt, i) => (
            <td key={i} className="py-3 px-4 text-right font-mono font-semibold">
              {formatCurrency(amt)}
            </td>
          ))}
        </>
      ) : (
        <>
          <td className="py-3 px-4 text-right font-mono"></td>
          {comparisonPeriods.map((_, i) => (
            <td key={i} className="py-3 px-4 text-right font-mono"></td>
          ))}
        </>
      )}
    </tr>
  );

  // Render account rows (indented, blue link style)
  const renderAccountRow = (account: { id: string; name: string; calculated_balance: number }) => {
    const compData = comparativeIncomeData?.slice(1) ?? [];
    
    return (
      <tr
        key={account.id}
        className="hover:bg-muted/30 transition-colors cursor-pointer"
        onDoubleClick={() => setDrilldown({ accountId: account.id, name: account.name })}
        title="Double-click to drill into transactions"
      >
        <td className="py-2 px-4 pl-8 text-primary cursor-pointer hover:underline">
          {account.name}
        </td>
        <td className="py-2 px-4 text-right font-mono text-primary">
          {formatCurrency(account.calculated_balance)}
        </td>
        {comparisonPeriods.map((_, i) => {
          const periodData = compData[i];
          // Try to find the account in any of the income statement sections
          const allAccounts = [
            ...(periodData?.income ?? []),
            ...(periodData?.cogs ?? []),
            ...(periodData?.expenses ?? []),
            ...(periodData?.otherIncome ?? []),
            ...(periodData?.otherExpenses ?? []),
          ];
          const compAccount = allAccounts.find(a => a.id === account.id);
          const compAmount = compAccount?.calculated_balance ?? 0;
          
          return (
            <td key={i} className="py-2 px-4 text-right font-mono text-primary">
              {formatCurrency(compAmount)}
            </td>
          );
        })}
      </tr>
    );
  };

  // Render total row for a section
  const renderTotalRow = (label: string, amount: number, compAmounts: number[] = []) => (
    <tr key={`total-${label}`}>
      <td className="py-2 px-4 font-semibold text-foreground">{label}</td>
      <td className="py-2 px-4 text-right font-mono font-semibold">{formatCurrency(amount)}</td>
      {comparisonPeriods.map((_, i) => (
        <td key={i} className="py-2 px-4 text-right font-mono font-semibold">
          {formatCurrency(compAmounts[i] ?? 0)}
        </td>
      ))}
    </tr>
  );

  // Render calculated row (Gross Profit, Operating Profit, Net Profit/Loss)
  const renderCalculatedRow = (label: string, amount: number, compAmounts: number[] = [], showBorder = true) => (
    <tr key={`calc-${label}`} className={cn(showBorder && "border-t border-border")}>
      <td className="py-3 px-4 font-bold text-foreground">{label}</td>
      <td className={cn(
        "py-3 px-4 text-right font-mono font-bold",
        amount < 0 ? "text-destructive" : ""
      )}>
        {formatCurrency(amount)}
      </td>
      {comparisonPeriods.map((_, i) => {
        const compAmt = compAmounts[i] ?? 0;
        return (
          <td key={i} className={cn(
            "py-3 px-4 text-right font-mono font-bold",
            compAmt < 0 ? "text-destructive" : ""
          )}>
            {formatCurrency(compAmt)}
          </td>
        );
      })}
    </tr>
  );

  // Get comparative totals
  const compData = comparativeIncomeData?.slice(1) ?? [];
  const compTotalRevenue = compData.map(cd => cd.totalRevenue);
  const compTotalCOGS = compData.map(cd => cd.totalCOGS);
  const compGrossProfit = compData.map(cd => cd.grossProfit);
  const compTotalExpenses = compData.map(cd => cd.totalExpenses);
  const compOperatingProfit = compData.map(cd => cd.operatingIncome);
  const compTotalOtherIncome = compData.map(cd => cd.totalOtherIncome);
  const compTotalNonOpEx = compData.map(cd => (cd as any).totalNonOperatingExpenses ?? 0);
  const compTotalIncomeTax = compData.map(cd => (cd as any).totalIncomeTax ?? 0);
  const compIncomeBeforeTax = compData.map(cd => (cd as any).incomeBeforeTax ?? 0);
  const compNetIncome = compData.map(cd => cd.netIncome);

  const currentPeriodLabel = `${formatLocalMonthYear(dateRange.startDate)} - ${formatLocalMonthYear(dateRange.endDate)}`;

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

      {/* Report Card */}
      <Card className="overflow-hidden">
        {/* Report Header */}
        <div className="text-center py-6 border-b border-border">
          <p className="text-sm text-muted-foreground uppercase tracking-wide mb-1">
            {organization.name}
          </p>
          <h1 className="text-xl font-bold text-foreground mb-1">{reportTitle}</h1>
          <p className="text-sm text-muted-foreground">Basis : Accrual</p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground uppercase text-xs">
                  Account
                </th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground w-40">
                  <div className="text-right text-xs uppercase">{currentPeriodLabel}</div>
                  <div className="text-right text-xs uppercase mt-1">Total</div>
                </th>
                {comparisonPeriods.map((period, i) => (
                  <th key={i} className="text-right py-3 px-4 font-medium text-muted-foreground w-40">
                    <div className="text-right text-xs uppercase">{period.label}</div>
                    <div className="text-right text-xs uppercase mt-1">Total</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Operating Income Section - Collapsible */}
              {renderSectionHeader(operatingIncomeLabel, 'operatingIncome', incomeData.totalRevenue, compTotalRevenue)}
              {expandedSections.operatingIncome && mergedAccountLists.income
                .filter(a => !a.is_header && (showZeroBalances || a.calculated_balance !== 0 || 
                  comparativeIncomeData?.slice(1).some(cd => {
                    const compAcc = cd.income.find(ca => ca.id === a.id);
                    return compAcc && compAcc.calculated_balance !== 0;
                  })
                ))
                .map(renderAccountRow)}
              {expandedSections.operatingIncome && renderTotalRow(isNpo ? totalRevenueLabel : `Total for ${operatingIncomeLabel}`, incomeData.totalRevenue, compTotalRevenue)}

              {/* Cost of Goods Sold Section - hidden for NPO (ASNPO classifies all costs as functional expenses) */}
              {!isNpo && renderSectionHeader('Cost of Goods Sold', 'cogs', incomeData.totalCOGS, compTotalCOGS)}
              {!isNpo && expandedSections.cogs && mergedAccountLists.cogs
                .filter(a => !a.is_header && (showZeroBalances || a.calculated_balance !== 0 || 
                  comparativeIncomeData?.slice(1).some(cd => {
                    const compAcc = cd.cogs.find(ca => ca.id === a.id);
                    return compAcc && compAcc.calculated_balance !== 0;
                  })
                ))
                .map(renderAccountRow)}
              {!isNpo && expandedSections.cogs && renderTotalRow('Total for Cost of Goods Sold', incomeData.totalCOGS, compTotalCOGS)}

              {/* Gross Profit — not an ASNPO concept */}
              {!isNpo && renderCalculatedRow(grossProfitLabel, incomeData.grossProfit, compGrossProfit)}

              {/* Expense Section — functional expenses for NPO, operating expenses for for-profit */}
              {renderSectionHeader(operatingExpenseLabel, 'operatingExpense', incomeData.totalExpenses, compTotalExpenses)}
              {expandedSections.operatingExpense && mergedAccountLists.expenses
                .filter(a => !a.is_header && (showZeroBalances || a.calculated_balance !== 0 || 
                  comparativeIncomeData?.slice(1).some(cd => {
                    const compAcc = cd.expenses.find(ca => ca.id === a.id);
                    return compAcc && compAcc.calculated_balance !== 0;
                  })
                ))
                .map(renderAccountRow)}
              {expandedSections.operatingExpense && renderTotalRow(totalExpensesLabel, incomeData.totalExpenses, compTotalExpenses)}

              {/* Operating Income subtotal — not an ASNPO concept */}
              {!isNpo && renderCalculatedRow('Operating Income', operatingProfit, compOperatingProfit)}

              {/* Non-operating Income Section - Collapsible */}
              {renderSectionHeader('Non-operating Income', 'nonOperatingIncome', incomeData.totalOtherIncome, compTotalOtherIncome)}
              {expandedSections.nonOperatingIncome && mergedAccountLists.otherIncome
                .filter(a => !a.is_header && (showZeroBalances || a.calculated_balance !== 0 || 
                  comparativeIncomeData?.slice(1).some(cd => {
                    const compAcc = cd.otherIncome.find(ca => ca.id === a.id);
                    return compAcc && compAcc.calculated_balance !== 0;
                  })
                ))
                .map(renderAccountRow)}
              {expandedSections.nonOperatingIncome && renderTotalRow('Total for Non-operating Income', incomeData.totalOtherIncome, compTotalOtherIncome)}

              {/* Non-operating Expenses Section (7xxx-8xxx) - Collapsible */}
              {renderSectionHeader('Non-operating Expenses', 'nonOperatingExpense', incomeData.totalNonOperatingExpenses, compTotalNonOpEx)}
              {expandedSections.nonOperatingExpense && mergedAccountLists.nonOperatingExpenses
                .filter(a => !a.is_header && (showZeroBalances || a.calculated_balance !== 0 || 
                  comparativeIncomeData?.slice(1).some(cd => {
                    const compAcc = ((cd as any).nonOperatingExpenses ?? []).find((ca: any) => ca.id === a.id);
                    return compAcc && compAcc.calculated_balance !== 0;
                  })
                ))
                .map(renderAccountRow)}
              {expandedSections.nonOperatingExpense && renderTotalRow('Total for Non-operating Expenses', incomeData.totalNonOperatingExpenses, compTotalNonOpEx)}

              {/* Income Before Income Taxes */}
              {renderCalculatedRow('Income Before Income Taxes', incomeData.incomeBeforeTax, compIncomeBeforeTax)}

              {/* Income Tax Expense Section (9xxx) - Collapsible */}
              {renderSectionHeader('Income Tax Expense', 'incomeTax', incomeData.totalIncomeTax, compTotalIncomeTax)}
              {expandedSections.incomeTax && mergedAccountLists.incomeTaxExpenses
                .filter(a => !a.is_header && (showZeroBalances || a.calculated_balance !== 0 || 
                  comparativeIncomeData?.slice(1).some(cd => {
                    const compAcc = ((cd as any).incomeTaxExpenses ?? []).find((ca: any) => ca.id === a.id);
                    return compAcc && compAcc.calculated_balance !== 0;
                  })
                ))
                .map(renderAccountRow)}
              {expandedSections.incomeTax && renderTotalRow('Total Income Tax Expense', incomeData.totalIncomeTax, compTotalIncomeTax)}

              {/* Net Profit/Loss */}
              {renderCalculatedRow(netIncomeLabel, incomeData.netIncome, compNetIncome)}

              {/* Empty state */}
              {!hasOperatingIncome && !hasCOGS && !hasOperatingExpense && !hasNonOperatingIncome && !hasNonOperatingExpense && !hasIncomeTax && (
                <tr>
                  <td colSpan={2 + comparisonPeriods.length} className="py-12 text-center text-muted-foreground">
                    No income or expense data available for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/30">
          <p className="text-xs text-muted-foreground">
            **Amount is displayed in your base currency{' '}
            <span className="inline-flex items-center px-1.5 py-0.5 bg-success text-success-foreground text-xs font-medium rounded">
              CAD
            </span>
          </p>
        </div>
      </Card>

      <ExecutiveSignatureBlock
        statementType="income_statement"
        statementTitle="Statement of Operations (Income Statement)"
        periodStart={startDate}
        periodEnd={endDate}
      />

      {drilldown && (
        <AmountDrilldownDialog
          open={!!drilldown}
          onOpenChange={(o) => !o && setDrilldown(null)}
          organizationId={organization?.id}
          accountId={drilldown.accountId}
          accountName={drilldown.name}
          periodStart={startDate}
          periodEnd={endDate}
        />
      )}
    </div>
  );
}
