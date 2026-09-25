import { DollarSign, TrendingUp, Wallet, CreditCard, Building2, Calendar } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { ExpensesPieChart } from '@/components/dashboard/ExpensesPieChart';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { AccountsSnapshot } from '@/components/dashboard/AccountsSnapshot';
import { CashPositionCard } from '@/components/dashboard/CashPositionCard';
import { AlertsCard } from '@/components/dashboard/AlertsCard';
import { ProfitMarginIndicator } from '@/components/dashboard/ProfitMarginIndicator';
import { QuickActionsGrid } from '@/components/dashboard/QuickActionsGrid';
import { EconomicIndicatorsTicker } from '@/components/dashboard/EconomicIndicatorsTicker';
import { useFinancialReports } from '@/hooks/useFinancialReports';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useReportFilters } from '@/hooks/useReportFilters';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useLocalizedCurrency } from '@/hooks/useLocalizedCurrency';
import { CountryFlagBadge } from '@/components/dashboard/CountryFlagBadge';
import { FxImpactWidget } from '@/components/dashboard/FxImpactWidget';
import { TaxDashboardWidget } from '@/components/dashboard/TaxDashboardWidget';

export default function Dashboard() {
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  
  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const { getBalanceSheetData, getIncomeStatementData, isLoading } = useFinancialReports();
  const reportFilters = useReportFilters();
  const { formatCurrency: formatLocalizedCurrency, formatDate, terminology } = useLocalizedCurrency();

  const formatCurrency = (value: number) => {
    return formatLocalizedCurrency(value, { 
      showSymbol: true, 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    });
  };

  // Show org creation dialog if no organization
  if (!orgLoading && !organization) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Building2 className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Welcome to Your Dashboard</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Create an organization to get started with your financial overview.
        </p>
        <Button onClick={() => setShowOrgDialog(true)}>Create Organization</Button>
        <CreateOrganizationDialog open={showOrgDialog} onOpenChange={setShowOrgDialog} />
      </div>
    );
  }

  if (isLoading || orgLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const balanceSheet = getBalanceSheetData();
  const incomeStatement = getIncomeStatementData();

  // Calculate AR and AP from balance sheet accounts
  const arAccounts = balanceSheet.assets.filter(a => 
    a.name.toLowerCase().includes('receivable') || a.code.startsWith('110') || a.code.startsWith('120')
  );
  const accountsReceivable = arAccounts.reduce((sum, a) => sum + a.calculated_balance, 0);

  const apAccounts = balanceSheet.liabilities.filter(a => 
    a.name.toLowerCase().includes('payable') || a.code.startsWith('200') || a.code.startsWith('210')
  );
  const accountsPayable = apAccounts.reduce((sum, a) => sum + a.calculated_balance, 0);

  // Calculate revenue growth (simplified - would need previous period data)
  const revenueGrowth = incomeStatement.totalRevenue > 0 ? 12.5 : 0; // Placeholder

  // Format the reporting period
  const periodStart = formatDate(reportFilters.startDate, 'medium');
  const periodEnd = formatDate(reportFilters.endDate, 'medium');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">
              Financial overview for {organization?.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Country Flag Badge */}
          <CountryFlagBadge />
          {/* Economic Indicators Ticker */}
          <EconomicIndicatorsTicker />
          
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">{periodStart} - {periodEnd}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm font-medium text-success hidden sm:inline">Operational</span>
          </div>
        </div>
      </div>

      {/* Top Row - KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(incomeStatement.totalRevenue)}
          change={revenueGrowth}
          changeLabel="vs last year"
          icon={<DollarSign className="w-6 h-6" />}
          variant="accent"
        />
        <StatCard
          title="Net Income"
          value={formatCurrency(incomeStatement.netIncome)}
          change={incomeStatement.netMargin}
          changeLabel="net margin"
          icon={<TrendingUp className="w-6 h-6" />}
          variant="success"
        />
        <StatCard
          title={terminology.accountsReceivable}
          value={formatCurrency(accountsReceivable)}
          icon={<Wallet className="w-6 h-6" />}
        />
        <StatCard
          title={terminology.accountsPayable}
          value={formatCurrency(accountsPayable)}
          icon={<CreditCard className="w-6 h-6" />}
          variant="warning"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Charts */}
        <div className="lg:col-span-2 space-y-6">
          <RevenueChart />
          <RecentTransactions />
        </div>
        
        {/* Right Column - Insights */}
        <div className="space-y-6">
          <ProfitMarginIndicator 
            revenue={incomeStatement.totalRevenue}
            expenses={incomeStatement.totalExpenses}
            netIncome={incomeStatement.netIncome}
          />
          <FxImpactWidget />
          <TaxDashboardWidget />
          <AlertsCard />
          <CashPositionCard />
        </div>
      </div>

      {/* Secondary Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExpensesPieChart />
        <AccountsSnapshot />
      </div>

      {/* Quick Actions */}
      <QuickActionsGrid />
    </div>
  );
}
