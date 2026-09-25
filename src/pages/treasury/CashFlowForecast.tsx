import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Sparkles } from 'lucide-react';
import { useTreasuryForecast } from '@/hooks/useTreasuryForecast';
import { ForecastWaterfallChart } from '@/components/treasury/ForecastWaterfallChart';
import { RunwayGauge } from '@/components/treasury/RunwayGauge';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

export default function CashFlowForecast() {
  const { latestRun, lines, isLoading, generate } = useTreasuryForecast();
  const fmt = useCurrencyFormatter();
  const [payrollGrowth, setPayrollGrowth] = useState(0);
  const [revenueGrowth, setRevenueGrowth] = useState(0);

  const kpi = useMemo(() => {
    const sum = (days: number) => {
      const cutoff = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
      return lines
        .filter((l) => l.bucket_start <= cutoff)
        .reduce((s, l) => s + Number(l.projected_liability), 0);
    };
    const totalAvail = lines.reduce((s, l) => s + Number(l.projected_funding), 0) / Math.max(1, lines.length / 6);
    return {
      next30: sum(30),
      next90: sum(90),
      next365: lines.reduce((s, l) => s + Number(l.projected_liability), 0),
      available: totalAvail,
    };
  }, [lines]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Cash-Flow Forecast</h1>
          <p className="text-muted-foreground">
            13-week and 12-month projection of CRA + provincial liabilities versus available funding.
          </p>
        </div>
        <Button onClick={() => generate.mutate({ payrollGrowth, revenueGrowth })} disabled={generate.isPending}>
          {generate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Generate forecast
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi title="Next 30 days" value={fmt.formatCurrency(kpi.next30, { showCurrencySymbol: true, currencyOverride: 'CAD' })} />
        <Kpi title="Next 90 days" value={fmt.formatCurrency(kpi.next90, { showCurrencySymbol: true, currencyOverride: 'CAD' })} />
        <Kpi title="Next 12 months" value={fmt.formatCurrency(kpi.next365, { showCurrencySymbol: true, currencyOverride: 'CAD' })} />
        <RunwayGauge liability={kpi.next90} available={kpi.available} />
      </div>

      <Card>
        <CardHeader><CardTitle>What-if assumptions</CardTitle></CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Payroll growth</span><span className="font-mono">{payrollGrowth > 0 ? '+' : ''}{payrollGrowth}%</span>
            </div>
            <Slider value={[payrollGrowth]} min={-25} max={50} step={1} onValueChange={([v]) => setPayrollGrowth(v)} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Revenue growth</span><span className="font-mono">{revenueGrowth > 0 ? '+' : ''}{revenueGrowth}%</span>
            </div>
            <Slider value={[revenueGrowth]} min={-25} max={50} step={1} onValueChange={([v]) => setRevenueGrowth(v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Projection</CardTitle>
          {latestRun && (
            <p className="text-xs text-muted-foreground">
              Last run {new Date(latestRun.created_at).toLocaleString()}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="week">
            <TabsList>
              <TabsTrigger value="week">13-week</TabsTrigger>
              <TabsTrigger value="month">12-month</TabsTrigger>
            </TabsList>
            <TabsContent value="week" className="pt-4">
              {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
                <ForecastWaterfallChart lines={lines} bucketType="week" />}
            </TabsContent>
            <TabsContent value="month" className="pt-4">
              {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
                <ForecastWaterfallChart lines={lines} bucketType="month" />}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>By authority</CardTitle></CardHeader>
        <CardContent>
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No forecast yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {Object.entries(
                lines.reduce<Record<string, number>>((acc, l) => {
                  const k = l.authority + (l.program_code ? ` · ${l.program_code}` : '');
                  acc[k] = (acc[k] ?? 0) + Number(l.projected_liability);
                  return acc;
                }, {}),
              )
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <li key={k} className="flex justify-between border-b py-1">
                    <span>{k}</span>
                    <span className="font-mono">{fmt.formatCurrency(v, { showCurrencySymbol: true, currencyOverride: 'CAD' })}</span>
                  </li>
                ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent><p className="text-2xl font-bold">{value}</p></CardContent>
    </Card>
  );
}
