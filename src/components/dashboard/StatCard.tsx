import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'accent' | 'cyan' | 'gold' | 'danger';
}

export function StatCard({ title, value, change, changeLabel, icon, variant = 'default' }: StatCardProps) {
  const isPositive = change && change > 0;
  
  const variantStyles = {
    default: 'border-t-[3px] border-t-[#6366f1]',
    success: 'border-t-[3px] border-t-[#22c55e]',
    warning: 'border-t-[3px] border-t-[#f59e0b]',
    accent: 'border-t-[3px] border-t-[#6366f1]',
    cyan: 'border-t-[3px] border-t-[#06b6d4]',
    gold: 'border-t-[3px] border-t-[#f59e0b]',
    danger: 'border-t-[3px] border-t-[#ef4444]',
  };

  const iconStyles = {
    default: 'bg-[rgba(99,102,241,0.10)] text-[#6366f1]',
    success: 'bg-[#dcfce7] text-[#22c55e]',
    warning: 'bg-[#fef3c7] text-[#f59e0b]',
    accent: 'bg-[rgba(99,102,241,0.10)] text-[#6366f1]',
    cyan: 'bg-[rgba(6,182,212,0.10)] text-[#06b6d4]',
    gold: 'bg-[rgba(245,158,11,0.10)] text-[#f59e0b]',
    danger: 'bg-[rgba(239,68,68,0.10)] text-[#ef4444]',
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
