import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';

interface ProfitMarginIndicatorProps {
  revenue: number;
  expenses: number;
  netIncome: number;
}

export function ProfitMarginIndicator({ revenue, expenses, netIncome }: ProfitMarginIndicatorProps) {
  const { organization } = useCurrentOrganization();
  
  const countryCode = organization?.country || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const grossMargin = revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0;
  const netMargin = revenue > 0 ? (netIncome / revenue) * 100 : 0;
  
  const getMarginStatus = (margin: number) => {
    if (margin >= 20) return { status: 'excellent', color: 'text-success', bg: 'bg-success' };
    if (margin >= 10) return { status: 'good', color: 'text-accent', bg: 'bg-accent' };
    if (margin >= 0) return { status: 'fair', color: 'text-warning', bg: 'bg-warning' };
    return { status: 'negative', color: 'text-destructive', bg: 'bg-destructive' };
  };

  const netMarginStatus = getMarginStatus(netMargin);
  const grossMarginStatus = getMarginStatus(grossMargin);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="stat-card animate-slide-in">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Profitability</h3>
        <div className={cn(
          "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
          netMargin >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
        )}>
          {netMargin >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          <span>{netMarginStatus.status}</span>
        </div>
      </div>

      {/* Net Income Highlight */}
      <div className="text-center mb-6">
        <p className="text-sm text-muted-foreground mb-1">Net Income</p>
        <p className={cn(
          "text-4xl font-bold tracking-tight",
          netIncome >= 0 ? "text-success" : "text-destructive"
        )}>
          {formatCurrency(netIncome)}
        </p>
      </div>

      {/* Margin Bars */}
      <div className="space-y-4">
        {/* Gross Margin */}
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Gross Margin</span>
            <span className={cn("font-semibold", grossMarginStatus.color)}>
              {grossMargin.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className={cn("h-full rounded-full transition-all duration-500", grossMarginStatus.bg)}
              style={{ width: `${Math.min(Math.max(grossMargin, 0), 100)}%` }}
            />
          </div>
        </div>

        {/* Net Margin */}
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Net Margin</span>
            <span className={cn("font-semibold", netMarginStatus.color)}>
              {netMargin.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className={cn("h-full rounded-full transition-all duration-500", netMarginStatus.bg)}
              style={{ width: `${Math.min(Math.max(netMargin, 0), 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-border">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Total Revenue</p>
          <p className="text-sm font-semibold text-foreground">{formatCurrency(revenue)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Total Expenses</p>
          <p className="text-sm font-semibold text-foreground">{formatCurrency(expenses)}</p>
        </div>
      </div>
    </div>
  );
}
