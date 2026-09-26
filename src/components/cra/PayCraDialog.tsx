import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCad, formatDay } from '@/lib/cra/engine';
import { ACCOUNT_FOR_TAX, FUNDING_ACCOUNT, TAX_LABEL } from '@/lib/cra/representative';
import type { TaxType } from '@/lib/cra/types';
import { useCraTaxCentre } from '@/hooks/useCraTaxCentre';

export interface PayPreset {
  taxType: TaxType;
  amount: number;
  dueDate: string;
  purpose: string;
  obligationId?: string;
}

const TAX_OPTIONS: TaxType[] = ['gst_hst', 'payroll', 'corporate_tax', 'information_return'];

export function PayCraDialog({
  open,
  onOpenChange,
  preset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset?: PayPreset;
}) {
  const cra = useCraTaxCentre();
  const [step, setStep] = useState<'form' | 'review' | 'done'>('form');
  const [taxType, setTaxType] = useState<TaxType>(preset?.taxType ?? 'gst_hst');
  const [amount, setAmount] = useState(String(preset?.amount ?? ''));
  const [paymentDate, setPaymentDate] = useState(preset?.dueDate ?? new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(preset?.dueDate ?? '');
  const [purpose, setPurpose] = useState(preset?.purpose ?? 'Account balance');
  const [resultId, setResultId] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    const today = new Date().toISOString().slice(0, 10);
    setStep('form');
    setTaxType(preset?.taxType ?? 'gst_hst');
    setAmount(preset?.amount ? String(preset.amount) : '');
    setDueDate(preset?.dueDate || today);
    setPaymentDate(preset?.dueDate || today);
    setPurpose(preset?.purpose ?? 'Account balance');
    setResultId(undefined);
  }, [open, preset]);

  const enrolled = TAX_OPTIONS.filter((type) => {
    const code = ACCOUNT_FOR_TAX[type]?.slice(0, 2);
    return cra.ledger.profile.programs.includes(code as 'RT');
  });
  const account = ACCOUNT_FOR_TAX[taxType];
  const numericAmount = Number(amount);

  const review = () => {
    if (!cra.can('prepare_payment')) return;
    setStep('review');
  };

  const confirm = () => {
    const result = cra.createPayment({
      taxType,
      account,
      amount: numericAmount,
      paymentDate,
      dueDate,
      fundingAccount: FUNDING_ACCOUNT,
      purpose,
      obligationId: preset?.obligationId,
    });
    if (result.ok) {
      setResultId(result.id);
      setStep('done');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{step === 'review' ? 'Review CRA payment' : 'Pay CRA'}</DialogTitle>
          <DialogDescription>
            Recipient is the Canada Revenue Agency. Visa or Mastercard checkout sends the payment. It is not paid until that charge settles and CRA confirms it.
          </DialogDescription>
        </DialogHeader>

        {step === 'form' ? (
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Tax type</Label>
              <Select value={taxType} onValueChange={(value) => setTaxType(value as TaxType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {enrolled.map((type) => (
                    <SelectItem key={type} value={type}>
                      {TAX_LABEL[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>CRA account</Label>
                <Input value={account} readOnly />
              </div>
              <div className="space-y-2">
                <Label>Amount (CAD)</Label>
                <Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Payment date</Label>
                <Input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Due date</Label>
                <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </div>
            </div>
            <div className="rounded-md border p-3 text-sm">
              <div className="text-muted-foreground">Funding account</div>
              <div className="font-medium">{FUNDING_ACCOUNT}</div>
              <div className="text-muted-foreground">
                CAD wallet ledger {formatCad(cra.ledger.walletBalance)}. Checkout does not require a wallet balance.
              </div>
            </div>
          </div>
        ) : null}

        {step === 'review' ? (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Recipient</dt>
              <dd>Canada Revenue Agency</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Program</dt>
              <dd>{TAX_LABEL[taxType]}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Account</dt>
              <dd>{account}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Amount</dt>
              <dd>{formatCad(numericAmount || 0)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Payment date</dt>
              <dd>{formatDay(paymentDate)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Funding</dt>
              <dd>{FUNDING_ACCOUNT}</dd>
            </div>
          </dl>
        ) : null}

        {step === 'done' ? (
          <div className="space-y-2 text-sm">
            <p>
              Payment <span className="font-medium">{resultId}</span> is <span className="font-medium">DRAFT</span>.
            </p>
            <p className="text-muted-foreground">
              Prepared by {cra.actor.email}. A different approver releases it. Status will move draft → authorized →
              submitted → processing → accepted → settled → confirmed.
            </p>
            <Button asChild variant="link" className="h-auto p-0">
              <Link to="/tax-cra/remittances" onClick={() => onOpenChange(false)}>
                Open tax remittances
              </Link>
            </Button>
          </div>
        ) : null}

        <DialogFooter>
          {step === 'form' ? (
            <Button onClick={review} disabled={!cra.can('prepare_payment') || !(numericAmount > 0)}>
              Review payment
            </Button>
          ) : null}
          {step === 'review' ? (
            <>
              <Button variant="outline" onClick={() => setStep('form')}>
                Back
              </Button>
              <Button onClick={confirm}>Confirm and pay CRA</Button>
            </>
          ) : null}
          {step === 'done' ? <Button onClick={() => onOpenChange(false)}>Close</Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
