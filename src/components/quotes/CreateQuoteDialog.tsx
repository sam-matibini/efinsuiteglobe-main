import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, FileText } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuotes, CreateQuoteInput } from '@/hooks/useQuotes';
import { useCustomers } from '@/hooks/useCustomers';
import { useProductsServices } from '@/hooks/useProductsServices';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CreateQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LineItem {
  id: string;
  product_service_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
}

export function CreateQuoteDialog({ open, onOpenChange }: CreateQuoteDialogProps) {
  const { organization } = useCurrentOrganization();
  const { customers, isLoading: customersLoading } = useCustomers();
  const productsQuery = useProductsServices(organization?.id);
  const productsServices = productsQuery.data || [];
  const { createQuote } = useQuotes();
  
  const countryCode = organization?.country?.toUpperCase() || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const [customerId, setCustomerId] = useState<string>('');
  const [quoteDate, setQuoteDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState<string>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [terms, setTerms] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [lines, setLines] = useState<LineItem[]>([
    {
      id: crypto.randomUUID(),
      product_service_id: null,
      description: '',
      quantity: 1,
      unit_price: 0,
      discount_percent: 0,
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
        discount_percent: 0,
        tax_rate: 0,
      },
    ]);
  };

  const removeLine = (id: string) => {
    if (lines.length > 1) {
      setLines(lines.filter((l) => l.id !== id));
    }
  };

  const updateLine = (id: string, field: keyof LineItem, value: unknown) => {
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
    () => lines.reduce((sum, line) => {
      const lineAmount = line.quantity * line.unit_price * (1 - (line.discount_percent || 0) / 100);
      return sum + lineAmount;
    }, 0),
    [lines]
  );

  const taxTotal = useMemo(
    () => lines.reduce((sum, line) => {
      const lineAmount = line.quantity * line.unit_price * (1 - (line.discount_percent || 0) / 100);
      return sum + (lineAmount * (line.tax_rate || 0)) / 100;
    }, 0),
    [lines]
  );

  const total = subtotal + taxTotal;

  const resetForm = () => {
    setCustomerId('');
    setQuoteDate(new Date().toISOString().split('T')[0]);
    setExpiryDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setTerms('');
    setNotes('');
    setLines([
      {
        id: crypto.randomUUID(),
        product_service_id: null,
        description: '',
        quantity: 1,
        unit_price: 0,
        discount_percent: 0,
        tax_rate: 0,
      },
    ]);
  };

  const handleSubmit = async () => {
    if (!customerId) return;

    const input: CreateQuoteInput = {
      customer_id: customerId,
      quote_date: quoteDate,
      expiry_date: expiryDate,
      terms: terms || undefined,
      notes: notes || undefined,
      lines: lines.map((line, index) => ({
        product_service_id: line.product_service_id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        discount_percent: line.discount_percent,
        tax_rate: line.tax_rate,
        tax_amount: (line.quantity * line.unit_price * (1 - (line.discount_percent || 0) / 100) * (line.tax_rate || 0)) / 100,
        amount: line.quantity * line.unit_price * (1 - (line.discount_percent || 0) / 100),
        line_order: index,
      })),
    };

    await createQuote.mutateAsync(input);
    resetForm();
    onOpenChange(false);
  };

  const isValid = customerId && lines.some((l) => l.description && l.quantity > 0 && l.unit_price > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Create Quote
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)] pr-4">
          <div className="space-y-6">
            {/* Header section */}
            <div className="grid grid-cols-3 gap-4">
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
                <Label htmlFor="quoteDate">Quote Date *</Label>
                <Input
                  id="quoteDate"
                  type="date"
                  value={quoteDate}
                  onChange={(e) => setQuoteDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiryDate">Expiry Date *</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
            </div>

            <Separator />

            {/* Quote lines */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Quote Items</Label>
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

                    <div className="grid grid-cols-5 gap-4">
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
                        <Label>Discount %</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          placeholder="0"
                          value={line.discount_percent || ''}
                          onChange={(e) => updateLine(line.id, 'discount_percent', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tax %</Label>
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
                          {formatCurrency(
                            line.quantity * line.unit_price * (1 - (line.discount_percent || 0) / 100) * (1 + (line.tax_rate || 0) / 100)
                          )}
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
                <span className="font-medium">Quote Total</span>
                <span className="font-bold text-lg">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Terms and Notes */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="terms">Terms & Conditions</Label>
                <Textarea
                  id="terms"
                  placeholder="Payment terms, delivery conditions..."
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes for the customer..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || createQuote.isPending}
          >
            {createQuote.isPending ? 'Creating...' : 'Create Quote'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
