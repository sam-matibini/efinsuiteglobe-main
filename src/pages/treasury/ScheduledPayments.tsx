import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Plus, Power, Trash2 } from 'lucide-react';
import { useScheduledPayments, ScheduledPaymentKind, ScheduledFrequency } from '@/hooks/useScheduledPayments';
import { useCraAccounts } from '@/hooks/useCraAccounts';
import { FundingBankSelect } from '@/components/treasury/FundingBankSelect';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';

const KIND_LABEL: Record<ScheduledPaymentKind, string> = {
  cra: 'CRA Payment', ap_batch: 'AP Batch', payroll: 'Payroll',
};

export default function ScheduledPayments() {
  const { schedules, isLoading, create, toggle, remove } = useScheduledPayments();
  const { accounts: craAccounts } = useCraAccounts();
  const isReadOnly = useIsReadOnly();
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    payment_kind: 'cra' as ScheduledPaymentKind,
    description: '',
    cra_account_id: '',
    funding_bank_account_id: '',
    amount: '',
    currency: 'CAD',
    frequency: 'monthly' as ScheduledFrequency,
    next_run_date: new Date().toISOString().slice(0, 10),
    auto_submit: false,
    requires_approval: true,
  });

  const submit = async () => {
    await create.mutateAsync({
      payment_kind: form.payment_kind,
      description: form.description || null,
      cra_account_id: form.cra_account_id || null,
      funding_bank_account_id: form.funding_bank_account_id || null,
      amount: form.amount ? Number(form.amount) : null,
      currency: form.currency,
      frequency: form.frequency,
      next_run_date: form.next_run_date,
      auto_submit: form.auto_submit,
      requires_approval: form.requires_approval,
    });
    setOpen(false);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scheduled Payments</h1>
          <p className="text-muted-foreground">Recurring CRA remittances, AP batches and payroll runs</p>
        </div>
        {!isReadOnly && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New Schedule</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Create Scheduled Payment</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Type</Label>
                    <Select value={form.payment_kind} onValueChange={(v) => setForm({ ...form, payment_kind: v as ScheduledPaymentKind })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(KIND_LABEL) as ScheduledPaymentKind[]).map(k => (
                          <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Frequency</Label>
                    <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v as ScheduledFrequency })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(['once','weekly','biweekly','monthly','quarterly','annual'] as ScheduledFrequency[]).map(f => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>
                {form.payment_kind === 'cra' && (
                  <div>
                    <Label>CRA account</Label>
                    <Select value={form.cra_account_id} onValueChange={(v) => setForm({ ...form, cra_account_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Choose CRA account" /></SelectTrigger>
                      <SelectContent>
                        {craAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.full_account_number} · {a.account_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Amount (optional)</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
                  <div><Label>Next run date</Label><Input type="date" value={form.next_run_date} onChange={e => setForm({ ...form, next_run_date: e.target.value })} /></div>
                </div>
                <div>
                  <Label>Funding bank account</Label>
                  <FundingBankSelect value={form.funding_bank_account_id} onValueChange={(v) => setForm({ ...form, funding_bank_account_id: v })} requireRail="any" />
                </div>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={form.requires_approval} onCheckedChange={(c) => setForm({ ...form, requires_approval: c })} />
                    Requires approval
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={form.auto_submit} onCheckedChange={(c) => setForm({ ...form, auto_submit: c })} />
                    Auto-submit on due date
                  </label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={submit} disabled={create.isPending}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>All schedules</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p>Loading…</p> : schedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scheduled payments.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Next run</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map(s => (
                  <TableRow key={s.id}>
                    <TableCell><Badge variant="outline">{KIND_LABEL[s.payment_kind]}</Badge></TableCell>
                    <TableCell className="text-sm">{s.description ?? '—'}</TableCell>
                    <TableCell className="capitalize">{s.frequency}</TableCell>
                    <TableCell>{s.next_run_date}</TableCell>
                    <TableCell className="text-right font-mono">{s.amount ? `${s.currency} ${Number(s.amount).toFixed(2)}` : '—'}</TableCell>
                    <TableCell><Badge variant={s.is_active ? 'default' : 'outline'}>{s.is_active ? 'active' : 'paused'}</Badge></TableCell>
                    <TableCell className="space-x-1">
                      {!isReadOnly && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => toggle.mutate({ id: s.id, is_active: !s.is_active })}>
                            <Power className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => remove.mutate(s.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
