import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRecurringBills, CreateRecurringBillInput } from '@/hooks/useRecurringBills';
import { useVendors } from '@/hooks/useVendors';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { SearchableGLAccountSelect } from '@/components/banking/SearchableGLAccountSelect';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PurchaseDocumentsPanel } from '@/components/purchases/PurchaseDocumentsPanel';
import { InvoiceExtractionReview, type ReviewField } from '@/components/purchases/InvoiceExtractionReview';
import { matchVendor, type InvoiceExtraction } from '@/lib/purchases/invoiceExtraction';
import { useStagedPurchaseAttachments } from '@/hooks/useStagedPurchaseAttachments';
import { toast } from 'sonner';

interface CreateRecurringBillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface BillLine {
  id: string;
  description: string;
  expense_account_id: string | null;
  quantity: number;
  unit_price: number;
  tax_rate: number;
}

const frequencyOptions = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
];

export function CreateRecurringBillDialog({ open, onOpenChange }: CreateRecurringBillDialogProps) {
  const { organization } = useCurrentOrganization();
  const { vendors, isLoading: vendorsLoading } = useVendors();
  const { createRecurringBill } = useRecurringBills();
  
  const countryCode = organization?.country?.toUpperCase() || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const [vendorId, setVendorId] = useState<string>('');
  const [templateName, setTemplateName] = useState<string>('');
  const [frequency, setFrequency] = useState<string>('monthly');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>('');
  const [daysUntilDue, setDaysUntilDue] = useState<number>(30);
  const [terms, setTerms] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [lines, setLines] = useState<BillLine[]>([
    {
      id: crypto.randomUUID(),
      description: '',
      expense_account_id: null,
      quantity: 1,
      unit_price: 0,
      tax_rate: 0,
    },
  ]);

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

  const updateLine = (id: string, field: keyof BillLine, value: unknown) => {
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
    setTemplateName('');
    setFrequency('monthly');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setDaysUntilDue(30);
    setTerms('');
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

  // ---- Attachments + AI invoice extraction -------------------------------
  const staging = useStagedPurchaseAttachments();
  const [extraction, setExtraction] = useState<InvoiceExtraction | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pendingSummary, setPendingSummary] = useState('');

  const matchedVendor = matchVendor(
    vendors as Array<{ id: string; name: string }>,
    extraction?.vendor_name,
  );

  const reviewFields: ReviewField[] = extraction
    ? [
        {
          key: 'vendor_id',
          label: 'Vendor',
          current: vendors.find((v) => v.id === vendorId)?.name ?? '',
          extracted: matchedVendor?.name ?? '',
        },
        {
          key: 'template_name',
          label: 'Template name',
          current: templateName,
          extracted: extraction.vendor_name ? `${extraction.vendor_name} recurring bill` : '',
        },
        { key: 'start_date', label: 'Start date', current: startDate, extracted: extraction.document_date ?? '' },
        { key: 'terms', label: 'Terms', current: terms, extracted: extraction.terms ?? '' },
        {
          key: 'notes',
          label: 'Notes (AI document summary)',
          current: notes,
          extracted: pendingSummary ? 'Append AI summary' : '',
        },
      ]
    : [];

  const applyExtraction = (keys: string[], applyLines: boolean) => {
    if (!extraction) return;
    const has = (k: string) => keys.includes(k);
    if (has('vendor_id') && matchedVendor) setVendorId(matchedVendor.id);
    if (has('template_name') && extraction.vendor_name)
      setTemplateName(`${extraction.vendor_name} recurring bill`);
    if (has('start_date') && extraction.document_date) setStartDate(extraction.document_date);
    if (has('terms') && extraction.terms) setTerms(extraction.terms);
    if (has('notes') && pendingSummary) setNotes((prev) => [prev, pendingSummary].filter(Boolean).join('\n\n'));
    if (applyLines && extraction.lines.length > 0) {
      setLines(
        extraction.lines.map((l) => ({
          id: crypto.randomUUID(),
          description: l.description,
          expense_account_id: null,
          quantity: l.quantity ?? 1,
          unit_price: l.unit_price ?? 0,
          tax_rate: l.tax_rate ?? 0,
        })),
      );
    }
    toast.success('Invoice data applied — set GL accounts before saving.');
  };

  const handleSubmit = async () => {
    if (!vendorId || !templateName) return;


    const input: CreateRecurringBillInput = {
      vendor_id: vendorId,
      template_name: templateName,
      frequency,
      start_date: startDate,
      end_date: endDate || undefined,
      days_until_due: daysUntilDue,
      terms: terms || undefined,
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

    const recurring: any = await createRecurringBill.mutateAsync(input);
    if (recurring?.id && organization?.id) {
      await staging.flush('recurring_bill', recurring.id, organization.id);
    }
    resetForm();
    setExtraction(null);
    setPendingSummary('');
    onOpenChange(false);
  };

  const isValid = vendorId && templateName && lines.some((l) => l.description && l.quantity > 0 && l.unit_price > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Create Recurring Bill
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)] pr-4">
          <div className="space-y-6">
            {/* Header section */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor *</Label>
                <Select value={vendorId} onValueChange={setVendorId}>
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
                <Label htmlFor="templateName">Template Name *</Label>
                <Input
                  id="templateName"
                  placeholder="e.g., Monthly Office Rent"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="frequency">Frequency *</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    {frequencyOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date (Optional)</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="daysUntilDue">Days Until Due</Label>
                <Input
                  id="daysUntilDue"
                  type="number"
                  min="0"
                  value={daysUntilDue}
                  onChange={(e) => setDaysUntilDue(parseInt(e.target.value) || 30)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="terms">Payment Terms</Label>
                <Input
                  id="terms"
                  placeholder="e.g., Net 30"
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                />
              </div>
            </div>

            <Separator />

            {/* Bill lines */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Bill Items</Label>
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
                <span className="font-medium">Bill Total (Per Occurrence)</span>
                <span className="font-bold text-lg">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes..."
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
            disabled={!isValid || createRecurringBill.isPending}
          >
            {createRecurringBill.isPending ? 'Creating...' : 'Create Recurring Bill'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
