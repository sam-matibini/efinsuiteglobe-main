import { TrendingUp, TrendingDown, CreditCard, Building2 } from 'lucide-react';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { useLocalizedCurrency } from '@/hooks/useLocalizedCurrency';
import { cn } from '@/lib/utils';

export function AccountsSnapshot() {
  const { accounts: bankAccounts, isLoading } = useBankAccounts();
  const navigate = useNavigate();
  const { formatCurrency: formatLocalizedCurrency } = useLocalizedCurrency();

  const formatCurrency = (value: number) => {
    return formatLocalizedCurrency(value, {
      showSymbol: true,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  // Show loading state FIRST before accessing data
  if (isLoading) {
    return (
      <div className="stat-card animate-slide-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Bank Accounts</h3>
            <p className="text-sm text-muted-foreground">Current balances</p>
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // Calculate total balance AFTER loading check
  const totalBalance = bankAccounts?.reduce((sum, acc) => sum + (acc.current_balance || 0), 0) ?? 0;
  const accounts = bankAccounts?.slice(0, 4) ?? [];

  return (
    <div className="stat-card animate-slide-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Bank Accounts</h3>
            <p className="text-sm text-muted-foreground">Current balances</p>
          </div>
        </div>
        <button 
          onClick={() => navigate('/banking/accounts')}
          className="text-sm text-accent hover:text-accent/80 font-medium transition-colors"
        >
          Manage
        </button>
      </div>

      <div className="space-y-3">
        {accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <CreditCard className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No bank accounts</p>
            <p className="text-xs text-muted-foreground">Add accounts to track balances</p>
          </div>
        ) : (
          accounts.map((account) => {
            // Calculate change percentage based on opening vs current balance
            const change = account.opening_balance && account.opening_balance !== 0
              ? ((account.current_balance - account.opening_balance) / Math.abs(account.opening_balance)) * 100
              : 0;

            return (
              <div 
                key={account.id} 
                className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all cursor-pointer group"
                onClick={() => navigate('/banking/accounts')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                    <CreditCard className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{account.name}</p>
                    <p className="text-xs text-muted-foreground">{account.institution}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "font-semibold",
                    account.current_balance >= 0 ? "text-foreground" : "text-destructive"
                  )}>
                    {formatCurrency(account.current_balance)}
                  </p>
                  {change !== 0 && (
                    <div className={cn(
                      "flex items-center justify-end gap-1 text-xs",
                      change >= 0 ? 'text-success' : 'text-destructive'
                    )}>
                      {change >= 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      <span>{Math.abs(change).toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total Balance</span>
          <span className={cn(
            "text-xl font-bold",
            totalBalance >= 0 ? "text-foreground" : "text-destructive"
          )}>
            {formatCurrency(totalBalance)}
          </span>
        </div>
      </div>
    </div>
  );
}
