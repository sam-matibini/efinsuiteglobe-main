import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Download, RefreshCw, FileArchive, TrendingUp, Mail, Coins } from 'lucide-react';
import {
  useProcessorMetricsDaily, useRefreshMetrics, useProcessorAccounts,
  useSettlements, useFxRevaluations, useRunFxRevaluation, useAuditorPackages,
} from '@/hooks/useSettlements';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { toast } from 'sonner';

export function SettlementAnalytics() {
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const { rows: metrics, isLoading } = useProcessorMetricsDaily(range);
  const refresh = useRefreshMetrics();
  const { accounts: processors } = useProcessorAccounts();
  const { settlements } = useSettlements();
  const { rows: fxRevals } = useFxRevaluations();
  const runFx = useRunFxRevaluation();
  const { packages, generate, downloadUrl } = useAuditorPackages();
  const fmt = useCurrencyFormatter();

  const [fxDialogOpen, setFxDialogOpen] = useState(false);
  const [fxPeriodEnd, setFxPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
  const [fxProcessorId, setFxProcessorId] = useState<string>('all');
  const [packDialogOpen, setPackDialogOpen] = useState(false);
  const [packStart, setPackStart] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10);
  });
  const [packEnd, setPackEnd] = useState(new Date().toISOString().slice(0, 10));
  const [packEmail, setPackEmail] = useState('');

  // Per-processor aggregates
  const byProcessor = useMemo(() => {
    const map = new Map<string, any>();
    for (const m of metrics) {
      const key = m.processor_account_id;
      const cur = map.get(key) ?? {
        processor_account_id: key,
        name: m.processor?.display_name ?? key.slice(0, 8),
        matched: 0, exception: 0, written_off: 0, total: 0,
        fees: 0, gross: 0, fee_pct_samples: [] as number[],
        days: [] as number[],
      };
      cur.matched += m.count_matched;
      cur.exception += m.count_exception;
      cur.written_off += m.count_written_off;
      cur.total += m.count_total;
      cur.fees += Number(m.fee_total);
      cur.gross += Number(m.gross_volume);
      if (Number(m.gross_volume) > 0) cur.fee_pct_samples.push(Number(m.fee_total) / Number(m.gross_volume));
      if (m.avg_days_to_match != null) cur.days.push(Number(m.avg_days_to_match));
      map.set(key, cur);
    }
    return Array.from(map.values()).map((p: any) => ({
      ...p,
      match_rate: p.total ? p.matched / p.total : 0,
      avg_fee_pct: p.gross ? p.fees / p.gross : 0,
      avg_days_to_match: p.days.length ? p.days.reduce((a: number, b: number) => a + b, 0) / p.days.length : null,
    }));
  }, [metrics]);

  // Aging buckets
  const agingBuckets = useMemo(() => {
    const buckets = { '0-3d': 0, '4-7d': 0, '8-14d': 0, '15-30d': 0, '30d+': 0 } as Record<string, number>;
    for (const s of settlements) {
      if (s.status === 'matched' || s.status === 'written_off') continue;
      const b = s.aging_bucket as string;
      if (b && b in buckets) buckets[b]++;
    }
    return Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }));
  }, [settlements]);

  // FX exposure: open foreign-currency settlements
  const fxExposure = useMemo(() => {
    const map = new Map<string, { currency: string; count: number; amount: number }>();
    for (const s of settlements) {
      if (s.status === 'matched' || s.status === 'written_off') continue;
      const cur = map.get(s.currency) ?? { currency: s.currency, count: 0, amount: 0 };
      cur.count++;
      cur.amount += Number(s.net_amount || 0);
      map.set(s.currency, cur);
    }
    return Array.from(map.values()).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }, [settlements]);

  // Anomaly detection on fee %
  const feePctMean = useMemo(() => {
    const samples = byProcessor.flatMap((p) => (p as any).fee_pct_samples ?? []);
    if (!samples.length) return { mean: 0, stdev: 0 };
    const mean = samples.reduce((a: number, b: number) => a + b, 0) / samples.length;
    const variance = samples.reduce((a: number, b: number) => a + (b - mean) ** 2, 0) / samples.length;
    return { mean, stdev: Math.sqrt(variance) };
  }, [byProcessor]);

  const chartData = byProcessor.map((p) => ({
    name: p.name, matched: p.matched, exception: p.exception, written_off: p.written_off,
  }));

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={String(range)} onValueChange={(v) => setRange(Number(v) as 7 | 30 | 90)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refresh.mutate(range)} disabled={refresh.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refresh.isPending ? 'animate-spin' : ''}`} />Rebuild metrics
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setFxDialogOpen(true)}>
            <Coins className="h-4 w-4 mr-2" />Run FX revaluation
          </Button>
          <Button onClick={() => setPackDialogOpen(true)}>
            <FileArchive className="h-4 w-4 mr-2" />Generate auditor pack
          </Button>
        </div>
      </div>

      {/* Processor performance chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4" />Processor performance</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground text-sm">Loading…</div>
          ) : chartData.length === 0 ? (
            <div className="text-muted-foreground text-sm">No metrics yet — click <strong>Rebuild metrics</strong>.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Legend />
                <Bar dataKey="matched" stackId="a" fill="hsl(var(--primary))" name="Matched" />
                <Bar dataKey="exception" stackId="a" fill="hsl(var(--destructive))" name="Exception" />
                <Bar dataKey="written_off" stackId="a" fill="hsl(var(--muted-foreground))" name="Written off" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Match rate & fee analysis</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Processor</TableHead>
                  <TableHead className="text-right">Match rate</TableHead>
                  <TableHead className="text-right">Avg days to match</TableHead>
                  <TableHead className="text-right">Fee %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byProcessor.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No data</TableCell></TableRow>
                ) : byProcessor.map((p) => {
                  const z = feePctMean.stdev > 0 ? (p.avg_fee_pct - feePctMean.mean) / feePctMean.stdev : 0;
                  const anomalous = Math.abs(z) > 2;
                  return (
                    <TableRow key={p.processor_account_id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right">{(p.match_rate * 100).toFixed(1)}%</TableCell>
                      <TableCell className="text-right">{p.avg_days_to_match != null ? p.avg_days_to_match.toFixed(1) : '—'}</TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-1">
                          {(p.avg_fee_pct * 100).toFixed(2)}%
                          {anomalous && <Badge variant="destructive" className="text-[10px]">anomaly</Badge>}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Aging waterfall</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={agingBuckets}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" name="Open settlements" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Coins className="h-4 w-4" />FX exposure (open settlements)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Currency</TableHead>
                <TableHead className="text-right">Open count</TableHead>
                <TableHead className="text-right">Net amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fxExposure.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No open exposure</TableCell></TableRow>
              ) : fxExposure.map((e) => (
                <TableRow key={e.currency}>
                  <TableCell className="font-mono">{e.currency}</TableCell>
                  <TableCell className="text-right">{e.count}</TableCell>
                  <TableCell className="text-right">{fmt.formatCurrency(e.amount, { currencyOverride: e.currency })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent FX revaluations */}
      <Card>
        <CardHeader><CardTitle>Recent FX revaluations</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period end</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead className="text-right">Original</TableHead>
                <TableHead className="text-right">Rate Δ</TableHead>
                <TableHead className="text-right">Adjustment</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fxRevals.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No revaluations yet</TableCell></TableRow>
              ) : fxRevals.slice(0, 20).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.period_end_date}</TableCell>
                  <TableCell className="font-mono">{r.original_currency} → {r.functional_currency}</TableCell>
                  <TableCell className="text-right">{Number(r.original_amount).toFixed(2)}</TableCell>
                  <TableCell className="text-right">{(Number(r.period_end_rate) - Number(r.original_rate)).toFixed(4)}</TableCell>
                  <TableCell className={`text-right ${Number(r.revaluation_amount) >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                    {Number(r.revaluation_amount).toFixed(2)}
                  </TableCell>
                  <TableCell>{r.reversed_at ? <Badge variant="secondary">Reversed</Badge> : <Badge>Posted</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Auditor packages */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileArchive className="h-4 w-4" />Auditor packages</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Matches</TableHead>
                <TableHead className="text-right">Write-offs</TableHead>
                <TableHead className="text-right">Exceptions</TableHead>
                <TableHead>Delivered to</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No packages yet</TableCell></TableRow>
              ) : packages.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.period_start} → {p.period_end}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === 'failed' ? 'destructive' : p.status === 'pending' ? 'secondary' : 'default'}>
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{p.match_count}</TableCell>
                  <TableCell className="text-right">{p.writeoff_count}</TableCell>
                  <TableCell className="text-right">{p.exception_count}</TableCell>
                  <TableCell className="text-xs">{p.delivered_to_email ?? '—'}</TableCell>
                  <TableCell>
                    {p.bundle_storage_path && (
                      <Button size="sm" variant="ghost" onClick={async () => {
                        try { const u = await downloadUrl(p.bundle_storage_path); window.open(u, '_blank'); }
                        catch (e: any) { toast.error(e.message); }
                      }}>
                        <Download className="h-3 w-3 mr-1" />ZIP
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* FX revaluation dialog */}
      <Dialog open={fxDialogOpen} onOpenChange={setFxDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run FX revaluation</DialogTitle>
            <DialogDescription>
              Posts unrealized FX gain/loss journal entries for open settlements held in foreign currency.
              Processors must have <strong>Revaluation enabled</strong> with gain & loss accounts configured.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Period end date</Label>
              <Input type="date" value={fxPeriodEnd} onChange={(e) => setFxPeriodEnd(e.target.value)} />
            </div>
            <div>
              <Label>Processor (optional)</Label>
              <Select value={fxProcessorId} onValueChange={setFxProcessorId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All eligible processors</SelectItem>
                  {processors.filter((p) => p.revaluation_enabled).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={() => runFx.mutate({
              period_end_date: fxPeriodEnd,
              processor_account_id: fxProcessorId === 'all' ? undefined : fxProcessorId,
              reverse: true,
            })} disabled={runFx.isPending}>
              Reverse period
            </Button>
            <Button onClick={() => runFx.mutate({
              period_end_date: fxPeriodEnd,
              processor_account_id: fxProcessorId === 'all' ? undefined : fxProcessorId,
            })} disabled={runFx.isPending}>
              {runFx.isPending ? 'Running…' : 'Run revaluation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auditor pack dialog */}
      <Dialog open={packDialogOpen} onOpenChange={setPackDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate auditor package</DialogTitle>
            <DialogDescription>Bundles matches, exceptions, write-offs, FX revaluations and their journal entries into a signed ZIP.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Period start</Label><Input type="date" value={packStart} onChange={(e) => setPackStart(e.target.value)} /></div>
              <div><Label>Period end</Label><Input type="date" value={packEnd} onChange={(e) => setPackEnd(e.target.value)} /></div>
            </div>
            <div>
              <Label className="flex items-center gap-1"><Mail className="h-3 w-3" />Deliver to (optional)</Label>
              <Input type="email" placeholder="auditor@firm.com" value={packEmail} onChange={(e) => setPackEmail(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => {
              generate.mutate({ period_start: packStart, period_end: packEnd, delivery_email: packEmail || undefined });
              setPackDialogOpen(false);
            }} disabled={generate.isPending}>
              {generate.isPending ? 'Generating…' : 'Generate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
