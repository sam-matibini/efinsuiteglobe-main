import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

interface Row {
  label: string;
  amount: number;
  bold?: boolean;
  indent?: boolean;
  divider?: boolean;
}

interface StatementsPanelProps {
  organizationName: string;
  startDate: Date;
  endDate: Date;
  balanceSheet: any;
  incomeStatement: any;
  cashFlow: any;
  fmt: (n: number) => string;
  /** Closing balance from Statement of Retained Earnings (already includes period NI) */
  reClosingBalance?: number;
  /** Net income for the period from Statement of Retained Earnings */
  rePeriodNetIncome?: number;
}

// ---------------------------------------------------------------------------
// Equity classification helpers — kept in sync with src/pages/BalanceSheet.tsx
// ---------------------------------------------------------------------------
const isCurrentYearEarningsEquityAccount = (a: any): boolean => {
  const n = (a?.name ?? '').toLowerCase();
  return (
    a?.code === '3-00-202' ||
    n.includes('current year earning') ||
    n.includes('current earnings') ||
    n === 'current year net income' ||
    n === 'current year income' ||
    n.includes('current year excess') ||
    n.includes('current year surplus') ||
    n.includes('excess (deficiency)')
  );
};

const isRetainedEarningsEquityAccount = (a: any): boolean => {
  const n = (a?.name ?? '').toLowerCase();
  return (
    a?.code === '3-00-201' ||
    n === 'retained earnings' ||
    n === 'retained profits' ||
    n.includes('retained earnings') ||
    n.includes('accumulated deficit') ||
    n.includes('accumulated earnings') ||
    n.includes('unrestricted net assets') ||
    n.includes('accumulated surplus') ||
    n.includes('unrestricted funds') ||
    n.includes('accumulated funds')
  );
};

const isDividendOrContraEquityAccount = (a: any): boolean => {
  const n = (a?.name ?? '').toLowerCase();
  return (
    (a?.account_type === 'equity' && a?.normal_balance === 'debit') ||
    n.includes('dividend') ||
    n.includes("owner's draw") ||
    n.includes('owner draw') ||
    n.includes('owners draw') ||
    n.includes('shareholder draw') ||
    n.includes('drawing') ||
    n.includes('distribution') ||
    n.includes('treasury stock') ||
    n.includes('treasury shares')
  );
};

const isExcludedFromEquityTotal = (a: any): boolean =>
  isCurrentYearEarningsEquityAccount(a) ||
  isRetainedEarningsEquityAccount(a) ||
  isDividendOrContraEquityAccount(a);

function StatementCard({
  title,
  subtitle,
  rows,
  fmt,
  headerRight,
}: {
  title: string;
  subtitle: string;
  rows: Row[];
  fmt: (n: number) => string;
  headerRight?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          {headerRight}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm">
          {rows.map((r, i) => (
            <div key={i}>
              {r.divider && <Separator className="my-1.5" />}
              <div
                className={`flex justify-between py-1 ${r.bold ? 'font-semibold' : ''} ${
                  r.indent ? 'pl-4 text-muted-foreground' : ''
                }`}
              >
                <span>{r.label}</span>
                <span className="tabular-nums">{fmt(r.amount)}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function StatementsPanel({
  startDate,
  endDate,
  balanceSheet,
  incomeStatement,
  cashFlow,
  fmt,
  reClosingBalance,
  rePeriodNetIncome,
}: StatementsPanelProps) {
  const periodLabel = `For the period ${format(startDate, 'MMM d, yyyy')} – ${format(endDate, 'MMM d, yyyy')}`;
  const asOfLabel = `As of ${format(endDate, 'MMMM d, yyyy')}`;

  // ------------------------------------------------------------------
  // Income Statement
  // ------------------------------------------------------------------
  const isRows: Row[] = [
    { label: 'Revenue', amount: incomeStatement?.totalRevenue ?? 0, bold: true },
    { label: 'Cost of Goods Sold', amount: -(incomeStatement?.totalCOGS ?? 0), indent: true },
    { label: 'Gross Profit', amount: incomeStatement?.grossProfit ?? 0, bold: true, divider: true },
    { label: 'Operating Expenses', amount: -(incomeStatement?.totalExpenses ?? 0), indent: true },
    { label: 'Operating Income', amount: incomeStatement?.operatingIncome ?? 0, bold: true, divider: true },
    { label: 'Other Income', amount: incomeStatement?.totalOtherIncome ?? 0, indent: true },
    { label: 'Other Expenses', amount: -(incomeStatement?.totalNonOperatingExpenses ?? 0), indent: true },
    { label: 'Income Before Tax', amount: incomeStatement?.incomeBeforeTax ?? 0, bold: true, divider: true },
    { label: 'Income Tax Expense', amount: -(incomeStatement?.totalIncomeTax ?? 0), indent: true },
    { label: 'Net Income', amount: incomeStatement?.netIncome ?? 0, bold: true, divider: true },
  ];

  // ------------------------------------------------------------------
  // Balance Sheet — mirrors src/pages/BalanceSheet.tsx equity formula:
  //   totalEquity = otherEquity (excl. RE + CYE + contra) + reClosingBalance
  // reClosingBalance already includes period Net Income.
  // ------------------------------------------------------------------
  const equityAccounts: any[] = balanceSheet?.equity ?? [];

  const otherEquity = equityAccounts
    .filter((a) => !isExcludedFromEquityTotal(a))
    .reduce((sum, a) => {
      const sign = a.normal_balance === 'credit' ? 1 : -1;
      return sum + (Number(a.calculated_balance) || 0) * sign;
    }, 0);

  // Fallback when RE statement hasn't loaded yet: use the hook's raw totals so
  // the panel still renders sensible numbers.
  const reClosing =
    typeof reClosingBalance === 'number'
      ? reClosingBalance
      : (balanceSheet?.netIncome ?? 0) +
        equityAccounts
          .filter((a) => isRetainedEarningsEquityAccount(a))
          .reduce((sum, a) => {
            const sign = a.normal_balance === 'credit' ? 1 : -1;
            return sum + (Number(a.calculated_balance) || 0) * sign;
          }, 0);

  const totalAssets = balanceSheet?.totalAssets ?? 0;
  const totalLiabilities = balanceSheet?.totalLiabilities ?? 0;
  const totalEquity = otherEquity + reClosing;
  const totalLiabAndEquity = totalLiabilities + totalEquity;
  const balanceDiff = Math.abs(totalAssets - totalLiabAndEquity);
  const isBalanced = balanceDiff < 0.02;

  const bsRows: Row[] = [
    { label: 'Total Assets', amount: totalAssets, bold: true },
    { label: 'Total Liabilities', amount: totalLiabilities, bold: true, divider: true },
    { label: 'Other Equity (opening + movements)', amount: otherEquity, indent: true },
    { label: 'Retained Earnings (closing, incl. current year)', amount: reClosing, indent: true },
    { label: 'Total Equity', amount: totalEquity, bold: true, divider: true },
    { label: 'Total Liabilities + Equity', amount: totalLiabAndEquity, bold: true },
  ];

  // ------------------------------------------------------------------
  // Cash Flow
  // ------------------------------------------------------------------
  const cfRows: Row[] = [
    { label: 'Net Cash from Operating Activities', amount: cashFlow?.netOperating ?? 0, bold: true },
    { label: 'Net Cash from Investing Activities', amount: cashFlow?.netInvesting ?? 0, bold: true },
    { label: 'Net Cash from Financing Activities', amount: cashFlow?.netFinancing ?? 0, bold: true, divider: true },
    { label: 'Net Change in Cash', amount: cashFlow?.netChange ?? 0, bold: true },
    { label: 'Beginning Cash', amount: cashFlow?.beginningCash ?? 0, indent: true },
    { label: 'Ending Cash', amount: cashFlow?.endingCash ?? 0, bold: true, divider: true },
  ];

  // ------------------------------------------------------------------
  // Statement of Changes in Equity
  // Uses period NI from the RE statement so the four cards reconcile.
  // ------------------------------------------------------------------
  const totalOpening = equityAccounts.reduce((sum, a) => {
    const sign = a.normal_balance === 'credit' ? 1 : -1;
    return sum + (Number(a.opening_balance) || 0) * sign;
  }, 0);
  const totalMovements = equityAccounts.reduce((sum, a) => {
    const sign = a.normal_balance === 'credit' ? 1 : -1;
    return sum + ((Number(a.calculated_balance) || 0) - (Number(a.opening_balance) || 0)) * sign;
  }, 0);
  const periodNI =
    typeof rePeriodNetIncome === 'number' ? rePeriodNetIncome : (incomeStatement?.netIncome ?? 0);
  // Movements from the ledger already include the current-period NI closed
  // through temporary accounts, so we deliberately DO NOT add it a second
  // time. If the movement figure is (near) zero and the RE statement gives us
  // a period NI, surface that as a separate line for readability.
  const soceRows: Row[] = [
    { label: 'Opening Equity Balance', amount: totalOpening, bold: true },
    { label: 'Equity Movements (contributions / distributions / NI)', amount: totalMovements, indent: true },
    { label: 'Net Income for the Period (memo)', amount: periodNI, indent: true },
    {
      label: 'Closing Equity Balance',
      amount: totalOpening + totalMovements,
      bold: true,
      divider: true,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground print:hidden">
        Interim / year-to-date financial statements for management review. These are condensed,
        unaudited summaries based on the current filter period. For full statements with account
        detail and comparatives, visit the individual report pages.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StatementCard title="Income Statement" subtitle={periodLabel} rows={isRows} fmt={fmt} />
        <StatementCard
          title="Balance Sheet"
          subtitle={asOfLabel}
          rows={bsRows}
          fmt={fmt}
          headerRight={
            <Badge variant={isBalanced ? 'secondary' : 'destructive'} className="shrink-0">
              {isBalanced ? 'Balanced' : `Out of balance by ${fmt(balanceDiff)}`}
            </Badge>
          }
        />
        <StatementCard title="Cash Flow Statement" subtitle={periodLabel} rows={cfRows} fmt={fmt} />
        <StatementCard title="Statement of Changes in Equity" subtitle={periodLabel} rows={soceRows} fmt={fmt} />
      </div>
    </div>
  );
}
