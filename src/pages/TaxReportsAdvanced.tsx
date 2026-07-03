/**
 * TaxReportsAdvanced — Phase 9
 * Three views:
 *  - Liability by Authority
 *  - Multi-Jurisdiction Consolidated
 *  - Filing Comparison (filed vs current GL recompute)
 *
 * Shared CSV export per tab; XML export for the per-authority filing snapshot.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, parseISO, subMonths } from 'date-fns';
import {
  ArrowLeft,
  Building2,
  Globe,
  GitCompareArrows,
  Download,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useLiabilityByAuthority,
  useJurisdictionConsolidated,
  useFilingComparison,
  buildFilingXml,
  type DateRange,
} from '@/hooks/useTaxReportsAdvanced';
import { useLocalizedCurrency } from '@/hooks/useLocalizedCurrency';
import { cn } from '@/lib/utils';

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function rowsToCsv(rows: (string | number)[][]): string {
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell ?? '');
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(','),
    )
    .join('\n');
}

export default function TaxReportsAdvanced() {
  const today = new Date();
  const [range, setRange] = useState<DateRange>({
    start: format(startOfMonth(subMonths(today, 2)), 'yyyy-MM-dd'),
    end: format(endOfMonth(today), 'yyyy-MM-dd'),
  });
  const [tab, setTab] = useState<'authority' | 'jurisdiction' | 'comparison'>('authority');

  const { formatCurrency } = useLocalizedCurrency();
  const fmt = (n: number) =>
    formatCurrency(n, { showSymbol: true, minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const liability = useLiabilityByAuthority(range);
  const jurisdiction = useJurisdictionConsolidated(range);
  const comparison = useFilingComparison();

  const exportCsv = () => {
    const stamp = `${range.start}_${range.end}`;
    if (tab === 'authority') {
      const rows: (string | number)[][] = [
        ['Authority', 'Region', 'Currency', 'Tax Collected', 'ITC Claimed', 'Net Payable'],
        ...(liability.data ?? []).map((r) => [
          r.authority_name,
          r.region ?? '',
          r.reporting_currency,
          r.tax_collected,
          r.itc_claimed,
          r.net_payable,
        ]),
      ];
      downloadFile(`tax_liability_by_authority_${stamp}.csv`, rowsToCsv(rows), 'text/csv');
    } else if (tab === 'jurisdiction') {
      const rows: (string | number)[][] = [
        ['Jurisdiction', 'Authority', 'Tax Type', 'Taxable', 'Collected', 'ITC', 'Net'],
        ...(jurisdiction.data ?? []).map((r) => [
          r.jurisdiction_code,
          r.authority,
          r.tax_type,
          r.taxable_amount,
          r.tax_collected,
          r.itc_claimed,
          r.net,
        ]),
      ];
      downloadFile(`tax_consolidated_${stamp}.csv`, rowsToCsv(rows), 'text/csv');
    } else {
      const rows: (string | number)[][] = [
        ['Authority', 'Period Start', 'Period End', 'Status', 'Filed Net', 'Recomputed Net', 'Variance'],
        ...(comparison.data ?? []).map((r) => [
          r.authority_name,
          r.period_start,
          r.period_end,
          r.status,
          r.filed_net,
          r.recomputed_net,
          r.variance,
        ]),
      ];
      downloadFile(`tax_filing_comparison.csv`, rowsToCsv(rows), 'text/csv');
    }
  };

  const exportXml = () => {
    if (!liability.data?.length) return;
    const xml = buildFilingXml(liability.data[0].authority_name, range, liability.data);
    downloadFile(`tax_filing_${range.start}_${range.end}.xml`, xml, 'application/xml');
  };

  const totals = useMemo(() => {
    const rows = liability.data ?? [];
    return rows.reduce(
      (acc, r) => {
        acc.collected += r.tax_collected;
        acc.itc += r.itc_claimed;
        acc.net += r.net_payable;
        return acc;
      },
      { collected: 0, itc: 0, net: 0 },
    );
  }, [liability.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2">
            <Link to="/tax">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Tax Center
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold text-foreground">Advanced Tax Reports</h1>
          <p className="text-sm text-muted-foreground">
            Liability by authority, multi-jurisdiction consolidation, and filed-vs-recomputed comparison.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input
              type="date"
              value={range.start}
              onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
              className="w-[160px]"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              type="date"
              value={range.end}
              onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
              className="w-[160px]"
            />
          </div>
          <Button variant="outline" onClick={exportCsv}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          {tab === 'authority' && (
            <Button variant="outline" onClick={exportXml} disabled={!liability.data?.length}>
              <Download className="w-4 h-4 mr-2" /> Export XML
            </Button>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total collected</p>
          <p className="text-xl font-semibold text-foreground">{fmt(totals.collected)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total ITC claimed</p>
          <p className="text-xl font-semibold text-foreground">{fmt(totals.itc)}</p>
        </Card>
        <Card
          className={cn(
            'p-4 border',
            totals.net >= 0 ? 'border-warning/40 bg-warning/5' : 'border-success/40 bg-success/5',
          )}
        >
          <p className="text-xs text-muted-foreground">
            Net {totals.net >= 0 ? 'payable' : 'refundable'}
          </p>
          <p className="text-xl font-semibold text-foreground">{fmt(Math.abs(totals.net))}</p>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="authority" className="gap-2">
            <Building2 className="w-4 h-4" /> By Authority
          </TabsTrigger>
          <TabsTrigger value="jurisdiction" className="gap-2">
            <Globe className="w-4 h-4" /> Consolidated
          </TabsTrigger>
          <TabsTrigger value="comparison" className="gap-2">
            <GitCompareArrows className="w-4 h-4" /> Filing Comparison
          </TabsTrigger>
        </TabsList>

        {/* By Authority */}
        <TabsContent value="authority">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Liability by tax authority</CardTitle>
            </CardHeader>
            <CardContent>
              {liability.isLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (liability.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No tax activity for the selected period.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Authority</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead className="text-right">Tax collected</TableHead>
                      <TableHead className="text-right">ITC claimed</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {liability.data!.map((r) => (
                      <TableRow key={r.authority_id ?? r.authority_name}>
                        <TableCell className="font-medium">{r.authority_name}</TableCell>
                        <TableCell>{r.region ?? '—'}</TableCell>
                        <TableCell className="text-right">{fmt(r.tax_collected)}</TableCell>
                        <TableCell className="text-right">{fmt(r.itc_claimed)}</TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-semibold',
                            r.net_payable > 0 ? 'text-warning' : 'text-success',
                          )}
                        >
                          {fmt(r.net_payable)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Consolidated */}
        <TabsContent value="jurisdiction">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Multi-jurisdiction consolidated</CardTitle>
            </CardHeader>
            <CardContent>
              {jurisdiction.isLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (jurisdiction.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No tax lines aggregated.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Jurisdiction</TableHead>
                      <TableHead>Authority</TableHead>
                      <TableHead>Tax type</TableHead>
                      <TableHead className="text-right">Taxable</TableHead>
                      <TableHead className="text-right">Collected</TableHead>
                      <TableHead className="text-right">ITC</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jurisdiction.data!.map((r, idx) => (
                      <TableRow key={`${r.jurisdiction_code}-${r.tax_type}-${idx}`}>
                        <TableCell className="font-medium">{r.jurisdiction_code}</TableCell>
                        <TableCell>{r.authority}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{r.tax_type.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{fmt(r.taxable_amount)}</TableCell>
                        <TableCell className="text-right">{fmt(r.tax_collected)}</TableCell>
                        <TableCell className="text-right">{fmt(r.itc_claimed)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(r.net)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comparison */}
        <TabsContent value="comparison">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filed return vs current ledger</CardTitle>
            </CardHeader>
            <CardContent>
              {comparison.isLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (comparison.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No filed returns available for comparison yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Authority</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Filed net</TableHead>
                      <TableHead className="text-right">Recomputed net</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparison.data!.map((r) => {
                      const off = Math.abs(r.variance) > 0.5;
                      return (
                        <TableRow key={r.return_id} className={off ? 'bg-warning/5' : undefined}>
                          <TableCell className="font-medium">{r.authority_name}</TableCell>
                          <TableCell className="text-sm">
                            {format(parseISO(r.period_start), 'MMM d')} –{' '}
                            {format(parseISO(r.period_end), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{r.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{fmt(r.filed_net)}</TableCell>
                          <TableCell className="text-right">{fmt(r.recomputed_net)}</TableCell>
                          <TableCell
                            className={cn(
                              'text-right font-semibold flex items-center justify-end gap-1',
                              off ? 'text-warning' : 'text-success',
                            )}
                          >
                            {off && <AlertTriangle className="w-3.5 h-3.5" />}
                            {fmt(r.variance)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
