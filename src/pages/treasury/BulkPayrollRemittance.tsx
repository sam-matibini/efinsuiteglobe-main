import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Layers, Plus } from 'lucide-react';
import { useCraPaymentBatches } from '@/hooks/useCraPaymentBatches';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

const PROGRAMS = [
  { code: 'RP', label: 'RP — Payroll source deductions' },
  { code: 'RT', label: 'RT — GST/HST' },
  { code: 'RC', label: 'RC — Corporate tax' },
  { code: 'RC_INSTALLMENT', label: 'RC — Corporate tax installment' },
];

export default function BulkPayrollRemittance() {
  const { batches, isLoading, createBatch, updateStatus } = useCraPaymentBatches();
  const fmt = useCurrencyFormatter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    period_start: '',
    period_end: '',
    program_code: 'RP',
    notes: '',
    amount: '',
    employee_count: '',
  });

  const reset = () =>
    setForm({ period_start: '', period_end: '', program_code: 'RP', notes: '', amount: '', employee_count: '' });

  const submit = async () => {
    const amt = Number(form.amount);
    if (!form.period_start || !form.period_end || !amt) return;
    await createBatch.mutateAsync({
      period_start: form.period_start,
      period_end: form.period_end,
      program_code: form.program_code,
      notes: form.notes,
      items: [
        {
          amount: amt,
          employee_count: form.employee_count ? Number(form.employee_count) : null,
        },
      ],
    });
    setOpen(false);
    reset();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Layers className="h-7 w-7 text-primary" />
            Bulk Payroll Remittance
          </h1>
          <p className="text-muted-foreground">
            Group payroll source deductions and other CRA program payments into a single remittance batch.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> New batch
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Batches</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : batches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No batches yet. Click <strong>New batch</strong> to roll up multiple remittances into one debit.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.reference}</TableCell>
                    <TableCell>{b.program_code}</TableCell>
                    <TableCell className="text-xs">
                      {b.period_start} → {b.period_end}
                    </TableCell>
                    <TableCell>{b.item_count}</TableCell>
                    <TableCell>
                      {fmt.formatCurrency(Number(b.total_amount), {
                        showCurrencySymbol: true,
                        currencyOverride: 'CAD',
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={b.status === 'completed' ? 'default' : 'outline'} className="capitalize">
                        {b.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {b.status === 'draft' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus.mutate({ id: b.id, status: 'pending_approval' })}
                        >
                          Submit for approval
                        </Button>
                      )}
                      {b.status === 'pending_approval' && (
                        <Button
                          size="sm"
                          onClick={() => updateStatus.mutate({ id: b.id, status: 'approved' })}
                        >
                          Approve
                        </Button>
                      )}
                      {b.status === 'approved' && (
                        <Button
                          size="sm"
                          onClick={() => updateStatus.mutate({ id: b.id, status: 'submitted' })}
                        >
                          Mark submitted
                        </Button>
                      )}
                      {b.status === 'submitted' && (
                        <Button
                          size="sm"
                          onClick={() => updateStatus.mutate({ id: b.id, status: 'completed' })}
                        >
                          Mark completed
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New payroll remittance batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Period start</Label>
                <Input
                  type="date"
                  value={form.period_start}
                  onChange={(e) => setForm({ ...form, period_start: e.target.value })}
                />
              </div>
              <div>
                <Label>Period end</Label>
                <Input
                  type="date"
                  value={form.period_end}
                  onChange={(e) => setForm({ ...form, period_end: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Program</Label>
              <Select value={form.program_code} onValueChange={(v) => setForm({ ...form, program_code: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROGRAMS.map((p) => (
                    <SelectItem key={p.code} value={p.code}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount (CAD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div>
                <Label>Employee count</Label>
                <Input
                  type="number"
                  value={form.employee_count}
                  onChange={(e) => setForm({ ...form, employee_count: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={createBatch.isPending}>
              Create batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
