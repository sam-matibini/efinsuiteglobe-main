import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, AlertTriangle, CheckCircle2, TrendingUp, DollarSign, PieChart } from 'lucide-react';
import { useDonations, useDonationPrograms } from '@/hooks/useDonations';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { ReportActions, type ReportData } from '@/components/reports/ReportActions';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type FiscalYear = string;

export function T3010Report() {
  const { organization } = useCurrentOrganization();
  const { data: donations = [] } = useDonations();
  const { data: programs = [] } = useDonationPrograms();
  
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<FiscalYear>(String(currentYear));

  // Fiscal year boundaries
  const startDate = `${selectedYear}-01-01`;
  const endDate = `${selectedYear}-12-31`;

  // Fetch GL accounts for metadata (t3010_category mapping)
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts-for-t3010', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('accounts')
        .select('id, code, name, account_type, account_group, t3010_category')
        .eq('organization_id', organization.id)
        .eq('is_active', true)
        .eq('is_header', false);
      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id,
  });

  // Fetch period-filtered GL balances from journal entries
  const { data: glBalances = new Map<string, number>() } = useQuery({
    queryKey: ['t3010-gl-balances', organization?.id, selectedYear],
    queryFn: async () => {
      if (!organization?.id) return new Map<string, number>();
      const { data: journalLines, error } = await supabase
        .from('journal_entry_lines')
        .select(`
          account_id,
          debit,
          credit,
          journal_entry:journal_entries!inner(status, entry_date, organization_id)
        `)
        .eq('journal_entry.organization_id', organization.id)
        .eq('journal_entry.status', 'posted')
        .gte('journal_entry.entry_date', startDate)
        .lte('journal_entry.entry_date', endDate);

      if (error) throw error;

      const balanceMap = new Map<string, number>();
      for (const line of journalLines || []) {
        const current = balanceMap.get(line.account_id) || 0;
        // Net amount: debit - credit (positive for expenses/assets, we'll adjust per type later)
        balanceMap.set(line.account_id, current + (line.debit - line.credit));
      }
      return balanceMap;
    },
    enabled: !!organization?.id,
  });

  // Filter donations by fiscal year (for supplementary counts)
  const yearDonations = useMemo(() =>
    donations.filter(d => new Date(d.date_received).getFullYear() === parseInt(selectedYear)),
    [donations, selectedYear]
  );

  // Available years from donations
  const availableYears = useMemo(() => {
    const years = new Set(donations.map(d => String(new Date(d.date_received).getFullYear())));
    years.add(String(currentYear));
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [donations, currentYear]);

  const { formatWithSymbol } = useCurrencyFormatter();
  const formatCurrency = formatWithSymbol;

  // Helper: sum GL balances for accounts matching a filter
  const sumGlByCategory = (accountType: string, t3010Category: string | null, includeUnmapped = false) => {
    return accounts
      .filter(a => {
        if (a.account_type !== accountType) return false;
        if (includeUnmapped) return a.t3010_category === t3010Category || !a.t3010_category;
        return a.t3010_category === t3010Category;
      })
      .reduce((sum, a) => {
        const raw = glBalances.get(a.id) || 0;
        // Income accounts: credit-normal, so net revenue = -(debit-credit) = credit-debit
        // Expense accounts: debit-normal, so net expense = debit-credit (already positive)
        // Asset accounts: debit-normal
        if (accountType === 'income') return sum + Math.abs(-raw); // credits - debits
        return sum + Math.abs(raw);
      }, 0);
  };

  // ===== SCHEDULE 6: FINANCIAL INFORMATION =====

  // Revenue breakdown — all from GL, period-filtered
  const revenueData = useMemo(() => {
    const receipted = sumGlByCategory('income', 'receipted_gifts');
    const nonReceipted = sumGlByCategory('income', 'non_receipted_gifts');
    const governmentGrants = sumGlByCategory('income', 'government_grants');
    const fundraisingRevenue = sumGlByCategory('income', 'fundraising_revenue');
    const investmentIncome = sumGlByCategory('income', 'investment_income');
    const otherRevenue = sumGlByCategory('income', 'other_revenue', true); // includes unmapped

    const totalRevenue = receipted + nonReceipted + governmentGrants + fundraisingRevenue + investmentIncome + otherRevenue;

    return {
      receipted, nonReceipted,
      governmentGrants, fundraisingRevenue, investmentIncome, otherRevenue, totalRevenue,
    };
  }, [accounts, glBalances]);

  // Expenditure breakdown — all from GL, period-filtered
  const expenseData = useMemo(() => {
    const charitablePrograms = sumGlByCategory('expense', 'charitable_programs');
    const managementAdmin = sumGlByCategory('expense', 'management_admin');
    const fundraising = sumGlByCategory('expense', 'fundraising');
    const politicalActivities = sumGlByCategory('expense', 'political_activities');
    const otherExpenses = sumGlByCategory('expense', 'other_expenditures', true); // includes unmapped

    const totalExpenses = charitablePrograms + managementAdmin + fundraising + politicalActivities + otherExpenses;

    return {
      charitablePrograms, managementAdmin, fundraising, politicalActivities, otherExpenses, totalExpenses,
    };
  }, [accounts, glBalances]);

  // Unmapped accounts warning
  const unmappedExpenseCount = useMemo(() => {
    return accounts.filter(a => a.account_type === 'expense' && !a.t3010_category).length;
  }, [accounts]);

  const unmappedIncomeCount = useMemo(() => {
    return accounts.filter(a => a.account_type === 'income' && !a.t3010_category).length;
  }, [accounts]);

  // ===== COMPLIANCE RATIOS =====

  // Total assets from GL (period-filtered)
  const totalAssets = useMemo(() => {
    return accounts
      .filter(a => a.account_type === 'asset')
      .reduce((sum, a) => sum + (glBalances.get(a.id) || 0), 0);
  }, [accounts, glBalances]);

  // Disbursement quota: 3.5% of assets over $25,000
  const disbursementQuota = useMemo(() => {
    const assetsOver25k = Math.max(totalAssets - 25000, 0);
    return assetsOver25k * 0.035;
  }, [totalAssets]);

  const fundraisingRatio = useMemo(() => {
    if (revenueData.totalRevenue === 0) return 0;
    return (expenseData.fundraising / revenueData.totalRevenue) * 100;
  }, [expenseData.fundraising, revenueData.totalRevenue]);

  const charitableProgramRatio = useMemo(() => {
    if (expenseData.totalExpenses === 0) return 0;
    return (expenseData.charitablePrograms / expenseData.totalExpenses) * 100;
  }, [expenseData]);

  const meetsDisburseQuota = expenseData.charitablePrograms >= disbursementQuota;

  // Donation counts (supplementary info from donation module)
  const donationCounts = useMemo(() => {
    const confirmed = yearDonations.filter(d => d.status === 'confirmed').length;
    const receipted = yearDonations.filter(d => d.receipt_issued).length;
    const cancelled = yearDonations.filter(d => d.status === 'cancelled').length;
    return { confirmed, receipted, cancelled, total: yearDonations.length };
  }, [yearDonations]);

  // ===== EXPORT DATA =====
  const reportData: ReportData = useMemo(() => ({
    title: `CRA T3010 Charity Return Summary`,
    subtitle: `Fiscal Year ${selectedYear}`,
    organizationName: organization?.name || '',
    dateRange: `January 1 - December 31, ${selectedYear}`,
    headers: ['Line Item', 'Amount'],
    rows: [
      ['SCHEDULE 6 - REVENUE', ''],
      ['4500 - Tax-receipted gifts', formatCurrency(revenueData.receipted)],
      ['4510 - Gifts for which a tax receipt was not issued', formatCurrency(revenueData.nonReceipted)],
      ['4530 - Government grants', formatCurrency(revenueData.governmentGrants)],
      ['4540 - Fundraising revenue', formatCurrency(revenueData.fundraisingRevenue)],
      ['4560 - Investment income', formatCurrency(revenueData.investmentIncome)],
      ['4570 - Other revenue', formatCurrency(revenueData.otherRevenue)],
      ['Total Revenue', formatCurrency(revenueData.totalRevenue)],
      ['', ''],
      ['SCHEDULE 6 - EXPENDITURES', ''],
      ['4800 - Charitable programs', formatCurrency(expenseData.charitablePrograms)],
      ['4810 - Management & administration', formatCurrency(expenseData.managementAdmin)],
      ['4820 - Fundraising', formatCurrency(expenseData.fundraising)],
      ['4830 - Political activities', formatCurrency(expenseData.politicalActivities)],
      ['4840 - Other expenditures', formatCurrency(expenseData.otherExpenses)],
      ['Total Expenditures', formatCurrency(expenseData.totalExpenses)],
      ['', ''],
      ['COMPLIANCE RATIOS', ''],
      ['Total assets', formatCurrency(totalAssets)],
      ['Disbursement quota (3.5% of assets > $25K)', formatCurrency(disbursementQuota)],
      ['Charitable program spending', formatCurrency(expenseData.charitablePrograms)],
      ['Meets disbursement quota', meetsDisburseQuota ? 'YES' : 'NO'],
      ['Fundraising ratio', `${fundraisingRatio.toFixed(1)}%`],
      ['Charitable program ratio', `${charitableProgramRatio.toFixed(1)}%`],
    ],
    totals: [
      { label: 'Total Revenue', value: formatCurrency(revenueData.totalRevenue) },
      { label: 'Total Expenditures', value: formatCurrency(expenseData.totalExpenses) },
      { label: 'Excess (Deficiency)', value: formatCurrency(revenueData.totalRevenue - expenseData.totalExpenses) },
    ],
  }), [selectedYear, organization, revenueData, expenseData, totalAssets, disbursementQuota, meetsDisburseQuota, fundraisingRatio, charitableProgramRatio]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-xl font-bold text-foreground">CRA T3010 Charity Return</h2>
            <p className="text-sm text-muted-foreground">Registered Charity Information Return Summary</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(y => (
                <SelectItem key={y} value={y}>FY {y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ReportActions reportData={reportData} variant="compact" />
        </div>
      </div>

      {/* Unmapped Accounts Warning */}
      {(unmappedExpenseCount > 0 || unmappedIncomeCount > 0) && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-700">Unmapped Accounts Detected</p>
            <p className="text-amber-600 mt-1">
              {unmappedExpenseCount > 0 && `${unmappedExpenseCount} expense account(s)`}
              {unmappedExpenseCount > 0 && unmappedIncomeCount > 0 && ' and '}
              {unmappedIncomeCount > 0 && `${unmappedIncomeCount} income account(s)`}
              {' '}without T3010 Schedule 6 mapping will be reported under "Other". 
              Assign T3010 categories in the Chart of Accounts for accurate reporting.
            </p>
          </div>
        </div>
      )}

      {/* Compliance Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Total Revenue</p>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(revenueData.totalRevenue)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Total Expenditures</p>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(expenseData.totalExpenses)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <PieChart className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Fundraising Ratio</p>
          </div>
          <p className="text-2xl font-bold">{fundraisingRatio.toFixed(1)}%</p>
          <Badge variant={fundraisingRatio <= 35 ? 'default' : 'destructive'} className="mt-1 text-xs">
            {fundraisingRatio <= 35 ? 'Acceptable' : 'Above CRA threshold'}
          </Badge>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            {meetsDisburseQuota ? (
              <CheckCircle2 className="w-4 h-4 text-success" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-destructive" />
            )}
            <p className="text-sm text-muted-foreground">Disbursement Quota</p>
          </div>
          <p className="text-2xl font-bold">{meetsDisburseQuota ? 'Met' : 'Not Met'}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Required: {formatCurrency(disbursementQuota)}
          </p>
        </Card>
      </div>

      {/* Schedule 6: Revenue */}
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">Schedule 6 — Revenue</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>T3010 Line</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="text-muted-foreground">4500</TableCell>
              <TableCell>Tax-receipted gifts (donations with official receipts)</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(revenueData.receipted)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-muted-foreground">4510</TableCell>
              <TableCell>Gifts for which a tax receipt was not issued</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(revenueData.nonReceipted)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-muted-foreground">4530</TableCell>
              <TableCell>Revenue from federal, provincial/territorial governments</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(revenueData.governmentGrants)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-muted-foreground">4540</TableCell>
              <TableCell>Fundraising revenue</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(revenueData.fundraisingRevenue)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-muted-foreground">4560</TableCell>
              <TableCell>Interest and investment income</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(revenueData.investmentIncome)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-muted-foreground">4570</TableCell>
              <TableCell>All other revenue</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(revenueData.otherRevenue)}</TableCell>
            </TableRow>
            <TableRow className="font-bold border-t-2">
              <TableCell></TableCell>
              <TableCell>Total Revenue (Line 4700)</TableCell>
              <TableCell className="text-right">{formatCurrency(revenueData.totalRevenue)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      {/* Schedule 6: Expenditures */}
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">Schedule 6 — Expenditures</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>T3010 Line</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="text-muted-foreground">4800</TableCell>
              <TableCell>Expenditures on charitable activities (programs)</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(expenseData.charitablePrograms)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-muted-foreground">4810</TableCell>
              <TableCell>Management and administration</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(expenseData.managementAdmin)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-muted-foreground">4820</TableCell>
              <TableCell>Fundraising expenditures</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(expenseData.fundraising)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-muted-foreground">4830</TableCell>
              <TableCell>Political activities</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(expenseData.politicalActivities)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-muted-foreground">4840</TableCell>
              <TableCell>All other expenditures</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(expenseData.otherExpenses)}</TableCell>
            </TableRow>
            <TableRow className="font-bold border-t-2">
              <TableCell></TableCell>
              <TableCell>Total Expenditures (Line 4850)</TableCell>
              <TableCell className="text-right">{formatCurrency(expenseData.totalExpenses)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      {/* Compliance Analysis */}
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">Compliance Analysis</h3>
        <div className="space-y-4">
          {/* Disbursement Quota */}
          <div className="flex items-start gap-3 p-4 rounded-lg border">
            {meetsDisburseQuota ? (
              <CheckCircle2 className="w-5 h-5 text-success mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-medium">Disbursement Quota</p>
              <p className="text-sm text-muted-foreground">
                Registered charities must spend at least 3.5% of property not used in charitable activities or administration 
                (average value of assets exceeding $25,000) on charitable programs or gifts to qualified donees.
              </p>
              <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Assets</p>
                  <p className="font-medium">{formatCurrency(totalAssets)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Required Spending</p>
                  <p className="font-medium">{formatCurrency(disbursementQuota)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Actual Charitable Spending</p>
                  <p className="font-medium">{formatCurrency(expenseData.charitablePrograms)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Fundraising Ratio */}
          <div className="flex items-start gap-3 p-4 rounded-lg border">
            {fundraisingRatio <= 35 ? (
              <CheckCircle2 className="w-5 h-5 text-success mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-medium">Fundraising Ratio</p>
              <p className="text-sm text-muted-foreground">
                CRA considers fundraising costs exceeding 35% of total revenue as a potential compliance issue. 
                Ratios above 35% may trigger CRA review.
              </p>
              <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Fundraising Costs</p>
                  <p className="font-medium">{formatCurrency(expenseData.fundraising)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Revenue</p>
                  <p className="font-medium">{formatCurrency(revenueData.totalRevenue)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ratio</p>
                  <p className="font-medium">{fundraisingRatio.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Charitable Program Ratio */}
          <div className="flex items-start gap-3 p-4 rounded-lg border">
            {charitableProgramRatio >= 50 ? (
              <CheckCircle2 className="w-5 h-5 text-success mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-medium">Charitable Program Spending Ratio</p>
              <p className="text-sm text-muted-foreground">
                The percentage of total expenditures directed to charitable programs. 
                CRA expects the majority of spending to support the charity's stated purposes.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Program Spending</p>
                  <p className="font-medium">{formatCurrency(expenseData.charitablePrograms)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ratio</p>
                  <p className="font-medium">{charitableProgramRatio.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Donation Summary */}
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">Donation Summary — FY {selectedYear}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">{donationCounts.total}</p>
            <p className="text-sm text-muted-foreground">Total Donations</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">{donationCounts.confirmed}</p>
            <p className="text-sm text-muted-foreground">Confirmed</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">{donationCounts.receipted}</p>
            <p className="text-sm text-muted-foreground">Receipts Issued</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">{donationCounts.cancelled}</p>
            <p className="text-sm text-muted-foreground">Cancelled</p>
          </div>
        </div>
      </Card>

      {/* Programs Summary */}
      {programs.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold text-lg mb-4">Charitable Programs</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Program Name</TableHead>
                <TableHead className="text-right">Budget</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {programs.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground">{p.code}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell className="text-right">{formatCurrency(p.budget)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Disclaimer */}
      <Card className="p-4 bg-muted/30 border-dashed">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            This report is a <strong>working summary</strong> to assist with preparing your CRA T3010 Registered Charity Information Return. 
            It does not constitute the official T3010 filing. All figures should be verified by a qualified accountant before submission. 
            The official T3010 must be filed within 6 months of the charity's fiscal year-end via CRA My Business Account.
          </p>
        </div>
      </Card>
    </div>
  );
}
