import { Wallet, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { useCreditCards } from '@/hooks/useCreditCards';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';

export function CashPositionCard() {
  const { accounts: bankAccounts, isLoading: bankLoading } = useBankAccounts();
  const { creditCards, isLoading: ccLoading } = useCreditCards();
  const { organization } = useCurrentOrganization();
  const navigate = useNavigate();

  const isLoading = bankLoading || ccLoading;

  const countryCode = organization?.country || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="stat-card animate-slide-in">
        <Skeleton className="h-6 w-32 mb-4" />
        <Skeleton className="h-10 w-40 mb-6" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
    );
  }

  const totalBankBalance = bankAccounts?.reduce((sum, acc) => sum + (acc.current_balance || 0), 0) ?? 0;
  const totalCreditCardBalance = creditCards?.reduce((sum, cc) => sum + (cc.current_balance || 0), 0) ?? 0;
  const netCashPosition = totalBankBalance - totalCreditCardBalance;
  const isPositive = netCashPosition >= 0;

  // Calculate change from opening balances
  const totalBankOpening = bankAccounts?.reduce((sum, acc) => sum + (acc.opening_balance || 0), 0) ?? 0;
  const changePercent = totalBankOpening > 0 
    ? ((totalBankBalance - totalBankOpening) / totalBankOpening) * 100 
    : 0;

  return (
    <div className="stat-card animate-slide-in bg-gradient-to-br from-card to-muted/30">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Net Cash Position</h3>
          </div>
        </div>
        {changePercent !== 0 && (
          <div className={cn(
            "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
            changePercent >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          )}>
            {changePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{Math.abs(changePercent).toFixed(1)}%</span>
          </div>
        )}
      </div>
      
      <p className={cn(
        "text-3xl font-bold tracking-tight mb-6",
        isPositive ? "text-foreground" : "text-destructive"
      )}>
        {formatCurrency(netCashPosition)}
      </p>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Bank Accounts</span>
          <span className="font-medium text-success">{formatCurrency(totalBankBalance)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Credit Cards</span>
          <span className="font-medium text-destructive">-{formatCurrency(totalCreditCardBalance)}</span>
        </div>
      </div>

      <button 
        onClick={() => navigate('/banking/accounts')}
        className="mt-4 w-full flex items-center justify-center gap-2 text-sm text-accent hover:text-accent/80 font-medium transition-colors pt-4 border-t border-border"
      >
        View All Accounts
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}
