import { Fragment } from 'react';
import { Printer } from 'lucide-react';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { GstHstPeriodSnapshot } from '@/lib/gstHstPeriodEngine';
import { buildGstHstQbDetail, formatQbPeriodHeading } from '@/lib/gstHstStatement';

interface GstHstDetailReportProps {
  organizationName?: string | null;
  snapshot: GstHstPeriodSnapshot;
  formatCurrency: (value: number) => string;
}

function formatRate(rate: number) {
  return `${rate.toFixed(2)}%`;
}

export function GstHstDetailReport({ organizationName, snapshot, formatCurrency }: GstHstDetailReportProps) {
  const groups = buildGstHstQbDetail(snapshot.supportRows);
  const year = snapshot.periodEnd.slice(0, 4);

  return (
    <div className="bg-background">
      <div className="flex justify-end mb-4 print:hidden">
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>
      <div className="overflow-x-auto">
        <header className="text-center mb-8">
          <h2 className="text-lg font-semibold">{organizationName || 'Organization'} {year}</h2>
          <p className="text-xs tracking-wide">GST/HST Detail Report</p>
          <p className="font-semibold mt-1">{formatQbPeriodHeading(snapshot.periodStart, snapshot.periodEnd)}</p>
          <p className="text-xs text-muted-foreground">Accrual Basis</p>
        </header>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="uppercase tracking-wide text-muted-foreground text-[10px]">
              <th className="text-left font-medium py-2 pr-2">Date</th>
              <th className="text-left font-medium py-2 px-2">Transaction type</th>
              <th className="text-left font-medium py-2 px-2">#</th>
              <th className="text-left font-medium py-2 px-2">Memo/Description</th>
              <th className="text-left font-medium py-2 px-2">Name</th>
              <th className="text-left font-medium py-2 px-2">Tax code</th>
              <th className="text-right font-medium py-2 px-2">Tax rate</th>
              <th className="text-right font-medium py-2 px-2">Net amount</th>
              <th className="text-right font-medium py-2 px-2">Amount</th>
              <th className="text-right font-medium py-2 pl-2">Balance</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center text-muted-foreground py-8">
                  No GST/HST documents in this period.
                </td>
              </tr>
            ) : (
              groups.map((group) => (
                <Fragment key={group.line}>
                  <tr key={`h-${group.line}`} className="border-t">
                    <td colSpan={10} className="pt-5 pb-2 font-semibold">
                      Line {group.line} {group.label}
                    </td>
                  </tr>
                  {group.rows.map((row, index) => (
                    <tr key={`${group.line}-${row.number}-${index}`}>
                      <td className="py-1 pr-2 whitespace-nowrap">
                        {row.date ? format(parseLocalDate(row.date), 'dd/MM/yyyy') : '—'}
                      </td>
                      <td className="py-1 px-2">{row.type}</td>
                      <td className="py-1 px-2 font-mono">{row.number || '—'}</td>
                      <td className="py-1 px-2 max-w-[220px] truncate">{row.description}</td>
                      <td className="py-1 px-2 max-w-[220px] truncate">{row.name || '—'}</td>
                      <td className="py-1 px-2">{row.taxCode}</td>
                      <td className="py-1 px-2 text-right font-mono">{formatRate(row.taxRate)}</td>
                      <td className="py-1 px-2 text-right font-mono">{formatCurrency(row.taxableAmount)}</td>
                      <td className="py-1 px-2 text-right font-mono">{formatCurrency(row.taxAmount)}</td>
                      <td className="py-1 pl-2 text-right font-mono">{formatCurrency(row.balance)}</td>
                    </tr>
                  ))}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
