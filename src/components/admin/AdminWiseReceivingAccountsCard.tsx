import { useState } from 'react';
import { Globe2, Plus, Pencil, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { toast } from 'sonner';
import {
  useWiseReceivingAccounts,
  type WiseReceivingAccount,
} from '@/hooks/useWiseReceivingAccounts';

const EMPTY = {
  currency: '',
  account_holder_name: '',
  bank_name: '',
  account_number: '',
  routing_number: '',
  iban: '',
  bic_swift: '',
  sort_code: '',
  institution_address: '',
  wise_profile_id: '',
  wise_balance_id: '',
  notes: '',
  is_active: true,
};

type FormState = typeof EMPTY;

export function AdminWiseReceivingAccountsCard() {
  const { accounts, isLoading, upsertAccount, deleteAccount } = useWiseReceivingAccounts();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<WiseReceivingAccount | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (a: WiseReceivingAccount) => {
    setEditingId(a.id);
    setForm({
      currency: a.currency ?? '',
      account_holder_name: a.account_holder_name ?? '',
      bank_name: a.bank_name ?? '',
      account_number: a.account_number ?? '',
      routing_number: a.routing_number ?? '',
      iban: a.iban ?? '',
      bic_swift: a.bic_swift ?? '',
      sort_code: a.sort_code ?? '',
      institution_address: a.institution_address ?? '',
      wise_profile_id: a.wise_profile_id ?? '',
      wise_balance_id: a.wise_balance_id ?? '',
      notes: a.notes ?? '',
      is_active: a.is_active,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.currency.trim()) {
      toast.error('Currency is required');
      return;
    }
    if (!form.account_number.trim() && !form.iban.trim()) {
      toast.error('Provide an account number or IBAN');
      return;
    }
    await upsertAccount.mutateAsync({ ...form, id: editingId ?? undefined });
    setDialogOpen(false);
  };

  const set = (key: keyof FormState) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">
            <Globe2 className="w-5 h-5 inline-block mr-2" />
            Wise Invoice Receiving Accounts
          </h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Platform-wide receiving bank details shown on invoices for each supported currency.
            Deposits are matched to invoices automatically using the unique payment reference.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={openCreate}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add account
        </Button>
      </div>

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading accounts…
          </div>
        ) : accounts.length === 0 ? (
          <div className="p-4 rounded-lg border border-dashed text-sm text-muted-foreground flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              No platform Wise receiving accounts configured yet. Add at least one so invoices can
              display transfer instructions.
            </span>
          </div>
        ) : (
          <div className="border rounded-lg divide-y">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{a.currency}</span>
                    {a.is_active ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                    {!a.wise_balance_id && (
                      <Badge variant="outline" className="text-warning">
                        No balance ID — auto-match off
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {[a.account_holder_name, a.bank_name].filter(Boolean).join(' • ') || '—'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {a.iban ? `IBAN ${a.iban}` : a.account_number ? `Acct ${a.account_number}` : '—'}
                    {a.bic_swift ? ` • SWIFT ${a.bic_swift}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(a)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(a)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Wise account' : 'Add Wise account'}</DialogTitle>
            <DialogDescription>
              Platform-wide account. These details are shown to customers on every organization's
              invoices issued in this currency.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Currency *</Label>
              <Input
                value={form.currency}
                onChange={(e) => set('currency')(e.target.value.toUpperCase())}
                placeholder="e.g. USD"
                maxLength={3}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Account holder name</Label>
              <Input
                value={form.account_holder_name}
                onChange={(e) => set('account_holder_name')(e.target.value)}
                placeholder="e.g. Acme Inc."
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Bank name</Label>
              <Input value={form.bank_name} onChange={(e) => set('bank_name')(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Account number</Label>
              <Input value={form.account_number} onChange={(e) => set('account_number')(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Routing / ACH number</Label>
              <Input value={form.routing_number} onChange={(e) => set('routing_number')(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Sort code</Label>
              <Input value={form.sort_code} onChange={(e) => set('sort_code')(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">IBAN</Label>
              <Input value={form.iban} onChange={(e) => set('iban')(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">BIC / SWIFT</Label>
              <Input value={form.bic_swift} onChange={(e) => set('bic_swift')(e.target.value)} className="mt-1.5" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">Institution address</Label>
              <Input
                value={form.institution_address}
                onChange={(e) => set('institution_address')(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Wise profile ID</Label>
              <Input
                value={form.wise_profile_id}
                onChange={(e) => set('wise_profile_id')(e.target.value)}
                placeholder="Used for auto-matching"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Wise balance ID</Label>
              <Input
                value={form.wise_balance_id}
                onChange={(e) => set('wise_balance_id')(e.target.value)}
                placeholder="Used for auto-matching"
                className="mt-1.5"
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">Notes (shown internally)</Label>
              <Textarea value={form.notes} onChange={(e) => set('notes')(e.target.value)} className="mt-1.5" />
            </div>
            <div className="md:col-span-2 flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Inactive accounts are hidden from invoices</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={upsertAccount.isPending}>
              {upsertAccount.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingId ? 'Save changes' : 'Add account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remove Wise account?"
        itemName={deleteTarget?.currency ? `${deleteTarget.currency} receiving account` : undefined}
        description="Invoices in this currency will no longer show Wise transfer instructions for any organization."
        onConfirm={async () => {
          if (deleteTarget) await deleteAccount.mutateAsync(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </Card>
  );
}
