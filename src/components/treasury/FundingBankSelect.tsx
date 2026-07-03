import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useFundingBankAccounts, FundingBankAccount } from '@/hooks/useFundingBankAccounts';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';
import { Zap } from 'lucide-react';
import { useEffect } from 'react';

export type RequireRail = 'any' | 'ach' | 'card';

interface Props {
  value: string;
  onValueChange: (v: string) => void;
  requireRail?: RequireRail;
  placeholder?: string;
  autoSelectDefault?: boolean;
}

function isCapable(a: FundingBankAccount, rail: RequireRail) {
  if (rail === 'ach') return a.canDrawACH;
  return true; // 'any' / 'card'
}

export function FundingBankSelect({
  value, onValueChange, requireRail = 'any', placeholder = 'Select funding bank', autoSelectDefault = true,
}: Props) {
  const { accounts, defaultAccount, enableStripeAch } = useFundingBankAccounts();
  const isReadOnly = useIsReadOnly();

  useEffect(() => {
    if (autoSelectDefault && !value && defaultAccount && isCapable(defaultAccount, requireRail)) {
      onValueChange(defaultAccount.id);
    }
  }, [autoSelectDefault, value, defaultAccount, requireRail, onValueChange]);

  const selected = accounts.find((a) => a.id === value);

  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {accounts.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              No bank accounts. Add one in Banking.
            </div>
          )}
          {accounts.map((a) => {
            const capable = isCapable(a, requireRail);
            return (
              <SelectItem key={a.id} value={a.id} disabled={!capable}>
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  <span className="truncate">{a.name}</span>
                  {a.capabilities.map((c) => (
                    <Badge key={c} variant="outline" className="h-4 px-1 text-[10px]">{c}</Badge>
                  ))}
                  {!capable && <span className="text-xs text-muted-foreground">(ACH not enabled)</span>}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {selected && !selected.isStripeReady && selected.isPlaidLinked && !isReadOnly && (
        <Button
          type="button" size="sm" variant="outline"
          disabled={enableStripeAch.isPending}
          onClick={() => enableStripeAch.mutate(selected.id)}
        >
          <Zap className="mr-2 h-3 w-3" />
          {enableStripeAch.isPending ? 'Enabling ACH…' : 'Enable Stripe ACH on this bank'}
        </Button>
      )}
      {selected && !selected.isPlaidLinked && requireRail === 'ach' && (
        <p className="text-xs text-muted-foreground">
          Connect this account via Plaid in Banking → Accounts to enable ACH.
        </p>
      )}
    </div>
  );
}
