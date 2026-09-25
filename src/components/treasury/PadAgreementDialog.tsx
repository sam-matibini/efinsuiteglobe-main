import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldCheck } from 'lucide-react';
import { usePadAgreements, type CreatePadAgreementInput } from '@/hooks/usePadAgreements';
import { useFundingBankAccounts } from '@/hooks/useFundingBankAccounts';
import { useCraAccounts } from '@/hooks/useCraAccounts';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultBankAccountId?: string;
}

export function PadAgreementDialog({ open, onOpenChange, defaultBankAccountId }: Props) {
  const { create } = usePadAgreements({ scope: 'cra' });
  const { accounts: bankAccounts } = useFundingBankAccounts();
  const { accounts: craAccounts } = useCraAccounts();

  const [form, setForm] = useState<CreatePadAgreementInput>({
    bank_account_id: defaultBankAccountId ?? '',
    payer_name: '',
    payer_title: '',
    payer_email: '',
    signature_text: '',
    max_amount_per_debit: 25000,
    frequency: 'sporadic',
    cra_program_account_ids: [],
    cra_pad_number: '',
    scope: 'cra',
  });
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (open) {
      setForm((f) => ({ ...f, bank_account_id: defaultBankAccountId ?? f.bank_account_id }));
      setAcknowledged(false);
    }
  }, [open, defaultBankAccountId]);

  const update = (patch: Partial<CreatePadAgreementInput>) => setForm((f) => ({ ...f, ...patch }));

  const toggleCraAccount = (id: string) => {
    const ids = new Set(form.cra_program_account_ids ?? []);
    ids.has(id) ? ids.delete(id) : ids.add(id);
    update({ cra_program_account_ids: Array.from(ids) });
  };

  const normalize = (s: string) =>
    s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,]+$/g, '');
  const signatureMatches =
    !!form.signature_text.trim() &&
    !!form.payer_name.trim() &&
    normalize(form.signature_text) === normalize(form.payer_name);

  const disabledReason = !form.bank_account_id
    ? 'Select a funding bank account'
    : !form.payer_name.trim()
    ? 'Enter the payer name'
    : !(form.max_amount_per_debit > 0)
    ? 'Set a per-debit cap greater than 0'
    : !form.signature_text.trim()
    ? 'Type your full name to sign'
    : !signatureMatches
    ? 'Signature must match the payer name above'
    : !acknowledged
    ? 'Tick the authorization acknowledgement'
    : null;

  const canSubmit = disabledReason === null;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await create.mutateAsync(form);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Pre-Authorized Debit (PAD) agreement
          </DialogTitle>
          <DialogDescription>
            Required before efinsuite can debit your bank account for CRA remittances via EFT.
            Complies with Payments Canada Rule H1.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2">
                <Label>Funding bank account *</Label>
                <Select value={form.bank_account_id} onValueChange={(v) => update({ bank_account_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select bank account…" /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} {b.institution ? `· ${b.institution}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Payer name *</Label>
                <Input value={form.payer_name} onChange={(e) => update({ payer_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Payer title</Label>
                <Input value={form.payer_title ?? ''} onChange={(e) => update({ payer_title: e.target.value })} placeholder="e.g. CFO, Director" />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Payer email</Label>
                <Input type="email" value={form.payer_email ?? ''} onChange={(e) => update({ payer_email: e.target.value })} />
              </div>

              <div className="space-y-2">
                <Label>Max per debit (CAD) *</Label>
                <Input
                  type="number"
                  min={0}
                  step={100}
                  value={form.max_amount_per_debit}
                  onChange={(e) => update({ max_amount_per_debit: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Frequency *</Label>
                <Select value={form.frequency} onValueChange={(v) => update({ frequency: v as 'sporadic' | 'recurring' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sporadic">Sporadic (each debit pre-notified)</SelectItem>
                    <SelectItem value="recurring">Recurring (fixed schedule)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 col-span-2">
                <Label>CRA PAD number (optional)</Label>
                <Input
                  value={form.cra_pad_number ?? ''}
                  onChange={(e) => update({ cra_pad_number: e.target.value })}
                  placeholder="Assigned by CRA after PAD activation"
                />
              </div>

              {craAccounts.length > 0 && (
                <div className="space-y-2 col-span-2">
                  <Label>Covered CRA program accounts</Label>
                  <div className="space-y-1 rounded border p-2">
                    {craAccounts.map((a: any) => (
                      <label key={a.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={(form.cra_program_account_ids ?? []).includes(a.id)}
                          onCheckedChange={() => toggleCraAccount(a.id)}
                        />
                        <span className="font-mono text-xs">{a.full_account_number}</span>
                        <span className="text-muted-foreground">{a.account_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Alert>
              <AlertDescription className="text-xs leading-relaxed">
                I authorize efinsuite to debit the designated bank account for Canada Revenue Agency
                remittances and related payments up to the per-debit cap shown above, on the selected
                frequency. I confirm that all persons whose signatures are required to authorize debits
                on this account have signed this agreement. I understand I have certain recourse rights
                if any debit does not comply with this agreement — for example, the right to receive
                reimbursement for any debit that is not authorized or is not consistent with this PAD.
                I may revoke this authorization at any time, subject to providing notice. To obtain a
                form for recourse, or for more information, I may contact my financial institution or
                visit <span className="font-medium">www.payments.ca</span>.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Type your full name to sign *</Label>
              <Input
                value={form.signature_text}
                onChange={(e) => update({ signature_text: e.target.value })}
                placeholder="Must match payer name above"
                className="font-serif italic"
              />
              {form.signature_text.trim() && !signatureMatches && (
                <p className="text-xs text-destructive">
                  Signature must match the payer name above ("{form.payer_name || '—'}").
                </p>
              )}
            </div>

            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={acknowledged} onCheckedChange={(v) => setAcknowledged(!!v)} className="mt-0.5" />
              <span>
                I am authorized to bind the account holder and I have read and agree to the PAD
                authorization above.
              </span>
            </label>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          {disabledReason ? (
            <p className="text-xs text-muted-foreground sm:mr-auto">{disabledReason}</p>
          ) : <span className="sm:mr-auto" />}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit || create.isPending}>
              {create.isPending ? 'Saving…' : 'Sign & activate PAD'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
