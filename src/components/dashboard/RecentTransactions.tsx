import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { cn, parseLocalDate } from '@/lib/utils';
import { useJournalEntries } from '@/hooks/useJournalEntries';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { useLocalizedCurrency } from '@/hooks/useLocalizedCurrency';

export function RecentTransactions() {
  const { organization } = useCurrentOrganization();
  const { data: journalEntries, isLoading } = useJournalEntries(organization?.id);
  const navigate = useNavigate();
  const { formatCurrency: formatLocalizedCurrency, formatDate } = useLocalizedCurrency();

  const formatCurrency = (value: number) => {
    return formatLocalizedCurrency(value, { 
      showSymbol: true, 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    });
  };

  if (isLoading) {
    return (
      <div className="stat-card animate-slide-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Recent Transactions</h3>
            <p className="text-sm text-muted-foreground">Latest activity in your accounts</p>
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      </div>
    );
  }

  // Get most recent posted entries
  const recentEntries = journalEntries
    ?.filter(je => je.status === 'posted')
    ?.sort((a, b) => parseLocalDate(b.entry_date).getTime() - parseLocalDate(a.entry_date).getTime())
    ?.slice(0, 5) ?? [];

  return (
    <div className="stat-card animate-slide-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Recent Transactions</h3>
          <p className="text-sm text-muted-foreground">Latest activity in your accounts</p>
        </div>
        <button 
          onClick={() => navigate('/journal-entries')}
          className="text-sm text-accent hover:text-accent/80 font-medium transition-colors"
        >
          View All
        </button>
      </div>

      <div className="space-y-4">
        {recentEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent transactions
          </p>
        ) : (
          recentEntries.map((entry) => {
            // Calculate total debit amount
            const totalDebit = entry.lines?.reduce((sum, line) => sum + (line.debit || 0), 0) ?? 0;
            
            // Determine if this is income or expense based on the first line's account type
            // This is a simplification - income transactions typically credit revenue accounts
            const isIncome = entry.description?.toLowerCase().includes('revenue') || 
                            entry.description?.toLowerCase().includes('invoice') ||
                            entry.description?.toLowerCase().includes('payment received');
            
            return (
              <div 
                key={entry.id} 
                className="flex items-center justify-between py-3 border-b border-border/50 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    isIncome ? "bg-success/10" : "bg-destructive/10"
                  )}>
                    {isIncome ? (
                      <ArrowDownLeft className="w-5 h-5 text-success" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5 text-destructive" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">{entry.reference}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {entry.description || 'Journal Entry'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "font-semibold",
                    isIncome ? "text-success" : "text-foreground"
                  )}>
                    {isIncome ? '+' : ''}{formatCurrency(totalDebit)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(entry.entry_date, 'medium')}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}