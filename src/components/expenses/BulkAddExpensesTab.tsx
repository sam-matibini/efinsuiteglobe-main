import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, ListPlus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableGLAccountSelect } from '@/components/banking/SearchableGLAccountSelect';
import { useExpenses, BulkExpenseInput } from '@/hooks/useExpenses';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useVendors } from '@/hooks/useVendors';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';

interface BulkExpenseRow {
  id: string;
  expense_date: string;
  expense_account_id: string;
  description: string;
  amount: number;
  vendor_id: string;
  reference: string;
}

interface BulkAddExpensesTabProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function BulkAddExpensesTab({ onSuccess, onCancel }: BulkAddExpensesTabProps) {
  const { organization } = useCurrentOrganization();
  const { createBulkExpenses } = useExpenses();
  const { vendors } = useVendors();

  const countryCode = organization?.country?.toUpperCase() || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const today = new Date().toISOString().split('T')[0];

  // Initialize with 5 empty rows
  const [rows, setRows] = useState<BulkExpenseRow[]>([
    { id: crypto.randomUUID(), expense_date: today, expense_account_id: '', description: '', amount: 0, vendor_id: '', reference: '' },
    { id: crypto.randomUUID(), expense_date: today, expense_account_id: '', description: '', amount: 0, vendor_id: '', reference: '' },
    { id: crypto.randomUUID(), expense_date: today, expense_account_id: '', description: '', amount: 0, vendor_id: '', reference: '' },
    { id: crypto.randomUUID(), expense_date: today, expense_account_id: '', description: '', amount: 0, vendor_id: '', reference: '' },
    { id: crypto.randomUUID(), expense_date: today, expense_account_id: '', description: '', amount: 0, vendor_id: '', reference: '' },
  ]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
      minimumFractionDigits: 2,
    }).format(value);
  };

  const addRow = () => {
    setRows([
      ...rows,
      { id: crypto.randomUUID(), expense_date: today, expense_account_id: '', description: '', amount: 0, vendor_id: '', reference: '' },
    ]);
  };

  const removeRow = (id: string) => {
    if (rows.length > 1) {
      setRows(rows.filter(row => row.id !== id));
    }
  };

  const updateRow = (id: string, field: keyof BulkExpenseRow, value: unknown) => {
    setRows(rows.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  // Calculate totals
  const totalAmount = useMemo(() => {
    return rows.reduce((sum, row) => sum + (row.amount || 0), 0);
  }, [rows]);

  const validRows = useMemo(() => {
    return rows.filter(row => row.description && row.amount > 0);
  }, [rows]);

  const resetForm = () => {
    setRows([
      { id: crypto.randomUUID(), expense_date: today, expense_account_id: '', description: '', amount: 0, vendor_id: '', reference: '' },
      { id: crypto.randomUUID(), expense_date: today, expense_account_id: '', description: '', amount: 0, vendor_id: '', reference: '' },
      { id: crypto.randomUUID(), expense_date: today, expense_account_id: '', description: '', amount: 0, vendor_id: '', reference: '' },
      { id: crypto.randomUUID(), expense_date: today, expense_account_id: '', description: '', amount: 0, vendor_id: '', reference: '' },
      { id: crypto.randomUUID(), expense_date: today, expense_account_id: '', description: '', amount: 0, vendor_id: '', reference: '' },
    ]);
  };

  const handleSave = async () => {
    const inputs: BulkExpenseInput[] = validRows.map(row => ({
      expense_date: row.expense_date,
      expense_account_id: row.expense_account_id || undefined,
      description: row.description,
      amount: row.amount,
      vendor_id: row.vendor_id || undefined,
      reference: row.reference || undefined,
    }));

    await createBulkExpenses.mutateAsync(inputs);
    resetForm();
    onSuccess();
  };

  const handleSaveAndNew = async () => {
    await handleSave();
    resetForm();
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
          <ListPlus className="w-5 h-5 text-primary" />
          <div>
            <p className="font-medium">Bulk Add Expenses</p>
            <p className="text-sm text-muted-foreground">
              Quickly add multiple expenses at once. Fill in the details below.
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total ({validRows.length} items)</p>
          <p className="text-xl font-bold text-primary">{formatCurrency(totalAmount)}</p>
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[100px_180px_1fr_120px_150px_100px_40px] gap-2 px-2 text-sm font-medium text-muted-foreground">
        <span>Date*</span>
        <span>Expense Account</span>
        <span>Description*</span>
        <span className="text-right">Amount*</span>
        <span>Vendor</span>
        <span>Reference</span>
        <span></span>
      </div>

      {/* Scrollable rows */}
      <ScrollArea className="max-h-[calc(90vh-360px)]">
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div 
              key={row.id} 
              className="grid grid-cols-[100px_180px_1fr_120px_150px_100px_40px] gap-2 items-center p-2 rounded-lg hover:bg-muted/30"
            >
              <Input
                type="date"
                value={row.expense_date}
                onChange={(e) => updateRow(row.id, 'expense_date', e.target.value)}
                className="h-9 text-sm"
              />
              <SearchableGLAccountSelect
                value={row.expense_account_id}
                onValueChange={(v) => updateRow(row.id, 'expense_account_id', v)}
                placeholder="Account"
                filterPostable={true}
                className="h-9"
              />
              <Input
                value={row.description}
                onChange={(e) => updateRow(row.id, 'description', e.target.value)}
                placeholder="Enter description"
                className="h-9"
              />
              <FormattedNumberInput
                value={row.amount}
                onChange={(v) => updateRow(row.id, 'amount', v)}
                placeholder="0.00"
                className="h-9"
              />
              <Select 
                value={row.vendor_id} 
                onValueChange={(v) => updateRow(row.id, 'vendor_id', v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={row.reference}
                onChange={(e) => updateRow(row.id, 'reference', e.target.value)}
                placeholder="Ref#"
                className="h-9"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => removeRow(row.id)}
                disabled={rows.length <= 1}
              >
                <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Add Row Button */}
      <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-2">
        <Plus className="w-4 h-4" />
        Add Another Row
      </Button>

      {/* Summary */}
      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
        <div className="text-sm text-muted-foreground">
          {validRows.length} of {rows.length} rows with data
        </div>
        <div className="text-right">
          <span className="text-sm text-muted-foreground mr-4">Grand Total:</span>
          <span className="text-lg font-bold">{formatCurrency(totalAmount)}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 border-t bg-background p-4 flex gap-3">
        <Button 
          onClick={handleSave}
          disabled={validRows.length === 0 || createBulkExpenses.isPending}
          className="bg-primary"
        >
          Save All ({validRows.length})
        </Button>
        <Button 
          variant="outline"
          onClick={handleSaveAndNew}
          disabled={validRows.length === 0 || createBulkExpenses.isPending}
        >
          Save and New
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
