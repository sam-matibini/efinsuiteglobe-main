import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gauge } from 'lucide-react';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

export function RunwayGauge({ liability, available }: { liability: number; available: number }) {
  const fmt = useCurrencyFormatter();
  const ratio = liability > 0 ? Math.min(1, available / liability) : 1;
  const pct = Math.round(ratio * 100);
  const tone = ratio >= 1 ? 'text-emerald-500' : ratio >= 0.6 ? 'text-amber-500' : 'text-destructive';
  const ringTone = ratio >= 1 ? 'stroke-emerald-500' : ratio >= 0.6 ? 'stroke-amber-500' : 'stroke-destructive';

  const circumference = 2 * Math.PI * 40;
  const offset = circumference * (1 - ratio);

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm text-muted-foreground">90-day runway coverage</CardTitle>
        <Gauge className={`h-4 w-4 ${tone}`} />
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <svg width="96" height="96" viewBox="0 0 100 100" className="-rotate-90">
          <circle cx="50" cy="50" r="40" strokeWidth="10" fill="none" className="stroke-muted" />
          <circle
            cx="50" cy="50" r="40" strokeWidth="10" fill="none"
            strokeLinecap="round"
            className={ringTone}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div>
          <p className={`text-2xl font-bold ${tone}`}>{pct}%</p>
          <p className="text-xs text-muted-foreground">
            {fmt.formatCurrency(available, { showCurrencySymbol: true, currencyOverride: 'CAD' })} available
          </p>
          <p className="text-xs text-muted-foreground">
            vs {fmt.formatCurrency(liability, { showCurrencySymbol: true, currencyOverride: 'CAD' })} due
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
