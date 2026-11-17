import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCraMyPayments, type MyPaymentRow } from '@/hooks/useCraMyPayments';
import { findType } from '@/lib/cra/mypayment/catalog';
import { formatCad, suggestLiabilityAccount } from '@/lib/cra/mypayment/workflow';

export function ConfirmPaymentDialog({ row, open, onOpenChange }: { row: MyPaymentRow | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const pay = useCraMyPayments();
  const [confirmation, setConfirmation] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [liabilityId, setLiabilityId] = useState('');
  const [bankId, setBankId] = useState('');
  const [postJournal, setPostJournal] = useState(true);
  const [notes, setNotes] = useState('');

  const type = row ? findType(pay.catalog, row.payer_kind, row.cra_payment_type) : undefined;
  const postable = useMemo(() => pay.accounts.filter((a) => !a.is_header), [pay.accounts]);
  const liabilities = useMemo(() => postable.filter((a) => (a.account_type ?? '').toLowerCase().includes('liab')), [postable]);

  useEffect(() => {
    if (!open || !row) return;
    setConfirmation('');
    setPaidAt(new Date().toISOString().slice(0, 10));
    setFile(null);
    setNotes('');
    setBankId(row.bank_account_id ?? pay.banks[0]?.id ?? '');
    setLiabilityId(suggestLiabilityAccount(type, pay.accounts, row.liability_account_id) ?? '');
    setPostJournal(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, row?.id]);

  if (!row) return null;
  const bank = pay.banks.find((b) => b.id === bankId);
  const liability = postable.find((a) => a.id === liabilityId);
  const bankGl = postable.find((a) => a.id === bank?.gl_account_id);
  const journalReady = !!liability && !!bankGl;
  const canSave = confirmation.trim().length >= 3 && !!paidAt && (!postJournal || journalReady);

  const submit = async () => {
    await pay.confirm.mutateAsync({
      row,
      confirmationNumber: confirmation,
      paidAt,
      receipt: file,
      liabilityAccountId: liabilityId || null,
      bankAccountId: bankId || null,
      postJournal,
      notes,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !pay.confirm.isPending && onOpenChange(v)}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record CRA payment confirmation</DialogTitle>
          <DialogDescription>
            Copy the confirmation number from the last CRA My Payment page or CRA's confirmation email. The payment is not treated as paid until you save this.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-2">
          <ReadOnly label="Payment amount" value={formatCad(row.amount)} />
          <ReadOnly label="Transaction reference" value={row.reference} />
          <ReadOnly label="Tax account" value={row.program_account ?? row.business_name ?? '—'} />
          <ReadOnly label="Payment allocation" value={pay.allocationLabel(row)} />
          <div className="space-y-1">
            <Label className="text-xs">CRA confirmation number *</Label>
            <Input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoFocus placeholder="From the CRA confirmation page" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Payment date *</Label>
            <Input type="date" value={paidAt} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setPaidAt(e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">CRA receipt or confirmation email (PDF, image or .eml, up to 10 MB)</Label>
            <Input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.eml,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox checked={postJournal} onCheckedChange={(v) => setPostJournal(v === true)} />
            Post the journal entry to the general ledger now
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Debit: tax liability account</Label>
              <Select value={liabilityId || undefined} onValueChange={setLiabilityId}>
                <SelectTrigger><SelectValue placeholder="Choose the liability account" /></SelectTrigger>
                <SelectContent>
                  {(liabilities.length ? liabilities : postable).map((a) => <SelectItem key={a.id} value={a.id}>{a.code ? `${a.code} · ` : ''}{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Credit: bank account paid from</Label>
              <Select value={bankId || undefined} onValueChange={setBankId}>
                <SelectTrigger><SelectValue placeholder="Choose the bank account" /></SelectTrigger>
                <SelectContent>
                  {pay.banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {bank && !bank.gl_account_id ? <p className="text-xs text-destructive">This bank account has no linked GL account.</p> : null}
            </div>
          </div>
          {postJournal ? (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr><th className="text-left font-normal">Account</th><th className="text-right font-normal">Debit</th><th className="text-right font-normal">Credit</th></tr>
              </thead>
              <tbody className="tabular-nums">
                <tr><td>{liability?.name ?? 'Tax liability'}</td><td className="text-right">{formatCad(row.amount)}</td><td /></tr>
                <tr><td>{bankGl?.name ?? bank?.name ?? 'Bank'}</td><td /><td className="text-right">{formatCad(row.amount)}</td></tr>
                <tr className="border-t font-semibold"><td>Total</td><td className="text-right">{formatCad(row.amount)}</td><td className="text-right">{formatCad(row.amount)}</td></tr>
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-muted-foreground">You can post the journal entry later from the payment.</p>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Notes</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pay.confirm.isPending}>Cancel</Button>
          <Button onClick={submit} disabled={!canSave || pay.confirm.isPending}>
            {pay.confirm.isPending ? 'Saving…' : 'Save confirmation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">{value}</div>
    </div>
  );
}
