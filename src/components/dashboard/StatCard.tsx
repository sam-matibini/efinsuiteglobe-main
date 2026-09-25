import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'accent';
}

export function StatCard({ title, value, change, changeLabel, icon, variant = 'default' }: StatCardProps) {
  const isPositive = change && change > 0;
  
  const variantStyles = {
    default: 'bg-card',
    success: 'bg-success/5 border-success/20',
    warning: 'bg-warning/5 border-warning/20',
    accent: 'bg-accent/5 border-accent/20',
  };

  const iconStyles = {
    default: 'bg-muted text-muted-foreground',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    accent: 'bg-accent/10 text-accent',
  };

  return (
    <div className={cn(
      "stat-card animate-fade-in",
      variantStyles[variant]
    )}>
      <div className="flex items-start justify-between mb-4">
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center",
          iconStyles[variant]
        )}>
          {icon}
        </div>
        {change !== undefined && (
          <div className={cn(
            "flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-full",
            isPositive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          )}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{Math.abs(change).toFixed(1)}%</span>
          </div>
        )}
      </div>
      
      <p className="metric-label mb-1">{title}</p>
      <p className="metric-value text-foreground">{value}</p>
      {changeLabel && (
        <p className="text-xs text-muted-foreground mt-2">{changeLabel}</p>
      )}
    </div>
  );
}
