import { useState, useEffect } from 'react';
import { Plus, Download, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { parseLocalDate } from '@/lib/utils';
import { useInvoices, Invoice } from '@/hooks/useInvoices';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useSalesTaxSettings } from '@/hooks/useSalesTax';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { CreateInvoiceDialog } from '@/components/invoices/CreateInvoiceDialog';
import { ViewEditInvoiceDialog } from '@/components/invoices/ViewEditInvoiceDialog';
import { RecordPaymentDialog } from '@/components/payments/RecordPaymentDialog';
import { InvoiceShareDialog } from '@/components/invoices/InvoiceShareDialog';
import { InvoiceSignatureRequestDialog } from '@/components/invoices/InvoiceSignatureRequestDialog';
import { InvoiceListSidebar } from '@/components/invoices/InvoiceListSidebar';
import { InvoiceDetailPanel } from '@/components/invoices/InvoiceDetailPanel';
import { Skeleton } from '@/components/ui/skeleton';
import { generateInvoicePdf } from '@/lib/generateInvoicePdf';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { getDocumentLogoUrl } from '@/lib/getDocumentLogo';
import { isNpoIndustry } from '@/data/industries';
import { AICategorizeLinesDialog } from '@/components/ai/AICategorizeLinesDialog';
import { AICategorizationHealth } from '@/components/banking/AICategorizationHealth';
import { Sparkles } from 'lucide-react';
import { useConfirmDelete } from '@/hooks/useConfirmDelete';

export default function Invoices() {
  const confirmDelete = useConfirmDelete();
  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const isReadOnly = useIsReadOnly();
  const { 
    invoices, 
    isLoading, 
    totalOutstanding, 
    overdueAmount, 
    paidThisMonth,
    updateInvoiceStatus,
    voidInvoice,
    deleteInvoice,
  } = useInvoices();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [showAICatDialog, setShowAICatDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<{ invoiceId?: string; customerId?: string }>({});
  const [viewEditInvoice, setViewEditInvoice] = useState<{ invoice: Invoice | null; mode: 'view' | 'edit' }>({ invoice: null, mode: 'view' });
  const [shareInvoice, setShareInvoice] = useState<Invoice | null>(null);
  const [signatureRequestInvoice, setSignatureRequestInvoice] = useState<Invoice | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Get tax settings for rate lookup
  const { data: taxSettings } = useSalesTaxSettings(organization?.id);

  const countryCode = organization?.country || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  // Helper function to load image as base64
  const loadImageAsBase64 = async (url: string): Promise<string | null> => {
    if (!url) return null;
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Failed to load image:', error);
      return null;
    }
  };

  // Function to download invoice as PDF
  const handleDownloadPdf = async (invoice: Invoice) => {
    try {
      // Fetch invoice lines
      const linesResult = await supabase
        .from('invoice_lines')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('line_order');
      
      if (linesResult.error) throw linesResult.error;
      
      // Fetch customer
      const customerResult = await supabase
        .from('customers')
        .select('*')
        .eq('id', invoice.customer_id)
        .maybeSingle();
      
      const customer = customerResult.data;
      
      // Resolve invoice logo using centralized document logo resolver
      const resolvedLogoUrl = getDocumentLogoUrl(organization, 'invoice');
      
      // Fetch seller signature (default) - using any to avoid TS deep instantiation error
      let sellerSignatureData: string | null = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sigResult: any = await (supabase as any)
            .from('user_signatures')
            .select('signature_data')
            .eq('user_id', user.id)
            .eq('is_default', true)
            .maybeSingle();
          sellerSignatureData = sigResult?.data?.signature_data || null;
        }
      } catch {
        // Ignore signature errors
      }

      // Pre-load logo as base64 to ensure it's embedded in PDF
      let logoBase64: string | null = null;
      if (resolvedLogoUrl) {
        logoBase64 = await loadImageAsBase64(resolvedLogoUrl);
      }

      // Parse custom fields from invoice
      const customFields = invoice.custom_fields && Array.isArray(invoice.custom_fields)
        ? (invoice.custom_fields as { id: string; label: string; value: string; type: 'text' | 'number' | 'date' }[])
        : undefined;

      await generateInvoicePdf({
        invoiceNumber: invoice.invoice_number,
        invoiceDate: parseLocalDate(invoice.invoice_date).toLocaleDateString('en-CA'),
        dueDate: parseLocalDate(invoice.due_date).toLocaleDateString('en-CA'),
        status: invoice.status,
        documentTitle: invoice.document_title || 'Invoice',
        customerName: customer?.name || invoice.customer?.name || 'Unknown Customer',
        customerEmail: customer?.email || invoice.customer?.email || undefined,
        customerAddress: customer?.address_line1 || undefined,
        customerCity: customer?.city || undefined,
        customerProvince: customer?.province || undefined,
        customerPostalCode: customer?.postal_code || undefined,
        customerCountry: customer?.country || undefined,
        customerPhone: customer?.phone || undefined,
        // Buyer details (for Bill of Sale)
        buyerName: invoice.buyer_name || undefined,
        attentionOf: (invoice as any).attention_of || undefined,
        buyerEmail: invoice.buyer_email || undefined,
        buyerPhone: invoice.buyer_phone || undefined,
        buyerAddressLine1: invoice.buyer_address_line1 || undefined,
        buyerAddressLine2: invoice.buyer_address_line2 || undefined,
        buyerCity: invoice.buyer_city || undefined,
        buyerProvince: invoice.buyer_province || undefined,
        buyerPostalCode: invoice.buyer_postal_code || undefined,
        buyerCountry: invoice.buyer_country || undefined,
        lines: linesResult.data.map(line => ({
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unit_price,
          amount: line.amount,
          taxRate: line.tax_rate || undefined,
          taxAmount: line.tax_amount || undefined,
          notes: line.notes || undefined,
        })),
        subtotal: Number(invoice.subtotal),
        taxAmount: Number(invoice.tax_amount),
        gstHstAmount: invoice.gst_hst_amount != null ? Number(invoice.gst_hst_amount) : undefined,
        pstAmount: invoice.pst_amount != null ? Number(invoice.pst_amount) : undefined,
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
        logoUrl: resolvedLogoUrl || undefined,
        logoBase64: logoBase64 || undefined,
        currency: localization.currency,
        locale: locale,
        // Tax registration (for Bill of Sale)
        dealerPermitNumber: invoice.dealer_permit_number || organization?.dealer_permit_number || undefined,
        gstHstNumber: invoice.gst_hst_number || organization?.gst_hst_number || undefined,
        pstNumber: invoice.pst_number || organization?.pst_number || undefined,
        charityBn: (organization?.industry && isNpoIndustry(organization.industry)) ? (organization as any).business_number || undefined : undefined,
        // Tax rates from settings - only pass PST rate if org is in a PST province
        gstHstRate: taxSettings?.hst_rate || taxSettings?.gst_rate || 5,
        pstRate: taxSettings?.pst_rate && taxSettings.pst_rate > 0 ? taxSettings.pst_rate : undefined,
        // Tax exemptions
        isGstHstExempt: invoice.is_gst_hst_exempt || false,
        isPstExempt: invoice.is_pst_exempt || false,
        exemptionReason: invoice.exemption_reason || undefined,
        // Seller info
        sellerEmail: invoice.seller_email || organization?.email || undefined,
        sellerPhone: invoice.seller_phone || organization?.phone || undefined,
        // Signatures
        sellerSignatureData: sellerSignatureData || undefined,
        sellerSignatureName: organization?.name || undefined,
        buyerSignatureData: invoice.buyer_signature_data || undefined,
        buyerSignatureDate: invoice.buyer_signature_date 
          ? parseLocalDate(invoice.buyer_signature_date).toLocaleDateString('en-CA') 
          : undefined,
        // Custom fields
        customFields: customFields,
        // Footer & payment instructions from org settings
        footer: organization?.invoice_footer || undefined,
        paymentInstructions: organization?.invoice_show_payment_instructions
          ? organization?.invoice_payment_instructions || undefined
          : undefined,
        // Template settings for visual parity
        showLineNumbers: organization?.invoice_show_line_numbers ?? false,
        showQuantityColumn: organization?.invoice_show_quantity_column ?? true,
        showRateColumn: organization?.invoice_show_rate_column ?? true,
        // Signature visibility flags (passed from dialog state when available)
        showSellerSignature: !!sellerSignatureData,
        showBuyerSignature: !!(invoice as unknown as Record<string, unknown>).buyer_signature_data,
        // Payment methods from org settings
        enableOnlinePayments: !!organization?.invoice_enable_online_payments,
        creditCardEnabled: !!organization?.invoice_credit_card_enabled,
        achEnabled: !!organization?.invoice_ach_enabled,
        interacEnabled: !!organization?.invoice_interac_enabled,
        ccInstructions: organization?.invoice_cc_instructions || undefined,
        achInstitution: organization?.invoice_ach_institution || undefined,
        achAccountName: organization?.invoice_ach_account_name || undefined,
        achAccountNumber: organization?.invoice_ach_account_number || undefined,
        achTransitNumber: organization?.invoice_ach_transit_number || undefined,
        etransferEmail: organization?.invoice_etransfer_email || undefined,
        ccPaymentUrl: organization?.invoice_cc_payment_url || undefined,
      });
      
      toast.success('Invoice PDF downloaded');
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Failed to generate PDF');
    }
  };


  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(parseLocalDate(date));
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.customer?.name && inv.customer.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Auto-select first invoice when data loads or filter changes
  useEffect(() => {
    if (filteredInvoices.length > 0 && (!selectedInvoice || !filteredInvoices.find(inv => inv.id === selectedInvoice.id))) {
      setSelectedInvoice(filteredInvoices[0]);
    }
    if (filteredInvoices.length === 0) {
      setSelectedInvoice(null);
    }
  }, [filteredInvoices, selectedInvoice]);

  // Show org creation dialog if no organization
  if (!orgLoading && !organization) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Building2 className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Organization Found</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Create an organization to start managing invoices.
        </p>
        <Button onClick={() => setShowOrgDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Organization
        </Button>
        <CreateOrganizationDialog open={showOrgDialog} onOpenChange={setShowOrgDialog} />
      </div>
    );
  }

  if (isLoading || orgLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
          <p className="text-muted-foreground">Create and manage customer invoices</p>
        </div>
        <div className="flex items-center gap-3">
          <AICategorizationHealth context="revenue" label="Revenue AI acceptance" />
          {!isReadOnly && (
            <Button variant="outline" size="sm" onClick={() => setShowAICatDialog(true)}>
              <Sparkles className="w-4 h-4 mr-2" />
              AI Categorize Lines
            </Button>
          )}
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          {!isReadOnly && (
            <Button 
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={() => setShowInvoiceDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Invoice
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Invoices</p>
          <p className="text-2xl font-bold text-foreground">{invoices.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Outstanding</p>
          <p className="text-2xl font-bold text-warning">{formatCurrency(totalOutstanding)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Overdue</p>
          <p className="text-2xl font-bold text-destructive">{formatCurrency(overdueAmount)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Paid This Month</p>
          <p className="text-2xl font-bold text-success">{formatCurrency(paidThisMonth)}</p>
        </Card>
      </div>

      {/* Split Panel Layout */}
      <Card className="overflow-hidden" style={{ height: 'calc(100vh - 280px)' }}>
        <div className="flex h-full">
          {/* Left Sidebar */}
          <InvoiceListSidebar
            invoices={filteredInvoices}
            selectedInvoiceId={selectedInvoice?.id || null}
            onSelectInvoice={setSelectedInvoice}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            onNewInvoice={() => setShowInvoiceDialog(true)}
            isReadOnly={isReadOnly}
          />

          {/* Right Detail Panel */}
          {selectedInvoice ? (
            <InvoiceDetailPanel
              invoice={selectedInvoice}
              onEdit={() => setViewEditInvoice({ invoice: selectedInvoice, mode: 'edit' })}
              onShare={() => setShareInvoice(selectedInvoice)}
              onRecordPayment={() => {
                setSelectedInvoiceForPayment({ invoiceId: selectedInvoice.id, customerId: selectedInvoice.customer_id });
                setShowPaymentDialog(true);
              }}
              onDownloadPdf={() => handleDownloadPdf(selectedInvoice)}
              onSignatureRequest={() => setSignatureRequestInvoice(selectedInvoice)}
              onStatusChange={(status) => updateInvoiceStatus.mutate({ id: selectedInvoice.id, status: status as Invoice['status'] })}
              onVoidInvoice={() => voidInvoice.mutate(selectedInvoice.id)}
              onDeleteInvoice={() => {
                confirmDelete(() => {
                  deleteInvoice.mutate(selectedInvoice.id);
                }
              }}
              isReadOnly={isReadOnly}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <p>
                {invoices.length === 0
                  ? 'No invoices yet. Create your first invoice to get started.'
                  : 'Select an invoice to view details.'}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Dialogs */}
      <CreateInvoiceDialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog} />
      <ViewEditInvoiceDialog
        open={viewEditInvoice.invoice !== null}
        onOpenChange={(open) => !open && setViewEditInvoice({ invoice: null, mode: 'view' })}
        invoice={viewEditInvoice.invoice}
        mode={viewEditInvoice.mode}
      />
      <RecordPaymentDialog 
        open={showPaymentDialog} 
        onOpenChange={(open) => {
          setShowPaymentDialog(open);
          if (!open) setSelectedInvoiceForPayment({});
        }}
        preselectedInvoiceId={selectedInvoiceForPayment.invoiceId}
        preselectedCustomerId={selectedInvoiceForPayment.customerId}
      />
      <InvoiceShareDialog
        open={shareInvoice !== null}
        onOpenChange={(open) => !open && setShareInvoice(null)}
        invoice={shareInvoice}
      />
      <InvoiceSignatureRequestDialog
        open={signatureRequestInvoice !== null}
        onOpenChange={(open) => !open && setSignatureRequestInvoice(null)}
        invoice={signatureRequestInvoice}
      />
      <AICategorizeLinesDialog
        open={showAICatDialog}
        onOpenChange={setShowAICatDialog}
        target="invoice"
      />
    </div>
  );
}
