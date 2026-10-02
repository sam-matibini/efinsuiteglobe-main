import { TrendingUp, TrendingDown } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
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

  const marginSlices = [
    { name: 'Net income', value: Math.max(netIncome, 0), fill: '#6366f1' },
    { name: 'Expenses', value: Math.max(expenses, 0), fill: '#06b6d4' },
  ].filter((slice) => slice.value > 0);

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

      <div className="relative mx-auto mb-6 h-[220px] max-w-[220px]">
        {revenue <= 0 && expenses <= 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-[#64748b]">
            No activity this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={marginSlices}
                dataKey="value"
                innerRadius={68}
                outerRadius={92}
                stroke="none"
                paddingAngle={2}
              >
                {marginSlices.map((slice) => (
                  <Cell key={slice.name} fill={slice.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-xl font-black text-[#0f172a]">{netMargin.toFixed(1)}%</p>
          <p className="text-xs text-[#64748b]">Net Margin</p>
        </div>
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
