import React, { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Package, MessageSquare, ChevronDown, ChevronRight, Settings, CreditCard, Mail, Phone, CheckCircle2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useDefaultSignature } from '@/hooks/useUserSignatures';
import { useSalesTaxSettings } from '@/hooks/useSalesTax';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useCustomers } from '@/hooks/useCustomers';
import { Invoice, useInvoices } from '@/hooks/useInvoices';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InvoiceShareDialog } from './InvoiceShareDialog';
import { useInventoryItems } from '@/hooks/useInventory';
import { useProductsServices } from '@/hooks/useProductsServices';
import { useInvoiceCustomFieldTemplates } from '@/hooks/useInvoiceCustomFieldTemplates';
import { usePaymentTerms } from '@/hooks/usePaymentTerms';
import { format, addDays } from 'date-fns';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { InvoiceBarcodeSection } from './InvoiceBarcodeSection';
import { InvoiceSignatureSection } from './InvoiceSignatureSection';
import { InvoiceCustomFields } from './InvoiceCustomFields';
import { PaymentTermsCombobox } from './PaymentTermsCombobox';
import { TaxRateCombobox } from './TaxRateCombobox';
import { DescriptionSearchCombobox } from './DescriptionSearchCombobox';
import { useStripeHealth } from '@/hooks/useStripeHealth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InvoicePreviewTab } from './InvoicePreviewTab';
import { useWiseReceivingAccounts, selectWiseAccountForCurrency } from '@/hooks/useWiseReceivingAccounts';
import { getDocumentLogoUrl } from '@/lib/getDocumentLogo';

const lineSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.coerce.number().min(0.01, 'Quantity must be positive'),
  unit_price: z.coerce.number().min(0, 'Price must be 0 or more'),
  tax_rate: z.coerce.number().min(0).max(100).optional(),
  inventory_item_id: z.string().optional(),
  notes: z.string().optional(),
});

const invoiceSchema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  invoice_date: z.string().min(1, 'Invoice date is required'),
  due_date: z.string().min(1, 'Due date is required'),
  document_title: z.string().optional(),
  buyer_name: z.string().optional(),
  attention_of: z.string().optional(),
  order_number: z.string().optional(),
  subject: z.string().optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  dealer_permit_number: z.string().optional(),
  gst_hst_number: z.string().optional(),
  pst_number: z.string().optional(),
  is_gst_hst_exempt: z.boolean().optional(),
  is_pst_exempt: z.boolean().optional(),
  exemption_reason: z.string().optional(),
  discount_type: z.string().optional(),
  discount_value: z.coerce.number().optional(),
  shipping_charges: z.coerce.number().optional(),
  adjustment: z.coerce.number().optional(),
  adjustment_label: z.string().optional(),
  lines: z.array(lineSchema).min(1, 'At least one line item is required'),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

interface CustomField {
  id: string;
  label: string;
  value: string;
  type: 'text' | 'number' | 'date';
}

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateInvoiceDialog({ open, onOpenChange }: CreateInvoiceDialogProps) {
  const { customers, isLoading: customersLoading } = useCustomers();
  const { createInvoice, updateInvoiceStatus } = useInvoices();
  const { organization } = useCurrentOrganization();
  const { isConfigured: stripeConfigured } = useStripeHealth();
  const { data: inventoryItems = [] } = useInventoryItems(organization?.id);
  const { data: productsServices = [] } = useProductsServices(organization?.id);
  const { templates: customFieldTemplates, getDefaultCustomFields } = useInvoiceCustomFieldTemplates();
  const { data: defaultSignature } = useDefaultSignature();
  const { data: taxSettings } = useSalesTaxSettings(organization?.id);
  const { paymentTerms: dbPaymentTerms, availableTerms } = usePaymentTerms();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [sellerSignature, setSellerSignature] = useState<string | null>(null);
  const [buyerSignature, setBuyerSignature] = useState<string | null>(null);
  const [showSellerSignature, setShowSellerSignature] = useState(false);
  const [showBuyerSignature, setShowBuyerSignature] = useState(false);
  const [tempInvoiceNumber, setTempInvoiceNumber] = useState('');
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareDefaultTab, setShareDefaultTab] = useState<'email' | 'whatsapp' | 'sms'>('email');
  const [lastCreatedInvoice, setLastCreatedInvoice] = useState<Invoice | null>(null);
  const saveActionRef = useRef<'draft' | 'save' | 'send-email' | 'send-whatsapp' | 'send-sms'>('draft');
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const { accounts: wiseAccounts } = useWiseReceivingAccounts();



  // Collapsible section states
  const [taxOpen, setTaxOpen] = useState(false);
  const [signaturesOpen, setSignaturesOpen] = useState(false);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);

  useEffect(() => {
    if (open && defaultSignature && !sellerSignature) {
      setSellerSignature(defaultSignature.signature_data);
    }
  }, [open, defaultSignature, sellerSignature]);

  const countryCode = organization?.country || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  useEffect(() => {
    if (open && !tempInvoiceNumber) {
      const prefix = 'INV';
      const timestamp = Date.now().toString().slice(-6);
      setTempInvoiceNumber(`${prefix}-${timestamp}`);
    }
  }, [open, tempInvoiceNumber]);

  useEffect(() => {
    if (open && customFieldTemplates.length > 0 && customFields.length === 0) {
      const defaultFields = getDefaultCustomFields();
      setCustomFields(defaultFields);
    }
  }, [open, customFieldTemplates, customFields.length, getDefaultCustomFields]);

  const defaultTaxRate = taxSettings?.gst_rate || taxSettings?.hst_rate || 13;

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customer_id: '',
      invoice_date: format(new Date(), 'yyyy-MM-dd'),
      due_date: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      document_title: 'Invoice',
      buyer_name: '',
      attention_of: '',
      order_number: '',
      subject: '',
      notes: (organization as any)?.invoice_default_notes || '',
      terms: 'Net 30',
      dealer_permit_number: '',
      gst_hst_number: '',
      pst_number: '',
      is_gst_hst_exempt: false,
      is_pst_exempt: false,
      exemption_reason: '',
      discount_type: 'percentage',
      discount_value: 0,
      shipping_charges: 0,
      adjustment: 0,
      adjustment_label: 'Adjustment',
      lines: [{ description: '', quantity: 1, unit_price: 0, tax_rate: defaultTaxRate }],
    },
  });

  useEffect(() => {
    if (open && organization) {
      if (organization.dealer_permit_number) form.setValue('dealer_permit_number', organization.dealer_permit_number);
      if (organization.gst_hst_number) form.setValue('gst_hst_number', organization.gst_hst_number);
      if (organization.pst_number) form.setValue('pst_number', organization.pst_number);
    }
  }, [open, organization, form]);

  const watchedInvoiceDate = form.watch('invoice_date');
  const watchedTerms = form.watch('terms');
  useEffect(() => {
    if (watchedInvoiceDate && watchedTerms) {
      const allTerms = dbPaymentTerms.length > 0 ? dbPaymentTerms : availableTerms;
      const selectedTerm = allTerms.find(t => t.name === watchedTerms);
      if (selectedTerm) {
        const date = new Date(watchedInvoiceDate + 'T00:00:00');
        date.setDate(date.getDate() + selectedTerm.days_until_due);
        form.setValue('due_date', format(date, 'yyyy-MM-dd'));
      }
    }
  }, [watchedInvoiceDate]);

  const handleSelectInventoryItem = (index: number, itemId: string) => {
    const item = inventoryItems.find(i => i.id === itemId);
    if (item) {
      form.setValue(`lines.${index}.description`, item.name);
      form.setValue(`lines.${index}.unit_price`, item.selling_price);
      form.setValue(`lines.${index}.tax_rate`, item.tax_rate || 0);
      form.setValue(`lines.${index}.inventory_item_id`, item.id);
    }
  };
  const handleSelectProductService = (index: number, ps: { name: string; selling_price: number; tax_rate: number | null }) => {
    form.setValue(`lines.${index}.description`, ps.name);
    form.setValue(`lines.${index}.unit_price`, ps.selling_price);
    if (ps.tax_rate) form.setValue(`lines.${index}.tax_rate`, ps.tax_rate);
  };

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lines',
  });

  const watchedLines = form.watch('lines');
  const watchedCustomerId = form.watch('customer_id');
  const selectedCustomer = customers.find(c => c.id === watchedCustomerId);
  const watchedDiscountType = form.watch('discount_type') || 'percentage';
  const watchedDiscountValue = Number(form.watch('discount_value')) || 0;
  const watchedShipping = Number(form.watch('shipping_charges')) || 0;
  const watchedAdjustment = Number(form.watch('adjustment')) || 0;

  const subtotal = watchedLines.reduce((sum, line) => {
    return sum + (Number(line.quantity) || 0) * (Number(line.unit_price) || 0);
  }, 0);

  const discountAmount = watchedDiscountType === 'percentage'
    ? subtotal * (watchedDiscountValue / 100)
    : watchedDiscountValue;

  const taxTotal = watchedLines.reduce((sum, line) => {
    const amount = (Number(line.quantity) || 0) * (Number(line.unit_price) || 0);
    return sum + amount * ((Number(line.tax_rate) || 0) / 100);
  }, 0);

  const total = subtotal - discountAmount + watchedShipping + watchedAdjustment + taxTotal;

  const totalQuantity = watchedLines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
    }).format(value);
  };

  const onSubmit = async (data: InvoiceFormData) => {
    setIsSubmitting(true);
    try {
      const createdInvoice = await createInvoice.mutateAsync({
        customer_id: data.customer_id,
        invoice_date: data.invoice_date,
        due_date: data.due_date,
        notes: data.notes,
        terms: data.terms,
        document_title: data.document_title || 'Invoice',
        buyer_name: data.buyer_name,
        buyer_email: selectedCustomer?.email || undefined,
        buyer_phone: selectedCustomer?.phone || undefined,
        buyer_address_line1: selectedCustomer?.address_line1 || undefined,
        buyer_address_line2: selectedCustomer?.address_line2 || undefined,
        buyer_city: selectedCustomer?.city || undefined,
        buyer_province: selectedCustomer?.province || undefined,
        buyer_postal_code: selectedCustomer?.postal_code || undefined,
        buyer_country: selectedCustomer?.country || undefined,
        attention_of: data.attention_of || undefined,
        is_gst_hst_exempt: data.is_gst_hst_exempt,
        is_pst_exempt: data.is_pst_exempt,
        exemption_reason: data.exemption_reason,
        dealer_permit_number: data.dealer_permit_number || undefined,
        gst_hst_number: data.gst_hst_number || undefined,
        pst_number: data.pst_number || undefined,
        seller_email: organization?.email || undefined,
        seller_phone: organization?.phone || undefined,
        order_number: data.order_number || undefined,
        subject: data.subject || undefined,
        discount_type: data.discount_type || 'percentage',
        discount_value: data.discount_value || 0,
        shipping_charges: data.shipping_charges || 0,
        adjustment: data.adjustment || 0,
        adjustment_label: data.adjustment_label || 'Adjustment',
        custom_fields: customFields.filter(f => f.value && String(f.value).trim() !== ''),
        lines: data.lines.map(line => ({
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          tax_rate: line.tax_rate,
          notes: line.notes?.trim() || undefined,
        })),
      });

      const action = saveActionRef.current;

      if (action === 'draft' && createdInvoice?.id) {
        // Downgrade from default 'issued' to 'draft'
        await updateInvoiceStatus.mutateAsync({ id: createdInvoice.id, status: 'draft' });
      } else if (action.startsWith('send-') && createdInvoice?.id) {
        await updateInvoiceStatus.mutateAsync({ id: createdInvoice.id, status: 'sent' });
        const tabMap: Record<string, 'email' | 'whatsapp' | 'sms'> = {
          'send-email': 'email',
          'send-whatsapp': 'whatsapp',
          'send-sms': 'sms',
        };
        setShareDefaultTab(tabMap[action] || 'email');
        setLastCreatedInvoice(createdInvoice as Invoice);
        setShowShareDialog(true);
      }

      form.reset();
      setCustomFields([]);
      setSellerSignature(null);
      setBuyerSignature(null);
      setTempInvoiceNumber('');
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitWithAction = (action: typeof saveActionRef.current) => {
    saveActionRef.current = action;
    form.handleSubmit(onSubmit)();
  };

  const handleClose = () => {
    form.reset();
    setCustomFields([]);
    setSellerSignature(null);
    setBuyerSignature(null);
    setTempInvoiceNumber('');
    setTaxOpen(false);
    setSignaturesOpen(false);
    setCustomFieldsOpen(false);
    onOpenChange(false);
  };

  return (
  <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3 flex-shrink-0 border-b">
          <DialogTitle className="text-lg">New Invoice</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'edit' | 'preview')} className="flex-1 flex flex-col overflow-hidden">
              <div className="px-6 pt-3 flex-shrink-0">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="edit">Edit</TabsTrigger>
                  <TabsTrigger value="preview">Invoice Preview</TabsTrigger>
                </TabsList>
              </div>

            <TabsContent value="edit" className="flex-1 overflow-y-auto mt-0">
              <div className="px-6 py-4 space-y-6">


                {/* ── Header Section ── */}
                <div className="grid grid-cols-[160px_1fr_160px_1fr] gap-x-4 gap-y-3 items-center">
                  {/* Customer */}
                  <Label className="text-sm text-muted-foreground text-right">Customer Name<span className="text-destructive">*</span></Label>
                  <div className="col-span-3">
                    <FormField
                      control={form.control}
                      name="customer_id"
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select or add a customer" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <ScrollArea className="h-[200px]">
                                {customersLoading ? (
                                  <SelectItem value="__loading__" disabled>Loading...</SelectItem>
                                ) : customers.length === 0 ? (
                                  <SelectItem value="__empty__" disabled>No customers found</SelectItem>
                                ) : (
                                  customers.map((customer) => (
                                    <SelectItem key={customer.id} value={customer.id}>
                                      {customer.name}
                                    </SelectItem>
                                  ))
                                )}
                              </ScrollArea>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Invoice # */}
                  <Label className="text-sm text-muted-foreground text-right">Invoice#<span className="text-destructive">*</span></Label>
                  <div>
                    <Input value={tempInvoiceNumber} readOnly className="bg-muted/50" />
                  </div>

                  {/* Order Number */}
                  <Label className="text-sm text-muted-foreground text-right">Order Number</Label>
                  <FormField
                    control={form.control}
                    name="order_number"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <Input {...field} placeholder="PO / Reference #" />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* Invoice Date */}
                  <Label className="text-sm text-muted-foreground text-right">Invoice Date<span className="text-destructive">*</span></Label>
                  <FormField
                    control={form.control}
                    name="invoice_date"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* Terms */}
                  <Label className="text-sm text-muted-foreground text-right">Terms</Label>
                  <FormField
                    control={form.control}
                    name="terms"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <PaymentTermsCombobox
                            value={field.value}
                            onChange={field.onChange}
                            onTermSelect={(term) => {
                              const invoiceDate = form.getValues('invoice_date');
                              if (invoiceDate) {
                                const date = new Date(invoiceDate + 'T00:00:00');
                                date.setDate(date.getDate() + term.days_until_due);
                                form.setValue('due_date', format(date, 'yyyy-MM-dd'));
                              }
                            }}
                            placeholder="Select terms..."
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* Due Date */}
                  <Label className="text-sm text-muted-foreground text-right">Due Date<span className="text-destructive">*</span></Label>
                  <FormField
                    control={form.control}
                    name="due_date"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* Empty cell for alignment */}
                  <div />
                  <div />
                </div>

                <Separator />

                {/* ── Document Details Section ── */}
                <div className="grid grid-cols-[160px_1fr_160px_1fr] gap-x-4 gap-y-3 items-center">
                  <Label className="text-sm text-muted-foreground text-right">Document Title</Label>
                  <FormField
                    control={form.control}
                    name="document_title"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <Select onValueChange={field.onChange} value={field.value || 'Invoice'}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Invoice">Invoice</SelectItem>
                            <SelectItem value="Bill of Sale">Bill of Sale</SelectItem>
                            <SelectItem value="Receipt">Receipt</SelectItem>
                            <SelectItem value="Quote">Quote</SelectItem>
                            <SelectItem value="Estimate">Estimate</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <Label className="text-sm text-muted-foreground text-right">Attention Of</Label>
                  <FormField
                    control={form.control}
                    name="attention_of"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <Input {...field} placeholder="Contact person" />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <Label className="text-sm text-muted-foreground text-right">Subject</Label>
                  <div className="col-span-3">
                    <FormField
                      control={form.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormControl>
                            <Input {...field} placeholder="Let your customer know what this invoice is for" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                {/* ── Item Table Section ── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">Item Table</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({ description: '', quantity: 1, unit_price: 0, tax_rate: defaultTaxRate })}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add New Row
                    </Button>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          {inventoryItems.length > 0 && <th className="text-left p-2.5 w-10 text-xs font-medium text-muted-foreground"></th>}
                          <th className="text-left p-2.5 text-xs font-medium text-muted-foreground">ITEM DETAILS</th>
                          <th className="text-right p-2.5 w-16 text-xs font-medium text-muted-foreground">QTY</th>
                          <th className="text-right p-2.5 w-24 text-xs font-medium text-muted-foreground">RATE</th>
                          <th className="text-center p-2.5 w-28 text-xs font-medium text-muted-foreground">TAX</th>
                          <th className="text-right p-2.5 w-24 text-xs font-medium text-muted-foreground">AMOUNT</th>
                          <th className="w-16"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {fields.map((field, index) => {
                          const qty = Number(watchedLines[index]?.quantity) || 0;
                          const price = Number(watchedLines[index]?.unit_price) || 0;
                          const amount = qty * price;
                          const lineNotes = watchedLines[index]?.notes || '';

                          return (
                            <React.Fragment key={field.id}>
                              <tr className="border-t">
                                {inventoryItems.length > 0 && (
                                  <td className="p-1.5">
                                    <Select onValueChange={(val) => handleSelectInventoryItem(index, val)}>
                                      <SelectTrigger className="border-0 bg-transparent h-8 w-8 p-0">
                                        <Package className="w-4 h-4" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <ScrollArea className="h-[200px]">
                                          {inventoryItems.map((item) => (
                                            <SelectItem key={item.id} value={item.id}>
                                              {item.sku} - {item.name}
                                            </SelectItem>
                                          ))}
                                        </ScrollArea>
                                      </SelectContent>
                                    </Select>
                                  </td>
                                )}
                                <td className="p-1.5">
                                  <DescriptionSearchCombobox
                                    value={watchedLines[index]?.description || ''}
                                    productsServices={productsServices}
                                    onSelect={(ps) => handleSelectProductService(index, ps)}
                                    onCustom={(desc) => form.setValue(`lines.${index}.description`, desc)}
                                    registerProps={form.register(`lines.${index}.description`)}
                                  />
                                </td>
                                <td className="p-1.5">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    {...form.register(`lines.${index}.quantity`)}
                                    className="border-0 bg-transparent text-right h-8"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    {...form.register(`lines.${index}.unit_price`)}
                                    className="border-0 bg-transparent text-right h-8"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <TaxRateCombobox
                                    organizationId={organization?.id}
                                    value={watchedLines[index]?.tax_rate}
                                    onChange={(rate) => form.setValue(`lines.${index}.tax_rate`, rate)}
                                    placeholder="Tax..."
                                  />
                                </td>
                                <td className="p-1.5 text-right font-mono text-sm">
                                  {formatCurrency(amount)}
                                </td>
                                <td className="p-1.5 flex items-center gap-0.5">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className={`h-7 w-7 ${lineNotes ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                                    onClick={() => {
                                      const current = form.getValues(`lines.${index}.notes`);
                                      if (current === undefined || current === '') {
                                        form.setValue(`lines.${index}.notes`, ' ');
                                      } else {
                                        form.setValue(`lines.${index}.notes`, '');
                                      }
                                    }}
                                    title="Add/remove note"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </Button>
                                  {fields.length > 1 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive"
                                      onClick={() => remove(index)}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                </td>
                              </tr>
                              {lineNotes !== undefined && lineNotes !== '' && (
                                <tr className="bg-muted/30">
                                  <td colSpan={inventoryItems.length > 0 ? 7 : 6} className="px-4 py-1.5">
                                    <Input
                                      {...form.register(`lines.${index}.notes`)}
                                      placeholder="Add a note for this line item..."
                                      className="h-7 text-xs bg-background"
                                      autoFocus
                                    />
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {form.formState.errors.lines && (
                    <p className="text-sm text-destructive mt-1">{form.formState.errors.lines.message}</p>
                  )}
                </div>

                {/* ── Totals Section ── */}
                <div className="flex justify-end">
                  <div className="w-80 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Sub Total</span>
                      <span className="font-mono">{formatCurrency(subtotal)}</span>
                    </div>

                    {/* Discount */}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Discount</span>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          step="0.01"
                          {...form.register('discount_value')}
                          className="w-20 h-7 text-right text-xs"
                        />
                        <Select
                          value={watchedDiscountType}
                          onValueChange={(v) => form.setValue('discount_type', v)}
                        >
                          <SelectTrigger className="w-14 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">%</SelectItem>
                            <SelectItem value="fixed">$</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="font-mono text-sm w-20 text-right">-{formatCurrency(discountAmount)}</span>
                      </div>
                    </div>

                    {/* Shipping */}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Shipping Charges</span>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          step="0.01"
                          {...form.register('shipping_charges')}
                          className="w-24 h-7 text-right text-xs"
                        />
                      </div>
                    </div>

                    {/* Adjustment */}
                    <div className="flex justify-between items-center text-sm">
                      <div>
                        <Input
                          {...form.register('adjustment_label')}
                          className="w-24 h-7 text-xs border-dashed"
                          placeholder="Adjustment"
                        />
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        {...form.register('adjustment')}
                        className="w-24 h-7 text-right text-xs"
                      />
                    </div>

                    {/* Tax */}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span className="font-mono">{formatCurrency(taxTotal)}</span>
                    </div>

                    <Separator />

                    <div className="flex justify-between font-semibold text-base">
                      <span>Total ({localization.currency})</span>
                      <span className="font-mono">{formatCurrency(total)}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* ── Notes & Terms ── */}
                <div className="grid grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Customer Notes</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Thanks for your business." rows={3} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="terms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Terms & Conditions</FormLabel>
                        <FormControl>
                          <Textarea
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Payment terms, conditions..."
                            rows={3}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* ── Tax Exemptions (Collapsible) ── */}
                <Collapsible open={taxOpen} onOpenChange={setTaxOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-medium py-1 hover:text-primary transition-colors">
                    {taxOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    Tax Exemptions
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 space-y-4">
                    <div className="flex flex-wrap gap-6">
                      <FormField
                        control={form.control}
                        name="is_gst_hst_exempt"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">GST/HST Exempt</FormLabel>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="is_pst_exempt"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">PST Exempt</FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>

                    {(form.watch('is_gst_hst_exempt') || form.watch('is_pst_exempt')) && (
                      <FormField
                        control={form.control}
                        name="exemption_reason"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Exemption Reason / Certificate</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., Export sale, Certificate #ABC123" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    )}

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="dealer_permit_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Dealer Permit #</FormLabel>
                            <FormControl><Input {...field} placeholder="Permit number" /></FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="gst_hst_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">GST/HST #</FormLabel>
                            <FormControl><Input {...field} placeholder="GST/HST number" /></FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="pst_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">PST #</FormLabel>
                            <FormControl><Input {...field} placeholder="PST number" /></FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* ── Signatures (Collapsible) ── */}
                <Collapsible open={signaturesOpen} onOpenChange={setSignaturesOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-medium py-1 hover:text-primary transition-colors">
                    {signaturesOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    Signatures
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3">
                    <InvoiceSignatureSection
                      sellerSignature={sellerSignature}
                      buyerSignature={buyerSignature}
                      onSellerSignatureChange={setSellerSignature}
                      onBuyerSignatureChange={setBuyerSignature}
                      buyerName={form.watch('buyer_name') || ''}
                      isEditable={true}
                    />
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* ── Custom Fields (Collapsible) ── */}
                <Collapsible open={customFieldsOpen} onOpenChange={setCustomFieldsOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-medium py-1 hover:text-primary transition-colors">
                    {customFieldsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    Custom Fields
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3">
                    <InvoiceCustomFields
                      fields={customFields}
                      onChange={setCustomFields}
                      isEditable={true}
                    />
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* ── Barcode Section ── */}
                <InvoiceBarcodeSection invoiceNumber={tempInvoiceNumber} />

                {/* ── Payment Options Info ── */}
                {stripeConfigured && (organization as any)?.invoice_enable_online_payments ? (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-center gap-3 text-sm text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Online payments active. Enabled methods: 
                      {(organization as any)?.invoice_credit_card_enabled && <Badge variant="secondary" className="ml-1 text-xs">Credit Card</Badge>}
                      {(organization as any)?.invoice_ach_enabled && <Badge variant="secondary" className="ml-1 text-xs">ACH</Badge>}
                      {(organization as any)?.invoice_interac_enabled && <Badge variant="secondary" className="ml-1 text-xs">Interac</Badge>}
                    </span>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-3 flex items-center gap-3 text-sm text-muted-foreground">
                    <CreditCard className="w-4 h-4 flex-shrink-0" />
                    <span>Want to get paid faster? Configure payment gateways in <strong>Settings → Payments</strong>.</span>
                  </div>
                )}

              </div>
            </TabsContent>

            <TabsContent value="preview" className="flex-1 overflow-y-auto mt-0">
              <div className="px-6 py-4">
                <InvoicePreviewTab
                  documentTitle={form.watch('document_title')}
                  invoiceNumber={tempInvoiceNumber}
                  invoiceDate={form.watch('invoice_date')}
                  dueDate={form.watch('due_date')}
                  customerName={selectedCustomer?.name}
                  buyerName={form.watch('buyer_name')}
                  attentionOf={form.watch('attention_of')}
                  buyerEmail={selectedCustomer?.email || undefined}
                  buyerPhone={selectedCustomer?.phone || undefined}
                  buyerAddress={[
                    selectedCustomer?.address_line1,
                    selectedCustomer?.address_line2,
                    selectedCustomer?.city && selectedCustomer?.province
                      ? `${selectedCustomer.city}, ${selectedCustomer.province} ${selectedCustomer?.postal_code || ''}`.trim()
                      : selectedCustomer?.city || selectedCustomer?.province || '',
                    selectedCustomer?.country,
                  ].filter(Boolean).join('\n')}
                  lines={watchedLines}
                  notes={form.watch('notes')}
                  terms={form.watch('terms')}
                  isGstHstExempt={form.watch('is_gst_hst_exempt')}
                  isPstExempt={form.watch('is_pst_exempt')}
                  exemptionReason={form.watch('exemption_reason')}
                  customFields={customFields}
                  organizationName={organization?.name}
                  organizationAddress={[
                    organization?.address_line1,
                    organization?.city && organization?.province
                      ? `${organization.city}, ${organization.province}, ${organization?.postal_code || ''}`
                      : '',
                    organization?.country,
                  ].filter(Boolean).join('\n')}
                  organizationEmail={organization?.email || undefined}
                  organizationPhone={organization?.phone || undefined}
                  logoUrl={getDocumentLogoUrl(organization, 'invoice') || undefined}
                  dealerPermitNumber={form.watch('dealer_permit_number')}
                  gstHstNumber={form.watch('gst_hst_number')}
                  pstNumber={form.watch('pst_number')}
                  currency={localization.currency}
                  locale={locale}
                  sellerSignature={sellerSignature}
                  buyerSignature={buyerSignature}
                  gstHstRate={taxSettings?.gst_rate ?? 5}
                  pstRate={taxSettings?.pst_rate ?? 0}
                  showTaxColumn={(organization as any)?.invoice_show_tax_column ?? true}
                  balanceDue={total}
                  discountAmount={discountAmount}
                  shippingCharges={watchedShipping}
                  adjustment={watchedAdjustment}
                  adjustmentLabel={form.watch('adjustment_label')}
                  orderNumber={form.watch('order_number')}
                  subject={form.watch('subject')}
                  templateStyle={((organization as any)?.invoice_template_style as 'modern' | 'classic' | 'minimal' | 'bold') ?? 'modern'}
                  primaryColor={(organization as any)?.invoice_primary_color ?? '#7c3aed'}
                  secondaryColor={(organization as any)?.invoice_secondary_color ?? '#a78bfa'}
                  fontFamily={(organization as any)?.invoice_font_family ?? 'Inter, sans-serif'}
                  headerAlignment={((organization as any)?.invoice_header_alignment as 'left' | 'center' | 'right') ?? 'left'}
                  accentStyle={((organization as any)?.invoice_accent_style as 'line' | 'filled' | 'none') ?? 'filled'}
                  showLogo={(organization as any)?.invoice_show_logo ?? true}
                  showLineNumbers={(organization as any)?.invoice_show_line_numbers ?? false}
                  showQuantityColumn={(organization as any)?.invoice_show_quantity_column ?? true}
                  showRateColumn={(organization as any)?.invoice_show_rate_column ?? true}
                  footerText={(organization as any)?.invoice_footer ?? ''}
                  showPaymentInstructions={(organization as any)?.invoice_show_payment_instructions ?? false}
                  paymentInstructions={(organization as any)?.invoice_payment_instructions ?? ''}
                  showSellerSignature={showSellerSignature}
                  showBuyerSignature={showBuyerSignature}
                  onShowSellerSignatureChange={setShowSellerSignature}
                  onShowBuyerSignatureChange={setShowBuyerSignature}
                  enableOnlinePayments={!!(organization as any)?.invoice_enable_online_payments}
                  creditCardEnabled={!!(organization as any)?.invoice_credit_card_enabled}
                  achEnabled={!!(organization as any)?.invoice_ach_enabled}
                  interacEnabled={!!(organization as any)?.invoice_interac_enabled}
                  ccInstructions={(organization as any)?.invoice_cc_instructions || undefined}
                  achInstitution={(organization as any)?.invoice_ach_institution || undefined}
                  achAccountName={(organization as any)?.invoice_ach_account_name || undefined}
                  achAccountNumber={(organization as any)?.invoice_ach_account_number || undefined}
                  achTransitNumber={(organization as any)?.invoice_ach_transit_number || undefined}
                  etransferEmail={(organization as any)?.invoice_etransfer_email || undefined}
                  wiseEnabled={!!(organization as any)?.invoice_wise_enabled}
                  wiseAccount={selectWiseAccountForCurrency(wiseAccounts, localization.currency)}
                />
              </div>
            </TabsContent>
            </Tabs>


            {/* ── Sticky Footer ── */}
            <div className="flex-shrink-0 border-t px-6 py-3 flex items-center justify-between bg-background">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Items: <strong className="text-foreground">{fields.length}</strong></span>
                <span>Qty: <strong className="text-foreground">{totalQuantity}</strong></span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold mr-2">
                  Total: {formatCurrency(total)}
                </span>
                <Button type="button" variant="outline" size="sm" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={isSubmitting} onClick={() => submitWithAction('draft')}>
                  Save Draft
                </Button>
                <Button type="button" variant="secondary" size="sm" disabled={isSubmitting} onClick={() => submitWithAction('save')}>
                  Save
                </Button>
                <div className="flex items-center">
                  <Button
                    type="button"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() => submitWithAction('send-email')}
                    className="rounded-r-none"
                  >
                    {isSubmitting ? 'Creating...' : 'Save & Send'}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" size="sm" disabled={isSubmitting} className="rounded-l-none border-l border-l-primary-foreground/30 px-2">
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover">
                      <DropdownMenuItem onClick={() => submitWithAction('send-email')}>
                        <Mail className="mr-2 h-4 w-4" /> Send via Email
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => submitWithAction('send-whatsapp')}>
                        <MessageSquare className="mr-2 h-4 w-4" /> Send via WhatsApp
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => submitWithAction('send-sms')}>
                        <Phone className="mr-2 h-4 w-4" /> Send via SMS
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    {/* Share Dialog (opened after Save & Send) */}
    <InvoiceShareDialog
      open={showShareDialog}
      onOpenChange={setShowShareDialog}
      invoice={lastCreatedInvoice}
      defaultTab={shareDefaultTab}
    />
  </>
  );
}
