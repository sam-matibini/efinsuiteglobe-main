import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GstHstPeriodSnapshot } from '@/lib/gstHstPeriodEngine';
import { buildGstHstQbSummary, formatQbPeriodHeading } from '@/lib/gstHstStatement';

interface GstHstSummaryReportProps {
  organizationName?: string | null;
  snapshot: GstHstPeriodSnapshot;
  formatCurrency: (value: number) => string;
}

function formatPlain(value: number | null) {
  if (value === null) return '';
  return new Intl.NumberFormat('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function GstHstSummaryReport({ organizationName, snapshot, formatCurrency }: GstHstSummaryReportProps) {
  const lines = buildGstHstQbSummary(snapshot);
  const year = snapshot.periodEnd.slice(0, 4);

  return (
    <div className="bg-background">
      <div className="flex justify-end mb-4 print:hidden">
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>
      <div className="max-w-4xl mx-auto text-sm">
        <header className="text-center mb-8">
          <h2 className="text-lg font-semibold">{organizationName || 'Organization'} {year}</h2>
          <p className="text-xs tracking-wide">GST/HST Summary Report</p>
          <p className="font-semibold mt-1">{formatQbPeriodHeading(snapshot.periodStart, snapshot.periodEnd)}</p>
          <p className="text-xs text-muted-foreground">Accrual Basis</p>
        </header>
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="text-left font-medium py-2 pr-4">Line description</th>
              <th className="text-right font-medium py-2 px-2">Amount</th>
              <th className="text-right font-medium py-2 px-2">Exception amount</th>
              <th className="text-right font-medium py-2 px-2">Total line amount</th>
              <th className="text-right font-medium py-2 pl-2">Balance</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.code} className={line.emphasize ? 'font-semibold' : undefined}>
                <td className="py-1.5 pr-4">{line.description}</td>
                <td className="text-right font-mono py-1.5 px-2">{formatPlain(line.amount)}</td>
                <td className="text-right font-mono py-1.5 px-2">{formatPlain(line.exceptionAmount)}</td>
                <td className="text-right font-mono py-1.5 px-2">{formatPlain(line.totalLineAmount)}</td>
                <td className="text-right font-mono py-1.5 pl-2">
                  {line.balance === null ? '' : formatCurrency(line.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
