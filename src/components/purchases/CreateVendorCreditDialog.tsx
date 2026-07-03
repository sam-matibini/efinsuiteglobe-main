import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, FileText } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useVendorCredits, CreateVendorCreditInput } from '@/hooks/useVendorCredits';
import { useVendors } from '@/hooks/useVendors';
import { useBills } from '@/hooks/useBills';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { SearchableGLAccountSelect } from '@/components/banking/SearchableGLAccountSelect';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CreateVendorCreditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CreditLine {
  id: string;
  description: string;
  expense_account_id: string | null;
  quantity: number;
  unit_price: number;
  tax_rate: number;
}

export function CreateVendorCreditDialog({ open, onOpenChange }: CreateVendorCreditDialogProps) {
  const { organization } = useCurrentOrganization();
  const { vendors, isLoading: vendorsLoading } = useVendors();
  const { bills } = useBills();
  const { createVendorCredit } = useVendorCredits();
  
  const countryCode = organization?.country?.toUpperCase() || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const [vendorId, setVendorId] = useState<string>('');
  const [billId, setBillId] = useState<string>('');
  const [creditDate, setCreditDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [lines, setLines] = useState<CreditLine[]>([
    {
      id: crypto.randomUUID(),
      description: '',
      expense_account_id: null,
      quantity: 1,
      unit_price: 0,
      tax_rate: 0,
    },
  ]);

  // Filter bills by selected vendor
  const vendorBills = useMemo(() => {
    if (!vendorId) return [];
    return bills.filter((b) => b.vendor_id === vendorId && b.status !== 'paid');
  }, [bills, vendorId]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
      minimumFractionDigits: 2,
    }).format(value);
  };

  const addLine = () => {
    setLines([
      ...lines,
      {
        id: crypto.randomUUID(),
        description: '',
        expense_account_id: null,
        quantity: 1,
        unit_price: 0,
        tax_rate: 0,
      },
    ]);
  };

  const removeLine = (id: string) => {
    if (lines.length > 1) {
      setLines(lines.filter((l) => l.id !== id));
    }
  };

  const updateLine = (id: string, field: keyof CreditLine, value: unknown) => {
    setLines(lines.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0),
    [lines]
  );

  const taxTotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const lineAmount = line.quantity * line.unit_price;
        return sum + (lineAmount * (line.tax_rate || 0)) / 100;
      }, 0),
    [lines]
  );

  const total = subtotal + taxTotal;

  const resetForm = () => {
    setVendorId('');
    setBillId('');
    setCreditDate(new Date().toISOString().split('T')[0]);
    setReason('');
    setNotes('');
    setLines([
      {
        id: crypto.randomUUID(),
        description: '',
        expense_account_id: null,
        quantity: 1,
        unit_price: 0,
        tax_rate: 0,
      },
    ]);
  };

  const handleSubmit = async () => {
    if (!vendorId) return;

    const input: CreateVendorCreditInput = {
      vendor_id: vendorId,
      bill_id: billId || undefined,
      credit_date: creditDate,
      reason: reason || undefined,
      notes: notes || undefined,
      lines: lines.map((line, index) => ({
        expense_account_id: line.expense_account_id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        tax_rate: line.tax_rate,
        tax_amount: (line.quantity * line.unit_price * (line.tax_rate || 0)) / 100,
        amount: line.quantity * line.unit_price,
        line_order: index,
      })),
    };

    await createVendorCredit.mutateAsync(input);
    resetForm();
    onOpenChange(false);
  };

  const isValid = vendorId && lines.some((l) => l.description && l.quantity > 0 && l.unit_price > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Create Vendor Credit
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)] pr-4">
          <div className="space-y-6">
            {/* Header section */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor *</Label>
                <Select
                  value={vendorId}
                  onValueChange={(v) => {
                    setVendorId(v);
                    setBillId(''); // Reset bill when vendor changes
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendorsLoading ? (
                      <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : vendors.length === 0 ? (
                      <SelectItem value="none" disabled>No vendors found</SelectItem>
                    ) : (
                      vendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="creditDate">Credit Date *</Label>
                <Input
                  id="creditDate"
                  type="date"
                  value={creditDate}
                  onChange={(e) => setCreditDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bill">Related Bill (Optional)</Label>
                <Select value={billId} onValueChange={setBillId} disabled={!vendorId}>
                  <SelectTrigger>
                    <SelectValue placeholder={vendorId ? 'Select bill' : 'Select vendor first'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {vendorBills.map((bill) => (
                      <SelectItem key={bill.id} value={bill.id}>
                        {bill.bill_number} - {formatCurrency(bill.balance_due)} due
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Input
                  id="reason"
                  placeholder="e.g., Return of defective goods"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>

            <Separator />

            {/* Credit lines */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Credit Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Line
                </Button>
              </div>

              <div className="space-y-4">
                {lines.map((line, index) => (
                  <div key={line.id} className="p-4 border rounded-lg space-y-4 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Item {index + 1}</span>
                      {lines.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLine(line.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Description *</Label>
                      <Input
                        placeholder="Enter item description"
                        value={line.description}
                        onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Expense Account</Label>
                      <SearchableGLAccountSelect
                        value={line.expense_account_id || ''}
                        onValueChange={(v) => updateLine(line.id, 'expense_account_id', v)}
                        placeholder="Select GL account"
                        filterPostable={true}
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={line.quantity}
                          onChange={(e) => updateLine(line.id, 'quantity', parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Unit Price</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={line.unit_price || ''}
                          onChange={(e) => updateLine(line.id, 'unit_price', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tax Rate (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          placeholder="0"
                          value={line.tax_rate || ''}
                          onChange={(e) => updateLine(line.id, 'tax_rate', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Line Total</Label>
                        <div className="h-10 flex items-center font-medium">
                          {formatCurrency(line.quantity * line.unit_price * (1 + (line.tax_rate || 0) / 100))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-medium">{formatCurrency(taxTotal)}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="font-medium">Total Credit</span>
                <span className="font-bold text-lg text-success">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes or comments..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || createVendorCredit.isPending}
          >
            {createVendorCredit.isPending ? 'Creating...' : 'Create Vendor Credit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
