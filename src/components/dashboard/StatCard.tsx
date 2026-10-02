import { ReactNode, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

function useCountUp(target: number | undefined) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target === undefined || Number.isNaN(target)) return;
    const duration = 1800;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      setValue(target * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return value;
}

interface StatCardProps {
  title: string;
  value: string;
  amount?: number;
  formatAmount?: (amount: number) => string;
  change?: number;
  changeLabel?: string;
  icon: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'accent' | 'cyan' | 'gold' | 'danger';
}

export function StatCard({ title, value, amount, formatAmount, change, changeLabel, icon, variant = 'default' }: StatCardProps) {
  const isPositive = change && change > 0;
  const counted = useCountUp(amount);
  const displayValue = amount !== undefined && formatAmount ? formatAmount(counted) : value;
  
  const variantStyles = {
    default: 'border-t-[3px] border-t-[#6366f1]',
    success: 'border-t-[3px] border-t-[#22c55e]',
    warning: 'border-t-[3px] border-t-[#f59e0b]',
    accent: 'border-t-[3px] border-t-[#6366f1]',
    cyan: 'border-t-[3px] border-t-[#06b6d4]',
    gold: 'border-t-[3px] border-t-[#f59e0b]',
    danger: 'border-t-[3px] border-t-[#ef4444]',
  };

  const badgeStyles = {
    default: 'bg-[#ede9fe] text-[#6366f1]',
    success: 'bg-[#dcfce7] text-[#16a34a]',
    warning: 'bg-[#fef3c7] text-[#d97706]',
    accent: 'bg-[#ede9fe] text-[#6366f1]',
    cyan: 'bg-[#cffafe] text-[#0891b2]',
    gold: 'bg-[#f1f5f9] text-[#64748b]',
    danger: 'bg-[#fee2e2] text-[#ef4444]',
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
            badgeStyles[variant]
          )}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{Math.abs(change).toFixed(1)}%</span>
          </div>
        )}
      </div>
      
      <p className="metric-label mb-1">{title}</p>
      <p className="metric-value text-foreground">{displayValue}</p>
      {changeLabel && (
        <p className="text-xs text-muted-foreground mt-2">{changeLabel}</p>
      )}
    </div>
  );
}
