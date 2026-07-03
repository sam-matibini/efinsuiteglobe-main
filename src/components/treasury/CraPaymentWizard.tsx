import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CraAccountSelect } from '@/components/treasury/CraAccountSelect';
import { FundingBankSelect } from '@/components/treasury/FundingBankSelect';
import { useCraAccounts, type CraTaxType } from '@/hooks/useCraAccounts';
import { useTaxPayments, type TaxPaymentMethod, type TaxPaymentRail } from '@/hooks/useTaxPayments';
import { CheckCircle2, AlertTriangle, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { supabase } from '@/integrations/supabase/client';
import { usePadAgreements } from '@/hooks/usePadAgreements';


type Step = 1 | 2 | 3 | 4;

const TAX_TYPE_LABEL: Record<CraTaxType, string> = {
  gst_hst: 'GST / HST',
  payroll: 'Payroll Source Deductions',
  corporate_tax: 'Corporate Income Tax',
};

const TYPE_TO_PAYMENT_TYPE: Record<CraTaxType, 'gst_hst' | 'source_deductions' | 'corporate_tax'> = {
  gst_hst: 'gst_hst',
  payroll: 'source_deductions',
  corporate_tax: 'corporate_tax',
};

interface MethodOption {
  value: TaxPaymentMethod;
  rail: TaxPaymentRail;
  label: string;
  hint: string;
  enabled: boolean;
  badge?: string;
}

const METHOD_OPTIONS: MethodOption[] = [
  { value: 'stripe',          rail: 'stripe_card',     label: 'Credit / Debit Card (Stripe)',      hint: 'Real-time card processing via Stripe. Settles immediately.', enabled: true,  badge: 'Live' },
  { value: 'plaid_ach',       rail: 'vopay_eft',       label: 'Bank debit (Plaid + Stripe ACH)',   hint: 'Pull funds from a Plaid-verified bank account via ACH.',     enabled: true,  badge: 'Live' },
  { value: 'cra_my_payment',  rail: 'cra_my_payment',  label: 'CRA My Payment',                    hint: 'Pay via cra.gc.ca and record confirmation.',                  enabled: true },
  { value: 'manual',          rail: 'manual',          label: 'Manual / external (recorded only)', hint: 'You will pay outside the app and record it here.',            enabled: true },
  { value: 'eft',             rail: 'vopay_eft',       label: 'EFT bank debit (manual)',           hint: 'Record an EFT initiated outside the app.',                    enabled: true },
  { value: 'pad',             rail: 'vopay_pad',       label: 'Pre-Authorized Debit (PAD)',        hint: 'Requires an active PAD agreement.',                           enabled: true },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTaxType?: CraTaxType;
  onCreated?: (id: string) => void;
}

export function CraPaymentWizard({ open, onOpenChange, initialTaxType, onCreated }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [taxType, setTaxType] = useState<CraTaxType>(initialTaxType ?? 'gst_hst');
  const [craAccountId, setCraAccountId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [periodLabel, setPeriodLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [method, setMethod] = useState<TaxPaymentMethod>('manual');
  const [rail, setRail] = useState<TaxPaymentRail>('manual');
  const [notes, setNotes] = useState('');
  const [createdId, setCreatedId] = useState<string | null>(null);

  const { accounts } = useCraAccounts({ taxType });
  const { payments, create } = useTaxPayments();
  const fmt = useCurrencyFormatter();

  // Reset when opened
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setTaxType(initialTaxType ?? 'gst_hst');
    setCraAccountId('');
    setPeriodStart('');
    setPeriodEnd('');
    setPeriodLabel('');
    setAmount('');
    setBankAccountId('');
    setMethod('manual');
    setRail('manual');
    setNotes('');
    setCreatedId(null);
  }, [open, initialTaxType]);

  // Auto-pick default account
  useEffect(() => {
    if (!craAccountId && accounts.length) {
      const def = accounts.find((a) => a.is_default) ?? accounts[0];
      setCraAccountId(def.id);
    }
  }, [accounts, craAccountId]);

  const selectedAccount = useMemo(() => accounts.find((a) => a.id === craAccountId), [accounts, craAccountId]);

  // Duplicate detection: same org + cra account + period + amount within ±0.01
  const duplicates = useMemo(() => {
    if (!craAccountId || !amount || !periodEnd) return [];
    const amt = Number(amount);
    return payments.filter(
      (p) =>
        p.cra_account_id === craAccountId &&
        p.period_end === periodEnd &&
        Math.abs((p.amount ?? 0) - amt) < 0.01 &&
        !['cancelled', 'failed', 'returned', 'reversed'].includes(p.status),
    );
  }, [payments, craAccountId, amount, periodEnd]);

  const canAdvance1 = !!craAccountId && !!periodStart && !!periodEnd && Number(amount) > 0;
  const canAdvance2 = !!method && METHOD_OPTIONS.find((m) => m.value === method)?.enabled === true;

  const submit = async () => {
    const row = await create.mutateAsync({
      payment_type: TYPE_TO_PAYMENT_TYPE[taxType],
      cra_account_id: craAccountId,
      period_start: periodStart,
      period_end: periodEnd,
      filing_period_label: periodLabel || null,
      amount: Number(amount),
      currency: 'CAD',
      payment_method: method,
      payment_rail: rail,
      bank_account_id: bankAccountId || null,
      notes: notes || null,
      requires_mfa: Number(amount) >= 5000 && (method === 'stripe' || method === 'plaid_ach' || method === 'eft' || method === 'pad'),
    });
    const id = (row as { id: string }).id;
    setCreatedId(id);
    try {
      await (supabase as unknown as { from: (n: string) => { insert: (v: unknown) => Promise<unknown> } })
        .from('cra_audit_log')
        .insert({
          organization_id: (row as { organization_id: string }).organization_id,
          tax_payment_id: id,
          action: 'remittance.created',
          payload: { amount: Number(amount), method, rail, tax_type: taxType },
        });
    } catch (e) { console.warn('audit log write failed', e); }
    onCreated?.(id);
    setStep(4);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New CRA Remittance</DialogTitle>
          <DialogDescription>Step {step} of 4 — {step === 1 ? 'remittance details' : step === 2 ? 'payment method' : step === 3 ? 'review & confirm' : 'confirmation'}</DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Remittance type</Label>
                <Select value={taxType} onValueChange={(v) => { setTaxType(v as CraTaxType); setCraAccountId(''); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TAX_TYPE_LABEL) as CraTaxType[]).map((k) => (
                      <SelectItem key={k} value={k}>{TAX_TYPE_LABEL[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>CRA program account</Label>
                <CraAccountSelect taxType={taxType} value={craAccountId} onValueChange={setCraAccountId} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Filing period start</Label>
                <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </div>
              <div>
                <Label>Filing period end</Label>
                <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </div>
              <div>
                <Label>Period label</Label>
                <Input placeholder="e.g. Q3 2026" value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount (CAD)</Label>
                <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <Label>Funding bank account (optional)</Label>
                <FundingBankSelect value={bankAccountId} onValueChange={setBankAccountId} />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional internal notes" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {METHOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={!opt.enabled}
                onClick={() => { setMethod(opt.value); setRail(opt.rail); }}
                className={`w-full text-left rounded-md border p-3 transition-colors ${
                  method === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                } ${!opt.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{opt.label}</span>
                  {opt.badge && <Badge variant="outline">{opt.badge}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{opt.hint}</p>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {duplicates.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Possible duplicate remittance</AlertTitle>
                <AlertDescription>
                  Found {duplicates.length} active payment{duplicates.length > 1 ? 's' : ''} for this CRA account, period, and amount.
                  Review {duplicates.map((d) => d.reference).join(', ')} before continuing.
                </AlertDescription>
              </Alert>
            )}
            <PadWarning bankAccountId={bankAccountId} method={method} amount={Number(amount)} />

            <div className="rounded-md border divide-y text-sm">
              <Row label="Remittance type" value={TAX_TYPE_LABEL[taxType]} />
              <Row label="CRA program account" value={selectedAccount ? `${selectedAccount.account_name} (${selectedAccount.full_account_number})` : '—'} />
              <Row label="Filing period" value={`${periodStart} → ${periodEnd}${periodLabel ? ` (${periodLabel})` : ''}`} />
              <Row label="Amount" value={fmt.formatCurrency(Number(amount), { showCurrencySymbol: true, currencyOverride: 'CAD' })} />
              <Row label="Payment method" value={METHOD_OPTIONS.find((m) => m.value === method)?.label ?? method} />
              {notes && <Row label="Notes" value={notes} />}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3 text-center py-6">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <p className="font-semibold">Remittance created as draft</p>
            <p className="text-sm text-muted-foreground">
              {(method === 'stripe' || method === 'plaid_ach') && Number(amount) >= 5000
                ? 'Requires approval before processing. View approvals from the CRA Payments tab.'
                : 'You can submit it now to charge via the selected rail, or open it later from CRA Payments.'}
            </p>
            {(method === 'stripe' || method === 'plaid_ach') && createdId && (
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    const { error } = await supabase.functions.invoke('treasury-pay-tax', { body: { tax_payment_id: createdId } });
                    if (error) throw error;
                    onOpenChange(false);
                  } catch (e) {
                    console.error(e);
                  }
                }}
              >
                Submit payment now
              </Button>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && step < 4 && (
            <Button variant="outline" onClick={() => setStep((s) => (s - 1) as Step)}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
          )}
          {step === 1 && (
            <Button disabled={!canAdvance1} onClick={() => setStep(2)}>
              Next <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === 2 && (
            <Button disabled={!canAdvance2} onClick={() => setStep(3)}>
              Next <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === 3 && (
            <Button onClick={submit} disabled={create.isPending}>
              {create.isPending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Saving…</> : 'Create remittance'}
            </Button>
          )}
          {step === 4 && (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function PadWarning({ bankAccountId, method, amount }: { bankAccountId: string; method: string; amount: number }) {
  const needsPad = method === 'eft' || method === 'pad' || method === 'plaid_ach';
  const { activePadForBankAccount } = usePadAgreements({ scope: 'cra' });
  if (!needsPad || !bankAccountId) return null;
  const pad = activePadForBankAccount(bankAccountId);
  if (!pad) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>PAD agreement required</AlertTitle>
        <AlertDescription>
          No active Pre-Authorized Debit agreement covers this bank account. EFT remittance will be
          rejected. Add one in <strong>Treasury Settings → PAD Agreements</strong>.
        </AlertDescription>
      </Alert>
    );
  }
  if (pad.max_amount_per_debit && amount > Number(pad.max_amount_per_debit)) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Amount exceeds PAD cap</AlertTitle>
        <AlertDescription>
          PAD per-debit cap is CAD {Number(pad.max_amount_per_debit).toLocaleString()}. Raise the cap
          or split the remittance.
        </AlertDescription>
      </Alert>
    );
  }
  return null;
}

