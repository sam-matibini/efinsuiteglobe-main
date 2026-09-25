import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';
import { useFinancialReports } from '@/hooks/useFinancialReports';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocalizedCurrency } from '@/hooks/useLocalizedCurrency';

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function ExpensesPieChart() {
  const { getIncomeStatementData, isLoading } = useFinancialReports();
  const { formatCurrency: formatLocalizedCurrency } = useLocalizedCurrency();

  const formatCurrency = (value: number) => {
    return formatLocalizedCurrency(value, {
      showSymbol: true,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const formatCompact = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value.toFixed(0);
  };

  // Show loading state FIRST before accessing data
  if (isLoading) {
    return (
      <div className="stat-card animate-slide-in">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-foreground">Expense Breakdown</h3>
          <p className="text-sm text-muted-foreground">By category</p>
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  // Get data AFTER loading check
  const incomeData = getIncomeStatementData();

  // Group expenses by account
  const expenseBreakdown = incomeData.expenses
    ?.filter(exp => exp.calculated_balance > 0)
    ?.sort((a, b) => b.calculated_balance - a.calculated_balance)
    ?.slice(0, 5)
    ?.map(exp => ({
      name: exp.name,
      value: exp.calculated_balance,
    })) ?? [];

  // If we have more expenses, group them into "Other"
  if (incomeData.expenses?.length > 5) {
    const otherTotal = incomeData.expenses
      .slice(5)
      .reduce((sum, exp) => sum + (exp.calculated_balance || 0), 0);
    if (otherTotal > 0) {
      expenseBreakdown.push({ name: 'Other', value: otherTotal });
    }
  }

  const total = expenseBreakdown.reduce((sum, item) => sum + item.value, 0);

  if (expenseBreakdown.length === 0) {
    return (
      <div className="stat-card animate-slide-in">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-chart-1/10 flex items-center justify-center">
            <PieChartIcon className="w-5 h-5 text-chart-1" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Expense Breakdown</h3>
            <p className="text-sm text-muted-foreground">By category</p>
          </div>
        </div>
        <div className="h-64 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">No expense data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stat-card animate-slide-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-chart-1/10 flex items-center justify-center">
          <PieChartIcon className="w-5 h-5 text-chart-1" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Expense Breakdown</h3>
          <p className="text-sm text-muted-foreground">By category for fiscal year</p>
        </div>
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={expenseBreakdown}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={4}
              dataKey="value"
            >
              {expenseBreakdown.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[index % COLORS.length]}
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
              formatter={(value: number) => [formatCurrency(value), '']}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 space-y-2">
        {expenseBreakdown.map((item, index) => (
          <div key={item.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-muted-foreground truncate max-w-[140px]">{item.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{formatCompact(item.value)}</span>
              <span className="text-xs text-muted-foreground w-10 text-right">
                {total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
