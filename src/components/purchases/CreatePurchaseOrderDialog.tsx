import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, ClipboardList } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePurchaseOrders, CreatePurchaseOrderInput } from '@/hooks/usePurchaseOrders';
import { useVendors } from '@/hooks/useVendors';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PurchaseDocumentsPanel } from '@/components/purchases/PurchaseDocumentsPanel';
import { InvoiceExtractionReview, type ReviewField } from '@/components/purchases/InvoiceExtractionReview';
import { matchVendor, type InvoiceExtraction } from '@/lib/purchases/invoiceExtraction';
import { useStagedPurchaseAttachments } from '@/hooks/useStagedPurchaseAttachments';
import { toast } from 'sonner';

interface CreatePurchaseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface POLine {
  id: string;
  description: string;
  product_service_id: string | null;
  inventory_item_id: string | null;
  quantity_ordered: number;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
}

export function CreatePurchaseOrderDialog({ open, onOpenChange }: CreatePurchaseOrderDialogProps) {
  const { organization } = useCurrentOrganization();
  const { vendors, isLoading: vendorsLoading } = useVendors();
  const { createPurchaseOrder } = usePurchaseOrders();
  
  const countryCode = organization?.country?.toUpperCase() || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const [vendorId, setVendorId] = useState<string>('');
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expectedDelivery, setExpectedDelivery] = useState<string>('');
  const [shippingAddress, setShippingAddress] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [lines, setLines] = useState<POLine[]>([
    {
      id: crypto.randomUUID(),
      description: '',
      product_service_id: null,
      inventory_item_id: null,
      quantity_ordered: 1,
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
        description: '',
        product_service_id: null,
        inventory_item_id: null,
        quantity_ordered: 1,
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

  const updateLine = (id: string, field: keyof POLine, value: unknown) => {
    setLines(lines.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const subtotal = useMemo(
    () => lines.reduce((sum, line) => {
      const lineAmount = line.quantity_ordered * line.unit_price * (1 - (line.discount_percent || 0) / 100);
      return sum + lineAmount;
    }, 0),
    [lines]
  );

  const taxTotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const lineAmount = line.quantity_ordered * line.unit_price * (1 - (line.discount_percent || 0) / 100);
        return sum + (lineAmount * (line.tax_rate || 0)) / 100;
      }, 0),
    [lines]
  );

  const total = subtotal + taxTotal;

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
        { key: 'order_date', label: 'Order date', current: orderDate, extracted: extraction.document_date ?? '' },
        {
          key: 'expected_delivery',
          label: 'Expected delivery',
          current: expectedDelivery,
          extracted: extraction.due_date ?? '',
        },
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
    if (has('order_date') && extraction.document_date) setOrderDate(extraction.document_date);
    if (has('expected_delivery') && extraction.due_date) setExpectedDelivery(extraction.due_date);
    if (has('notes') && pendingSummary) setNotes((prev) => [prev, pendingSummary].filter(Boolean).join('\n\n'));
    if (applyLines && extraction.lines.length > 0) {
      setLines(
        extraction.lines.map((l) => ({
          id: crypto.randomUUID(),
          description: l.description,
          product_service_id: null,
          inventory_item_id: null,
          quantity_ordered: l.quantity ?? 1,
          unit_price: l.unit_price ?? 0,
          discount_percent: 0,
          tax_rate: l.tax_rate ?? 0,
        })),
      );
    }
    toast.success('Invoice data applied to the purchase order.');
  };


  const resetForm = () => {
    setVendorId('');
    setOrderDate(new Date().toISOString().split('T')[0]);
    setExpectedDelivery('');
    setShippingAddress('');
    setNotes('');
    setLines([
      {
        id: crypto.randomUUID(),
        description: '',
        product_service_id: null,
        inventory_item_id: null,
        quantity_ordered: 1,
        unit_price: 0,
        discount_percent: 0,
        tax_rate: 0,
      },
    ]);
  };

  const handleSubmit = async () => {
    if (!vendorId) return;

    const input: CreatePurchaseOrderInput = {
      vendor_id: vendorId,
      po_date: orderDate,
      expected_date: expectedDelivery || undefined,
      shipping_address: shippingAddress || undefined,
      notes: notes || undefined,
      lines: lines.map((line, index) => ({
        description: line.description,
        product_service_id: line.product_service_id,
        inventory_item_id: line.inventory_item_id,
        quantity_ordered: line.quantity_ordered,
        unit_price: line.unit_price,
        discount_percent: line.discount_percent,
        tax_rate: line.tax_rate,
        tax_amount: (line.quantity_ordered * line.unit_price * (1 - (line.discount_percent || 0) / 100) * (line.tax_rate || 0)) / 100,
        amount: line.quantity_ordered * line.unit_price * (1 - (line.discount_percent || 0) / 100),
        line_order: index,
      })),
    };

    const po: any = await createPurchaseOrder.mutateAsync(input);
    if (po?.id && organization?.id) {
      await staging.flush('purchase_order', po.id, organization.id);
    }
    resetForm();
    setExtraction(null);
    setPendingSummary('');
    onOpenChange(false);
  };

  const isValid = vendorId && lines.some((l) => l.description && l.quantity_ordered > 0 && l.unit_price > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            Create Purchase Order
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
                <Label htmlFor="orderDate">Order Date *</Label>
                <Input
                  id="orderDate"
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expectedDelivery">Expected Delivery</Label>
                <Input
                  id="expectedDelivery"
                  type="date"
                  value={expectedDelivery}
                  onChange={(e) => setExpectedDelivery(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shippingAddress">Shipping Address</Label>
                <Input
                  id="shippingAddress"
                  placeholder="Enter shipping address"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                />
              </div>
            </div>

            <Separator />

            {/* Order lines */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Order Items</Label>
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

                    <div className="grid grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={line.quantity_ordered}
                          onChange={(e) => updateLine(line.id, 'quantity_ordered', parseInt(e.target.value) || 1)}
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
                          {formatCurrency(line.quantity_ordered * line.unit_price * (1 - (line.discount_percent || 0) / 100) * (1 + (line.tax_rate || 0) / 100))}
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
                <span className="font-medium">Order Total</span>
                <span className="font-bold text-lg">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes / Terms</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes, terms, or delivery instructions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Documents + AI analysis */}
            <div className="rounded-lg border p-4">
              <PurchaseDocumentsPanel
                entityType="purchase_order"
                organizationId={organization?.id}
                staging={staging}
                draftContext={{
                  vendor: vendors.find((v) => v.id === vendorId)?.name ?? null,
                  date: orderDate || null,
                  currency: localization.currency,
                  total,
                }}
                onExtraction={(ex, summary) => {
                  setExtraction(ex);
                  setPendingSummary(summary);
                  setReviewOpen(true);
                }}
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
            disabled={!isValid || createPurchaseOrder.isPending}
          >
            {createPurchaseOrder.isPending ? 'Creating...' : 'Create Purchase Order'}
          </Button>
        </DialogFooter>

        {extraction && (
          <InvoiceExtractionReview
            open={reviewOpen}
            onOpenChange={setReviewOpen}
            extraction={extraction}
            fields={reviewFields}
            supportsLines
            currentLineCount={lines.length}
            onApply={applyExtraction}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
