import { useState, useMemo, useEffect } from 'react';
import { Building2, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ReportsTabs } from '@/components/reports/ReportsTabs';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ReportActions, ReportData } from '@/components/reports/ReportActions';
import { useFinancialReports } from '@/hooks/useFinancialReports';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useReportFilters } from '@/hooks/useReportFilters';
import { usePopulateEquityMovements } from '@/hooks/useASPEEquityData';
import { useNpoTerminology } from '@/hooks/useNpoTerminology';
import { useZohoEquityData } from '@/hooks/useZohoEquityData';
import { useRetainedEarningsStatement } from '@/hooks/useRetainedEarningsStatement';
import { ZohoEquityTable } from '@/components/reports/ZohoEquityTable';
import { toast } from 'sonner';
import { ExecutiveSignatureBlock } from '@/components/reports/ExecutiveSignatureBlock';

/**
 * ============================================================================
 * STATEMENT OF CHANGES IN EQUITY - ZOHO BOOKS STYLE
 * ============================================================================
 * 
 * Columns: Description | Share Capital ($) | Retained Earnings ($) | Total Equity ($)
 * 
 * For each year, rows:
 *   - Balance at January 1, YYYY
 *   - Profit/Loss for the year YYYY
 *   - Owner's Investment/Contribution
 *   - Drawings/Dividends Paid
 *   - Balance at December 31, YYYY
 * 
 * Key Components:
 *   - Balance at January 1: Closing balance of previous year
 *   - Profit/Loss: Net income/loss from Income Statement
 *   - Owner's Contribution: Funds added (classified as Equity in CoA)
 *   - Drawings/Dividends: Funds withdrawn by owner or distributed to shareholders
 *   - Total Equity: Sum of all equity components, reconciles to Balance Sheet
 * 
 * ============================================================================
 */

export default function ChangesInEquity() {
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
  const [isPopulating, setIsPopulating] = useState(false);

  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  
  // Sync fiscal year end month from organization
  useEffect(() => {
    if (organization?.fiscal_year_end_month) {
      setFiscalYearEndMonth(organization.fiscal_year_end_month);
    }
  }, [organization?.fiscal_year_end_month, setFiscalYearEndMonth]);
  
  const { isLoading: reportsLoading, error, getBalanceSheetData, refetch } = useFinancialReports({
    startDate,
    endDate,
  });

  const { formatWithSymbol: formatCurrency } = useCurrencyFormatter();
  const { populate } = usePopulateEquityMovements();
  const { npoTerms, isNpo } = useNpoTerminology();
  const soceTitle = isNpo ? 'Statement of Changes in Net Assets' : 'Statement of Changes in Equity';

  // Determine fiscal years to display (based on comparison settings)
  const currentYear = endDate.getFullYear();
  const numberOfPeriods = compareSettings?.numberOfPeriods || 0;
  const years = useMemo(() => {
    const result = [currentYear];
    for (let i = 1; i <= numberOfPeriods; i++) {
      result.push(currentYear - i);
    }
    return result.sort((a, b) => a - b);
  }, [currentYear, numberOfPeriods]);

  // Fetch Zoho-style equity data
  const { rows: rawRows, totals: rawTotals, isLoading: equityLoading, hasData, refetch: refetchEquity } = useZohoEquityData(years);

  // Authoritative RE source (matches Balance Sheet — see balance-sheet-re-statement-integration memory)
  const { currentStatement: reCurrentStatement, refetch: refetchREStatement } = useRetainedEarningsStatement(
    { startDate, endDate },
    []
  );

  const authoritativeClosingRE = reCurrentStatement?.data.closingBalance ?? rawTotals.retainedEarnings;
  const authoritativeNetIncome = reCurrentStatement?.data.netIncomeLoss ?? rawTotals.netIncome;

  const totals = useMemo(() => ({
    ...rawTotals,
    retainedEarnings: authoritativeClosingRE,
    netIncome: authoritativeNetIncome,
    closingEquity: rawTotals.shareCapital + authoritativeClosingRE,
  }), [rawTotals, authoritativeClosingRE, authoritativeNetIncome]);

  // Override the current (latest) year's closing row + profit/loss row so the table foot ties to the badge
  const rows = useMemo(() => {
    if (!reCurrentStatement) return rawRows;
    const latestYear = years[years.length - 1];
    return rawRows.map(r => {
      if (r.id === `closing-${latestYear}`) {
        return {
          ...r,
          retainedEarnings: authoritativeClosingRE,
          totalEquity: r.shareCapital + authoritativeClosingRE,
        };
      }
      if (r.id === `profit-loss-${latestYear}`) {
        return {
          ...r,
          retainedEarnings: authoritativeNetIncome,
          totalEquity: authoritativeNetIncome,
        };
      }
      return r;
    });
  }, [rawRows, reCurrentStatement, years, authoritativeClosingRE, authoritativeNetIncome]);

  // Populate equity movements from journal entries
  const handlePopulateMovements = async () => {
    if (!organization?.id) return;
    
    setIsPopulating(true);
    try {
      for (const year of years) {
        await populate(year);
      }
      toast.success('Equity movements populated successfully');
      refetchEquity();
    } catch (err) {
      console.error('Failed to populate movements:', err);
      toast.error('Failed to populate equity movements');
    } finally {
      setIsPopulating(false);
    }
  };

  // Handle date range changes
  const handleDateRangeChange = (start: Date, end: Date) => {
    setDateRange(start, end);
  };

  // Handle Run Report button
  const handleRunReport = () => {
    refetch();
    refetchEquity();
  };

  // Build report data for export
  const reportData: ReportData = useMemo(() => {
    const exportRows: (string | number)[][] = [];
    
    rows.forEach(row => {
      if (row.label) {
        const indent = row.indent ? '  ' : '';
        if (isNpo) {
          exportRows.push([
            `${indent}${row.label}`,
            formatCurrency(row.retainedEarnings),
            formatCurrency(row.totalEquity),
          ]);
        } else {
          exportRows.push([
            `${indent}${row.label}`,
            formatCurrency(row.shareCapital),
            formatCurrency(row.retainedEarnings),
            formatCurrency(row.totalEquity),
          ]);
        }
      } else {
        exportRows.push(isNpo ? ['', '', ''] : ['', '', '', '']);
      }
    });


    return {
      title: soceTitle,
      subtitle: `For the Years Ended December 31, ${years.join(', ')}`,
      organizationName: organization?.name,
      dateRange: years.length > 1 
        ? `${years[0]} - ${years[years.length - 1]}`
        : `${years[0]}`,
      headers: isNpo
        ? ['Description', 'Unrestricted Net Assets ($)', 'Total Net Assets ($)']
        : ['Description', 'Owner\'s Capital / Share Capital ($)', 'Retained Earnings ($)', 'Total Equity ($)'],
      rows: exportRows,
      totals: [
        { label: isNpo ? 'Total Net Assets' : 'Total Equity', value: formatCurrency(totals.closingEquity) },
      ],
    };
  }, [rows, years, organization, formatCurrency, totals, soceTitle, isNpo]);

  // Verify tie-out with Balance Sheet
  const balanceSheetData = getBalanceSheetData();
  const tiesToBalanceSheet = Math.abs(totals.closingEquity - balanceSheetData.totalEquity) < 0.01;

  // Loading state
  const isLoading = orgLoading || reportsLoading || equityLoading;
  if (isLoading) {
    return (
      <div className="space-y-6">
        <ReportsTabs />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-20" />
            </Card>
          ))}
        </div>
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
          Create an organization to view the statement of changes in equity.
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
      <ReportsTabs />

      {/* Filters */}
      <ReportFilters
        showExpandCollapse={false}
        showZeroBalances={showZeroBalances}
        onShowZeroBalancesChange={setShowZeroBalances}
        onCompareChange={setCompareSettings}
        onDateRangeChange={handleDateRangeChange}
        onRunReport={handleRunReport}
        initialStartDate={startDate}
        initialEndDate={endDate}
        fiscalYearEndMonth={fiscalYearEndMonth}
        actions={<ReportActions reportData={reportData} variant="compact" />}
      />

      {/* No Data State - Prompt to populate */}
      {!hasData && (
        <Card className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Equity Movements Found</h3>
          <p className="text-muted-foreground mb-4">
            The equity movements table is empty. Click below to populate it from your journal entries.
          </p>
          <Button 
            onClick={handlePopulateMovements} 
            disabled={isPopulating}
            className="gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", isPopulating && "animate-spin")} />
            {isPopulating ? 'Populating...' : 'Populate Equity Movements'}
          </Button>
        </Card>
      )}

      {/* Report Content */}
      {hasData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {!isNpo && (
              <Card className="p-4 border-l-4 border-l-primary">
                <p className="text-sm text-muted-foreground mb-1">Share Capital</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totals.shareCapital)}</p>
              </Card>
            )}
            <Card className="p-4 border-l-4 border-l-accent">
              <p className="text-sm text-muted-foreground mb-1">{isNpo ? 'Unrestricted Net Assets' : 'Retained Earnings'}</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(totals.retainedEarnings)}</p>
            </Card>
            <Card className="p-4 border-l-4 border-l-success">
              <p className="text-sm text-muted-foreground mb-1">
                {isNpo ? `Excess (Deficiency) of Revenue over Expenses (${years[years.length - 1]})` : `Net Income (${years[years.length - 1]})`}
              </p>
              <p className={cn("text-2xl font-bold", totals.netIncome >= 0 ? "text-success" : "text-destructive")}>
                {formatCurrency(totals.netIncome)}
              </p>
            </Card>
            <Card className="p-4 border-l-4 border-l-muted-foreground">
              <p className="text-sm text-muted-foreground mb-1">{isNpo ? 'Total Net Assets' : 'Total Equity'}</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(totals.closingEquity)}</p>
            </Card>
          </div>

          {/* Statement of Changes in Equity Table (Zoho Style) */}
          <Card className="overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-4 border-b border-border bg-muted/30">
              <div>
                <h2 className="font-semibold text-foreground">{organization?.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {soceTitle}
                </p>
                <p className="text-sm text-muted-foreground">
                  For the Years Ended December 31, {years.join(', ')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePopulateMovements}
                  disabled={isPopulating}
                  className="gap-1"
                >
                  <RefreshCw className={cn("w-3 h-3", isPopulating && "animate-spin")} />
                  Refresh
                </Button>
                {tiesToBalanceSheet ? (
                  <Badge className="bg-success/20 text-success border-success/30">
                    <Check className="w-3 h-3 mr-1" />
                    Ties to Balance Sheet
                  </Badge>
                ) : (
                  <Badge className="bg-warning/20 text-warning border-warning/30">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Difference: {formatCurrency(totals.closingEquity - balanceSheetData.totalEquity)}
                  </Badge>
                )}
              </div>
            </div>
            <ZohoEquityTable rows={rows} years={years} isNpo={isNpo} />
          </Card>

          {/* Key Components Explained */}
          <Card className="p-4">
            <h3 className="font-semibold text-foreground mb-3">Key Components Explained</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-foreground">Balance at January 1</p>
                <p className="text-muted-foreground">
                  The closing balance of the previous year acts as the opening balance.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Profit/Loss for the Year</p>
                <p className="text-muted-foreground">
                  Net income or loss sourced from the Income Statement.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Owner's Investment/Contribution</p>
                <p className="text-muted-foreground">
                  Funds added to the business by the owner (classified as Equity in Chart of Accounts).
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Drawings/Dividends Paid</p>
                <p className="text-muted-foreground">
                  Funds withdrawn by the owner or distributed to shareholders.
                </p>
              </div>
              <div className="md:col-span-2">
                <p className="font-medium text-foreground">Total Equity</p>
                <p className="text-muted-foreground">
                  The sum of all equity components, which reconciles to the total equity shown on the Balance Sheet.
                </p>
              </div>
            </div>
          </Card>
        </>
      )}

      <ExecutiveSignatureBlock
        statementType="changes_in_equity"
        statementTitle="Statement of Changes in Equity / Net Assets"
        periodStart={startDate}
        periodEnd={endDate}
      />
    </div>
  );
}
