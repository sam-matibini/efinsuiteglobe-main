import { useFxGainLossReport } from '@/hooks/useFxReports';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useLocalizedCurrency } from '@/hooks/useLocalizedCurrency';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, ArrowUpDown, Info } from 'lucide-react';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function FxGainLossReport() {
  const { data, isLoading } = useFxGainLossReport();
  const { formatCurrency } = useLocalizedCurrency();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-72" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!data) return null;

  const fmt = (n: number) => formatCurrency(n, { showSymbol: true, minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">FX Gain / Loss Report</h1>
          <p className="text-muted-foreground text-sm">
            Realized and unrealized foreign exchange impact for the selected period.
          </p>
        </div>
        <ReportFilters />
      </div>

      {data.lines.length === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            No FX postings found in the selected period. Configure your FX accounts in Settings → Multi-Currency
            and post foreign-currency transactions to populate this report.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-success" /> Realized Gain
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-success">{fmt(data.totalRealizedGain)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-destructive" /> Realized Loss
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{fmt(data.totalRealizedLoss)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-info" /> Unrealized Gain
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-info">{fmt(data.totalUnrealizedGain)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-primary" /> Net Impact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${data.netImpact >= 0 ? 'text-success' : 'text-destructive'}`}>
              {fmt(data.netImpact)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* By Currency */}
      {Object.keys(data.byCurrency).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Breakdown by Currency</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Currency</TableHead>
                  <TableHead className="text-right">Realized</TableHead>
                  <TableHead className="text-right">Unrealized</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(data.byCurrency).map(([cur, v]) => (
                  <TableRow key={cur}>
                    <TableCell className="font-medium">{cur}</TableCell>
                    <TableCell className={`text-right ${v.realized >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(v.realized)}</TableCell>
                    <TableCell className={`text-right ${v.unrealized >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(v.unrealized)}</TableCell>
                    <TableCell className={`text-right font-semibold ${v.net >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(v.net)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Detailed lines */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Detail</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Base Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.lines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No FX postings in this period.
                  </TableCell>
                </TableRow>
              ) : (
                data.lines.map((line, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{line.date}</TableCell>
                    <TableCell className="font-mono text-xs">{line.reference}</TableCell>
                    <TableCell>{line.account_code} – {line.account_name}</TableCell>
                    <TableCell>{line.currency}</TableCell>
                    <TableCell>
                      <Badge variant={line.type === 'realized' ? 'default' : 'secondary'}>
                        {line.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{line.rate.toFixed(6)}</TableCell>
                    <TableCell className={`text-right font-medium ${line.base_amount >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {fmt(line.base_amount)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
