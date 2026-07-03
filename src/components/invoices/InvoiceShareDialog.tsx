/**
 * Invoice Share Dialog
 * Share invoices via Email, WhatsApp, SMS/MMS, or Print/PDF
 */

import { useState, useEffect } from 'react';
import { Mail, MessageSquare, Phone, Printer, Download, Copy, Check, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMessaging } from '@/hooks/useMessaging';
import { useTwilioShare } from '@/hooks/useTwilioShare';
import { copyTextToClipboard, openWhatsAppShare } from '@/lib/share';
import { generateInvoicePdf, generateInvoicePdfDoc } from '@/lib/generateInvoicePdf';
import { Invoice, useInvoiceLines } from '@/hooks/useInvoices';
import { useCustomers } from '@/hooks/useCustomers';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useDefaultSignature } from '@/hooks/useUserSignatures';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getDocumentLogoUrl } from '@/lib/getDocumentLogo';
import { isNpoIndustry } from '@/data/industries';
import { Checkbox } from '@/components/ui/checkbox';
import { useInvoicePaymentLink, type InvoicePayLink } from '@/hooks/useInvoicePaymentLink';


interface InvoiceShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  defaultTab?: 'email' | 'whatsapp' | 'sms' | 'print';
}

export function InvoiceShareDialog({ open, onOpenChange, invoice, defaultTab }: InvoiceShareDialogProps) {
  const [activeTab, setActiveTab] = useState<'email' | 'whatsapp' | 'sms' | 'print'>(defaultTab || 'email');

  // Sync activeTab when defaultTab or dialog opens
  useEffect(() => {
    if (open && defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [open, defaultTab]);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [sellerSignatureData, setSellerSignatureData] = useState<string | null>(null);
  const [payLink, setPayLink] = useState<InvoicePayLink | null>(null);
  const [includePayLink, setIncludePayLink] = useState<boolean>(true);
  const [linkLoading, setLinkLoading] = useState<boolean>(false);

  const { sendEmail } = useMessaging();
  const { shareSMS, shareWhatsApp } = useTwilioShare({ fallbackToApp: true });
  const { customers } = useCustomers();
  const { organization } = useCurrentOrganization();
  const { lines: invoiceLines } = useInvoiceLines(invoice?.id);
  const { data: defaultSignature } = useDefaultSignature();
  const { ensureLink } = useInvoicePaymentLink();


  const countryCode = organization?.country || 'CA';
  const localization = getCountryLocalization(countryCode);

  const customer = customers.find(c => c.id === invoice?.customer_id);
  const documentTitle = (invoice as any)?.document_title || 'Invoice';
  
  // Extended invoice fields
  const extendedInvoice = invoice as Invoice & {
    buyer_name?: string;
    buyer_signature_data?: string;
    buyer_signature_date?: string;
    custom_fields?: { id: string; label: string; value: string; type: 'text' | 'number' | 'date' }[];
    seller_signature_id?: string;
  };

  // Load seller signature
  useEffect(() => {
    const loadSellerSignature = async () => {
      // First try from invoice's seller_signature_id
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
      // Fall back to default signature
      if (defaultSignature?.signature_data) {
        setSellerSignatureData(defaultSignature.signature_data);
      }
    };
    
    if (open && invoice) {
      loadSellerSignature();
    }
  }, [open, invoice, defaultSignature, extendedInvoice?.seller_signature_id]);

  // Default the "Include Pay Now" checkbox from the org setting.
  useEffect(() => {
    const orgFlag = (organization as unknown as { invoice_auto_payment_link?: boolean } | null)
      ?.invoice_auto_payment_link;
    setIncludePayLink(orgFlag !== false);
  }, [organization]);

  // Ensure (find or create) a stable Pay Now link whenever the dialog opens
  // for an unpaid invoice with a positive balance.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!open || !invoice) {
        setPayLink(null);
        return;
      }
      const balance = Number(invoice.balance_due ?? 0);
      if (!(balance > 0) || invoice.status === 'paid' || invoice.status === 'void') {
        setPayLink(null);
        return;
      }
      setLinkLoading(true);
      try {
        const link = await ensureLink({
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          total: Number(invoice.total ?? 0),
          amount_paid: Number(invoice.amount_paid ?? 0),
          balance_due: balance,
          currency: invoice.currency || undefined,
          customer_id: invoice.customer_id ?? null,
          buyer_name: (invoice as Invoice & { buyer_name?: string }).buyer_name ?? null,
          buyer_email: (invoice as Invoice & { buyer_email?: string }).buyer_email ?? null,
          customer: customer ? { name: customer.name, email: customer.email } : null,
        });
        if (!cancelled) setPayLink(link);
      } catch (e) {
        console.error('ensure invoice pay link failed', e);
        if (!cancelled) setPayLink(null);
      } finally {
        if (!cancelled) setLinkLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice?.id]);


  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: localization.currency,
    }).format(value);
  };

  const getInvoiceSummary = () => {
    if (!invoice) return '';
    return `${documentTitle} #${invoice.invoice_number}
Amount Due: ${formatCurrency(Number(invoice.balance_due))}
Due Date: ${format(parseLocalDate(invoice.due_date), 'MMMM d, yyyy')}`;
  };

  const getDefaultMessage = () => {
    if (!invoice || !organization) return '';
    return `Dear ${customer?.name || 'Customer'},

Please find attached your ${documentTitle.toLowerCase()} #${invoice.invoice_number} from ${organization.name}.

${getInvoiceSummary()}

If you have any questions, please don't hesitate to contact us.

Best regards,
${organization.name}`;
  };

  const generatePdfData = () => {
    if (!invoice || !customer) return null;

    // Get organization-specific invoice settings
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
      lines: invoiceLines.map(line => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unit_price,
        amount: line.amount,
        taxRate: line.tax_rate || 0,
        taxAmount: line.tax_amount || 0,
      })),
      subtotal: Number(invoice.subtotal),
      taxAmount: Number(invoice.tax_amount),
      total: Number(invoice.total),
      amountPaid: Number(invoice.amount_paid),
      balanceDue: Number(invoice.balance_due),
      notes: invoice.notes || undefined,
      terms: invoice.terms || undefined,
      // Organization details
      organizationName: organization?.name,
      organizationAddress: organization?.address_line1 || undefined,
      organizationCity: organization?.city || undefined,
      organizationProvince: organization?.province || undefined,
      organizationPostalCode: organization?.postal_code || undefined,
      organizationCountry: organization?.country || undefined,
      organizationPhone: organization?.phone || undefined,
      organizationEmail: organization?.email || undefined,
      organizationWebsite: organization?.website || undefined,
      // Logo - use centralized document logo resolver
      logoUrl: getDocumentLogoUrl(organization, 'invoice') || undefined,
      currency: localization.currency,
      locale: countryCode === 'US' ? 'en-US' : 'en-CA',
      // Tax registration numbers
      dealerPermitNumber: (invoice as any).dealer_permit_number || organization?.dealer_permit_number || undefined,
      gstHstNumber: (invoice as any).gst_hst_number || organization?.gst_hst_number || undefined,
      pstNumber: (invoice as any).pst_number || organization?.pst_number || undefined,
      charityBn: (organization?.industry && isNpoIndustry(organization.industry)) ? (organization as any).business_number || undefined : undefined,
      // Tax exemptions
      isGstHstExempt: (invoice as any).is_gst_hst_exempt || false,
      isPstExempt: (invoice as any).is_pst_exempt || false,
      // Signatures
      sellerSignatureData: sellerSignatureData || undefined,
      sellerSignatureName: organization?.name || undefined,
      buyerSignatureData: extendedInvoice.buyer_signature_data || undefined,
      buyerSignatureDate: extendedInvoice.buyer_signature_date 
        ? format(new Date(extendedInvoice.buyer_signature_date), 'MMM d, yyyy')
        : undefined,
      // Custom fields
      customFields: extendedInvoice.custom_fields || undefined,
      // Payment instructions & footer
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
    };
  };

  /**
   * Generate PDF blob for attachment
   */
  const generatePdfBlob = async (): Promise<Blob | null> => {
    const pdfData = generatePdfData();
    if (!pdfData) return null;
    try {
      const doc = await generateInvoicePdfDoc(pdfData);
      return doc.output('blob');
    } catch (e) {
      console.error('Failed to generate PDF blob:', e);
      return null;
    }
  };

  const handleSendEmail = async () => {
    if (!recipientEmail || !invoice) {
      toast.error('Please enter a recipient email');
      return;
    }

    setIsSending(true);
    try {
      const baseMessage = customMessage || getDefaultMessage();
      const showPay = includePayLink && !!payLink;
      const message = showPay && payLink
        ? `${baseMessage}\n\nPay online: ${payLink.url}`
        : baseMessage;
      const subject = `${documentTitle} #${invoice.invoice_number} from ${organization?.name || 'eFinsuite Globe'}`;

      // Generate PDF attachment
      const pdfBlob = await generatePdfBlob();
      let pdfBase64: string | undefined;
      if (pdfBlob) {
        const arrayBuffer = await pdfBlob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        bytes.forEach(b => binary += String.fromCharCode(b));
        pdfBase64 = btoa(binary);
      }

      const payNowBlock = showPay && payLink ? `
            <div style="background: white; border: 1px solid #c7d2fe; border-radius: 8px; padding: 20px; margin-top: 24px; text-align: center;">
              <p style="margin: 0 0 12px 0; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Pay this invoice online</p>
              <a href="${payLink.url}" style="display: inline-block; background: #1e40af; color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">Pay ${formatCurrency(payLink.amount)} Now</a>
              <p style="margin: 12px 0 0 0; font-size: 12px; color: #6b7280;">Card, Debit, Visa Debit, EFT and Interac e-Transfer accepted.</p>
              <p style="margin: 6px 0 0 0; font-size: 11px; color: #9ca3af; word-break: break-all;">${payLink.url}</p>
            </div>
          ` : '';


      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1e40af, #1e3a8a); padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">${organization?.name || 'eFinsuite Globe'}</h1>
          </div>
          <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb;">
            <h2 style="color: #1e40af; margin-bottom: 16px;">${documentTitle} #${invoice.invoice_number}</h2>
            <div style="white-space: pre-wrap; font-size: 14px; line-height: 1.6; color: #374151;">
              ${message.replace(/\n/g, '<br>')}
            </div>
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-top: 24px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Amount Due:</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #1e40af; font-size: 18px;">
                    ${formatCurrency(Number(invoice.balance_due))}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Due Date:</td>
                  <td style="padding: 8px 0; text-align: right; color: #374151;">
                    ${format(parseLocalDate(invoice.due_date), 'MMMM d, yyyy')}
                  </td>
                </tr>
              </table>
            </div>
            ${payNowBlock}
            ${pdfBase64 ? '<p style="font-size: 12px; color: #6b7280; margin-top: 16px;">📎 PDF document attached.</p>' : ''}

          </div>
          <div style="background: #1e40af; padding: 16px; border-radius: 0 0 8px 8px; text-align: center;">
            <p style="color: rgba(255,255,255,0.8); margin: 0; font-size: 12px;">
              Powered by eFinsuite Globe
            </p>
          </div>
        </div>
      `;

      // Build attachments array with inline base64 content (not data URL)
      const attachments = pdfBase64 ? [{
        content: pdfBase64,
        filename: `${documentTitle.replace(/\s+/g, '-')}-${invoice.invoice_number}.pdf`,
        mimeType: 'application/pdf',
      }] : undefined;

      const result = await sendEmail(
        recipientEmail,
        subject,
        message,
        htmlContent,
        'sendgrid',
        undefined,
        attachments
      );

      if (result.success) {
        toast.success(`${documentTitle} sent via email with PDF attached`);
        onOpenChange(false);
      } else {
        toast.error(result.error || 'Failed to send email');
      }
    } catch (error: any) {
      toast.error('Failed to send email: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  /**
   * Upload PDF to storage and return a public URL for Twilio MMS/WhatsApp
   */
  const uploadPdfForSharing = async (): Promise<string | null> => {
    const pdfBlob = await generatePdfBlob();
    if (!pdfBlob || !invoice) return null;

    const filename = `shared-invoices/${invoice.id}/${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filename, pdfBlob, { contentType: 'application/pdf', upsert: true });

    if (uploadError) {
      console.error('Failed to upload PDF for sharing:', uploadError);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(filename);

    return urlData?.publicUrl || null;
  };

  const handleSendWhatsApp = async () => {
    if (!invoice) return;

    setIsSending(true);
    try {
      const payLine = includePayLink && payLink ? `\n\n💳 Pay online: ${payLink.url}` : '';
      const message = `*${organization?.name || 'eFinsuite Globe'}*\n\n${customMessage || getInvoiceSummary()}${payLine}\n\n_${documentTitle} #${invoice.invoice_number}_`;


      // Upload PDF and get public URL for Twilio media
      const pdfUrl = await uploadPdfForSharing();

      if (recipientPhone) {
        // Send via Twilio with PDF attachment
        const { data, error } = await supabase.functions.invoke("twilio-send-message", {
          body: {
            action: "send",
            channel: "whatsapp",
            to: recipientPhone,
            message,
            ...(pdfUrl ? { mediaUrls: [pdfUrl] } : {}),
          },
        });

        if (error || !data?.success) {
          // Fallback: download PDF and open WhatsApp app
          const pdfData = generatePdfData();
          if (pdfData) {
            await generateInvoicePdf(pdfData);
            toast.info('PDF downloaded — attach it in WhatsApp');
          }
          await openWhatsAppShare(message);
        } else {
          toast.success('Invoice sent via WhatsApp with PDF attached');
        }
      } else {
        // No recipient: download PDF and open WhatsApp picker
        const pdfData = generatePdfData();
        if (pdfData) {
          await generateInvoicePdf(pdfData);
          toast.info('PDF downloaded — attach it in WhatsApp');
        }
        await openWhatsAppShare(message);
      }
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Failed to open WhatsApp: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendSMS = async () => {
    if (!invoice) return;

    setIsSending(true);
    try {
      const payLine = includePayLink && payLink ? ` Pay: ${payLink.url}` : '';
      const message = `${organization?.name || 'eFinsuite Globe'}: ${documentTitle} #${invoice.invoice_number} - ${formatCurrency(Number(invoice.balance_due))} due ${format(parseLocalDate(invoice.due_date), 'MMM d')}.${payLine} ${customMessage || ''}`.trim();


      // Upload PDF and get public URL for Twilio MMS
      const pdfUrl = await uploadPdfForSharing();

      if (recipientPhone) {
        // Send via Twilio with PDF as MMS
        const { data, error } = await supabase.functions.invoke("twilio-send-message", {
          body: {
            action: "send",
            channel: "sms",
            to: recipientPhone,
            message,
            ...(pdfUrl ? { mediaUrls: [pdfUrl] } : {}),
          },
        });

        if (error || !data?.success) {
          // Fallback: download PDF and open SMS app
          const pdfData = generatePdfData();
          if (pdfData) {
            await generateInvoicePdf(pdfData);
            toast.info('PDF downloaded — attach it in your message');
          }
          window.location.href = `sms:${recipientPhone}?body=${encodeURIComponent(message)}`;
        } else {
          toast.success('Invoice sent via SMS/MMS with PDF attached');
        }
      } else {
        // No recipient: download PDF and open SMS
        const pdfData = generatePdfData();
        if (pdfData) {
          await generateInvoicePdf(pdfData);
          toast.info('PDF downloaded — attach it in your message');
        }
        window.location.href = `sms:?body=${encodeURIComponent(message)}`;
      }
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Failed to send SMS: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  const handlePrintPdf = () => {
    const pdfData = generatePdfData();
    if (pdfData) {
      generateInvoicePdf(pdfData);
      toast.success('PDF downloaded');
    }
  };

  const handleCopyLink = async () => {
    if (!invoice) return;
    
    const text = `${documentTitle} #${invoice.invoice_number}\n${getInvoiceSummary()}`;
    const copied = await copyTextToClipboard(text);
    
    if (copied) {
      setIsCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            Share {documentTitle}
          </DialogTitle>
          <DialogDescription>
            Share {documentTitle} #{invoice.invoice_number} with {customer?.name || 'customer'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="email" className="gap-1.5">
                <Mail className="w-4 h-4" />
                <span className="hidden sm:inline">Email</span>
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="gap-1.5">
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">WhatsApp</span>
              </TabsTrigger>
              <TabsTrigger value="sms" className="gap-1.5">
                <Phone className="w-4 h-4" />
                <span className="hidden sm:inline">SMS</span>
              </TabsTrigger>
              <TabsTrigger value="print" className="gap-1.5">
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Print</span>
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[300px] mt-4">
              <TabsContent value="email" className="space-y-4 m-0">
                <div className="space-y-2">
                  <Label htmlFor="email-recipient">Recipient Email</Label>
                  <Input
                    id="email-recipient"
                    type="email"
                    placeholder={customer?.email || 'customer@example.com'}
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-message">Message (optional)</Label>
                  <Textarea
                    id="email-message"
                    placeholder={getDefaultMessage()}
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={6}
                  />
                </div>
                {(payLink || linkLoading) && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="include-pay-link-email"
                        checked={includePayLink}
                        onCheckedChange={(v) => setIncludePayLink(v === true)}
                        disabled={!payLink}
                      />
                      <div className="flex-1 min-w-0">
                        <label
                          htmlFor="include-pay-link-email"
                          className="text-sm font-medium cursor-pointer"
                        >
                          Include Pay Now button
                        </label>
                        <p className="text-xs text-muted-foreground">
                          Lets the customer pay by card, debit, EFT or Interac e-Transfer.
                        </p>
                        {payLink && (
                          <p className="text-[11px] text-muted-foreground break-all mt-1">
                            {payLink.url}
                          </p>
                        )}
                        {linkLoading && !payLink && (
                          <p className="text-[11px] text-muted-foreground mt-1">Generating link…</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <Button 
                  onClick={handleSendEmail} 
                  disabled={isSending || !recipientEmail}
                  className="w-full"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4 mr-2" />
                  )}
                  Send Email
                </Button>
              </TabsContent>

              <TabsContent value="whatsapp" className="space-y-4 m-0">
                <div className="space-y-2">
                  <Label htmlFor="wa-phone">Phone Number (optional)</Label>
                  <Input
                    id="wa-phone"
                    type="tel"
                    placeholder="+1234567890"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to open WhatsApp and choose a contact
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wa-message">Custom Message (optional)</Label>
                  <Textarea
                    id="wa-message"
                    placeholder={getInvoiceSummary()}
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={4}
                  />
                </div>
                <Button 
                  onClick={handleSendWhatsApp} 
                  disabled={isSending}
                  className="w-full"
                  variant="default"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <MessageSquare className="w-4 h-4 mr-2" />
                  )}
                  Send via WhatsApp
                </Button>
              </TabsContent>

              <TabsContent value="sms" className="space-y-4 m-0">
                <div className="space-y-2">
                  <Label htmlFor="sms-phone">Phone Number (optional)</Label>
                  <Input
                    id="sms-phone"
                    type="tel"
                    placeholder="+1234567890"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to open SMS app and choose a contact
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sms-message">Additional Message (optional)</Label>
                  <Input
                    id="sms-message"
                    placeholder="Thank you for your business!"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    SMS includes invoice summary automatically
                  </p>
                </div>
                <Button 
                  onClick={handleSendSMS} 
                  disabled={isSending}
                  className="w-full"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Phone className="w-4 h-4 mr-2" />
                  )}
                  Send SMS
                </Button>
              </TabsContent>

              <TabsContent value="print" className="space-y-4 m-0">
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <p className="text-sm font-medium">{documentTitle} #{invoice.invoice_number}</p>
                  <p className="text-sm text-muted-foreground">Customer: {customer?.name}</p>
                  <p className="text-sm text-muted-foreground">Amount: {formatCurrency(Number(invoice.balance_due))}</p>
                  <p className="text-sm text-muted-foreground">Due: {format(parseLocalDate(invoice.due_date), 'MMMM d, yyyy')}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={handlePrintPdf} variant="default" className="gap-2">
                    <Download className="w-4 h-4" />
                    Download PDF
                  </Button>
                  <Button onClick={handleCopyLink} variant="outline" className="gap-2">
                    {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {isCopied ? 'Copied!' : 'Copy Details'}
                  </Button>
                </div>
                {payLink && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Pay Now link</p>
                        <p className="text-[11px] text-muted-foreground break-all">{payLink.url}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 shrink-0"
                        onClick={async () => {
                          const ok = await copyTextToClipboard(payLink.url);
                          if (ok) toast.success('Pay link copied');
                        }}
                      >
                        <Copy className="w-4 h-4" />
                        Copy link
                      </Button>
                    </div>
                    <div className="flex items-center gap-3">
                      <img
                        src={payLink.qrUrl}
                        alt="Pay Now QR code"
                        className="w-24 h-24 rounded border bg-white"
                      />
                      <div className="text-xs text-muted-foreground">
                        Scan to pay <span className="font-medium text-foreground">{formatCurrency(payLink.amount)}</span> via card, debit, EFT or Interac e-Transfer.
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

            </ScrollArea>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
