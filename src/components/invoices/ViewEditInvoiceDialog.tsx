import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Package, Save, X, Eye, Edit, FileSignature, ChevronDown, FileCheck, FileText, Building2, Receipt, Download, Printer, Mail, MessageSquare, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCustomers } from '@/hooks/useCustomers';
import { Invoice, useInvoiceLines } from '@/hooks/useInvoices';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useInventoryItems } from '@/hooks/useInventory';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { InvoiceSignatureSection } from './InvoiceSignatureSection';
import { InvoicePayNowButton } from './InvoicePayNowButton';
import { InvoiceCustomFields } from './InvoiceCustomFields';
import { InvoiceBarcodeSection } from './InvoiceBarcodeSection';
import { InvoiceShareDialog } from './InvoiceShareDialog';

import { InvoiceSignatureRequestDialog } from './InvoiceSignatureRequestDialog';
import { InvoicePreviewTab } from './InvoicePreviewTab';
import { useWiseReceivingAccounts, selectWiseAccountForCurrency } from '@/hooks/useWiseReceivingAccounts';
import { useSalesTaxSettings } from '@/hooks/useSalesTax';
import { generateInvoicePdf, generateInvoicePdfDoc } from '@/lib/generateInvoicePdf';
import { getDocumentLogoUrl } from '@/lib/getDocumentLogo';
import { isNpoIndustry } from '@/data/industries';
import { printService } from '@/lib/print/PrintService';
import { useDefaultSignature } from '@/hooks/useUserSignatures';
import { PaymentTermsCombobox } from './PaymentTermsCombobox';

const lineSchema = z.object({
  id: z.string().optional(),
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
  notes: z.string().optional(),
  terms: z.string().optional(),
  // Seller contact
  seller_email: z.string().optional(),
  seller_phone: z.string().optional(),
  // Tax registration
  dealer_permit_number: z.string().optional(),
  gst_hst_number: z.string().optional(),
  pst_number: z.string().optional(),
  // Tax exemptions
  is_gst_hst_exempt: z.boolean().optional(),
  is_pst_exempt: z.boolean().optional(),
  // Attention of
  attention_of: z.string().optional(),
  // Buyer details
  buyer_name: z.string().optional(),
  buyer_email: z.string().optional(),
  buyer_phone: z.string().optional(),
  buyer_address_line1: z.string().optional(),
  buyer_address_line2: z.string().optional(),
  buyer_city: z.string().optional(),
  buyer_province: z.string().optional(),
  buyer_postal_code: z.string().optional(),
  buyer_country: z.string().optional(),
  // Zoho-style fields
  order_number: z.string().optional(),
  subject: z.string().optional(),
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

interface ViewEditInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  mode: 'view' | 'edit';
}

export function ViewEditInvoiceDialog({ open, onOpenChange, invoice, mode: initialMode }: ViewEditInvoiceDialogProps) {
  const [mode, setMode] = useState<'view' | 'edit'>(initialMode);
  const { customers, isLoading: customersLoading } = useCustomers();
  const { organization } = useCurrentOrganization();
  
  const { data: inventoryItems = [] } = useInventoryItems(organization?.id);
  const { lines: invoiceLines, isLoading: linesLoading } = useInvoiceLines(invoice?.id);
  const { data: taxSettings } = useSalesTaxSettings(organization?.id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [sellerSignatureData, setSellerSignatureData] = useState<string | null>(null);
  const [buyerSignatureData, setBuyerSignatureData] = useState<string | null>(null);
  const [showSellerSignature, setShowSellerSignature] = useState(false);
  const [showBuyerSignature, setShowBuyerSignature] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showSignatureRequestDialog, setShowSignatureRequestDialog] = useState(false);
  const [shareDefaultTab, setShareDefaultTab] = useState<'email' | 'whatsapp' | 'sms' | 'print'>('email');

  const { data: defaultSignatureData } = useDefaultSignature();

  const countryCode = organization?.country || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customer_id: '',
      invoice_date: format(new Date(), 'yyyy-MM-dd'),
      due_date: format(new Date(), 'yyyy-MM-dd'),
      document_title: 'Invoice',
      notes: '',
      terms: '',
      seller_email: organization?.email || '',
      seller_phone: organization?.phone || '',
      dealer_permit_number: organization?.dealer_permit_number || '',
      gst_hst_number: organization?.gst_hst_number || '',
      pst_number: organization?.pst_number || '',
      is_gst_hst_exempt: false,
      is_pst_exempt: false,
      attention_of: '',
      buyer_name: '',
      buyer_email: '',
      buyer_phone: '',
      buyer_address_line1: '',
      buyer_address_line2: '',
      buyer_city: '',
      buyer_province: '',
      buyer_postal_code: '',
      buyer_country: '',
      // Zoho-style fields
      order_number: '',
      subject: '',
      discount_type: 'none',
      discount_value: 0,
      shipping_charges: 0,
      adjustment: 0,
      adjustment_label: 'Adjustment',
      lines: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 5 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lines',
  });

  // Reset mode and active tab when dialog opens/closes
  useEffect(() => {
    setMode(initialMode);
    if (initialMode === 'edit') {
      setActiveTab('details');
    }
  }, [initialMode, open]);

  // Load invoice data when invoice or lines change
  useEffect(() => {
    if (invoice && invoiceLines.length >= 0 && !linesLoading) {
      form.reset({
        customer_id: invoice.customer_id,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        document_title: invoice.document_title || 'Invoice',
        notes: invoice.notes || (organization as any)?.invoice_default_notes || '',
        terms: invoice.terms || '',
        seller_email: invoice.seller_email || organization?.email || '',
        seller_phone: invoice.seller_phone || organization?.phone || '',
        dealer_permit_number: invoice.dealer_permit_number || organization?.dealer_permit_number || '',
        gst_hst_number: invoice.gst_hst_number || organization?.gst_hst_number || '',
        pst_number: invoice.pst_number || organization?.pst_number || '',
        is_gst_hst_exempt: invoice.is_gst_hst_exempt || false,
        is_pst_exempt: invoice.is_pst_exempt || false,
        attention_of: (invoice as any).attention_of || '',
        buyer_name: invoice.buyer_name || '',
        buyer_email: invoice.buyer_email || '',
        buyer_phone: invoice.buyer_phone || '',
        buyer_address_line1: invoice.buyer_address_line1 || '',
        buyer_address_line2: invoice.buyer_address_line2 || '',
        buyer_city: invoice.buyer_city || '',
        buyer_province: invoice.buyer_province || '',
        buyer_postal_code: invoice.buyer_postal_code || '',
        buyer_country: invoice.buyer_country || '',
        // Zoho-style fields
        order_number: (invoice as any).order_number || '',
        subject: (invoice as any).subject || '',
        discount_type: (invoice as any).discount_type || 'none',
        discount_value: (invoice as any).discount_value || 0,
        shipping_charges: (invoice as any).shipping_charges || 0,
        adjustment: (invoice as any).adjustment || 0,
        adjustment_label: (invoice as any).adjustment_label || 'Adjustment',
        lines: invoiceLines.length > 0 
          ? invoiceLines.map(line => ({
              id: line.id,
              description: line.description,
              quantity: line.quantity,
              unit_price: line.unit_price,
              tax_rate: line.tax_rate || 0,
              notes: (line as any).notes || '',
            }))
          : [{ description: '', quantity: 1, unit_price: 0, tax_rate: 5 }],
      });

      // Load custom fields
      const extendedInvoice = invoice as Invoice & {
        custom_fields?: CustomField[];
        buyer_signature_data?: string;
      };
      if (extendedInvoice.custom_fields && Array.isArray(extendedInvoice.custom_fields)) {
        setCustomFields(extendedInvoice.custom_fields);
      }

      // Load signatures
      if (extendedInvoice.buyer_signature_data) {
        setBuyerSignatureData(extendedInvoice.buyer_signature_data);
      }
    }
  }, [invoice, invoiceLines, linesLoading, form, organization]);

  const watchedLines = form.watch('lines');
  const isGstHstExempt = form.watch('is_gst_hst_exempt');
  const isPstExempt = form.watch('is_pst_exempt');

  const subtotal = watchedLines.reduce((sum, line) => {
    return sum + (Number(line.quantity) || 0) * (Number(line.unit_price) || 0);
  }, 0);

  // Calculate split taxes - GST/HST is 5% (federal) or combined rate, PST varies by province
  // For simplicity, we assume tax_rate contains GST/HST and handle PST separately if needed
  const gstHstTotal = isGstHstExempt ? 0 : watchedLines.reduce((sum, line) => {
    const amount = (Number(line.quantity) || 0) * (Number(line.unit_price) || 0);
    const taxRate = Number(line.tax_rate) || 0;
    // For HST provinces (ON, NB, NL, NS, PE), the full rate is GST/HST
    // For GST+PST provinces, we need to split - assume GST is 5%
    const gstHstRate = taxRate >= 13 ? taxRate : Math.min(taxRate, 5);
    return sum + amount * (gstHstRate / 100);
  }, 0);

  const pstTotal = isPstExempt ? 0 : watchedLines.reduce((sum, line) => {
    const amount = (Number(line.quantity) || 0) * (Number(line.unit_price) || 0);
    const taxRate = Number(line.tax_rate) || 0;
    // PST only applies in GST+PST provinces where rate > 5 and < 13
    const pstRate = taxRate > 5 && taxRate < 13 ? taxRate - 5 : 0;
    return sum + amount * (pstRate / 100);
  }, 0);

  const taxTotal = gstHstTotal + pstTotal;

  // Zoho-style adjustments
  const watchedDiscountType = form.watch('discount_type');
  const watchedDiscountValue = form.watch('discount_value') || 0;
  const watchedShippingCharges = form.watch('shipping_charges') || 0;
  const watchedAdjustment = form.watch('adjustment') || 0;

  const discountAmount = watchedDiscountType === 'percentage'
    ? subtotal * (watchedDiscountValue / 100)
    : watchedDiscountType === 'flat' ? watchedDiscountValue : 0;
  const total = subtotal - discountAmount + taxTotal + watchedShippingCharges + watchedAdjustment;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
    }).format(value);
  };

  const handleSelectInventoryItem = (index: number, itemId: string) => {
    const item = inventoryItems.find(i => i.id === itemId);
    if (item) {
      form.setValue(`lines.${index}.description`, item.name);
      form.setValue(`lines.${index}.unit_price`, item.selling_price);
      form.setValue(`lines.${index}.tax_rate`, item.tax_rate || 0);
      form.setValue(`lines.${index}.inventory_item_id`, item.id);
    }
  };

  const onSubmit = async (data: InvoiceFormData) => {
    if (!invoice) return;
    
    setIsSubmitting(true);
    try {
      // Calculate totals with exemption handling
      let newSubtotal = 0;
      let newGstHstAmount = 0;
      let newPstAmount = 0;

      const lines = data.lines.map((line, idx) => {
        const amount = line.quantity * line.unit_price;
        const taxRate = line.tax_rate || 0;
        
        // Split tax calculation
        let gstHstRate = 0;
        let pstRate = 0;
        
        if (!data.is_gst_hst_exempt) {
          gstHstRate = taxRate >= 13 ? taxRate : Math.min(taxRate, 5);
        }
        if (!data.is_pst_exempt && taxRate > 5 && taxRate < 13) {
          pstRate = taxRate - 5;
        }
        
        const lineGstHst = amount * (gstHstRate / 100);
        const linePst = amount * (pstRate / 100);
        const lineTax = lineGstHst + linePst;
        
        newSubtotal += amount;
        newGstHstAmount += lineGstHst;
        newPstAmount += linePst;

        return {
          ...line,
          amount,
          tax_amount: lineTax,
          line_order: idx,
        };
      });

      const newTaxAmount = newGstHstAmount + newPstAmount;
      
      // Zoho-style adjustments
      const dType = data.discount_type || 'none';
      const dValue = data.discount_value || 0;
      const calcDiscount = dType === 'percentage' ? newSubtotal * (dValue / 100) : dType === 'flat' ? dValue : 0;
      const shippingCh = data.shipping_charges || 0;
      const adj = data.adjustment || 0;
      const newTotal = newSubtotal - calcDiscount + newTaxAmount + shippingCh + adj;

      // Update invoice
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({
          customer_id: data.customer_id,
          invoice_date: data.invoice_date,
          due_date: data.due_date,
          document_title: data.document_title,
          notes: data.notes || null,
          terms: data.terms || null,
          // Seller contact
          seller_email: data.seller_email || null,
          seller_phone: data.seller_phone || null,
          // Tax registration
          dealer_permit_number: data.dealer_permit_number || null,
          gst_hst_number: data.gst_hst_number || null,
          pst_number: data.pst_number || null,
          // Attention of
          attention_of: data.attention_of || null,
          // Tax exemptions
          is_gst_hst_exempt: data.is_gst_hst_exempt || false,
          is_pst_exempt: data.is_pst_exempt || false,
          // Buyer details
          buyer_name: data.buyer_name || null,
          buyer_email: data.buyer_email || null,
          buyer_phone: data.buyer_phone || null,
          buyer_address_line1: data.buyer_address_line1 || null,
          buyer_address_line2: data.buyer_address_line2 || null,
          buyer_city: data.buyer_city || null,
          buyer_province: data.buyer_province || null,
          buyer_postal_code: data.buyer_postal_code || null,
          buyer_country: data.buyer_country || null,
          // Tax amounts
          subtotal: newSubtotal,
          tax_amount: newTaxAmount,
          gst_hst_amount: newGstHstAmount,
          pst_amount: newPstAmount,
          total: newTotal,
          balance_due: newTotal - Number(invoice.amount_paid),
          // Zoho-style fields
          order_number: data.order_number || null,
          subject: data.subject || null,
          discount_type: data.discount_type || null,
          discount_value: data.discount_value || null,
          discount_amount: calcDiscount || null,
          shipping_charges: shippingCh || null,
          adjustment: adj || null,
          adjustment_label: data.adjustment_label || null,
          custom_fields: customFields.length > 0 ? JSON.parse(JSON.stringify(customFields)) : null,
          buyer_signature_data: buyerSignatureData,
          buyer_signature_date: buyerSignatureData ? new Date().toISOString() : null,
        })
        .eq('id', invoice.id);

      if (invoiceError) throw invoiceError;

      // Delete existing lines and insert new ones
      await supabase.from('invoice_lines').delete().eq('invoice_id', invoice.id);

      const { error: linesError } = await supabase
        .from('invoice_lines')
        .insert(
          lines.map((line, idx) => ({
            invoice_id: invoice.id,
            description: line.description,
            quantity: line.quantity,
            unit_price: line.unit_price,
            amount: line.amount,
            tax_rate: line.tax_rate || 0,
            tax_amount: line.tax_amount || 0,
            line_order: line.line_order,
            notes: (data.lines[idx] as any)?.notes || null,
          }))
        );

      if (linesError) throw linesError;

      toast.success('Invoice updated successfully');
      onOpenChange(false);
    } catch (err: unknown) {
      const error = err as Error;
      toast.error('Failed to update invoice: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusConfig: Record<string, { label: string; color: string }> = {
    draft: { label: 'Draft', color: 'bg-muted text-muted-foreground' },
    issued: { label: 'Issued', color: 'bg-blue-500/10 text-blue-600' },
    final: { label: 'Final', color: 'bg-emerald-500/10 text-emerald-600' },
    sent: { label: 'Sent', color: 'bg-blue-500/10 text-blue-600' },
    paid: { label: 'Paid', color: 'bg-success/10 text-success' },
    partial: { label: 'Partial', color: 'bg-warning/10 text-warning' },
    overdue: { label: 'Overdue', color: 'bg-destructive/10 text-destructive' },
    void: { label: 'Void', color: 'bg-muted text-muted-foreground' },
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!invoice) return;
    
    try {
      const updateData: Record<string, unknown> = { status: newStatus };
      
      // Set issued_at timestamp when marking as issued or final
      if ((newStatus === 'issued' || newStatus === 'final') && invoice.status === 'draft') {
        updateData.issued_at = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', invoice.id);
      
      if (error) throw error;
      
      toast.success(`Invoice marked as ${newStatus}`);
      onOpenChange(false);
    } catch (err: unknown) {
      const error = err as Error;
      toast.error('Failed to update status: ' + error.message);
    }
  };

  // --- PDF Generation helpers (reuse InvoiceShareDialog pattern) ---
  const customer = customers.find(c => c.id === invoice?.customer_id);
  const documentTitle = (invoice as any)?.document_title || 'Invoice';

  const extendedInvoice = invoice as Invoice & {
    buyer_name?: string;
    buyer_signature_data?: string;
    buyer_signature_date?: string;
    custom_fields?: { id: string; label: string; value: string; type: 'text' | 'number' | 'date' }[];
    seller_signature_id?: string;
  };

  // Load seller signature from invoice or default
  useEffect(() => {
    const loadSig = async () => {
      if (extendedInvoice?.seller_signature_id) {
        const { data } = await supabase
          .from('user_signatures')
          .select('signature_data')
          .eq('id', extendedInvoice.seller_signature_id)
          .single();
        if (data?.signature_data) {
          setSellerSignatureData(data.signature_data);
          return;
        }
      }
      if (defaultSignatureData?.signature_data) {
        setSellerSignatureData(defaultSignatureData.signature_data);
      }
    };
    if (open && invoice) loadSig();
  }, [open, invoice, defaultSignatureData, extendedInvoice?.seller_signature_id]);

  const buildPdfData = () => {
    if (!invoice || !customer) return null;
    const orgWithSettings = organization as typeof organization & {
      invoice_logo_url?: string;
      invoice_footer?: string;
      invoice_payment_instructions?: string;
      invoice_show_payment_instructions?: boolean;
      invoice_show_logo?: boolean;
    };
    return {
      invoiceNumber: invoice.invoice_number,
      invoiceDate: format(parseLocalDate(invoice.invoice_date), 'MMMM d, yyyy'),
      dueDate: format(parseLocalDate(invoice.due_date), 'MMMM d, yyyy'),
      status: invoice.status,
      documentTitle,
      customerName: customer.name,
      customerEmail: customer.email || undefined,
      customerAddress: customer.address_line1 || undefined,
      customerCity: customer.city || undefined,
      customerProvince: customer.province || undefined,
      customerPostalCode: customer.postal_code || undefined,
      customerCountry: customer.country || undefined,
      customerPhone: customer.phone || undefined,
      buyerName: extendedInvoice.buyer_name || undefined,
      attentionOf: (invoice as any).attention_of || undefined,
      lines: invoiceLines.map(line => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unit_price,
        amount: line.amount,
        taxRate: line.tax_rate || 0,
        taxAmount: line.tax_amount || 0,
        notes: (line as any).notes || undefined,
      })),
      subtotal: Number(invoice.subtotal),
      taxAmount: Number(invoice.tax_amount),
      total: Number(invoice.total),
      amountPaid: Number(invoice.amount_paid),
      balanceDue: Number(invoice.balance_due),
      notes: invoice.notes || undefined,
      terms: invoice.terms || undefined,
      organizationName: organization?.name,
      organizationAddress: organization?.address_line1 || undefined,
      organizationCity: organization?.city || undefined,
      organizationProvince: organization?.province || undefined,
      organizationPostalCode: organization?.postal_code || undefined,
      organizationCountry: organization?.country || undefined,
      organizationPhone: organization?.phone || undefined,
      organizationEmail: organization?.email || undefined,
      organizationWebsite: organization?.website || undefined,
      logoUrl: getDocumentLogoUrl(organization, 'invoice') || undefined,
      currency: localization.currency,
      locale: countryCode === 'US' ? 'en-US' : 'en-CA',
      dealerPermitNumber: (invoice as any).dealer_permit_number || organization?.dealer_permit_number || undefined,
      gstHstNumber: (invoice as any).gst_hst_number || organization?.gst_hst_number || undefined,
      pstNumber: (invoice as any).pst_number || organization?.pst_number || undefined,
      charityBn: (organization?.industry && isNpoIndustry(organization.industry)) ? (organization as any).business_number || undefined : undefined,
      isGstHstExempt: (invoice as any).is_gst_hst_exempt || false,
      isPstExempt: (invoice as any).is_pst_exempt || false,
      sellerSignatureData: sellerSignatureData || undefined,
      sellerSignatureName: organization?.name || undefined,
      buyerSignatureData: extendedInvoice.buyer_signature_data || undefined,
      buyerSignatureDate: extendedInvoice.buyer_signature_date
        ? format(new Date(extendedInvoice.buyer_signature_date), 'MMM d, yyyy')
        : undefined,
      customFields: extendedInvoice.custom_fields || undefined,
      paymentInstructions: orgWithSettings?.invoice_show_payment_instructions !== false
        ? orgWithSettings?.invoice_payment_instructions
        : undefined,
      footer: orgWithSettings?.invoice_footer || undefined,
      // Payment method fields
      enableOnlinePayments: organization?.invoice_enable_online_payments || false,
      creditCardEnabled: organization?.invoice_credit_card_enabled || false,
      achEnabled: organization?.invoice_ach_enabled || false,
      interacEnabled: organization?.invoice_interac_enabled || false,
      ccInstructions: organization?.invoice_cc_instructions || undefined,
      achInstitution: organization?.invoice_ach_institution || undefined,
      achAccountName: organization?.invoice_ach_account_name || undefined,
      achAccountNumber: organization?.invoice_ach_account_number || undefined,
      achTransitNumber: organization?.invoice_ach_transit_number || undefined,
      etransferEmail: organization?.invoice_etransfer_email || undefined,
      ccPaymentUrl: organization?.invoice_cc_payment_url || undefined,
      wiseEnabled: !!(organization as unknown as Record<string, unknown>)?.invoice_wise_enabled,
      wiseAccount: selectWiseAccountForCurrency(wiseAccounts, (invoice as any).currency),
      wiseReference: (extendedInvoice.wise_payment_reference as string | null) || null,
    };
  };

  const handleDownloadPdf = async () => {
    const pdfData = buildPdfData();
    if (pdfData) {
      await generateInvoicePdf(pdfData);
      toast.success('PDF downloaded');
    }
  };

  const handlePrint = async () => {
    const pdfData = buildPdfData();
    if (!pdfData) return;
    try {
      const doc = await generateInvoicePdfDoc(pdfData);
      printService.openPrintDialog(doc);
    } catch (e) {
      console.error('Print failed:', e);
      toast.error('Failed to open print dialog');
    }
  };

  const openShareWithChannel = (channel: 'email' | 'whatsapp' | 'sms') => {
    setShareDefaultTab(channel);
    setShowShareDialog(true);
  };

  if (!invoice) return null;

  const status = statusConfig[invoice.status] || statusConfig.draft;
  const isEditable = mode === 'edit' && !['void', 'paid', 'final'].includes(invoice.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-3">
                {mode === 'view' ? <Eye className="w-5 h-5" /> : <Edit className="w-5 h-5" />}
                {form.watch('document_title') || 'Invoice'} #{invoice.invoice_number}
              </DialogTitle>
              <DialogDescription>
                {mode === 'view' ? 'View invoice details' : 'Edit invoice details'}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* Status Badge with Dropdown for changing status */}
              {invoice.status === 'draft' ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Badge className={status.color}>{status.label}</Badge>
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      onClick={() => handleStatusChange('issued')}
                      className="gap-2"
                    >
                      <FileText className="w-4 h-4 text-blue-500" />
                      Mark as Issued
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleStatusChange('final')}
                      className="gap-2"
                    >
                      <FileCheck className="w-4 h-4 text-emerald-500" />
                      Mark as Final
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => handleStatusChange('void')}
                      className="gap-2 text-destructive"
                    >
                      <X className="w-4 h-4" />
                      Void Invoice
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Badge className={status.color}>{status.label}</Badge>
              )}
              
              {mode === 'view' && !['void', 'paid', 'draft'].includes(invoice.status) && Number(invoice.balance_due) > 0 && organization?.invoice_enable_online_payments && (
                <InvoicePayNowButton
                  invoiceId={invoice.id}
                  balanceDue={Number(invoice.balance_due)}
                  creditCardEnabled={organization?.invoice_credit_card_enabled}
                  achEnabled={organization?.invoice_ach_enabled}
                  interacEnabled={organization?.invoice_interac_enabled}
                />
              )}
              {mode === 'view' && !['void', 'paid', 'final'].includes(invoice.status) && (
                <Button variant="outline" size="sm" onClick={() => setMode('edit')}>
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {mode === 'view' ? (
                /* View mode: render preview directly, no tabs */
                <InvoicePreviewTab
                    hideSignatureControls
                    documentTitle={form.watch('document_title')}
                    invoiceNumber={invoice.invoice_number}
                    invoiceDate={form.watch('invoice_date')}
                    dueDate={form.watch('due_date')}
                    customerName={customers.find(c => c.id === form.watch('customer_id'))?.name}
                    buyerName={form.watch('buyer_name')}
                    attentionOf={form.watch('attention_of')}
                    buyerEmail={form.watch('buyer_email')}
                    buyerPhone={form.watch('buyer_phone')}
                    buyerAddress={[
                      form.watch('buyer_address_line1'),
                      form.watch('buyer_address_line2'),
                      form.watch('buyer_city') && form.watch('buyer_province')
                        ? `${form.watch('buyer_city')}, ${form.watch('buyer_province')} ${form.watch('buyer_postal_code') || ''}`.trim()
                        : form.watch('buyer_city') || form.watch('buyer_province') || '',
                      form.watch('buyer_country'),
                    ].filter(Boolean).join('\n')}
                    lines={watchedLines}
                    notes={form.watch('notes')}
                    terms={form.watch('terms')}
                    isGstHstExempt={isGstHstExempt}
                    isPstExempt={isPstExempt}
                    customFields={customFields}
                    organizationName={organization?.name}
                    organizationAddress={[
                      organization?.address_line1,
                      organization?.city && organization?.province
                        ? `${organization.city}, ${organization.province}, ${organization?.postal_code || ''}`
                        : '',
                      organization?.country
                    ].filter(Boolean).join('\n')}
                    organizationEmail={form.watch('seller_email') || organization?.email}
                    organizationPhone={form.watch('seller_phone') || organization?.phone}
                    logoUrl={getDocumentLogoUrl(organization, 'invoice') || undefined}
                    dealerPermitNumber={form.watch('dealer_permit_number')}
                    gstHstNumber={form.watch('gst_hst_number')}
                    pstNumber={form.watch('pst_number')}
                    currency={localization.currency}
                    locale={locale}
                    sellerSignature={sellerSignatureData}
                    buyerSignature={buyerSignatureData}
                    gstHstRate={taxSettings?.gst_rate ?? 5}
                    pstRate={taxSettings?.pst_rate ?? 0}
                    showTaxColumn={organization?.invoice_show_tax_column ?? true}
                    balanceDue={invoice.balance_due}
                    templateStyle={(organization?.invoice_template_style as 'modern' | 'classic' | 'minimal' | 'bold') ?? 'modern'}
                    primaryColor={organization?.invoice_primary_color ?? '#7c3aed'}
                    secondaryColor={organization?.invoice_secondary_color ?? '#a78bfa'}
                    fontFamily={organization?.invoice_font_family ?? 'Inter, sans-serif'}
                    headerAlignment={(organization?.invoice_header_alignment as 'left' | 'center' | 'right') ?? 'left'}
                    accentStyle={(organization?.invoice_accent_style as 'line' | 'filled' | 'none') ?? 'filled'}
                    showLogo={organization?.invoice_show_logo ?? true}
                    showLineNumbers={organization?.invoice_show_line_numbers ?? false}
                    showQuantityColumn={organization?.invoice_show_quantity_column ?? true}
                    showRateColumn={organization?.invoice_show_rate_column ?? true}
                    footerText={organization?.invoice_footer ?? ''}
                    showPaymentInstructions={organization?.invoice_show_payment_instructions ?? false}
                    paymentInstructions={organization?.invoice_payment_instructions ?? ''}
                    showSellerSignature={showSellerSignature}
                    showBuyerSignature={showBuyerSignature}
                    onShowSellerSignatureChange={setShowSellerSignature}
                    onShowBuyerSignatureChange={setShowBuyerSignature}
                    enableOnlinePayments={!!organization?.invoice_enable_online_payments}
                    creditCardEnabled={!!organization?.invoice_credit_card_enabled}
                    achEnabled={!!organization?.invoice_ach_enabled}
                    interacEnabled={!!organization?.invoice_interac_enabled}
                    ccInstructions={organization?.invoice_cc_instructions || undefined}
                    achInstitution={organization?.invoice_ach_institution || undefined}
                    achAccountName={organization?.invoice_ach_account_name || undefined}
                    achAccountNumber={organization?.invoice_ach_account_number || undefined}
                    achTransitNumber={organization?.invoice_ach_transit_number || undefined}
                    etransferEmail={organization?.invoice_etransfer_email || undefined}
                    wiseEnabled={!!(organization as unknown as Record<string, unknown>)?.invoice_wise_enabled}
                    wiseAccount={selectWiseAccountForCurrency(wiseAccounts, (invoice as any).currency)}
                    wiseReference={(extendedInvoice.wise_payment_reference as string | null) || null}
                    discountAmount={discountAmount}
                    shippingCharges={watchedShippingCharges}
                    adjustment={watchedAdjustment}
                    adjustmentLabel={form.watch('adjustment_label')}
                    orderNumber={form.watch('order_number')}
                    subject={form.watch('subject')}
                  />
              ) : (
                /* Edit mode: tabbed form */
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="items">Line Items</TabsTrigger>
                  <TabsTrigger value="signatures">Signatures</TabsTrigger>
                  <TabsTrigger value="custom">Custom Fields</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="mt-4">
                  <ScrollArea className="h-[450px] pr-4">
                  <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="document_title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Document Title</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value}
                            disabled={!isEditable}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="customer_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value}
                            disabled={!isEditable}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select customer" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {customersLoading ? (
                                <SelectItem value="__loading__" disabled>Loading...</SelectItem>
                              ) : (
                                customers.map((customer) => (
                                  <SelectItem key={customer.id} value={customer.id}>
                                    {customer.name}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="invoice_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Invoice Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} disabled={!isEditable} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="due_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Due Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} disabled={!isEditable} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="buyer_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Buyer Name (for signature)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Full legal name" disabled={!isEditable} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="attention_of"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Attention Of</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Contact person name" disabled={!isEditable} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Seller Contact & Tax Registration */}
                  <div className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <h4 className="font-medium text-sm">Seller Information & Tax Registration</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="seller_email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Seller Email</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" placeholder="sales@company.com" disabled={!isEditable} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="seller_phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Seller Phone</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="(555) 123-4567" disabled={!isEditable} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="dealer_permit_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dealer Permit #</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="DLR-12345" disabled={!isEditable} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="gst_hst_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>GST/HST #</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="123456789RT0001" disabled={!isEditable} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="pst_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>PST #</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="PST-1234-5678" disabled={!isEditable} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Buyer Info Section */}
                  <div className="border rounded-lg p-4 space-y-4">
                    <h4 className="font-medium text-sm text-muted-foreground">Buyer Information</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="buyer_email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Buyer Email</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" placeholder="buyer@email.com" disabled={!isEditable} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="buyer_phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Buyer Phone</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="(555) 987-6543" disabled={!isEditable} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="buyer_address_line1"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Address Line 1</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Street address" disabled={!isEditable} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="buyer_address_line2"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Address Line 2</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Apt, suite, unit, etc." disabled={!isEditable} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="buyer_city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="City" disabled={!isEditable} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="buyer_province"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Province/State</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Province or State" disabled={!isEditable} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="buyer_postal_code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Postal/ZIP Code</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Postal code" disabled={!isEditable} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="buyer_country"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Country</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Country" disabled={!isEditable} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Tax Exemptions */}
                  <div className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-muted-foreground" />
                      <h4 className="font-medium text-sm">Tax Exemptions</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="is_gst_hst_exempt"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={!isEditable}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>GST/HST Exempt</FormLabel>
                              <FormDescription className="text-xs">
                                For export sales or zero-rated supplies
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="is_pst_exempt"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={!isEditable}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>PST Exempt</FormLabel>
                              <FormDescription className="text-xs">
                                For resellers or exempt items
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">

                    <FormField
                      control={form.control}
                      name="terms"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Terms</FormLabel>
                          <FormControl>
                            {isEditable ? (
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
                                placeholder="Select payment terms..."
                              />
                            ) : (
                              <Input {...field} placeholder="Net 30" disabled />
                            )}
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder="Additional notes..." 
                            rows={3} 
                            disabled={!isEditable}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Line Items Summary */}
                  {watchedLines && watchedLines.length > 0 && (
                    <div className="border rounded-lg">
                      <div className="px-4 py-2 border-b bg-muted/30">
                        <h4 className="text-sm font-medium text-muted-foreground">Line Items Summary</h4>
                      </div>
                      <div className="overflow-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b bg-muted/20">
                              <th className="text-left p-2">Description</th>
                              <th className="text-right p-2 w-14">Qty</th>
                              <th className="text-right p-2 w-20">Price</th>
                              <th className="text-right p-2 w-16">Tax %</th>
                              <th className="text-right p-2 w-24">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {watchedLines.map((line: any, idx: number) => {
                              const qty = Number(line.quantity) || 0;
                              const price = Number(line.unit_price) || 0;
                              const amount = qty * price;
                              return (
                                <tr key={idx} className="border-b last:border-0">
                                  <td className="p-2">
                                    <span>{line.description || '—'}</span>
                                    {line.notes && (
                                      <p className="text-[10px] italic text-muted-foreground mt-0.5">{line.notes}</p>
                                    )}
                                  </td>
                                  <td className="p-2 text-right">{qty}</td>
                                  <td className="p-2 text-right">{formatCurrency(price)}</td>
                                  <td className="p-2 text-right">{Number(line.tax_rate) || 0}%</td>
                                  <td className="p-2 text-right">{formatCurrency(amount)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot className="bg-muted/10">
                            <tr className="border-t">
                              <td colSpan={4} className="p-2 text-right font-medium">Subtotal</td>
                              <td className="p-2 text-right">{formatCurrency(subtotal)}</td>
                            </tr>
                            <tr>
                              <td colSpan={4} className="p-2 text-right font-medium">Tax</td>
                              <td className="p-2 text-right">{formatCurrency(taxTotal)}</td>
                            </tr>
                            <tr className="border-t font-semibold">
                              <td colSpan={4} className="p-2 text-right">Total</td>
                              <td className="p-2 text-right">{formatCurrency(total)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Barcode Section */}
                  <InvoiceBarcodeSection invoiceNumber={invoice.invoice_number} />
                  </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="items" className="mt-4">
                  <ScrollArea className="h-[450px] pr-4">
                  <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <FormLabel>Line Items</FormLabel>
                    {isEditable && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => append({ description: '', quantity: 1, unit_price: 0, tax_rate: 5 })}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Line
                      </Button>
                    )}
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          {inventoryItems.length > 0 && <th className="text-left p-3 w-32">Product</th>}
                          <th className="text-left p-3">Description</th>
                          <th className="text-right p-3 w-20">Qty</th>
                          <th className="text-right p-3 w-28">Price</th>
                          <th className="text-right p-3 w-20">Tax %</th>
                          <th className="text-right p-3 w-28">Amount</th>
                          {isEditable && <th className="w-10"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {fields.map((field, index) => {
                          const qty = Number(watchedLines[index]?.quantity) || 0;
                          const price = Number(watchedLines[index]?.unit_price) || 0;
                          const amount = qty * price;

                          return (
                            <tr key={field.id} className="border-t">
                              {inventoryItems.length > 0 && (
                                <td className="p-2">
                                  <Select
                                    onValueChange={(val) => handleSelectInventoryItem(index, val)}
                                    disabled={!isEditable}
                                  >
                                    <SelectTrigger className="border-0 bg-transparent h-8">
                                      <Package className="w-4 h-4" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {inventoryItems.map((item) => (
                                        <SelectItem key={item.id} value={item.id}>
                                          {item.sku} - {item.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                              )}
                              <td className="p-2">
                                <Input
                                  {...form.register(`lines.${index}.description`)}
                                  placeholder="Description"
                                  className={isEditable ? "h-8 text-sm" : "border-0 bg-transparent"}
                                  disabled={!isEditable}
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  {...form.register(`lines.${index}.quantity`)}
                                  className={isEditable ? "h-8 text-sm text-right" : "border-0 bg-transparent text-right"}
                                  disabled={!isEditable}
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  {...form.register(`lines.${index}.unit_price`)}
                                  className={isEditable ? "h-8 text-sm text-right" : "border-0 bg-transparent text-right"}
                                  disabled={!isEditable}
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  {...form.register(`lines.${index}.tax_rate`)}
                                  className={isEditable ? "h-8 text-sm text-right" : "border-0 bg-transparent text-right"}
                                  disabled={!isEditable}
                                />
                              </td>
                              <td className="p-2 text-right font-mono">
                                {formatCurrency(amount)}
                              </td>
                              {isEditable && (
                                <td className="p-2">
                                  {fields.length > 1 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive"
                                      onClick={() => remove(index)}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="flex justify-end">
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-mono">{formatCurrency(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tax</span>
                        <span className="font-mono">{formatCurrency(taxTotal)}</span>
                      </div>
                      <div className="flex justify-between font-semibold border-t pt-2">
                        <span>Total</span>
                        <span className="font-mono">{formatCurrency(total)}</span>
                      </div>
                      {Number(invoice.amount_paid) > 0 && (
                        <>
                          <div className="flex justify-between text-sm text-success">
                            <span>Amount Paid</span>
                            <span className="font-mono">{formatCurrency(Number(invoice.amount_paid))}</span>
                          </div>
                          <div className="flex justify-between font-semibold border-t pt-2 text-warning">
                            <span>Balance Due</span>
                            <span className="font-mono">{formatCurrency(total - Number(invoice.amount_paid))}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="signatures" className="mt-4">
                  <ScrollArea className="h-[450px] pr-4">
                  <InvoiceSignatureSection
                    sellerSignature={sellerSignatureData}
                    buyerSignature={buyerSignatureData}
                    buyerName={form.watch('buyer_name') || ''}
                    onSellerSignatureChange={setSellerSignatureData}
                    onBuyerSignatureChange={setBuyerSignatureData}
                    isEditable={isEditable}
                  />
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="custom" className="mt-4">
                  <ScrollArea className="h-[450px] pr-4">
                  <InvoiceCustomFields
                    fields={customFields}
                    onChange={setCustomFields}
                    isEditable={isEditable}
                  />
                  </ScrollArea>
                </TabsContent>

              </Tabs>
              )}

              {isEditable && (
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setMode('view')}>
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    <Save className="w-4 h-4 mr-1" />
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </Button>
                </DialogFooter>
              )}
            </form>
          </Form>
        </ScrollArea>

        {mode === 'view' && (
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex gap-2 flex-1 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
                <Download className="w-4 h-4 mr-1" />
                Download PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-1" />
                Print
              </Button>
              <Button variant="outline" size="sm" onClick={() => openShareWithChannel('email')}>
                <Mail className="w-4 h-4 mr-1" />
                Email
              </Button>
              <Button variant="outline" size="sm" onClick={() => openShareWithChannel('whatsapp')}>
                <MessageSquare className="w-4 h-4 mr-1" />
                WhatsApp
              </Button>
              <Button variant="outline" size="sm" onClick={() => openShareWithChannel('sms')}>
                <Phone className="w-4 h-4 mr-1" />
                SMS
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowSignatureRequestDialog(true)}>
                <FileSignature className="w-4 h-4 mr-1" />
                Request Signature
              </Button>
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>

      {/* Share Dialog */}
      <InvoiceShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        invoice={invoice}
        defaultTab={shareDefaultTab}
      />

      {/* Signature Request Dialog */}
      <InvoiceSignatureRequestDialog
        open={showSignatureRequestDialog}
        onOpenChange={setShowSignatureRequestDialog}
        invoice={invoice}
      />
    </Dialog>
  );
}
