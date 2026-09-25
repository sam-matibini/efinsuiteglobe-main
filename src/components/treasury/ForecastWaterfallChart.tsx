import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import type { ForecastLine } from '@/hooks/useTreasuryForecast';

export function ForecastWaterfallChart({ lines, bucketType }: { lines: ForecastLine[]; bucketType: 'week' | 'month' }) {
  const fmt = useCurrencyFormatter();
  const filtered = lines.filter((l) => l.bucket_type === bucketType);

  const byBucket = new Map<string, { bucket: string; liability: number; funding: number; gap: number }>();
  for (const l of filtered) {
    const key = l.bucket_start;
    const ex = byBucket.get(key) ?? { bucket: key, liability: 0, funding: 0, gap: 0 };
    ex.liability += Number(l.projected_liability);
    ex.funding += Number(l.projected_funding);
    ex.gap += Number(l.funding_gap);
    byBucket.set(key, ex);
  }
  const data = Array.from(byBucket.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No forecast data yet. Click Generate to build a projection.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmt.formatCurrency(Number(v), { showCurrencySymbol: false })} />
        <Tooltip formatter={(v: number) => fmt.formatCurrency(Number(v), { showCurrencySymbol: true, currencyOverride: 'CAD' })} />
        <Legend />
        <Bar dataKey="liability" fill="hsl(var(--primary))" name="Projected liability" />
        <Bar dataKey="funding" fill="hsl(var(--muted-foreground))" name="Available funding" />
        <Bar dataKey="gap" fill="hsl(var(--destructive))" name="Funding gap" />
      </BarChart>
    </ResponsiveContainer>
  );
}
