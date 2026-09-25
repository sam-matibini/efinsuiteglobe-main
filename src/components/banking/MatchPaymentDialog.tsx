import { useState, useMemo } from 'react';
import { parseLocalDate } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Link2, Check, CreditCard } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { ExtendedCreditCardTransaction } from '@/hooks/useCreditCards';

interface MatchPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceTransaction: ExtendedCreditCardTransaction | null;
  allTransactions: ExtendedCreditCardTransaction[];
  onMatch: (sourceId: string, targetId: string) => Promise<void>;
}

export function MatchPaymentDialog({
  open,
  onOpenChange,
  sourceTransaction,
  allTransactions,
  onMatch,
}: MatchPaymentDialogProps) {
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [isMatching, setIsMatching] = useState(false);

  // Find potential matches based on EXACT amount match (user preference)
  const potentialMatches = useMemo(() => {
    if (!sourceTransaction) return [];
    
    const sourceAmount = Math.abs(Number(sourceTransaction.amount));
    const sourceDate = parseLocalDate(sourceTransaction.transaction_date);
    
    // Find transactions from opposite source that match amount
    const oppositeSource = sourceTransaction.source === 'credit_card_transaction' 
      ? 'journal_entry' 
      : 'credit_card_transaction';
    
    return allTransactions
      .filter(t => {
        // Must be opposite source
        if (t.source !== oppositeSource) return false;
        // Must be payment type (negative amount on CC side)
        if (t.transaction_type !== 'payment' && t.amount >= 0) return false;
        // Must not already be matched/reconciled
        if (t.status === 'matched' || t.status === 'reconciled') return false;
        // EXACT amount match only (within 0.01 for rounding)
        const targetAmount = Math.abs(Number(t.amount));
        const amountDiff = Math.abs(sourceAmount - targetAmount);
        return amountDiff < 0.01;
      })
      .map(t => {
        const targetDate = parseLocalDate(t.transaction_date);
        const daysDiff = Math.abs((sourceDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
        return { ...t, daysDiff };
      })
      .sort((a, b) => a.daysDiff - b.daysDiff) // Sort by date proximity
      .slice(0, 5); // Limit to 5 best matches
  }, [sourceTransaction, allTransactions]);

  const handleMatch = async () => {
    if (!sourceTransaction || !selectedMatch) return;
    
    setIsMatching(true);
    try {
      await onMatch(sourceTransaction.id, selectedMatch);
      onOpenChange(false);
      setSelectedMatch(null);
    } finally {
      setIsMatching(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(Math.abs(amount));
  };

  if (!sourceTransaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Match Payment Transaction
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Source Transaction */}
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn(
                  "text-[10px] font-semibold px-1.5 py-0",
                  sourceTransaction.source === 'journal_entry' 
                    ? "border-blue-400 text-blue-600 bg-blue-50" 
                    : "border-muted-foreground/30 text-muted-foreground"
                )}>
                  {sourceTransaction.source === 'journal_entry' ? 'JE' : 'CC'}
                </Badge>
                <span className="font-medium text-sm">{sourceTransaction.description}</span>
              </div>
              <span className="font-semibold text-green-600">
                {formatCurrency(sourceTransaction.amount)}
              </span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {format(parseLocalDate(sourceTransaction.transaction_date), 'MMM d, yyyy')}
            </div>
          </div>

          {/* Match With */}
          <div>
            <Label className="text-sm font-medium">Match with:</Label>
            {potentialMatches.length === 0 ? (
              <div className="mt-2 p-4 text-center text-muted-foreground bg-muted/50 rounded-lg">
                <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No matching transactions found</p>
                <p className="text-xs mt-1">
                  Import the credit card statement with a matching payment to enable matching.
                </p>
              </div>
            ) : (
              <RadioGroup
                value={selectedMatch || ''}
                onValueChange={setSelectedMatch}
                className="mt-2 space-y-2"
              >
                {potentialMatches.map((match) => (
                  <div
                    key={match.id}
                    className={cn(
                      "flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedMatch === match.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    )}
                    onClick={() => setSelectedMatch(match.id)}
                  >
                    <RadioGroupItem value={match.id} id={match.id} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn(
                          "text-[10px] font-semibold px-1.5 py-0 shrink-0",
                          match.source === 'journal_entry' 
                            ? "border-blue-400 text-blue-600 bg-blue-50" 
                            : "border-muted-foreground/30 text-muted-foreground"
                        )}>
                          {match.source === 'journal_entry' ? 'JE' : 'CC'}
                        </Badge>
                        <span className="text-sm truncate">{match.description}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground">
                          {format(parseLocalDate(match.transaction_date), 'MMM d, yyyy')}
                          {match.daysDiff > 0 && (
                            <span className="ml-1">({Math.round(match.daysDiff)} days apart)</span>
                          )}
                        </span>
                        <span className="text-sm font-medium text-green-600">
                          {formatCurrency(match.amount)}
                        </span>
                      </div>
                    </div>
                    {selectedMatch === match.id && (
                      <Check className="w-4 h-4 text-primary shrink-0" />
                    )}
                  </div>
                ))}
              </RadioGroup>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleMatch}
            disabled={!selectedMatch || isMatching}
          >
            {isMatching ? 'Matching...' : 'Confirm Match'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
