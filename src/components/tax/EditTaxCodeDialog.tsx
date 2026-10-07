import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { paidTaxGlChoices, paidTaxGlFieldCopy, type PaidTaxAccount } from '@/lib/paidTaxGlAccounts';
import { taxCodePostingSides, taxCodeSelectType } from '@/lib/retailTaxRateCatalog';

function AccountOptions({ accounts }: { accounts: PaidTaxAccount[] }) {
  return accounts.map((account) => (
    <SelectItem key={account.id} value={account.id}>
      <span className="font-mono mr-2">{account.code}</span>
      {account.name}
    </SelectItem>
  ));
}

export function EditTaxCodeDialog({
  code,
  open,
  onOpenChange,
  accounts,
  onSubmit,
  isPending,
}: {
  code: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: PaidTaxAccount[];
  onSubmit: (updates: Record<string, any>) => Promise<void>;
  isPending: boolean;
}) {
  const [form, setForm] = useState<any>({});

  // Reset form when the dialog opens with a different code
  useMemo(() => {
    if (code) {
      setForm({
        code: code.code ?? '',
        name: code.name ?? '',
        rate: Number(code.rate ?? 0),
        jurisdiction: code.jurisdiction ?? '',
        tax_type: taxCodeSelectType(code),
        original_tax_type: code.tax_type ?? 'both',
        is_recoverable: code.is_recoverable ?? true,
        is_active: code.is_active ?? true,
        gl_collected_account_id: code.gl_collected_account_id ?? null,
        gl_paid_account_id: code.gl_paid_account_id ?? null,
      });
    }
  }, [code?.id]);

  const noPosting =
    !!code && ((code as any).is_zero_rated || (code as any).is_exempt || Number(form.rate || 0) === 0);
  const sides = taxCodePostingSides({
    code: form.code,
    tax_type: form.tax_type,
    applies_to: code?.applies_to,
  });
  const needsCollected = !noPosting && sides.collected;
  const needsPaid = !noPosting && sides.paid;
  const recoverable = !!form.is_recoverable;
  const paidCopy = paidTaxGlFieldCopy(recoverable);
  const paidChoices = paidTaxGlChoices(accounts, {
    isRecoverable: recoverable,
    selectedId: form.gl_paid_account_id,
  });

  const liabilityAccounts = accounts.filter((account) => account.account_type === 'liability');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const initialSelect = code ? taxCodeSelectType(code) : 'both';
    const taxTypeUnchanged = form.tax_type === initialSelect;
    await onSubmit({
      code: form.code,
      name: form.name,
      rate: Number(form.rate) || 0,
      jurisdiction: form.jurisdiction || null,
      tax_type: taxTypeUnchanged ? (form.original_tax_type || form.tax_type) : form.tax_type,
      is_recoverable: recoverable,
      is_active: !!form.is_active,
      gl_collected_account_id: needsCollected ? form.gl_collected_account_id || null : null,
      gl_paid_account_id: needsPaid ? form.gl_paid_account_id || null : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Tax Code</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Code</Label>
              <Input value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Rate (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.rate ?? 0}
                onChange={(e) => setForm({ ...form, rate: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Jurisdiction</Label>
            <Input
              value={form.jurisdiction ?? ''}
              onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Tax Type</Label>
            <Select value={form.tax_type ?? 'both'} onValueChange={(v) => setForm({ ...form, tax_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">Sales Only</SelectItem>
                <SelectItem value="purchase">Purchases Only</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {needsCollected && (
            <div className="space-y-2">
              <Label>GL Collected Account (Liability)</Label>
              <Select
                value={form.gl_collected_account_id ?? ''}
                onValueChange={(v) => setForm({ ...form, gl_collected_account_id: v || null })}
              >
                <SelectTrigger><SelectValue placeholder="Select liability account" /></SelectTrigger>
                <SelectContent>
                  {liabilityAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <span className="font-mono mr-2">{account.code}</span>{account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Tax collected on sales is credited here (e.g. GST/HST Payable).
              </p>
            </div>
          )}

          {needsPaid && (
            <div className="space-y-2">
              <Label>{paidCopy.label}</Label>
              <Select
                value={form.gl_paid_account_id ?? ''}
                onValueChange={(v) => setForm({ ...form, gl_paid_account_id: v || null })}
              >
                <SelectTrigger data-testid="tax-paid-gl-account">
                  <SelectValue placeholder={paidCopy.placeholder} />
                </SelectTrigger>
                <SelectContent>
                  {paidChoices.expenses.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Expense (income statement)</SelectLabel>
                      <AccountOptions accounts={paidChoices.expenses} />
                    </SelectGroup>
                  )}
                  {paidChoices.assets.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Asset (ITC)</SelectLabel>
                      <AccountOptions accounts={paidChoices.assets} />
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{paidCopy.helper}</p>
            </div>
          )}

          {noPosting && (
            <p className="text-xs text-muted-foreground">
              This code is zero-rated / exempt / 0% — no GL posting accounts required.
            </p>
          )}

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Recoverable (ITC)</p>
              <p className="text-sm text-muted-foreground">Can claim as input tax credit</p>
            </div>
            <Switch
              checked={recoverable}
              onCheckedChange={(v) => setForm({ ...form, is_recoverable: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Active</p>
              <p className="text-sm text-muted-foreground">Available for use on transactions</p>
            </div>
            <Switch
              checked={!!form.is_active}
              onCheckedChange={(v) => setForm({ ...form, is_active: v })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
