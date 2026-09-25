import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFxGainLossReport } from '@/hooks/useFxReports';
import { useMultiCurrencySettings } from '@/hooks/useMultiCurrencySettings';
import { useLocalizedCurrency } from '@/hooks/useLocalizedCurrency';
import { ArrowUpDown, TrendingUp, TrendingDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/** Compact dashboard widget summarizing FX gains/losses for the current period. */
export function FxImpactWidget() {
  const { settings } = useMultiCurrencySettings();
  const { data, isLoading } = useFxGainLossReport();
  const { formatCurrency } = useLocalizedCurrency();

  // Hide widget when multi-currency disabled
  if (!settings?.multi_currency_enabled) return null;

  const fmt = (n: number) => formatCurrency(n, { showSymbol: true, minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-primary" /> FX Impact
          </CardTitle>
          <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
            <Link to="/reports/fx-gain-loss">View report →</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="space-y-3">
            <div>
              <p className={`text-2xl font-bold ${data.netImpact >= 0 ? 'text-success' : 'text-destructive'}`}>
                {fmt(data.netImpact)}
              </p>
              <p className="text-xs text-muted-foreground">Net FX impact (period)</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5 p-2 rounded-md bg-muted/40">
                <TrendingUp className="w-3.5 h-3.5 text-success" />
                <div>
                  <p className="text-muted-foreground">Realized</p>
                  <p className="font-semibold">{fmt(data.totalRealizedGain - data.totalRealizedLoss)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 p-2 rounded-md bg-muted/40">
                <TrendingDown className="w-3.5 h-3.5 text-info" />
                <div>
                  <p className="text-muted-foreground">Unrealized</p>
                  <p className="font-semibold">{fmt(data.totalUnrealizedGain - data.totalUnrealizedLoss)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
