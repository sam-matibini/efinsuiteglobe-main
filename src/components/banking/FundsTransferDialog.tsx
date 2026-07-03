import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight, Building2, CreditCard, Calendar, DollarSign, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { useCreditCards } from '@/hooks/useCreditCards';
import { useFundsTransfer, useCreditCardPayment, TransferAccount } from '@/hooks/useFundsTransfer';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { format } from 'date-fns';

interface FundsTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialFromAccount?: string;
  initialToAccount?: string;
  transferType?: 'transfer' | 'cc-payment';
}

export function FundsTransferDialog({
  open,
  onOpenChange,
  initialFromAccount,
  initialToAccount,
  transferType = 'transfer',
}: FundsTransferDialogProps) {
  const { organization } = useCurrentOrganization();
  const { accounts: bankAccounts } = useBankAccounts();
  const { creditCards } = useCreditCards();
  const fundsTransfer = useFundsTransfer();
  const creditCardPayment = useCreditCardPayment();

  const [fromAccountId, setFromAccountId] = useState(initialFromAccount || '');
  const [toAccountId, setToAccountId] = useState(initialToAccount || '');
  const [amount, setAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [fxRate, setFxRate] = useState<string>('');
  const [transferDate, setTransferDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reference, setReference] = useState('');
  const [memo, setMemo] = useState('');

  // Combine bank accounts and credit cards into a unified list
  const allAccounts: TransferAccount[] = useMemo(() => {
    const banks: TransferAccount[] = bankAccounts.map(ba => ({
      id: ba.id,
      type: 'bank' as const,
      name: `${ba.name} (${ba.institution})`,
      gl_account_id: ba.gl_account_id,
      current_balance: ba.current_balance,
      currency: ba.currency,
    }));

    const cards: TransferAccount[] = creditCards.map(cc => ({
      id: cc.id,
      type: 'credit_card' as const,
      name: `${cc.name} (${cc.issuer})`,
      gl_account_id: cc.gl_account_id,
      current_balance: cc.current_balance,
      currency: cc.currency,
    }));

    return [...banks, ...cards];
  }, [bankAccounts, creditCards]);

  const fromAccount = allAccounts.find(a => a.id === fromAccountId);
  const toAccount = allAccounts.find(a => a.id === toAccountId);
  const isCrossCurrency = !!fromAccount && !!toAccount && fromAccount.currency !== toAccount.currency;

  const formatCurrency = (value: number, currency: string = 'CAD') => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
      }).format(value);
    } catch {
      return `${currency} ${value.toFixed(2)}`;
    }
  };

  // Auto-fetch implied cross-currency rate when accounts/date change
  useEffect(() => {
    if (!isCrossCurrency || !fromAccount || !toAccount) {
      setFxRate('');
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('exchange_rates')
        .select('rate')
        .eq('from_currency', fromAccount.currency)
        .eq('to_currency', toAccount.currency)
        .lte('effective_date', transferDate)
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data?.rate) {
        setFxRate(String(data.rate));
      }
    })();
    return () => { cancelled = true; };
  }, [isCrossCurrency, fromAccount?.currency, toAccount?.currency, transferDate, fromAccount, toAccount]);

  // Auto-compute "you receive" from amount × rate at full precision (round to cents)
  useEffect(() => {
    if (!isCrossCurrency) return;
    const a = parseFloat(amount);
    const r = parseFloat(fxRate);
    if (a > 0 && r > 0) {
      const computed = Math.round(a * r * 100) / 100;
      setToAmount(String(computed));
    }
  }, [amount, fxRate, isCrossCurrency]);

  // Validation
  const amountValue = parseFloat(amount) || 0;
  const isCreditCardPayment = fromAccount?.type === 'bank' && toAccount?.type === 'credit_card';
  const hasValidGLAccounts = fromAccount?.gl_account_id && toAccount?.gl_account_id;
  const canSubmit = fromAccountId && toAccountId && fromAccountId !== toAccountId && amountValue > 0 && hasValidGLAccounts && (!isCrossCurrency || (parseFloat(toAmount) > 0 && parseFloat(fxRate) > 0));

  const handleSubmit = async () => {
    if (!organization?.id || !fromAccount || !toAccount) return;

    try {
      if (isCreditCardPayment) {
        await creditCardPayment.mutateAsync({
          organizationId: organization.id,
          bankAccount: fromAccount,
          creditCard: toAccount,
          amount: amountValue,
          paymentDate: transferDate,
          reference: reference || undefined,
          memo: memo || undefined,
        });
      } else {
        await fundsTransfer.mutateAsync({
          organizationId: organization.id,
          fromAccount,
          toAccount,
          amount: amountValue,
          toAmount: isCrossCurrency ? (parseFloat(toAmount) || 0) : undefined,
          transferDate,
          reference: reference || undefined,
          memo: memo || undefined,
        });
      }
      
      // Reset form
      setFromAccountId('');
      setToAccountId('');
      setAmount('');
      setToAmount('');
      setFxRate('');
      setReference('');
      setMemo('');
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  const isPending = fundsTransfer.isPending || creditCardPayment.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="w-5 h-5" />
            {transferType === 'cc-payment' ? 'Credit Card Payment' : 'Funds Transfer'}
          </DialogTitle>
          <DialogDescription>
            {transferType === 'cc-payment' 
              ? 'Pay your credit card from a bank account'
              : 'Transfer funds between bank accounts and credit cards'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* From Account */}
          <div>
            <Label htmlFor="from-account">From Account</Label>
            <Select value={fromAccountId} onValueChange={setFromAccountId}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select source account..." />
              </SelectTrigger>
              <SelectContent>
                {allAccounts
                  .filter(a => a.id !== toAccountId)
                  .map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2">
                        {account.type === 'bank' ? (
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <CreditCard className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span>{account.name}</span>
                        <span className="text-muted-foreground text-xs ml-auto">
                          {formatCurrency(account.current_balance, account.currency)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {fromAccount && !fromAccount.gl_account_id && (
              <p className="text-xs text-destructive mt-1">
                ⚠️ This account is not linked to a GL account
              </p>
            )}
          </div>

          {/* Arrow indicator */}
          <div className="flex justify-center">
            <div className="p-2 bg-muted rounded-full">
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          {/* To Account */}
          <div>
            <Label htmlFor="to-account">To Account</Label>
            <Select value={toAccountId} onValueChange={setToAccountId}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select destination account..." />
              </SelectTrigger>
              <SelectContent>
                {allAccounts
                  .filter(a => a.id !== fromAccountId)
                  .map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2">
                        {account.type === 'bank' ? (
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <CreditCard className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span>{account.name}</span>
                        <span className="text-muted-foreground text-xs ml-auto">
                          {account.type === 'credit_card' ? 'Owes: ' : ''}
                          {formatCurrency(account.current_balance, account.currency)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {toAccount && !toAccount.gl_account_id && (
              <p className="text-xs text-destructive mt-1">
                ⚠️ This account is not linked to a GL account
              </p>
            )}
          </div>

          {/* Transfer Type Info */}
          {isCreditCardPayment && (
            <Alert>
              <CreditCard className="h-4 w-4" />
              <AlertDescription>
                This will be recorded as a credit card payment, reducing your card balance.
              </AlertDescription>
            </Alert>
          )}

          {/* Amount and Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount" className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                You send {fromAccount ? `(${fromAccount.currency})` : ''}
              </Label>
              <Input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="transfer-date" className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Date
              </Label>
              <Input
                id="transfer-date"
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          {/* Cross-currency: rate + receive amount */}
          {isCrossCurrency && fromAccount && toAccount && (
            <div className="space-y-3 p-3 rounded-lg border border-dashed bg-muted/30">
              <div className="text-xs font-medium text-muted-foreground">
                Cross-currency transfer ({fromAccount.currency} → {toAccount.currency})
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fx-rate">Exchange rate</Label>
                  <Input
                    id="fx-rate"
                    type="number"
                    step="0.00000001"
                    value={fxRate}
                    onChange={(e) => setFxRate(e.target.value)}
                    placeholder="0.00000000"
                    className="mt-1.5 font-mono"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    1 {fromAccount.currency} = {fxRate ? Number(fxRate).toFixed(8) : '—'} {toAccount.currency}
                  </p>
                </div>
                <div>
                  <Label htmlFor="to-amount">You receive ({toAccount.currency})</Label>
                  <Input
                    id="to-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={toAmount}
                    onChange={(e) => setToAmount(e.target.value)}
                    placeholder="0.00"
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Reference */}
          <div>
            <Label htmlFor="reference" className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              Reference (Optional)
            </Label>
            <Input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Auto-generated if empty"
              className="mt-1.5 font-mono"
            />
          </div>

          {/* Memo */}
          <div>
            <Label htmlFor="memo">Memo (Optional)</Label>
            <Textarea
              id="memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Add a note about this transfer..."
              className="mt-1.5 resize-none"
              rows={2}
            />
          </div>

          {/* Summary */}
          {fromAccount && toAccount && amountValue > 0 && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="font-medium">Transfer Summary</div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">From</span>
                <span>{fromAccount.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">To</span>
                <span>{toAccount.name}</span>
              </div>
              <div className="flex justify-between font-medium border-t pt-2">
                <span>You send</span>
                <span className="font-mono">{formatCurrency(amountValue, fromAccount.currency)}</span>
              </div>
              {isCrossCurrency && (
                <div className="flex justify-between font-medium">
                  <span>You receive</span>
                  <span className="font-mono">
                    {formatCurrency(parseFloat(toAmount) || 0, toAccount.currency)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!canSubmit || isPending}
          >
            {isPending ? 'Processing...' : isCreditCardPayment ? 'Record Payment' : 'Transfer Funds'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
