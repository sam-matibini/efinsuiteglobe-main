import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Building2, CheckCircle2, ExternalLink, User } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useCraAccounts } from '@/hooks/useCraAccounts';
import { useCraMyPayments, type MyPaymentRow } from '@/hooks/useCraMyPayments';
import { useCraRepresentativeSettings } from '@/hooks/useCraRepresentativeSettings';
import { useCraTaxCentre } from '@/hooks/useCraTaxCentre';
import { findAllocation, findType, type PayerKind } from '@/lib/cra/mypayment/catalog';
import { knownProgramAccounts, prefillForType } from '@/lib/cra/mypayment/prefill';
import {
  approveBlock,
  approvalSteps,
  findDuplicates,
  formatCad,
  needsReview,
  normalizeProgramAccount,
  parseAmount,
  validateDraft,
  type PaymentDraft,
} from '@/lib/cra/mypayment/workflow';
import { reserveCraTab } from './handoff';

const STEPS = ['Payment type', 'Allocation', 'Payment details', 'Review'] as const;

const EMPTY: PaymentDraft = {
  payerKind: 'business',
  typeKey: '',
  allocationKey: '',
  businessName: '',
  businessNumber: '',
  programAccount: '',
  periodLabel: '',
  periodStart: '',
  periodEnd: '',
  amount: '',
  paymentDate: new Date().toISOString().slice(0, 10),
};

function fromRow(row: MyPaymentRow): PaymentDraft {
  return {
    payerKind: (row.payer_kind ?? 'business') as PayerKind,
    typeKey: row.cra_payment_type ?? '',
    allocationKey: row.cra_allocation ?? '',
    businessName: row.business_name ?? '',
    businessNumber: row.business_number ?? '',
    programAccount: row.program_account ?? '',
    periodLabel: row.filing_period_label ?? '',
    periodStart: row.period_start ?? '',
    periodEnd: row.period_end ?? '',
    amount: row.amount ? row.amount.toFixed(2) : '',
    paymentDate: row.scheduled_for ?? new Date().toISOString().slice(0, 10),
  };
}

export interface PaymentWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: MyPaymentRow | null;
  /** Pre-select a type, e.g. from a GST/HST or payroll screen. */
  initialType?: { payerKind: PayerKind; typeKey: string; allocationKey?: string };
  onSaved?: (row: MyPaymentRow) => void;
}

export function PaymentWizard({ open, onOpenChange, editing, initialType, onSaved }: PaymentWizardProps) {
  const cra = useCraTaxCentre();
  const pay = useCraMyPayments();
  const rep = useCraRepresentativeSettings();
  const { accounts: dbAccounts } = useCraAccounts();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<PaymentDraft>(EMPTY);
  const [bankAccountId, setBankAccountId] = useState<string>('');
  const [clientId, setClientId] = useState<string>('self');
  const [notes, setNotes] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [duplicateReason, setDuplicateReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setShowErrors(false);
    setDuplicateReason(editing?.duplicate_override_reason ?? '');
    setNotes(editing?.notes ?? '');
    setBankAccountId(editing?.bank_account_id ?? pay.banks[0]?.id ?? '');
    setClientId(editing?.represented_client_id ?? 'self');
    setSources([]);
    if (editing) {
      setDraft(fromRow(editing));
      setStep(2);
    } else if (initialType) {
      setDraft({ ...EMPTY, payerKind: initialType.payerKind, typeKey: initialType.typeKey, allocationKey: initialType.allocationKey ?? '' });
      setStep(initialType.allocationKey ? 2 : 1);
    } else {
      setDraft(EMPTY);
      setStep(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  const programAccounts = useMemo(() => knownProgramAccounts(cra.ledger, dbAccounts), [cra.ledger, dbAccounts]);
  const type = findType(pay.catalog, draft.payerKind as PayerKind, draft.typeKey);
  const allocation = findAllocation(type, draft.allocationKey);
  const types = pay.catalog.filter((t) => t.payerKind === draft.payerKind);
  const activeClients = rep.clients.filter((c) => c.status === 'active' && c.payer_kind === draft.payerKind);

  // Pre-fill when the type and allocation are chosen (new payments only).
  useEffect(() => {
    if (!open || editing || !type || !draft.allocationKey) return;
    const client = rep.clients.find((c) => c.id === clientId);
    if (client) {
      const account = client.program_accounts.find((a) => a.slice(9, 11) === type.program) ?? '';
      setDraft((d) => ({ ...d, businessName: client.client_name, businessNumber: client.business_number, programAccount: account }));
      setSources([`Taxpayer details from the CRA Representative client register (${client.client_name}).`]);
      return;
    }
    const { patch, sources: notes } = prefillForType(type, draft.allocationKey, cra.ledger, programAccounts);
    setDraft((d) => ({ ...d, ...patch }));
    setSources(notes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft.typeKey, draft.allocationKey, clientId]);

  const set = <K extends keyof PaymentDraft>(key: K, value: PaymentDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const validation = validateDraft(draft, type, pay.policy);
  const amount = parseAmount(draft.amount);
  const duplicates = useMemo(() => {
    if (!type || Number.isNaN(amount)) return { exact: [], similar: [] };
    return findDuplicates({
      id: editing?.id,
      payer_kind: draft.payerKind as PayerKind,
      cra_payment_type: draft.typeKey,
      cra_allocation: draft.allocationKey,
      program_account: draft.payerKind === 'business' ? normalizeProgramAccount(draft.programAccount) : null,
      business_name: draft.businessName,
      filing_period_label: draft.periodLabel,
      amount,
    }, pay.payments, pay.policy.duplicate_window_days);
  }, [type, amount, draft, editing?.id, pay.payments, pay.policy.duplicate_window_days]);

  const needsDuplicateReason = duplicates.exact.length > 0;
  const canSelfApprove = !!pay.userId && !Number.isNaN(amount) && approveBlock({
    id: 'new', reference: '', workflow_status: 'awaiting_authorization', payer_kind: null, cra_payment_type: null, cra_allocation: null,
    business_name: null, business_number: null, program_account: null, filing_period_label: null, period_start: null, period_end: null,
    amount, scheduled_for: null, bank_account_id: null, prepared_by: pay.userId, reviewed_by: null, approved_by: null,
    confirmation_number: null, paid_at: null, journal_entry_id: null, bank_transaction_id: null, receipt_path: null, created_at: '',
  }, { userId: pay.userId, role: cra.actor.role }, pay.policy) === null;

  const stepValid = (index: number) => {
    if (index === 0) return !!type;
    if (index === 1) return !!allocation;
    if (index === 2) return validation.ok && (!needsDuplicateReason || duplicateReason.trim().length >= 5);
    return true;
  };

  const next = () => {
    if (!stepValid(step)) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const save = async (mode: 'draft' | 'submit' | 'proceed') => {
    if (mode !== 'draft' && !(validation.ok && (!needsDuplicateReason || duplicateReason.trim().length >= 5))) {
      setShowErrors(true);
      setStep(2);
      return;
    }
    const tab = mode === 'proceed' ? reserveCraTab() : null;
    setBusy(true);
    try {
      const submit = mode !== 'draft';
      const representedClientId = clientId === 'self' ? null : clientId;
      let row = editing
        ? await pay.updateDraft.mutateAsync({ id: editing.id, draft, bankAccountId: bankAccountId || null, submit, duplicateReason, notes })
        : await pay.create.mutateAsync({ draft, submit, bankAccountId: bankAccountId || null, duplicateReason, representedClientId, notes });
      if (mode === 'proceed') {
        row = await pay.approve.mutateAsync(row.id);
        const result = await pay.transition.mutateAsync({ id: row.id, to: 'payment_initiated', message: `CRA My Payment opened for ${row.reference}. Record the confirmation when you are done.` });
        row = result.row;
        tab?.go();
      }
      onSaved?.(row);
      onOpenChange(false);
    } catch {
      tab?.close();
      // Toasts come from the mutations.
    } finally {
      setBusy(false);
    }
  };

  const err = (key: keyof PaymentDraft) => (showErrors ? validation.errors[key] : undefined);
  const bank = pay.banks.find((b) => b.id === bankAccountId);

  return (
    <Dialog open={open} onOpenChange={(value) => !busy && onOpenChange(value)}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.reference}` : 'New CRA payment'}</DialogTitle>
          <DialogDescription>
            Prepare the payment here, then complete it on CRA My Payment. eFinsuite never signs in to CRA or enters card details.
          </DialogDescription>
        </DialogHeader>

        <ol className="grid grid-cols-4 gap-2 text-xs">
          {STEPS.map((label, index) => (
            <li key={label}>
              <button
                type="button"
                className={cn(
                  'w-full rounded-md border px-2 py-1.5 text-left transition-colors',
                  index === step ? 'border-primary bg-primary/10 font-semibold text-foreground' : 'text-muted-foreground',
                  index < step && 'border-emerald-500/50 text-foreground',
                )}
                disabled={index > step && !Array.from({ length: index }, (_, i) => stepValid(i)).every(Boolean)}
                onClick={() => setStep(index)}
              >
                <span className="mr-1 tabular-nums">{index + 1}.</span>{label}
              </button>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(['business', 'individual'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...EMPTY, payerKind: kind, paymentDate: d.paymentDate }))}
                  className={cn('flex items-center gap-2 rounded-lg border p-3 text-left text-sm', draft.payerKind === kind && 'border-primary bg-primary/5')}
                >
                  {kind === 'business' ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  <span className="font-medium">{kind === 'business' ? 'Businesses' : 'Individuals'}</span>
                </button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {types.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, typeKey: t.key, allocationKey: t.allocations.length === 1 ? t.allocations[0].key : '' }))}
                  className={cn('rounded-lg border p-3 text-left text-sm hover:bg-muted/50', draft.typeKey === t.key && 'border-primary bg-primary/5')}
                >
                  <div className="font-medium">{t.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.program === 'SIN' ? 'Paid with your SIN on the CRA page' : t.program === 'NONE' ? 'Account set on CRA' : `${t.program} program account`}
                    {t.custom ? ' · custom' : ''}
                  </div>
                </button>
              ))}
            </div>
            {showErrors && !type ? <p className="text-sm text-destructive">Choose the tax obligation you are paying.</p> : null}
          </div>
        )}

        {step === 1 && type && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">How should CRA apply this {type.label} payment?</p>
            <div className="grid gap-2">
              {type.allocations.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => set('allocationKey', a.key)}
                  className={cn('flex items-center justify-between rounded-lg border p-3 text-left text-sm hover:bg-muted/50', draft.allocationKey === a.key && 'border-primary bg-primary/5')}
                >
                  <span className="font-medium">{a.label}</span>
                  {draft.allocationKey === a.key ? <CheckCircle2 className="h-4 w-4 text-primary" /> : null}
                </button>
              ))}
            </div>
            {showErrors && !allocation ? <p className="text-sm text-destructive">Choose an allocation.</p> : null}
          </div>
        )}

        {step === 2 && type && (
          <div className="space-y-4">
            {!editing && activeClients.length > 0 ? (
              <Field label="Paying for">
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">{cra.orgName || 'This organization'}</SelectItem>
                    {activeClients.map((c) => <SelectItem key={c.id} value={c.id}>{c.client_name} (represented client)</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            {sources.length > 0 ? (
              <Alert>
                <AlertDescription className="space-y-1 text-xs">
                  <div className="font-medium text-foreground">Filled in from eFinsuite. Check each value; you can change any of them.</div>
                  {sources.map((s) => <div key={s}>{s}</div>)}
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={draft.payerKind === 'business' ? 'Business name' : 'Taxpayer name'} error={err('businessName')}>
                <Input value={draft.businessName} onChange={(e) => set('businessName', e.target.value)} />
              </Field>
              {draft.payerKind === 'business' ? (
                <>
                  <Field label="Business number" error={err('businessNumber')}>
                    <Input value={draft.businessNumber} onChange={(e) => set('businessNumber', e.target.value)} inputMode="numeric" maxLength={11} placeholder="123456789" />
                  </Field>
                  <Field label="Program account" error={err('programAccount')} hint={`${type.program} account, for example 123456789${type.program}0001`}>
                    <Input
                      value={draft.programAccount}
                      onChange={(e) => set('programAccount', e.target.value.toUpperCase())}
                      list="cra-program-accounts"
                      placeholder={`123456789${type.program}0001`}
                    />
                    <datalist id="cra-program-accounts">
                      {programAccounts.filter((a) => a.program === type.program).map((a) => <option key={a.full} value={a.full}>{a.label}</option>)}
                    </datalist>
                  </Field>
                </>
              ) : (
                <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground md:col-span-1">
                  You will enter the Social Insurance Number on the CRA page. eFinsuite does not ask for it or store it.
                </div>
              )}
              <Field label="Payment type">
                <Input value={`${type.label} — ${allocation?.label ?? ''}`} readOnly className="bg-muted/50" />
              </Field>
              <Field label="Tax period" error={err('periodLabel')} hint="As CRA shows it, e.g. October 2026 or 2026-Q3">
                <Input value={draft.periodLabel} onChange={(e) => set('periodLabel', e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Period start" error={err('periodStart')}>
                  <Input type="date" value={draft.periodStart} onChange={(e) => set('periodStart', e.target.value)} />
                </Field>
                <Field label="Period end" error={err('periodEnd')}>
                  <Input type="date" value={draft.periodEnd} onChange={(e) => set('periodEnd', e.target.value)} />
                </Field>
              </div>
              <Field label="Payment amount (CAD)" error={err('amount')}>
                <Input value={draft.amount} onChange={(e) => set('amount', e.target.value)} inputMode="decimal" placeholder="0.00" />
              </Field>
              <Field label="Payment date" error={err('paymentDate')}>
                <Input type="date" value={draft.paymentDate} onChange={(e) => set('paymentDate', e.target.value)} />
              </Field>
              <Field label="Paid from bank account" hint="Used for the journal entry and bank matching">
                <Select value={bankAccountId || 'none'} onValueChange={(v) => setBankAccountId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Choose a bank account" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Decide when confirming</SelectItem>
                    {pay.banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}{b.account_number ? ` ····${b.account_number.slice(-4)}` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Reference number">
                <Input value={editing?.reference ?? 'Assigned on save (EF-CRA-…)'} readOnly className="bg-muted/50" />
              </Field>
              <Field label="Notes for the approver" className="md:col-span-2">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </Field>
            </div>
            <Warnings warnings={validation.warnings} />
            <DuplicateNotice
              exact={duplicates.exact.map((r) => `${r.reference} · ${formatCad(r.amount)} · ${r.workflow_status.replace(/_/g, ' ')}`)}
              similar={duplicates.similar.map((r) => `${r.reference} · ${formatCad(r.amount)} · ${r.workflow_status.replace(/_/g, ' ')}`)}
              reason={duplicateReason}
              onReason={setDuplicateReason}
              showError={showErrors}
            />
          </div>
        )}

        {step === 3 && type && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-lg border">
              <div className="bg-muted/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide">CRA payment summary</div>
              <dl className="divide-y text-sm">
                <Row label={`${type.label} payable`} value={Number.isNaN(amount) ? '—' : formatCad(amount)} />
                <Row label="Payment allocation" value={allocation?.label ?? '—'} />
                <Row label="Reporting period" value={draft.periodLabel || '—'} />
                <Row label={draft.payerKind === 'business' ? 'Business' : 'Taxpayer'} value={draft.businessName} />
                {draft.payerKind === 'business' ? <Row label="Business number" value={draft.businessNumber} /> : null}
                {draft.payerKind === 'business' ? <Row label="Program account" value={normalizeProgramAccount(draft.programAccount)} /> : null}
                <Row label="Payment date" value={draft.paymentDate} />
                <Row label="Paid from" value={bank?.name ?? 'Chosen when confirming'} />
                <Row label="Payment reference" value={editing?.reference ?? 'EF-CRA-… (assigned on save)'} />
                <Row label="Total payment" value={Number.isNaN(amount) ? '—' : formatCad(amount)} strong />
              </dl>
            </div>
            <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              {approvalSteps(pay.policy, Number.isNaN(amount) ? 0 : amount).map((label, index, all) => (
                <span key={label} className="flex items-center gap-1">
                  <Badge variant="outline">{label}</Badge>
                  {index < all.length - 1 ? <ArrowRight className="h-3 w-3" /> : null}
                </span>
              ))}
            </div>
            {canSelfApprove ? (
              <p className="text-sm text-muted-foreground">
                You can approve this payment yourself. <span className="text-foreground">Confirm and Proceed to CRA</span> saves the payment instruction, records your approval, and opens CRA My Payment in a new tab.
              </p>
            ) : (
              <Alert>
                <AlertDescription className="text-sm">
                  {needsReview(pay.policy, Number.isNaN(amount) ? 0 : amount)
                    ? 'This payment needs a review and an approval by other people before anyone pays it on CRA.'
                    : 'This payment needs approval by someone other than you before anyone pays it on CRA.'}
                </AlertDescription>
              </Alert>
            )}
            <Warnings warnings={validation.warnings} />
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            {step > 0 ? (
              <Button variant="outline" onClick={() => setStep(step === 3 ? 2 : step - 1)} disabled={busy}>
                <ArrowLeft className="mr-1 h-4 w-4" /> {step === 3 ? 'Modify Payment' : 'Back'}
              </Button>
            ) : null}
            {step >= 2 ? (
              <Button variant="ghost" onClick={() => save('draft')} disabled={busy || !type || !draft.allocationKey}>Save draft</Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            {step < 3 ? (
              <Button onClick={next} disabled={busy}>Next <ArrowRight className="ml-1 h-4 w-4" /></Button>
            ) : canSelfApprove ? (
              <Button onClick={() => save('proceed')} disabled={busy || !cra.can('prepare_payment')}>
                Confirm and Proceed to CRA <ExternalLink className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => save('submit')} disabled={busy || !cra.can('prepare_payment')}>Confirm and send for approval</Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, hint, className, children }: { label: string; error?: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('space-y-1', className)}>
      <Label className="text-xs">{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn('grid grid-cols-[1fr_auto] gap-4 px-4 py-2', strong && 'bg-muted/40 font-semibold')}>
      <dt className={cn(!strong && 'text-muted-foreground')}>{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}

function Warnings({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;
  return (
    <ul className="space-y-1 rounded-md border border-amber-400/50 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
      {warnings.map((w) => <li key={w} className="flex gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{w}</li>)}
    </ul>
  );
}

function DuplicateNotice({ exact, similar, reason, onReason, showError }: { exact: string[]; similar: string[]; reason: string; onReason: (v: string) => void; showError: boolean }) {
  if (!exact.length && !similar.length) return null;
  return (
    <div className={cn('space-y-2 rounded-md border p-3 text-sm', exact.length ? 'border-destructive/60 bg-destructive/5' : 'border-amber-400/50')}>
      <div className="flex items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4" />
        {exact.length ? 'Possible duplicate payment' : 'Other payments for this account and period'}
      </div>
      <ul className="list-disc pl-5 text-xs text-muted-foreground">{[...exact, ...similar].map((r) => <li key={r}>{r}</li>)}</ul>
      {exact.length ? (
        <div className="space-y-1">
          <Label className="text-xs">Why is this not a duplicate?</Label>
          <Input value={reason} onChange={(e) => onReason(e.target.value)} placeholder="e.g. second instalment for the same period" />
          {showError && reason.trim().length < 5 ? <p className="text-xs text-destructive">Explain why, or go back and change the payment.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
