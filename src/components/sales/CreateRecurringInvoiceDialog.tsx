import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRecurringInvoices, CreateRecurringInvoiceInput } from '@/hooks/useRecurringInvoices';
import { useCustomers } from '@/hooks/useCustomers';
import { useProductsServices } from '@/hooks/useProductsServices';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CreateRecurringInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface InvoiceLine {
  id: string;
  product_service_id: string | null;
  description: string;
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

export function CreateRecurringInvoiceDialog({ open, onOpenChange }: CreateRecurringInvoiceDialogProps) {
  const { organization } = useCurrentOrganization();
  const { customers, isLoading: customersLoading } = useCustomers();
  const productsQuery = useProductsServices(organization?.id);
  const productsServices = productsQuery.data || [];
  const { createRecurringInvoice } = useRecurringInvoices();
  
  const countryCode = organization?.country?.toUpperCase() || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const [customerId, setCustomerId] = useState<string>('');
  const [templateName, setTemplateName] = useState<string>('');
  const [frequency, setFrequency] = useState<string>('monthly');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>('');
  const [daysUntilDue, setDaysUntilDue] = useState<number>(30);
  const [autoSend, setAutoSend] = useState<boolean>(false);
  const [terms, setTerms] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [lines, setLines] = useState<InvoiceLine[]>([
    {
      id: crypto.randomUUID(),
      product_service_id: null,
      description: '',
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
        product_service_id: null,
        description: '',
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

  const updateLine = (id: string, field: keyof InvoiceLine, value: unknown) => {
    setLines(lines.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const handleProductSelect = (lineId: string, productId: string) => {
    const product = productsServices.find(p => p.id === productId);
    if (product) {
      setLines(lines.map(l => 
        l.id === lineId 
          ? { 
              ...l, 
              product_service_id: productId,
              description: product.name,
              unit_price: Number(product.selling_price) || 0,
            }
          : l
      ));
    }
  };

  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0),
    [lines]
  );

  const taxTotal = useMemo(
    () => lines.reduce((sum, line) => {
      const lineAmount = line.quantity * line.unit_price;
      return sum + (lineAmount * (line.tax_rate || 0)) / 100;
    }, 0),
    [lines]
  );

  const total = subtotal + taxTotal;

  const resetForm = () => {
    setCustomerId('');
    setTemplateName('');
    setFrequency('monthly');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setDaysUntilDue(30);
    setAutoSend(false);
    setTerms('');
    setNotes('');
    setLines([
      {
        id: crypto.randomUUID(),
        product_service_id: null,
        description: '',
        quantity: 1,
        unit_price: 0,
        tax_rate: 0,
      },
    ]);
  };

  const handleSubmit = async () => {
    if (!customerId || !templateName) return;

    const input: CreateRecurringInvoiceInput = {
      customer_id: customerId,
      template_name: templateName,
      frequency,
      start_date: startDate,
      end_date: endDate || undefined,
      days_until_due: daysUntilDue,
      auto_send: autoSend,
      terms: terms || undefined,
      notes: notes || undefined,
      lines: lines.map((line, index) => ({
        product_service_id: line.product_service_id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        tax_rate: line.tax_rate,
        tax_amount: (line.quantity * line.unit_price * (line.tax_rate || 0)) / 100,
        amount: line.quantity * line.unit_price,
        line_order: index,
      })),
    };

    await createRecurringInvoice.mutateAsync(input);
    resetForm();
    onOpenChange(false);
  };

  const isValid = customerId && templateName && lines.some((l) => l.description && l.quantity > 0 && l.unit_price > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Create Recurring Invoice Template
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)] pr-4">
          <div className="space-y-6">
            {/* Header section */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer">Customer *</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customersLoading ? (
                      <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : customers.length === 0 ? (
                      <SelectItem value="none" disabled>No customers found</SelectItem>
                    ) : (
                      customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
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
                  placeholder="e.g., Monthly Retainer, Website Hosting"
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

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="daysUntilDue">Payment Due (Days)</Label>
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
              <div className="space-y-2">
                <Label>Auto-Send Invoice</Label>
                <div className="flex items-center gap-2 h-10">
                  <Switch
                    checked={autoSend}
                    onCheckedChange={setAutoSend}
                  />
                  <span className="text-sm text-muted-foreground">
                    {autoSend ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Invoice lines */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Invoice Items</Label>
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

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Product/Service</Label>
                        <Select
                          value={line.product_service_id || ''}
                          onValueChange={(v) => handleProductSelect(line.id, v === 'custom' ? '' : v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select or type custom" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="custom">Custom Item</SelectItem>
                            {productsServices.map((ps) => (
                              <SelectItem key={ps.id} value={ps.id}>
                                {ps.name} - {formatCurrency(Number(ps.selling_price))}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Description *</Label>
                        <Input
                          placeholder="Item description"
                          value={line.description}
                          onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                        />
                      </div>
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
                <span className="font-medium">Invoice Total (Per Occurrence)</span>
                <span className="font-bold text-lg">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Notes to appear on generated invoices..."
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
            disabled={!isValid || createRecurringInvoice.isPending}
          >
            {createRecurringInvoice.isPending ? 'Creating...' : 'Create Recurring Invoice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
