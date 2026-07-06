import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useVendors } from '@/hooks/useVendors';
import { useAccounts } from '@/hooks/useAccounts';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useExpenses, type Expense } from '@/hooks/useExpenses';
import { Loader2 } from 'lucide-react';

interface Props {
  expense: Expense | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function EditExpenseDialog({ expense, open, onOpenChange }: Props) {
  const { organization } = useCurrentOrganization();
  const { vendors } = useVendors();
  const { data: accounts = [] } = useAccounts(organization?.id);
  const { updateExpense } = useExpenses();

  const isMileage = expense?.expense_type === 'mileage';

  const [form, setForm] = useState({
    expense_date: '',
    vendor_id: '',
    expense_account_id: '',
    paid_through_account_id: '',
    reference: '',
    amount: 0,
    tax_amount: 0,
    notes: '',
    is_billable: false,
    from_location: '',
    to_location: '',
    distance: 0,
    rate_per_unit: 0,
    distance_unit: 'km',
  });

  useEffect(() => {
    if (!expense) return;
    setForm({
      expense_date: expense.expense_date,
      vendor_id: expense.vendor_id || '',
      expense_account_id: expense.expense_account_id || '',
      paid_through_account_id: expense.paid_through_account_id || '',
      reference: expense.reference || '',
      amount: Number(expense.amount) || 0,
      tax_amount: Number(expense.tax_amount) || 0,
      notes: expense.notes || '',
      is_billable: !!expense.is_billable,
      from_location: expense.from_location || '',
      to_location: expense.to_location || '',
      distance: Number(expense.distance) || 0,
      rate_per_unit: Number(expense.rate_per_unit) || 0,
      distance_unit: expense.distance_unit || 'km',
    });
  }, [expense?.id]);

  if (!expense) return null;

  const expenseAccounts = accounts.filter(
    (a: any) => a.account_type === 'expense' && a.posting_allowed !== false,
  );
  const paidThroughAccounts = accounts.filter(
    (a: any) =>
      ['asset', 'liability'].includes(a.account_type) && a.posting_allowed !== false,
  );

  const handleSave = async () => {
    const updates: any = {
      expense_date: form.expense_date,
      vendor_id: form.vendor_id || null,
      expense_account_id: form.expense_account_id || null,
      paid_through_account_id: form.paid_through_account_id || null,
      reference: form.reference || null,
      notes: form.notes || null,
      is_billable: form.is_billable,
    };
    if (isMileage) {
      const amount = Number(form.distance) * Number(form.rate_per_unit);
      updates.from_location = form.from_location || null;
      updates.to_location = form.to_location || null;
      updates.distance = Number(form.distance);
      updates.rate_per_unit = Number(form.rate_per_unit);
      updates.distance_unit = form.distance_unit;
      updates.amount = amount;
    } else {
      updates.amount = Number(form.amount);
      updates.tax_amount = Number(form.tax_amount);
    }
    await updateExpense.mutateAsync({ id: expense.id, updates });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {isMileage ? 'Mileage' : 'Expense'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input
              type="date"
              value={form.expense_date}
              onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Reference</Label>
            <Input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
            />
          </div>

          <div className="space-y-1.5 col-span-2">
            <Label>Vendor</Label>
            <Select
              value={form.vendor_id || 'none'}
              onValueChange={(v) => setForm({ ...form, vendor_id: v === 'none' ? '' : v })}
            >
              <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {vendors.map((v: any) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Expense Account</Label>
            <Select
              value={form.expense_account_id || 'none'}
              onValueChange={(v) => setForm({ ...form, expense_account_id: v === 'none' ? '' : v })}
            >
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {expenseAccounts.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Paid Through</Label>
            <Select
              value={form.paid_through_account_id || 'none'}
              onValueChange={(v) => setForm({ ...form, paid_through_account_id: v === 'none' ? '' : v })}
            >
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {paidThroughAccounts.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isMileage ? (
            <>
              <div className="space-y-1.5">
                <Label>From</Label>
                <Input
                  value={form.from_location}
                  onChange={(e) => setForm({ ...form, from_location: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>To</Label>
                <Input
                  value={form.to_location}
                  onChange={(e) => setForm({ ...form, to_location: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Distance</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.distance}
                  onChange={(e) => setForm({ ...form, distance: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Rate per {form.distance_unit}</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={form.rate_per_unit}
                  onChange={(e) => setForm({ ...form, rate_per_unit: Number(e.target.value) })}
                />
              </div>
              <div className="col-span-2 text-sm text-muted-foreground">
                Computed amount: <span className="font-mono">{(Number(form.distance) * Number(form.rate_per_unit)).toFixed(2)}</span>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tax Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.tax_amount}
                  onChange={(e) => setForm({ ...form, tax_amount: Number(e.target.value) })}
                />
              </div>
            </>
          )}

          <div className="space-y-1.5 col-span-2">
            <Label>Notes</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-2 col-span-2">
            <Switch
              checked={form.is_billable}
              onCheckedChange={(v) => setForm({ ...form, is_billable: v })}
            />
            <Label>Billable to customer</Label>
          </div>
        </div>

        {expense.is_posted && (
          <p className="text-xs text-amber-600">
            Note: This expense is already posted to the GL. Editing here updates the expense record only; the existing journal entry is not automatically re-posted.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateExpense.isPending}>
            {updateExpense.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
