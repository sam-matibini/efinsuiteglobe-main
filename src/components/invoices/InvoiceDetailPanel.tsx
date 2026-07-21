import { useState, useEffect } from 'react';
import { Edit, Share2, FileText, Download, Printer, Mail, MoreHorizontal, FileSignature, Send, Trash2, CreditCard, AlertTriangle, Clock, Check, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, parseLocalDate } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Invoice, useInvoiceLines } from '@/hooks/useInvoices';

import { useCustomers } from '@/hooks/useCustomers';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useSalesTaxSettings } from '@/hooks/useSalesTax';
import { InvoicePreviewTab } from './InvoicePreviewTab';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { getDocumentLogoUrl } from '@/lib/getDocumentLogo';
import { supabase } from '@/integrations/supabase/client';
import { useDefaultSignature } from '@/hooks/useUserSignatures';
import { usePaymentLinks } from '@/hooks/usePaymentLinks';
import { toast } from 'sonner';
import { differenceInDays } from 'date-fns';
import { useConfirmDelete } from '@/hooks/useConfirmDelete';

interface InvoiceDetailPanelProps {
  invoice: Invoice;
  onEdit: () => void;
  onShare: () => void;
  onRecordPayment: () => void;
  onDownloadPdf: () => void;
  onSignatureRequest: () => void;
  onStatusChange: (status: string) => void;
  onVoidInvoice: () => void;
  onDeleteInvoice: () => void;
  isReadOnly?: boolean;
}

export function InvoiceDetailPanel({
  invoice,
  onEdit,
  onShare,
  onRecordPayment,
  onDownloadPdf,
  onSignatureRequest,
  onStatusChange,
  onVoidInvoice,
  onDeleteInvoice,
  isReadOnly,
}: InvoiceDetailPanelProps) {
  const confirmDelete = useConfirmDelete();
  const { organization } = useCurrentOrganization();
  const { customers } = useCustomers();
  const { lines: invoiceLines } = useInvoiceLines(invoice.id);
  
  const { data: taxSettings } = useSalesTaxSettings(organization?.id);
  const { data: defaultSignatureData } = useDefaultSignature();
  
  const [sellerSignatureData, setSellerSignatureData] = useState<string | null>(null);
  const [payingMethod, setPayingMethod] = useState<'cc' | 'ach' | 'interac' | null>(null);
  const { create: createPaymentLink } = usePaymentLinks();

  const handlePayOnline = async (method: 'cc' | 'ach' | 'interac') => {
    if (!invoice.id) return;
    const amount = Number(invoice.balance_due ?? invoice.total ?? 0);
    if (!(amount > 0)) {
      toast.error('Nothing to pay — balance is zero.');
      return;
    }
    const payment_method =
      method === 'cc' ? 'any_card' : method === 'ach' ? 'eft' : 'all';
    const instant_payment = method === 'interac';
    const instant_method = method === 'interac' ? 'interac_etransfer' : null;
    try {
      setPayingMethod(method);
      const link = await createPaymentLink.mutateAsync({
        amount,
        currency: invoice.currency || 'CAD',
        description: `Invoice ${invoice.invoice_number}`,
        invoice_id: invoice.id,
        customer_id: invoice.customer_id ?? null,
        payment_method: payment_method as 'any_card' | 'eft' | 'all',
        payer_name: invoice.buyer_name ?? invoice.customer?.name ?? null,
        payer_email: invoice.buyer_email ?? null,
        instant_payment,
        instant_method,
      });
      const url = link.hosted_url ?? `${window.location.origin}/pay/${link.id}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Could not start payment: ${msg}`);
    } finally {
      setPayingMethod(null);
    }
  };


  const countryCode = organization?.country || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);
  const customer = customers.find(c => c.id === invoice.customer_id);

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

  // Load seller signature
  useEffect(() => {
    const loadSig = async () => {
      const extInv = invoice as Invoice & { seller_signature_id?: string };
      if (extInv.seller_signature_id) {
        const { data } = await supabase
          .from('user_signatures')
          .select('signature_data')
          .eq('id', extInv.seller_signature_id)
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
    loadSig();
  }, [invoice, defaultSignatureData]);

  const status = statusConfig[invoice.status] || statusConfig.draft;
  const balance = Number(invoice.balance_due);
  const isOverdue = invoice.status === 'overdue';
  const overdueDays = isOverdue ? differenceInDays(new Date(), parseLocalDate(invoice.due_date)) : 0;

  const extendedInvoice = invoice as Invoice & {
    buyer_signature_data?: string;
    buyer_signature_date?: string;
    custom_fields?: { id: string; label: string; value: string; type: 'text' | 'number' | 'date' }[];
  };

  // Build buyer address
  const buyerAddress = [
    invoice.buyer_address_line1,
    invoice.buyer_address_line2,
    invoice.buyer_city && invoice.buyer_province
      ? `${invoice.buyer_city}, ${invoice.buyer_province} ${invoice.buyer_postal_code || ''}`.trim()
      : invoice.buyer_city || invoice.buyer_province || '',
    invoice.buyer_country,
  ].filter(Boolean).join('\n');

  // Status banner message
  const getStatusBanner = () => {
    if (invoice.status === 'overdue') {
      return {
        icon: AlertTriangle,
        color: 'border-destructive/30 bg-destructive/5 text-destructive',
        title: `Payment is overdue by ${overdueDays} day${overdueDays !== 1 ? 's' : ''}.`,
        action: 'Send a payment reminder or record a payment.',
      };
    }
    if (invoice.status === 'draft') {
      return {
        icon: Info,
        color: 'border-blue-300 bg-blue-50 text-blue-700',
        title: 'This invoice is a draft.',
        action: 'Mark it as issued or send it to the customer.',
      };
    }
    if (invoice.status === 'sent' || invoice.status === 'issued') {
      return {
        icon: Clock,
        color: 'border-warning/30 bg-warning/5 text-warning',
        title: 'Awaiting payment.',
        action: `Balance due: ${new Intl.NumberFormat(locale, { style: 'currency', currency: localization.currency }).format(balance)}`,
      };
    }
    if (invoice.status === 'paid') {
      return {
        icon: Check,
        color: 'border-success/30 bg-success/5 text-success',
        title: 'This invoice has been paid in full.',
        action: '',
      };
    }
    return null;
  };

  const banner = getStatusBanner();

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b bg-background flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">{invoice.invoice_number}</h2>
          <Badge className={cn("text-xs", status.color)}>{status.label}</Badge>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {!isReadOnly && !['void', 'paid'].includes(invoice.status) && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="w-3.5 h-3.5 mr-1" />
              Edit
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onShare}>
            <Mail className="w-3.5 h-3.5 mr-1" />
            Send
          </Button>
          <Button variant="outline" size="sm" onClick={onShare}>
            <Share2 className="w-3.5 h-3.5 mr-1" />
            Share
          </Button>

          {/* PDF/Print Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <FileText className="w-3.5 h-3.5 mr-1" />
                PDF/Print
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onDownloadPdf}>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDownloadPdf}>
                <Printer className="w-4 h-4 mr-2" />
                Print
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Record Payment */}
          {!isReadOnly && ['sent', 'partial', 'issued', 'overdue'].includes(invoice.status) && (
            <Button variant="outline" size="sm" onClick={onRecordPayment}>
              <CreditCard className="w-3.5 h-3.5 mr-1" />
              Record Payment
            </Button>
          )}


          {/* More Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!isReadOnly && invoice.status === 'draft' && (
                <>
                  <DropdownMenuItem onClick={() => onStatusChange('issued')}>
                    <FileText className="w-4 h-4 mr-2" />
                    Mark as Issued
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onStatusChange('sent')}>
                    <Send className="w-4 h-4 mr-2" />
                    Send to Customer
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={onSignatureRequest}>
                <FileSignature className="w-4 h-4 mr-2" />
                Request Signature
              </DropdownMenuItem>
              {!isReadOnly && invoice.status !== 'void' && invoice.status !== 'paid' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={onVoidInvoice}>
                    Void Invoice
                  </DropdownMenuItem>
                </>
              )}
              {!isReadOnly && (invoice.status === 'void' || invoice.status === 'issued') && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => confirmDelete(() => onDeleteInvoice?.(), { title: 'Delete invoice?' })}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Invoice
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Status Banner */}
        {banner && (
          <div className={cn("flex items-start gap-3 p-3 rounded-lg border", banner.color)}>
            <banner.icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">{banner.title}</p>
              {banner.action && <p className="text-xs mt-0.5 opacity-80">{banner.action}</p>}
            </div>
          </div>
        )}


        {/* Invoice Preview */}
        <InvoicePreviewTab
          hideSignatureControls
          documentTitle={invoice.document_title || 'Invoice'}
          invoiceNumber={invoice.invoice_number}
          invoiceDate={invoice.invoice_date}
          dueDate={invoice.due_date}
          customerName={customer?.name || invoice.customer?.name}
          buyerName={invoice.buyer_name || undefined}
          attentionOf={(invoice as any).attention_of || undefined}
          buyerEmail={invoice.buyer_email || undefined}
          buyerPhone={invoice.buyer_phone || undefined}
          buyerAddress={buyerAddress || undefined}
          lines={invoiceLines.map(line => ({
            description: line.description,
            quantity: line.quantity,
            unit_price: line.unit_price,
            tax_rate: line.tax_rate || 0,
            notes: (line as any).notes || undefined,
          }))}
          notes={invoice.notes || undefined}
          terms={invoice.terms || undefined}
          isGstHstExempt={invoice.is_gst_hst_exempt}
          isPstExempt={invoice.is_pst_exempt}
          customFields={extendedInvoice.custom_fields}
          organizationName={organization?.name}
          organizationAddress={[
            organization?.address_line1,
            organization?.city && organization?.province
              ? `${organization.city}, ${organization.province}, ${organization?.postal_code || ''}`
              : '',
            organization?.country,
          ].filter(Boolean).join('\n')}
          organizationEmail={invoice.seller_email || organization?.email || undefined}
          organizationPhone={invoice.seller_phone || organization?.phone || undefined}
          logoUrl={getDocumentLogoUrl(organization, 'invoice') || undefined}
          dealerPermitNumber={invoice.dealer_permit_number || organization?.dealer_permit_number || undefined}
          gstHstNumber={invoice.gst_hst_number || organization?.gst_hst_number || undefined}
          pstNumber={invoice.pst_number || organization?.pst_number || undefined}
          currency={localization.currency}
          locale={locale}
          sellerSignature={sellerSignatureData}
          buyerSignature={extendedInvoice.buyer_signature_data || undefined}
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
          showSellerSignature={!!sellerSignatureData}
          showBuyerSignature={!!extendedInvoice.buyer_signature_data}
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
          ccPaymentUrl={organization?.invoice_cc_payment_url || undefined}
          discountAmount={Number((invoice as any).discount_amount) || 0}
          shippingCharges={Number((invoice as any).shipping_charges) || 0}
          adjustment={Number((invoice as any).adjustment) || 0}
          adjustmentLabel={(invoice as any).adjustment_label || undefined}
          orderNumber={(invoice as any).order_number || undefined}
          subject={(invoice as any).subject || undefined}
          onPayOnline={
            organization?.invoice_enable_online_payments && Number(invoice.balance_due ?? 0) > 0 && invoice.status !== 'paid'
              ? handlePayOnline
              : undefined
          }
          payingMethod={payingMethod}
        />

        {/* Additional Info Sections */}
        {invoice.notes && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-1">Notes</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}

        {invoice.terms && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-1">Terms & Conditions</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.terms}</p>
          </div>
        )}
      </div>
    </div>
  );
}
