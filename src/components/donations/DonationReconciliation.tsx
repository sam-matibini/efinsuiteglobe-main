import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, CheckCircle2, Info, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDonationReconciliation } from '@/hooks/useDonationReconciliation';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

import { Skeleton } from '@/components/ui/skeleton';
import { ReportActions, type ReportData } from '@/components/reports/ReportActions';

export function DonationReconciliation() {
  const { formatWithSymbol } = useCurrencyFormatter();
  const fmt = formatWithSymbol;

  // Default to calendar year
  const currentYear = new Date().getFullYear();
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(`${currentYear}-12-31`);

  const { data, isLoading, refetch, isFetching } = useDonationReconciliation(startDate, endDate);

  const isBalanced = data && Math.abs(data.totalVariance) < 0.01;

  const reportData: ReportData | null = useMemo(() => {
    if (!data) return null;
    return {
      title: 'Donation Reconciliation Report',
      subtitle: `${startDate} to ${endDate}`,
      headers: ['Account Code', 'Account Name', 'T3010 Line', 'GL Balance', 'Donations Module', 'Variance'],
      rows: [
        ...data.lines.map(l => [
          l.accountCode,
          l.accountName,
          l.t3010Category || '—',
          fmt(l.glBalance),
          fmt(l.donationModuleTotal),
          fmt(l.variance),
        ]),
        ['', 'TOTAL', '', fmt(data.totalGl), fmt(data.totalDonations), fmt(data.totalVariance)],
      ],
    };
  }, [data, startDate, endDate, fmt]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Start Date</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">End Date</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40" />
          </div>
          <Button onClick={() => refetch()} disabled={isFetching} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Running…' : 'Run Reconciliation'}
          </Button>
          <div className="flex-1" />
          {reportData && <ReportActions reportData={reportData} />}
        </div>
      </Card>

      {/* Status Banner */}
      {data && (
        <Card className={`p-4 flex items-center gap-3 ${isBalanced ? 'border-success/50 bg-success/5' : 'border-warning/50 bg-warning/5'}`}>
          {isBalanced ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-success" />
              <span className="font-medium text-success">Balanced — GL and Donations module totals match.</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-5 h-5 text-warning" />
              <div>
                <span className="font-medium text-warning">Variance of {fmt(data.totalVariance)} detected.</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  This may be caused by donations not posted to GL, transactions posted directly to GL without a donation record, or different posting accounts.
                </p>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Unlinked donations info */}
      {data && data.unlinkedDonations > 0 && (
        <Card className="p-3 flex items-center gap-2 border-primary/30 bg-primary/5">
          <Info className="w-4 h-4 text-primary" />
          <span className="text-sm text-muted-foreground">
            <strong>{data.unlinkedDonations}</strong> confirmed donation(s) have no GL journal entry and are not reflected in the General Ledger.
          </span>
        </Card>
      )}

      {/* Reconciliation Table */}
      <Card>
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : data && data.lines.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account Code</TableHead>
                <TableHead>Account Name</TableHead>
                <TableHead>T3010 Line</TableHead>
                <TableHead className="text-right">GL Balance</TableHead>
                <TableHead className="text-right">Donations Module</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.lines.map(line => {
                const matched = Math.abs(line.variance) < 0.01;
                return (
                  <TableRow key={line.accountId}>
                    <TableCell className="font-mono text-sm">{line.accountCode}</TableCell>
                    <TableCell>{line.accountName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{line.t3010Category || '—'}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(line.glBalance)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(line.donationModuleTotal)}</TableCell>
                    <TableCell className={`text-right font-mono ${!matched ? 'text-warning font-medium' : ''}`}>
                      {fmt(line.variance)}
                    </TableCell>
                    <TableCell className="text-center">
                      {matched ? (
                        <Badge variant="outline" className="text-success border-success/30">
                          <CheckCircle2 className="w-3 h-3 mr-1" />Match
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-warning border-warning/30">
                          <AlertTriangle className="w-3 h-3 mr-1" />Variance
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* Totals row */}
              <TableRow className="border-t-2 font-semibold">
                <TableCell />
                <TableCell>Total</TableCell>
                <TableCell />
                <TableCell className="text-right font-mono">{fmt(data.totalGl)}</TableCell>
                <TableCell className="text-right font-mono">{fmt(data.totalDonations)}</TableCell>
                <TableCell className={`text-right font-mono ${!isBalanced ? 'text-warning' : 'text-success'}`}>
                  {fmt(data.totalVariance)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            No donation-related accounts found. Ensure income accounts have a T3010 category assigned in the Chart of Accounts.
          </div>
        )}
      </Card>
    </div>
  );
}
