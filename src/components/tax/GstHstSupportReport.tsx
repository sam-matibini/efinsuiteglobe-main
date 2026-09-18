import { Fragment, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { groupGstHstSupportByLine, type GstHstPeriodSnapshot } from '@/lib/gstHstPeriodEngine';

interface SupportPeriod {
  id: string;
  label: string;
  snapshot: GstHstPeriodSnapshot;
  isLoading?: boolean;
}

interface GstHstSupportReportProps {
  periods: SupportPeriod[];
  formatCurrency: (value: number) => string;
}

export function GstHstSupportReport({ periods, formatCurrency }: GstHstSupportReportProps) {
  const [selectedId, setSelectedId] = useState(periods[0]?.id ?? 'current');
  const selected = periods.find((period) => period.id === selectedId) ?? periods[0];
  const groups = useMemo(
    () => (selected ? groupGstHstSupportByLine(selected.snapshot.supportRows) : []),
    [selected],
  );

  if (periods.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex flex-col gap-2 mb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-medium text-foreground">GST/HST support report</h4>
          <p className="text-xs text-muted-foreground">
            Source documents that support the CRA working-copy totals for the selected period.
          </p>
        </div>
        {periods.length > 1 && (
          <Tabs value={selected?.id} onValueChange={setSelectedId}>
            <TabsList className="h-auto flex-wrap">
              {periods.map((period) => (
                <TabsTrigger key={period.id} value={period.id} className="text-xs">
                  {period.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </div>
      <div className="border rounded-lg overflow-hidden max-h-[32rem] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Number</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Tax code</TableHead>
              <TableHead>CRA line</TableHead>
              <TableHead className="text-right">Amount (ex tax)</TableHead>
              <TableHead className="text-right">GST/HST</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {selected?.isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-sm text-muted-foreground text-center py-6">
                  Loading period support…
                </TableCell>
              </TableRow>
            ) : groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-sm text-muted-foreground text-center py-6">
                  No invoices, bills, or expenses in this period.
                </TableCell>
              </TableRow>
            ) : (
              groups.map((group) => (
                <Fragment key={group.line}>
                  <TableRow className="bg-muted/40">
                    <TableCell colSpan={6} className="font-medium">
                      Line {group.line}: {group.label}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        ({group.rows.length} {group.rows.length === 1 ? 'document' : 'documents'})
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(group.taxableAmount)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(group.taxAmount)}</TableCell>
                  </TableRow>
                  {group.rows.map((row, idx) => (
                    <TableRow key={`${group.line}-${row.number}-${idx}`}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {row.date ? format(parseLocalDate(row.date), 'MMM d, yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-sm">{row.type}</TableCell>
                      <TableCell className="font-mono text-xs">{row.number || '—'}</TableCell>
                      <TableCell className="text-sm max-w-[220px] truncate">{row.description}</TableCell>
                      <TableCell>
                        {row.taxCode ? <Badge variant="outline">{row.taxCode}</Badge> : '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.craLine}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatCurrency(row.taxableAmount)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatCurrency(row.taxAmount)}</TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
