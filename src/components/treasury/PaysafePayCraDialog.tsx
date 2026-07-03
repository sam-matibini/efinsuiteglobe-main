import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Building2, Send, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { usePaysafeCraPayment } from '@/hooks/usePaysafeCraPayment';
import { usePadAgreements } from '@/hooks/usePadAgreements';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import type { TaxPayment } from '@/hooks/useTaxPayments';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: TaxPayment | null;
}

/**
 * Pay a CRA `tax_payment` via Paysafe. Three rails:
 *  - Card (Paysafe.js tokenization — manual handle entry for now)
 *  - Bank debit / EFT (requires an active PAD covering the funding bank account)
 *  - Interac e-Transfer (hosted Paysafe link)
 *
 * The Paysafe edge functions already handle simulation when secrets are
 * absent — this dialog is a pure UI surface around them.
 */
export function PaysafePayCraDialog({ open, onOpenChange, payment }: Props) {
  const { mutateAsync, isPending } = usePaysafeCraPayment();
  const { pads: agreements } = usePadAgreements({ scope: 'cra' });
  const fmt = useCurrencyFormatter();
  const [cardToken, setCardToken] = useState('');

  const activePad = useMemo(() => {
    if (!payment) return null;
    return (
      agreements.find(
        (a) => a.status === 'active' && (a.bank_account_id === payment.bank_account_id || !payment.bank_account_id),
      ) ?? null
    );
  }, [agreements, payment]);

  if (!payment) return null;

  const amountLabel = fmt.formatCurrency(Number(payment.amount ?? 0), {
    showCurrencySymbol: true,
    currencyOverride: payment.currency || 'CAD',
  });

  const submit = async (rail: 'card' | 'eft' | 'interac') => {
    await mutateAsync({
      taxPaymentId: payment.id,
      rail,
      paymentHandleToken: rail === 'card' ? cardToken : undefined,
      returnUrl: rail === 'interac' ? window.location.href : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pay CRA via Paysafe</DialogTitle>
          <DialogDescription>
            Remit <span className="font-mono">{payment.reference}</span> — {amountLabel} for{' '}
            {payment.payment_type.replace('_', ' ')}.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="card">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="card"><CreditCard className="h-4 w-4 mr-1" /> Card</TabsTrigger>
            <TabsTrigger value="eft"><Building2 className="h-4 w-4 mr-1" /> Bank (PAD)</TabsTrigger>
            <TabsTrigger value="interac"><Send className="h-4 w-4 mr-1" /> Interac</TabsTrigger>
          </TabsList>

          <TabsContent value="card" className="space-y-3 pt-3">
            <Alert>
              <CreditCard className="h-4 w-4" />
              <AlertTitle>Credit / Visa Debit</AlertTitle>
              <AlertDescription>
                Paste a Paysafe payment-handle token to authorize the charge. In the live UI this is captured by Paysafe.js.
              </AlertDescription>
            </Alert>
            <div className="space-y-1">
              <Label htmlFor="card-token">Paysafe payment handle token</Label>
              <Input
                id="card-token"
                value={cardToken}
                onChange={(e) => setCardToken(e.target.value)}
                placeholder="phl_xxxxxxxxxxxxxxxx"
              />
            </div>
            <DialogFooter>
              <Button disabled={isPending || !cardToken} onClick={() => submit('card')}>
                Charge {amountLabel}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="eft" className="space-y-3 pt-3">
            {activePad ? (
              <>
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <AlertTitle>PAD authorization active</AlertTitle>
                  <AlertDescription className="space-y-1 text-sm">
                    <div>
                      Payer: <strong>{activePad.payer_name}</strong>
                    </div>
                    <div>
                      Per-debit cap:{' '}
                      <strong>
                        {fmt.formatCurrency(Number(activePad.max_amount_per_debit ?? 0), {
                          showCurrencySymbol: true,
                          currencyOverride: 'CAD',
                        })}
                      </strong>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {activePad.frequency}
                    </Badge>
                  </AlertDescription>
                </Alert>
                <DialogFooter>
                  <Button disabled={isPending} onClick={() => submit('eft')}>
                    Debit {amountLabel}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>No active PAD agreement</AlertTitle>
                <AlertDescription>
                  Capture a CRA Pre-Authorized Debit in <strong>Treasury Settings → PAD Agreements</strong> before remitting via EFT.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="interac" className="space-y-3 pt-3">
            <Alert>
              <Send className="h-4 w-4" />
              <AlertTitle>Interac e-Transfer</AlertTitle>
              <AlertDescription>
                Opens a Paysafe-hosted Interac request. The user completes the transfer at their bank.
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button disabled={isPending} onClick={() => submit('interac')}>
                Request {amountLabel}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
