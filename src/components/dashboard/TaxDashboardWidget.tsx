/**
 * TaxDashboardWidget — at-a-glance tax KPIs on the main dashboard.
 */

import { Receipt, AlertTriangle, CalendarClock, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { useTaxDashboard } from '@/hooks/useTaxDashboard';
import { useLocalizedCurrency } from '@/hooks/useLocalizedCurrency';
import { cn } from '@/lib/utils';

export function TaxDashboardWidget() {
  const { data, isLoading } = useTaxDashboard();
  const { formatCurrency } = useLocalizedCurrency();

  if (isLoading || !data) {
    return (
      <Card className="p-6 space-y-4">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
        <Skeleton className="h-12" />
      </Card>
    );
  }

  const fmt = (n: number) =>
    formatCurrency(n, { showSymbol: true, minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const dueColor =
    data.daysUntilDue == null
      ? 'text-muted-foreground'
      : data.daysUntilDue < 0
        ? 'text-destructive'
        : data.daysUntilDue <= 7
          ? 'text-warning'
          : 'text-muted-foreground';

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Sales Tax</h3>
            <p className="text-xs text-muted-foreground">{data.periodLabel}</p>
          </div>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/tax">
            View <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border border-border p-3">
          <p className="text-xs text-muted-foreground">Collected</p>
          <p className="text-lg font-semibold text-foreground">{fmt(data.collected)}</p>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="text-xs text-muted-foreground">ITC / Paid</p>
          <p className="text-lg font-semibold text-foreground">{fmt(data.itc)}</p>
        </div>
        <div
          className={cn(
            'rounded-md border p-3',
            data.netPayable >= 0
              ? 'border-warning/40 bg-warning/5'
              : 'border-success/40 bg-success/5',
          )}
        >
          <p className="text-xs text-muted-foreground">
            {data.netPayable >= 0 ? 'Net payable' : 'Net refundable'}
          </p>
          <p className="text-lg font-semibold text-foreground">
            {fmt(Math.abs(data.netPayable))}
          </p>
        </div>
      </div>

      {/* Sparkline */}
      <div className="h-16">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.sparkline}>
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                fontSize: '12px',
              }}
              formatter={(v: number) => fmt(v)}
            />
            <Line
              type="monotone"
              dataKey="net"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Footer: due date + exceptions */}
      <div className="flex items-center justify-between pt-2 border-t border-border text-sm">
        <div className="flex items-center gap-2">
          <CalendarClock className={cn('w-4 h-4', dueColor)} />
          <div>
            <p className="text-xs text-muted-foreground">Next filing</p>
            <p className={cn('font-medium', dueColor)}>
              {data.nextDueDate
                ? `${data.daysUntilDue! < 0 ? Math.abs(data.daysUntilDue!) + ' d overdue' : data.daysUntilDue + ' d'}${data.nextDueAuthority ? ` · ${data.nextDueAuthority}` : ''}`
                : 'No periods scheduled'}
            </p>
          </div>
        </div>

        <Link to="/tax/exceptions">
          <Badge
            variant={data.criticalExceptionsCount > 0 ? 'destructive' : 'secondary'}
            className="gap-1 cursor-pointer"
          >
            <AlertTriangle className="w-3 h-3" />
            {data.exceptionsCount} issue{data.exceptionsCount === 1 ? '' : 's'}
          </Badge>
        </Link>
      </div>
    </Card>
  );
}
