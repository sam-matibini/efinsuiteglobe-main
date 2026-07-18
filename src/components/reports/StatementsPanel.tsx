import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

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
}

function StatementCard({
  title,
  subtitle,
  rows,
  fmt,
}: {
  title: string;
  subtitle: string;
  rows: Row[];
  fmt: (n: number) => string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
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
}: StatementsPanelProps) {
  const periodLabel = `For the period ${format(startDate, 'MMM d, yyyy')} – ${format(endDate, 'MMM d, yyyy')}`;
  const asOfLabel = `As of ${format(endDate, 'MMMM d, yyyy')}`;

  // Income Statement rows
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

  // Balance Sheet rows
  const totalEquityWithNI = (balanceSheet?.totalEquity ?? 0) + (balanceSheet?.netIncome ?? 0);
  const bsRows: Row[] = [
    { label: 'Total Assets', amount: balanceSheet?.totalAssets ?? 0, bold: true },
    { label: 'Total Liabilities', amount: balanceSheet?.totalLiabilities ?? 0, bold: true, divider: true },
    { label: 'Equity (opening + movements)', amount: balanceSheet?.totalEquity ?? 0, indent: true },
    { label: 'Current Year Earnings', amount: balanceSheet?.netIncome ?? 0, indent: true },
    { label: 'Total Equity', amount: totalEquityWithNI, bold: true, divider: true },
    {
      label: 'Total Liabilities + Equity',
      amount: (balanceSheet?.totalLiabilities ?? 0) + totalEquityWithNI,
      bold: true,
    },
  ];

  // Cash Flow rows
  const cfRows: Row[] = [
    { label: 'Net Cash from Operating Activities', amount: cashFlow?.netOperating ?? 0, bold: true },
    { label: 'Net Cash from Investing Activities', amount: cashFlow?.netInvesting ?? 0, bold: true },
    { label: 'Net Cash from Financing Activities', amount: cashFlow?.netFinancing ?? 0, bold: true, divider: true },
    { label: 'Net Change in Cash', amount: cashFlow?.netChange ?? 0, bold: true },
    { label: 'Beginning Cash', amount: cashFlow?.beginningCash ?? 0, indent: true },
    { label: 'Ending Cash', amount: cashFlow?.endingCash ?? 0, bold: true, divider: true },
  ];

  // Statement of Changes in Equity — use balance sheet equity accounts
  const equityAccounts: any[] = balanceSheet?.equity ?? [];
  const totalOpening = equityAccounts.reduce((sum, a) => {
    const sign = a.normal_balance === 'credit' ? 1 : -1;
    return sum + (a.opening_balance || 0) * sign;
  }, 0);
  const totalMovements = equityAccounts.reduce((sum, a) => {
    const sign = a.normal_balance === 'credit' ? 1 : -1;
    return sum + ((a.calculated_balance || 0) - (a.opening_balance || 0)) * sign;
  }, 0);
  const soceRows: Row[] = [
    { label: 'Opening Equity Balance', amount: totalOpening, bold: true },
    { label: 'Equity Movements (contributions / distributions)', amount: totalMovements, indent: true },
    { label: 'Net Income for the Period', amount: balanceSheet?.netIncome ?? 0, indent: true },
    {
      label: 'Closing Equity Balance',
      amount: totalOpening + totalMovements + (balanceSheet?.netIncome ?? 0),
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
        <StatementCard title="Balance Sheet" subtitle={asOfLabel} rows={bsRows} fmt={fmt} />
        <StatementCard title="Cash Flow Statement" subtitle={periodLabel} rows={cfRows} fmt={fmt} />
        <StatementCard title="Statement of Changes in Equity" subtitle={periodLabel} rows={soceRows} fmt={fmt} />
      </div>
    </div>
  );
}
