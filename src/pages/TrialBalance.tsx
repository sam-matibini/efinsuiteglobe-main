import { useState, useMemo, useCallback, useEffect } from 'react';
import { Check, AlertTriangle, Upload, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useFinancialReportsRealtime } from '@/hooks/useFinancialReportsRealtime';
import { RealtimeIndicator } from '@/components/reports/RealtimeIndicator';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { DivisionFilter } from '@/components/reports/DivisionFilter';
import { ReportActions, ReportData } from '@/components/reports/ReportActions';
import { format, subMonths, subYears } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { parseLocalDate } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useReportFilters } from '@/hooks/useReportFilters';
import { TrialBalanceImportDialog } from '@/components/import/TrialBalanceImportDialog';
import { TrialBalanceImportHistoryDialog } from '@/components/import/TrialBalanceImportHistoryDialog';
import { AmountDrilldownDialog } from '@/components/reports/AmountDrilldownDialog';

interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  openingBalance: number;
  periodDebit: number;
  periodCredit: number;
  closingBalance: number;
  normalBalance: string;
}

interface ComparisonPeriod {
  label: string;
  startDate: Date;
  endDate: Date;
}

const typeLabels: Record<string, string> = {
  asset: 'Asset',
  liability: 'Liability',
  equity: 'Equity',
  income: 'Income',
  cogs: 'COGS',
  expense: 'Expense',
  other_income: 'Other Income',
  other_expense: 'Other Expense',
};

// Helper to format date in local timezone (avoids UTC conversion issues)
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};


export default function TrialBalance() {
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importHistoryOpen, setImportHistoryOpen] = useState(false);
  const [drilldown, setDrilldown] = useState<{ accountId: string; name: string; code?: string } | null>(null);

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

  const { organization } = useCurrentOrganization();
  const { lastEventAt: realtimeLastEventAt } = useFinancialReportsRealtime(organization?.id);
  const [divisionIds, setDivisionIds] = useState<string[]>([]);
  
  // Sync fiscal year end month from organization
  useEffect(() => {
    if (organization?.fiscal_year_end_month) {
      setFiscalYearEndMonth(organization.fiscal_year_end_month);
    }
  }, [organization?.fiscal_year_end_month, setFiscalYearEndMonth]);

  const handleDateRangeChange = useCallback((start: Date, end: Date) => {
    setDateRange(start, end);
  }, [setDateRange]);

  const handleCompareChange = useCallback((settings: typeof compareSettings) => {
    setCompareSettings(settings);
  }, [setCompareSettings]);

  // Generate comparison periods based on settings
  const getComparisonPeriods = useCallback((): ComparisonPeriod[] => {
    if (!compareSettings) return [];
    
    const periods: ComparisonPeriod[] = [];
    const periodLength = endDate.getTime() - startDate.getTime();
    const periodDays = Math.round(periodLength / (1000 * 60 * 60 * 24));
    
    for (let i = 1; i <= compareSettings.numberOfPeriods; i++) {
      if (compareSettings.compareType === 'year') {
        const periodStart = subYears(startDate, i);
        const periodEnd = subYears(endDate, i);
        periods.push({
          label: format(periodEnd, 'yyyy'),
          startDate: periodStart,
          endDate: periodEnd,
        });
      } else {
        const periodEnd = subMonths(startDate, (i - 1) * Math.max(1, Math.round(periodDays / 30)));
        const periodStart = subMonths(periodEnd, Math.max(1, Math.round(periodDays / 30)));
        periods.push({
          label: `${format(periodStart, 'MMM yyyy')} - ${format(periodEnd, 'MMM yyyy')}`,
          startDate: new Date(periodStart.getTime() - periodLength),
          endDate: periodStart,
        });
      }
    }
    
    return compareSettings.latestToOldest ? periods : periods.reverse();
  }, [compareSettings, startDate, endDate]);

  const comparisonPeriods = getComparisonPeriods();

  // Fetch trial balance data with proper GAAP calculations
  const fetchTrialBalanceForPeriod = async (periodStart: Date, periodEnd: Date): Promise<TrialBalanceRow[]> => {
    if (!organization?.id) return [];

    // Get all accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*')
      .eq('organization_id', organization.id)
      .eq('is_header', false)
      .order('code');

    if (accountsError) throw accountsError;

    // Get all posted journal entries up to the report end date.
    // CRITICAL: Supabase REST has a default 1000-row cap; paginate or the Trial
    // Balance will silently exclude later entries.
    const endDateStrLocal = formatLocalDate(periodEnd);
    const fetchAllJournalEntries = async () => {
      const pageSize = 1000;
      const all: Array<{ id: string; entry_date: string; department_id: string | null }> = [];
      let offset = 0;
      while (true) {
        const { data, error } = await supabase
          .from('journal_entries')
          .select('id, entry_date, department_id')
          .eq('organization_id', organization.id)
          .eq('status', 'posted')
          .lte('entry_date', endDateStrLocal)
          .order('id', { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        const rows = data ?? [];
        all.push(...rows);
        if (rows.length < pageSize) break;
        offset += pageSize;
      }
      return all;
    };
    const journalEntries = await fetchAllJournalEntries();

    const journalEntryIds = journalEntries?.map(je => je.id) ?? [];
    const entryDateMap = new Map(journalEntries?.map(e => [e.id, e.entry_date]) ?? []);
    const entryDeptMap = new Map(journalEntries?.map(e => [e.id, e.department_id]) ?? []);

    // IMPORTANT: paginate line fetches (REST default limit is 1000 rows)
    let journalLines: Array<{ id: string; account_id: string; debit: number; credit: number; base_currency_debit: number | null; base_currency_credit: number | null; journal_entry_id: string; department_id: string | null }> = [];

    const fetchAllLinesForEntries = async (entryIds: string[]) => {
      const chunkSize = 200;
      const pageSize = 1000;
      const all: typeof journalLines = [];

      for (let i = 0; i < entryIds.length; i += chunkSize) {
        const chunk = entryIds.slice(i, i + chunkSize);
        let offset = 0;

        while (true) {
          const { data, error } = await supabase
            .from('journal_entry_lines')
            .select('id, account_id, debit, credit, base_currency_debit, base_currency_credit, journal_entry_id, department_id')
            .in('journal_entry_id', chunk)
            .order('id', { ascending: true })
            .range(offset, offset + pageSize - 1);

          if (error) throw error;
          const rows = data ?? [];
          all.push(...rows);

          if (rows.length < pageSize) break;
          offset += pageSize;
        }
      }

      return all;
    };

    if (journalEntryIds.length > 0) {
      journalLines = await fetchAllLinesForEntries(journalEntryIds);
    }

    // Phase 4 — division filter: keep only lines whose effective division
    // (line override OR header) matches the selected set. Empty = consolidated.
    if (divisionIds.length > 0) {
      const allowed = new Set(divisionIds);
      journalLines = journalLines.filter(l => {
        const eff = l.department_id ?? entryDeptMap.get(l.journal_entry_id) ?? null;
        return eff && allowed.has(eff);
      });
    }

    /**
     * GAAP/ASPE Trial Balance Calculation Logic:
     * 
     * A Trial Balance is an "as-of" report showing all account balances at a point in time.
     * It verifies that Debits = Credits across ALL accounts (double-entry principle).
     * 
     * For BOTH permanent and temporary accounts, the Trial Balance shows:
     * - Opening Balance: All activity BEFORE the period start
     * - Period Activity: Debits/Credits WITHIN the period
     * - Closing Balance: Sum of opening + period activity
     * 
     * This ensures the Trial Balance totals match the backend validator function.
     */
    const rows: TrialBalanceRow[] = [];
    
    // Find the earliest transaction date to determine when the books actually started
    const allDates = journalLines
      .map(l => entryDateMap.get(l.journal_entry_id))
      .filter((d): d is string => !!d)
      .map(d => parseLocalDate(d));
    
    const earliestTransactionDate = allDates.length > 0 
      ? new Date(Math.min(...allDates.map(d => d.getTime())))
      : null;

    // Use integer cents throughout to prevent floating-point drift
    const toCents = (n: number) => Math.round(n * 100);
    const fromCents = (n: number) => n / 100;

    for (const account of accounts ?? []) {
      const accountLines = journalLines.filter(l => l.account_id === account.id);
      
      // Opening balance only applies if the period END is >= earliest transaction date
      // For historical comparison periods with no transactions, balances should be zero
      const shouldIncludeOpeningBalance = earliestTransactionDate 
        ? periodEnd >= earliestTransactionDate 
        : false;
      // Static account.opening_balance is org-wide and not division-tagged, so
      // exclude it when filtering to specific divisions.
      let openingBalanceCents = (shouldIncludeOpeningBalance && divisionIds.length === 0)
        ? toCents(Number(account.opening_balance) || 0) 
        : 0;
      let periodDebitCents = 0;
      let periodCreditCents = 0;
      
      for (const line of accountLines) {
        const entryDate = entryDateMap.get(line.journal_entry_id);
        if (!entryDate) continue;
        
        const lineDate = parseLocalDate(entryDate);
        const debitCents = toCents(Number(line.base_currency_debit ?? line.debit) || 0);
        const creditCents = toCents(Number(line.base_currency_credit ?? line.credit) || 0);
        
        if (lineDate < periodStart) {
          // Transactions before period start contribute to opening balance
          if (account.normal_balance === 'debit') {
            openingBalanceCents += debitCents - creditCents;
          } else {
            openingBalanceCents += creditCents - debitCents;
          }
        } else if (lineDate <= periodEnd) {
          // Transactions within period
          periodDebitCents += debitCents;
          periodCreditCents += creditCents;
        }
      }

      // Calculate closing balance based on normal balance
      let closingBalanceCents = openingBalanceCents;
      if (account.normal_balance === 'debit') {
        closingBalanceCents += periodDebitCents - periodCreditCents;
      } else {
        closingBalanceCents += periodCreditCents - periodDebitCents;
      }

      // Convert back to dollars for display
      const openingBalance = fromCents(openingBalanceCents);
      const periodDebit = fromCents(periodDebitCents);
      const periodCredit = fromCents(periodCreditCents);
      const closingBalance = fromCents(closingBalanceCents);

      // Include accounts based on showZeroBalances setting
      const hasActivity = openingBalanceCents !== 0 || periodDebitCents !== 0 || periodCreditCents !== 0 || closingBalanceCents !== 0;
      if (hasActivity || showZeroBalances) {
        rows.push({
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          accountType: account.account_type,
          openingBalance,
          periodDebit,
          periodCredit,
          closingBalance,
          normalBalance: account.normal_balance,
        });
      }
    }

    return rows.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  };

  // Main query for current period
  const { data: trialBalanceData = [], isLoading, error, refetch } = useQuery({
    queryKey: ['trial-balance', organization?.id, formatLocalDate(startDate), formatLocalDate(endDate), showZeroBalances, divisionIds.slice().sort().join(',')],
    queryFn: () => fetchTrialBalanceForPeriod(startDate, endDate),
    enabled: !!organization?.id,
  });

  // Comparison period queries
  const { data: comparisonData = [] } = useQuery({
    queryKey: ['trial-balance-comparison', organization?.id, comparisonPeriods.map(p => `${formatLocalDate(p.startDate)}-${formatLocalDate(p.endDate)}`).join(','), showZeroBalances, divisionIds.slice().sort().join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        comparisonPeriods.map(period => fetchTrialBalanceForPeriod(period.startDate, period.endDate))
      );
      return results;
    },
    enabled: !!organization?.id && comparisonPeriods.length > 0,
  });

  const { formatCurrency: formatCurrencyBase } = useCurrencyFormatter();
  
  const formatCurrency = (value: number) => {
    if (value === 0) return '-';
    return formatCurrencyBase(value);
  };

  /**
   * Calculate totals using integer cents to avoid floating point drift
   * GAAP/ASPE Trial Balance Logic:
   * - Debit-normal accounts (Assets, Expenses): positive balance = Debit column, negative = Credit column
   * - Credit-normal accounts (Liabilities, Equity, Revenue): positive balance = Credit column, negative = Debit column
   */
  const calculateTotals = (data: TrialBalanceRow[]) => {
    // Use integer cents throughout to prevent floating-point drift
    const toCents = (n: number) => Math.round(n * 100);
    
    const cents = data.reduce(
      (acc, row) => {
        const isDebitNormal = row.normalBalance === 'debit';
        const balCents = toCents(row.closingBalance);
        
        // Skip zero balances - they don't contribute to either column
        if (balCents === 0) {
          return {
            ...acc,
            periodDebitCents: acc.periodDebitCents + toCents(row.periodDebit),
            periodCreditCents: acc.periodCreditCents + toCents(row.periodCredit),
          };
        }
        
        // Determine which column the balance belongs in
        // Debit-normal: positive → Debit, negative → Credit
        // Credit-normal: positive → Credit, negative → Debit
        const showInDebit = isDebitNormal ? balCents > 0 : balCents < 0;
        const absCents = Math.abs(balCents);

        return {
          debitCents: acc.debitCents + (showInDebit ? absCents : 0),
          creditCents: acc.creditCents + (showInDebit ? 0 : absCents),
          periodDebitCents: acc.periodDebitCents + toCents(row.periodDebit),
          periodCreditCents: acc.periodCreditCents + toCents(row.periodCredit),
        };
      },
      { debitCents: 0, creditCents: 0, periodDebitCents: 0, periodCreditCents: 0 }
    );

    return {
      debit: cents.debitCents / 100,
      credit: cents.creditCents / 100,
      periodDebit: cents.periodDebitCents / 100,
      periodCredit: cents.periodCreditCents / 100,
    };
  };

  const totals = calculateTotals(trialBalanceData);
  const isBalanced = Math.abs(totals.debit - totals.credit) < 0.01;

  // Get balance for a specific account from comparison data
  const getComparisonBalance = (accountId: string, periodIndex: number): { debit: string; credit: string } => {
    const periodData = comparisonData[periodIndex];
    if (!periodData) return { debit: '-', credit: '-' };
    
    const row = periodData.find(r => r.accountId === accountId);
    if (!row) return { debit: '-', credit: '-' };
    
    const isDebitNormal = row.normalBalance === 'debit';
    const balance = row.closingBalance;
    const balCents = Math.round(balance * 100);
    const absBalance = Math.abs(balance);
    
    // Zero balance shows dash in both columns
    if (balCents === 0) {
      return { debit: '-', credit: '-' };
    }
    
    const showInDebit = isDebitNormal ? balCents > 0 : balCents < 0;
    
    return {
      debit: showInDebit ? formatCurrency(absBalance) : '-',
      credit: showInDebit ? '-' : formatCurrency(absBalance),
    };
  };

  // Build report data for export
  const reportData: ReportData = useMemo(() => {
    const headers = ['Code', 'Account Name', 'Type', 'Debit', 'Credit'];
    
    // Add comparison headers
    comparisonPeriods.forEach(period => {
      headers.push(`Debit (${period.label})`, `Credit (${period.label})`);
    });

    const rows: (string | number)[][] = trialBalanceData.map(row => {
      const isDebitNormal = row.normalBalance === 'debit';
      const balance = row.closingBalance;
      const balCents = Math.round(balance * 100);
      const absBalance = Math.abs(balance);
      
      // For export: show 0.00 instead of dash for zero balances
      const isZero = balCents === 0;
      const showInDebit = !isZero && (isDebitNormal ? balCents > 0 : balCents < 0);
      const showInCredit = !isZero && !showInDebit;
      
      const rowData: (string | number)[] = [
        row.accountCode,
        row.accountName,
        typeLabels[row.accountType] || row.accountType,
        showInDebit ? formatCurrency(absBalance) : (isZero ? '0.00' : '-'),
        showInCredit ? formatCurrency(absBalance) : (isZero ? '0.00' : '-'),
      ];
      
      // Add comparison data
      comparisonPeriods.forEach((_, index) => {
        const compBalance = getComparisonBalance(row.accountId, index);
        rowData.push(compBalance.debit, compBalance.credit);
      });
      
      return rowData;
    });

    return {
      title: 'Trial Balance',
      subtitle: 'Account Balances Verification',
      organizationName: organization?.name,
      dateRange: `As of ${format(endDate, 'MMMM d, yyyy')}`,
      headers,
      rows,
      totals: [
        { label: 'Total Debits', value: formatCurrency(totals.debit) },
        { label: 'Total Credits', value: formatCurrency(totals.credit) },
      ],
    };
  }, [trialBalanceData, totals, organization, endDate, comparisonPeriods, comparisonData]);

  if (!organization) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <p className="text-muted-foreground">Please create an organization to view the trial balance.</p>
        <Button onClick={() => setShowOrgDialog(true)}>Create Organization</Button>
        <CreateOrganizationDialog open={showOrgDialog} onOpenChange={setShowOrgDialog} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <Skeleton className="h-8 w-48 mb-2 bg-muted/80" />
          <Skeleton className="h-4 w-64 mb-6 bg-muted/80" />
          <Skeleton className="h-64 w-full bg-muted/80" />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <h1 className="text-xl font-bold text-foreground">Trial Balance</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : 'Failed to load trial balance data.'}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <RealtimeIndicator lastEventAt={realtimeLastEventAt} />
      </div>
      {/* Filter Bar - using shared state */}
      <ReportFilters
        initialStartDate={startDate}
        initialEndDate={endDate}
        onDateRangeChange={handleDateRangeChange}
        onRunReport={() => refetch()}
        onCompareChange={handleCompareChange}
        showExpandCollapse={false}
        showZeroBalances={showZeroBalances}
        onShowZeroBalancesChange={setShowZeroBalances}
        fiscalYearEndMonth={fiscalYearEndMonth}
        actions={
          <div className="flex items-center gap-2">
            <DivisionFilter value={divisionIds} onChange={setDivisionIds} />
            <ReportActions reportData={reportData} variant="compact" />
          </div>
        }
      />

      {/* Main Card */}
      <Card className="overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h1 className="text-xl font-bold text-foreground">Trial Balance</h1>
            <p className="text-sm text-muted-foreground">
              As of {format(endDate, 'MMMM d, yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Import TB / Opening Balances
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportHistoryOpen(true)}>
              <History className="w-4 h-4 mr-2" />
              Import History
            </Button>
            {isBalanced ? (
              <Badge className="bg-success/20 text-success border-success/30 hover:bg-success/30">
                <Check className="w-3 h-3 mr-1" />
                Balanced
              </Badge>
            ) : (
              <Badge className="bg-destructive/20 text-destructive border-destructive/30">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Out of Balance
              </Badge>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left font-medium text-muted-foreground px-6 py-3 w-40 whitespace-nowrap">Code</th>
                <th className="text-left font-medium text-muted-foreground px-6 py-3">Account Name</th>
                <th className="text-left font-medium text-muted-foreground px-6 py-3 w-28">Type</th>
                <th className="text-right font-medium text-muted-foreground px-6 py-3 w-32">Debit</th>
                <th className="text-right font-medium text-muted-foreground px-6 py-3 w-32">Credit</th>
                {comparisonPeriods.map((period, idx) => (
                  <th key={`header-debit-${idx}`} colSpan={2} className="text-center font-medium text-muted-foreground px-3 py-3 border-l border-border">
                    {period.label}
                  </th>
                ))}
              </tr>
              {comparisonPeriods.length > 0 && (
                <tr className="bg-muted/30">
                  <th colSpan={5}></th>
                  {comparisonPeriods.map((_, idx) => (
                    <>
                      <th key={`subheader-debit-${idx}`} className="text-right font-medium text-muted-foreground/70 px-3 py-2 text-xs border-l border-border">Debit</th>
                      <th key={`subheader-credit-${idx}`} className="text-right font-medium text-muted-foreground/70 px-3 py-2 text-xs">Credit</th>
                    </>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {trialBalanceData.length === 0 ? (
                <tr>
                  <td colSpan={5 + comparisonPeriods.length * 2} className="text-center py-12 text-muted-foreground">
                    No account data available. Add accounts and journal entries to see the trial balance.
                  </td>
                </tr>
              ) : (
                trialBalanceData.map((row) => {
                  const isDebitNormal = row.normalBalance === 'debit';
                  const balance = row.closingBalance;
                  const balCents = Math.round(balance * 100);
                  const absBalance = Math.abs(balance);
                  
                  // Determine column placement based on normal balance and actual balance position
                  // Debit-normal: positive → Debit, negative → Credit, zero → dash in both
                  // Credit-normal: positive → Credit, negative → Debit, zero → dash in both
                  const isZero = balCents === 0;
                  const showInDebit = !isZero && (isDebitNormal ? balCents > 0 : balCents < 0);
                  const showInCredit = !isZero && !showInDebit;
                  
                  return (
                    <tr
                      key={row.accountId}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                      onDoubleClick={() => setDrilldown({ accountId: row.accountId, name: row.accountName, code: row.accountCode })}
                      title="Double-click to drill into transactions"
                    >
                      <td className="px-6 py-3 font-mono text-accent whitespace-nowrap">{row.accountCode}</td>
                      <td className="px-6 py-3 font-medium text-foreground">{row.accountName}</td>
                      <td className="px-6 py-3 text-muted-foreground">{typeLabels[row.accountType] || row.accountType}</td>
                      <td className="px-6 py-3 text-right font-mono text-foreground">
                        {showInDebit ? formatCurrency(absBalance) : '-'}
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-foreground">
                        {showInCredit ? formatCurrency(absBalance) : '-'}
                      </td>
                      {comparisonPeriods.map((_, idx) => {
                        const compBalance = getComparisonBalance(row.accountId, idx);
                        return (
                          <>
                            <td key={`comp-debit-${row.accountId}-${idx}`} className="px-3 py-3 text-right font-mono text-muted-foreground border-l border-border">
                              {compBalance.debit}
                            </td>
                            <td key={`comp-credit-${row.accountId}-${idx}`} className="px-3 py-3 text-right font-mono text-muted-foreground">
                              {compBalance.credit}
                            </td>
                          </>
                        );
                      })}
                    </tr>
                  );
                })
              )}
              
              {/* Totals row */}
              {trialBalanceData.length > 0 && (
                <tr className="bg-muted/50 font-bold border-t-2 border-border">
                  <td className="px-6 py-3" colSpan={3}>Totals</td>
                  <td className="px-6 py-3 text-right font-mono">{formatCurrency(totals.debit)}</td>
                  <td className="px-6 py-3 text-right font-mono">{formatCurrency(totals.credit)}</td>
                  {comparisonPeriods.map((_, idx) => {
                    const periodData = comparisonData[idx];
                    const periodTotals = periodData ? calculateTotals(periodData) : { debit: 0, credit: 0 };
                    return (
                      <>
                        <td key={`total-debit-${idx}`} className="px-3 py-3 text-right font-mono border-l border-border">
                          {formatCurrency(periodTotals.debit)}
                        </td>
                        <td key={`total-credit-${idx}`} className="px-3 py-3 text-right font-mono">
                          {formatCurrency(periodTotals.credit)}
                        </td>
                      </>
                    );
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <TrialBalanceImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={() => refetch()}
      />

      <TrialBalanceImportHistoryDialog
        open={importHistoryOpen}
        onOpenChange={setImportHistoryOpen}
        onAfterChange={() => refetch()}
      />

      {drilldown && (
        <AmountDrilldownDialog
          open={!!drilldown}
          onOpenChange={(o) => !o && setDrilldown(null)}
          organizationId={organization?.id}
          accountId={drilldown.accountId}
          accountName={drilldown.name}
          accountCode={drilldown.code}
          periodStart={startDate}
          periodEnd={endDate}
        />
      )}
    </div>
  );
}
