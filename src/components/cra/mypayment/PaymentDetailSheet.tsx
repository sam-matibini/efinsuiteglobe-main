import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, FileText, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useCraMyPaymentAudit, useCraMyPayments, type MyPaymentRow } from '@/hooks/useCraMyPayments';
import { useCraTaxCentre } from '@/hooks/useCraTaxCentre';
import { findType } from '@/lib/cra/mypayment/catalog';
import {
  STATUS_LABEL,
  STATUS_TONE,
  approveBlock,
  formatCad,
  handoffChecklist,
  needsReview,
  reviewBlock,
  suggestLiabilityAccount,
} from '@/lib/cra/mypayment/workflow';
import { ConfirmPaymentDialog } from './ConfirmPaymentDialog';
import { ReconcileDialog } from './ReconcileDialog';
import { openCraMyPayment } from './handoff';

export function StatusBadge({ status }: { status: MyPaymentRow['workflow_status'] }) {
  return <span className={cn('inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', STATUS_TONE[status])}>{STATUS_LABEL[status]}</span>;
}

const AUDIT_LABEL: Record<string, string> = {
  created: 'Payment prepared',
  reviewed: 'Reviewed',
  journal_posted: 'Journal entry posted',
  receipt_attached: 'Receipt attached',
  bank_matched: 'Bank transaction matched',
  updated: 'Details changed',
  deleted: 'Deleted',
};

function auditLabel(action: string) {
  if (action.startsWith('status:')) {
    const status = action.slice(7) as keyof typeof STATUS_LABEL;
    return `Status → ${STATUS_LABEL[status] ?? status}`;
  }
  return AUDIT_LABEL[action] ?? action;
}

export function PaymentDetailSheet({ row, onOpenChange, onEdit }: { row: MyPaymentRow | null; onOpenChange: (open: boolean) => void; onEdit: (row: MyPaymentRow) => void }) {
  const cra = useCraTaxCentre();
  const pay = useCraMyPayments();
  const audit = useCraMyPaymentAudit(row?.id ?? null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [failReason, setFailReason] = useState('');
  const [showFail, setShowFail] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [liabilityId, setLiabilityId] = useState('');
  const [bankId, setBankId] = useState('');

  // Keep the sheet in sync with the latest copy of the row.
  const current = useMemo(() => (row ? pay.payments.find((p) => p.id === row.id) ?? row : null), [row, pay.payments]);
  const type = current ? findType(pay.catalog, current.payer_kind, current.cra_payment_type) : undefined;

  useEffect(() => {
    setShowFail(false);
    setFailReason('');
    if (current) {
      setLiabilityId(suggestLiabilityAccount(type, pay.accounts, current.liability_account_id) ?? '');
      setBankId(current.bank_account_id ?? pay.banks[0]?.id ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (!current) return <Sheet open={false} onOpenChange={onOpenChange}><SheetContent /></Sheet>;

  const actor = { userId: pay.userId ?? '', role: cra.actor.role };
  const review = needsReview(pay.policy, current.amount);
  const reviewWhy = reviewBlock(current, actor, pay.policy);
  const approveWhy = approveBlock(current, actor, pay.policy);
  const canPrepare = cra.can('prepare_payment');
  const status = current.workflow_status;
  const busy = pay.transition.isPending || pay.review.isPending || pay.approve.isPending;

  const go = (to: MyPaymentRow['workflow_status'], message: string, extra?: Record<string, unknown>) =>
    pay.transition.mutate({ id: current.id, to, message, extra });

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error('Copy failed. Select the text instead.');
    }
  };

  const handoff = () => {
    openCraMyPayment();
    if (status === 'awaiting_payment') go('payment_initiated', `CRA My Payment opened for ${current.reference}. Record the confirmation when you are done.`);
  };

  const openReceipt = async () => {
    if (!current.receipt_path) return;
    try {
      window.open(await pay.receiptUrl(current.receipt_path), '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const checklist = handoffChecklist(current, pay.typeLabel(current), pay.allocationLabel(current));
  const bank = pay.banks.find((b) => b.id === current.bank_account_id);
  const liability = pay.accounts.find((a) => a.id === current.liability_account_id);
  const completed = ['payment_completed', 'reconciliation_pending', 'reconciled'].includes(status);

  return (
    <Sheet open={!!row} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <div className="flex items-center gap-2"><StatusBadge status={status} /><span className="text-xs text-muted-foreground">{current.reference}</span></div>
          <SheetTitle>{pay.typeLabel(current)} · {formatCad(current.amount)}</SheetTitle>
          <SheetDescription>{pay.allocationLabel(current)}{current.filing_period_label ? ` · ${current.filing_period_label}` : ''}</SheetDescription>
        </SheetHeader>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Item label={current.payer_kind === 'business' ? 'Business' : 'Taxpayer'} value={current.business_name} />
          {current.payer_kind === 'business' ? <Item label="Program account" value={current.program_account} /> : null}
          <Item label="Intended payment date" value={current.scheduled_for} />
          <Item label="Paid from" value={bank?.name} />
          <Item label="Prepared by" value={pay.personName(current.prepared_by)} />
          {review || current.reviewed_by ? <Item label="Reviewed by" value={current.reviewed_by ? pay.personName(current.reviewed_by) : 'Waiting'} /> : null}
          <Item label="Approved by" value={current.approved_by ? pay.personName(current.approved_by) : 'Waiting'} />
          {current.confirmation_number ? <Item label="CRA confirmation" value={current.confirmation_number} /> : null}
          {current.paid_at ? <Item label="Paid on" value={current.paid_at.slice(0, 10)} /> : null}
          {current.failure_reason ? <Item label="Failure reason" value={current.failure_reason} /> : null}
          {current.duplicate_override_reason ? <Item label="Duplicate note" value={current.duplicate_override_reason} /> : null}
          {current.notes ? <Item label="Notes" value={current.notes} wide /> : null}
        </dl>

        <Separator className="my-4" />

        {/* Actions by status */}
        <div className="space-y-3">
          {status === 'draft' && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => onEdit(current)} disabled={!canPrepare}>Edit</Button>
              <Button variant="outline" onClick={() => go('awaiting_authorization', `${current.reference} sent for authorization`)} disabled={!canPrepare || busy}>Submit for authorization</Button>
              <Button variant="ghost" className="text-destructive" onClick={() => pay.remove.mutate(current.id, { onSuccess: () => onOpenChange(false) })}>Delete draft</Button>
            </div>
          )}

          {status === 'awaiting_authorization' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {review && !current.reviewed_by ? (
                  <Button onClick={() => pay.review.mutate(current.id)} disabled={!!reviewWhy || busy}>Mark reviewed</Button>
                ) : null}
                <Button onClick={() => pay.approve.mutate(current.id)} disabled={!!approveWhy || busy}>Approve payment</Button>
                <Button variant="outline" onClick={() => go('draft', `${current.reference} returned to draft`)} disabled={busy}>Send back to draft</Button>
                <Button variant="ghost" onClick={() => go('cancelled', `${current.reference} cancelled`)} disabled={busy}>Cancel</Button>
              </div>
              {review && !current.reviewed_by && reviewWhy ? <p className="text-xs text-muted-foreground">Review: {reviewWhy}</p> : null}
              {approveWhy ? <p className="text-xs text-muted-foreground">Approval: {approveWhy}</p> : null}
            </div>
          )}

          {(status === 'awaiting_payment' || status === 'payment_initiated') && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="text-sm font-medium">Enter these on CRA My Payment</div>
              <ul className="space-y-1 text-sm">
                {checklist.map((item) => (
                  <li key={item.label} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="flex items-center gap-1 text-right font-medium">
                      {item.value}
                      {item.label !== 'Identifier' ? (
                        <button type="button" className="rounded p-1 hover:bg-muted" onClick={() => copy(item.label, item.value)} aria-label={`Copy ${item.label}`}>
                          {copied === item.label ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
              <ol className="list-decimal space-y-0.5 pl-5 text-xs text-muted-foreground">
                <li>Select the payment type and allocation, enter the details, click Next.</li>
                <li>Check the details and click Confirm and proceed to pay.</li>
                <li>Choose Visa Debit, Debit Mastercard, Apple Pay, Google Pay or Konek and click Pay Now.</li>
                <li>Use express checkout or enter your card, then click Pay. Keep the confirmation number.</li>
              </ol>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handoff} disabled={busy}>
                  {status === 'awaiting_payment' ? 'Pay now using CRA My Payment' : 'Reopen CRA My Payment'} <ExternalLink className="ml-1 h-4 w-4" />
                </Button>
                {status === 'payment_initiated' ? (
                  <>
                    <Button variant="secondary" onClick={() => setConfirmOpen(true)}>Record confirmation</Button>
                    <Button variant="outline" onClick={() => setShowFail((v) => !v)}>Payment failed</Button>
                    <Button variant="ghost" onClick={() => go('awaiting_payment', `${current.reference} is waiting for payment again`)} disabled={busy}>Not paid yet</Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => go('draft', `${current.reference} returned to draft`)} disabled={busy}>Send back to draft</Button>
                    <Button variant="ghost" onClick={() => go('cancelled', `${current.reference} cancelled`)} disabled={busy}>Cancel</Button>
                  </>
                )}
              </div>
              {showFail ? (
                <div className="space-y-2">
                  <Label className="text-xs">What happened?</Label>
                  <Textarea rows={2} value={failReason} onChange={(e) => setFailReason(e.target.value)} placeholder="e.g. card declined, daily debit limit reached" />
                  <Button size="sm" variant="destructive" disabled={failReason.trim().length < 3 || busy}
                    onClick={() => go('payment_failed', `${current.reference} marked as failed`, { failure_reason: failReason.trim() })}>
                    Mark payment failed
                  </Button>
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">eFinsuite does not fill in or submit the CRA page. You authorize the payment yourself.</p>
            </div>
          )}

          {status === 'payment_failed' && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => go('awaiting_payment', `${current.reference} is ready to pay again`, { failure_reason: null })} disabled={busy}>Try again</Button>
              <Button variant="ghost" onClick={() => go('cancelled', `${current.reference} cancelled`)} disabled={busy}>Cancel</Button>
            </div>
          )}

          {completed && (
            <div className="space-y-3">
              <div className="rounded-lg border p-3 text-sm">
                <div className="mb-2 font-medium">General ledger</div>
                {current.journal_entry_id ? (
                  <p className="text-muted-foreground">Posted: Dr {liability?.name ?? 'tax liability'} / Cr {bank?.name ?? 'bank'} {formatCad(current.amount)}, reference {current.reference}.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-muted-foreground">Not posted yet.</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Select value={liabilityId || undefined} onValueChange={setLiabilityId}>
                        <SelectTrigger><SelectValue placeholder="Tax liability account" /></SelectTrigger>
                        <SelectContent>{pay.accounts.filter((a) => !a.is_header).map((a) => <SelectItem key={a.id} value={a.id}>{a.code ? `${a.code} · ` : ''}{a.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={bankId || undefined} onValueChange={setBankId}>
                        <SelectTrigger><SelectValue placeholder="Bank account" /></SelectTrigger>
                        <SelectContent>{pay.banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <Button size="sm" disabled={!liabilityId || !bankId || pay.postJournal.isPending}
                      onClick={() => pay.postJournal.mutate({ row: current, liabilityAccountId: liabilityId, bankAccountId: bankId })}>
                      Post journal entry
                    </Button>
                  </div>
                )}
              </div>
              <div className="rounded-lg border p-3 text-sm">
                <div className="mb-2 font-medium">Receipt</div>
                {current.receipt_path ? (
                  <Button variant="outline" size="sm" onClick={openReceipt}><FileText className="mr-1 h-4 w-4" />{current.receipt_file_name ?? 'Open receipt'}</Button>
                ) : (
                  <label className="flex items-center gap-2 text-muted-foreground">
                    <Paperclip className="h-4 w-4" />
                    <Input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.eml,.txt" className="max-w-xs"
                      onChange={(e) => { const file = e.target.files?.[0]; if (file) pay.attachReceipt.mutate({ row: current, file }); }} />
                  </label>
                )}
              </div>
              <div className="rounded-lg border p-3 text-sm">
                <div className="mb-2 font-medium">Bank reconciliation</div>
                {status === 'reconciled' ? (
                  <p className="text-muted-foreground">Matched to a bank transaction on {current.reconciled_at?.slice(0, 10)}.</p>
                ) : (
                  <Button size="sm" onClick={() => setReconcileOpen(true)}>Find bank transaction</Button>
                )}
              </div>
            </div>
          )}
        </div>

        <Separator className="my-4" />
        <div>
          <div className="mb-2 text-sm font-medium">Audit trail</div>
          {audit.isLoading ? <p className="text-xs text-muted-foreground">Loading…</p> : null}
          <ol className="space-y-2 border-l pl-4 text-sm">
            {(audit.data ?? []).map((event) => (
              <li key={event.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                <div className="font-medium">{auditLabel(event.action)}</div>
                <div className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString('en-CA')} · {pay.personName(event.actor_id)}</div>
              </li>
            ))}
            {!audit.isLoading && !(audit.data ?? []).length ? <li className="text-xs text-muted-foreground">No events yet.</li> : null}
          </ol>
        </div>

        <ConfirmPaymentDialog row={current} open={confirmOpen} onOpenChange={setConfirmOpen} />
        <ReconcileDialog row={current} open={reconcileOpen} onOpenChange={setReconcileOpen} />
      </SheetContent>
    </Sheet>
  );
}

function Item({ label, value, wide }: { label: string; value: string | null | undefined; wide?: boolean }) {
  return (
    <div className={cn(wide && 'col-span-2')}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words">{value || '—'}</dd>
    </div>
  );
}

