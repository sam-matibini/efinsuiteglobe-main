import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useJournalEntries } from '@/hooks/useJournalEntries';
import { useReportFilters } from '@/hooks/useReportFilters';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { toLocalISO } from '@/lib/dateRangePresets';
import { revenueExpenseByMonth } from '@/lib/dashboardPeriodSeries';

export function RevenueChart() {
  const { organization } = useCurrentOrganization();
  const { startDate, endDate } = useReportFilters();
  const { data: journalEntries, isLoading } = useJournalEntries(organization?.id, {
    status: 'posted',
    startDate: toLocalISO(startDate),
    endDate: toLocalISO(endDate),
  });

  const countryCode = organization?.country?.toUpperCase() || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
      notation: 'compact',
      compactDisplay: 'short',
    }).format(value);
  };

  const formatCurrencyFull = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
    }).format(value);
  };

  // Show loading state FIRST before accessing data
  if (isLoading) {
    return (
      <div className="stat-card animate-slide-in">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-foreground">Revenue vs Expenses</h3>
          <p className="text-sm text-muted-foreground">Selected period</p>
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const monthlyData = revenueExpenseByMonth(
    (journalEntries ?? []).flatMap((entry) =>
      (entry.lines ?? []).map((line) => ({
        entryDate: entry.entry_date,
        accountCode: line.account?.code ?? '',
        accountType: line.account?.account_type,
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
      })),
    ),
    startDate,
    endDate,
  );

  return (
    <div className="stat-card animate-slide-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Revenue vs Expenses</h3>
          <p className="text-sm text-muted-foreground">Posted activity in the selected period</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#6366f1]" />
            <span className="text-sm text-muted-foreground">Revenue</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#06b6d4]" />
            <span className="text-sm text-muted-foreground">Expenses</span>
          </div>
        </div>
      </div>
      
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.82}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.82}/>
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.05}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.06)" vertical={false} />
            <XAxis 
              dataKey="month" 
              axisLine={false} 
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 12 }}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              tickFormatter={(value) => formatCurrency(value)}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
              formatter={(value: number) => [formatCurrencyFull(value), '']}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Area 
              type="monotone" 
              dataKey="revenue" 
              stroke="#6366f1" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorRevenue)" 
              name="Revenue"
            />
            <Area 
              type="monotone" 
              dataKey="expenses" 
              stroke="#06b6d4" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorExpenses)" 
              name="Expenses"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}