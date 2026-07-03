/**
 * Generic Document Share Dialog
 * Share any business document (Quote, Bill, PO, Credit Note, Vendor Credit,
 * Recurring Invoice/Bill, Expense Claim, Customer/Vendor Payment) via
 * Email, WhatsApp, SMS, or Print/PDF.
 *
 * Reuses the same flow as InvoiceShareDialog but is parameterized by `kind`.
 */

import { useEffect, useState } from 'react';
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
import { copyTextToClipboard, openWhatsAppShare } from '@/lib/share';
import { generateInvoicePdf, generateInvoicePdfDoc } from '@/lib/generateInvoicePdf';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getDocumentLogoUrl } from '@/lib/getDocumentLogo';

export type DocumentKind =
  | 'quote'
  | 'bill'
  | 'purchase_order'
  | 'credit_note'
  | 'vendor_credit'
  | 'recurring_invoice'
  | 'recurring_bill'
  | 'expense_claim'
  | 'customer_payment'
  | 'vendor_payment';

const KIND_LABEL: Record<DocumentKind, string> = {
  quote: 'Quote',
  bill: 'Bill',
  purchase_order: 'Purchase Order',
  credit_note: 'Credit Note',
  vendor_credit: 'Vendor Credit',
  recurring_invoice: 'Recurring Invoice',
  recurring_bill: 'Recurring Bill',
  expense_claim: 'Expense Claim',
  customer_payment: 'Payment Receipt',
  vendor_payment: 'Remittance Advice',
};

const KIND_LINES_TABLE: Partial<Record<DocumentKind, { table: string; fk: string }>> = {
  quote: { table: 'quote_lines', fk: 'quote_id' },
  bill: { table: 'bill_lines', fk: 'bill_id' },
  purchase_order: { table: 'purchase_order_lines', fk: 'purchase_order_id' },
  credit_note: { table: 'credit_note_lines', fk: 'credit_note_id' },
  vendor_credit: { table: 'vendor_credit_lines', fk: 'vendor_credit_id' },
  recurring_invoice: { table: 'recurring_invoice_lines', fk: 'recurring_invoice_id' },
  recurring_bill: { table: 'recurring_bill_lines', fk: 'recurring_bill_id' },
  expense_claim: { table: 'expense_claim_lines', fk: 'claim_id' },
};

export interface ShareContact {
  name?: string;
  email?: string;
  phone?: string;
}

export interface ShareableDocument {
  id: string;
  number: string;
  date?: string;
  dueDate?: string;
  total: number;
  balanceDue?: number;
  notes?: string;
  terms?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: DocumentKind;
  document: ShareableDocument | null;
  contact: ShareContact | null;
  defaultTab?: 'email' | 'whatsapp' | 'sms' | 'print';
}

interface LineRow {
  description: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  amount?: number | null;
  tax_rate?: number | null;
  tax_amount?: number | null;
}

export function DocumentShareDialog({ open, onOpenChange, kind, document, contact, defaultTab }: Props) {
  const [activeTab, setActiveTab] = useState<'email' | 'whatsapp' | 'sms' | 'print'>(defaultTab || 'email');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [lines, setLines] = useState<LineRow[]>([]);

  const { sendEmail } = useMessaging();
  const { organization } = useCurrentOrganization();
  const countryCode = organization?.country || 'CA';
  const localization = getCountryLocalization(countryCode);

  const documentTitle = KIND_LABEL[kind];

  useEffect(() => {
    if (open && defaultTab) setActiveTab(defaultTab);
  }, [open, defaultTab]);

  useEffect(() => {
    if (open && contact) {
      setRecipientEmail(contact.email || '');
      setRecipientPhone(contact.phone || '');
      setCustomMessage('');
    }
  }, [open, contact]);

  useEffect(() => {
    const loadLines = async () => {
      const map = KIND_LINES_TABLE[kind];
      if (!open || !document?.id || !map) {
        setLines([]);
        return;
      }
      const { data } = await supabase
        .from(map.table as any)
        .select('description, quantity, unit_price, amount, tax_rate, tax_amount')
        .eq(map.fk, document.id);
      setLines(((data as unknown) as LineRow[]) || []);
    };
    loadLines();
  }, [open, kind, document?.id]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-CA', { style: 'currency', currency: localization.currency }).format(value);

  const getSummary = () => {
    if (!document) return '';
    const amount = document.balanceDue ?? document.total;
    const dueLine = document.dueDate
      ? `\nDue Date: ${format(parseLocalDate(document.dueDate), 'MMMM d, yyyy')}`
      : '';
    return `${documentTitle} #${document.number}\nAmount: ${formatCurrency(amount)}${dueLine}`;
  };

  const getDefaultMessage = () => {
    if (!document || !organization) return '';
    return `Dear ${contact?.name || 'Customer'},

Please find attached your ${documentTitle.toLowerCase()} #${document.number} from ${organization.name}.

${getSummary()}

If you have any questions, please don't hesitate to contact us.

Best regards,
${organization.name}`;
  };

  const buildPdfData = () => {
    if (!document) return null;
    return {
      invoiceNumber: document.number,
      invoiceDate: document.date ? format(parseLocalDate(document.date), 'MMMM d, yyyy') : '',
      dueDate: document.dueDate ? format(parseLocalDate(document.dueDate), 'MMMM d, yyyy') : '',
      status: 'sent',
      documentTitle,
      customerName: contact?.name || '',
      customerEmail: contact?.email || undefined,
      customerPhone: contact?.phone || undefined,
      lines: lines.map((l) => ({
        description: l.description || '',
        quantity: Number(l.quantity || 0),
        unitPrice: Number(l.unit_price || 0),
        amount: Number(l.amount || 0),
        taxRate: Number(l.tax_rate || 0),
        taxAmount: Number(l.tax_amount || 0),
      })),
      subtotal: Number(document.total),
      taxAmount: 0,
      total: Number(document.total),
      amountPaid: document.balanceDue != null ? Number(document.total) - Number(document.balanceDue) : 0,
      balanceDue: Number(document.balanceDue ?? document.total),
      notes: document.notes || undefined,
      terms: document.terms || undefined,
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
    } as any;
  };

  const generatePdfBlob = async (): Promise<Blob | null> => {
    const data = buildPdfData();
    if (!data) return null;
    try {
      const doc = await generateInvoicePdfDoc(data);
      return doc.output('blob');
    } catch (e) {
      console.error('PDF generation failed:', e);
      return null;
    }
  };

  const uploadPdfForSharing = async (): Promise<string | null> => {
    const blob = await generatePdfBlob();
    if (!blob || !document) return null;
    const path = `shared-${kind}/${document.id}/${Date.now()}.pdf`;
    const { error } = await supabase.storage
      .from('documents')
      .upload(path, blob, { contentType: 'application/pdf', upsert: true });
    if (error) {
      console.error('Upload failed:', error);
      return null;
    }
    const { data } = supabase.storage.from('documents').getPublicUrl(path);
    return data?.publicUrl || null;
  };

  const handleSendEmail = async () => {
    if (!recipientEmail || !document) {
      toast.error('Please enter a recipient email');
      return;
    }
    setIsSending(true);
    try {
      const message = customMessage || getDefaultMessage();
      const subject = `${documentTitle} #${document.number} from ${organization?.name || 'eFinsuite'}`;

      const pdfBlob = await generatePdfBlob();
      let pdfBase64: string | undefined;
      if (pdfBlob) {
        const buf = await pdfBlob.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let bin = '';
        bytes.forEach((b) => (bin += String.fromCharCode(b)));
        pdfBase64 = btoa(bin);
      }

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1e40af, #1e3a8a); padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">${organization?.name || 'eFinsuite'}</h1>
          </div>
          <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb;">
            <h2 style="color: #1e40af; margin-bottom: 16px;">${documentTitle} #${document.number}</h2>
            <div style="white-space: pre-wrap; font-size: 14px; line-height: 1.6; color: #374151;">
              ${message.replace(/\n/g, '<br>')}
            </div>
            ${pdfBase64 ? '<p style="font-size: 12px; color: #6b7280; margin-top: 16px;">📎 PDF document attached.</p>' : ''}
          </div>
        </div>`;

      const attachments = pdfBase64
        ? [{
            content: pdfBase64,
            filename: `${documentTitle.replace(/\s+/g, '-')}-${document.number}.pdf`,
            mimeType: 'application/pdf',
          }]
        : undefined;

      const orgRecord = (organization ?? {}) as unknown as Record<string, unknown>;
      const branding = {
        displayName:
          (orgRecord.email_from_name as string | undefined) ||
          organization?.name ||
          undefined,
        email:
          (orgRecord.email_from_address as string | undefined) ||
          (orgRecord.email as string | undefined) ||
          undefined,
      };

      const result = await sendEmail(
        recipientEmail,
        subject,
        message,
        html,
        'sendgrid',
        undefined,
        attachments,
        branding,
      );
      if (result.success) {
        toast.success(`${documentTitle} sent via email`);
        onOpenChange(false);
      } else {
        toast.error(result.error || 'Failed to send email', { duration: 10000 });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      toast.error('Failed to send email: ' + msg, { duration: 10000 });
    } finally {
      setIsSending(false);
    }
  };


  const handleSendWhatsApp = async () => {
    if (!document) return;
    setIsSending(true);
    try {
      const message = `*${organization?.name || 'eFinsuite'}*\n\n${customMessage || getSummary()}\n\n_${documentTitle} #${document.number}_`;
      const pdfUrl = await uploadPdfForSharing();
      if (recipientPhone) {
        const { data, error } = await supabase.functions.invoke('twilio-send-message', {
          body: {
            action: 'send',
            channel: 'whatsapp',
            to: recipientPhone,
            message,
            ...(pdfUrl ? { mediaUrls: [pdfUrl] } : {}),
          },
        });
        if (error || !data?.success) {
          const pdfData = buildPdfData();
          if (pdfData) {
            await generateInvoicePdf(pdfData);
            toast.info('PDF downloaded — attach it in WhatsApp');
          }
          await openWhatsAppShare(message);
        } else {
          toast.success(`${documentTitle} sent via WhatsApp`);
        }
      } else {
        const pdfData = buildPdfData();
        if (pdfData) {
          await generateInvoicePdf(pdfData);
          toast.info('PDF downloaded — attach it in WhatsApp');
        }
        await openWhatsAppShare(message);
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Failed to open WhatsApp: ' + e.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendSMS = async () => {
    if (!document) return;
    setIsSending(true);
    try {
      const amount = document.balanceDue ?? document.total;
      const dueBit = document.dueDate
        ? ` due ${format(parseLocalDate(document.dueDate), 'MMM d')}`
        : '';
      const message = `${organization?.name || 'eFinsuite'}: ${documentTitle} #${document.number} - ${formatCurrency(amount)}${dueBit}. ${customMessage || ''}`.trim();
      const pdfUrl = await uploadPdfForSharing();
      if (recipientPhone) {
        const { data, error } = await supabase.functions.invoke('twilio-send-message', {
          body: {
            action: 'send',
            channel: 'sms',
            to: recipientPhone,
            message,
            ...(pdfUrl ? { mediaUrls: [pdfUrl] } : {}),
          },
        });
        if (error || !data?.success) {
          const pdfData = buildPdfData();
          if (pdfData) {
            await generateInvoicePdf(pdfData);
            toast.info('PDF downloaded — attach it in your message');
          }
          window.location.href = `sms:${recipientPhone}?body=${encodeURIComponent(message)}`;
        } else {
          toast.success(`${documentTitle} sent via SMS`);
        }
      } else {
        const pdfData = buildPdfData();
        if (pdfData) {
          await generateInvoicePdf(pdfData);
          toast.info('PDF downloaded — attach it in your message');
        }
        window.location.href = `sms:?body=${encodeURIComponent(message)}`;
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Failed to send SMS: ' + e.message);
    } finally {
      setIsSending(false);
    }
  };

  const handlePrintPdf = async () => {
    const data = buildPdfData();
    if (data) {
      await generateInvoicePdf(data);
      toast.success('PDF downloaded');
    }
  };

  const handleCopyLink = async () => {
    if (!document) return;
    const text = `${documentTitle} #${document.number}\n${getSummary()}`;
    const copied = await copyTextToClipboard(text);
    if (copied) {
      setIsCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  if (!document) return null;
  const amount = document.balanceDue ?? document.total;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            Share {documentTitle}
          </DialogTitle>
          <DialogDescription>
            Share {documentTitle} #{document.number} with {contact?.name || 'recipient'}
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
                  <Label htmlFor="doc-email-recipient">Recipient Email</Label>
                  <Input
                    id="doc-email-recipient"
                    type="email"
                    placeholder={contact?.email || 'recipient@example.com'}
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doc-email-message">Message (optional)</Label>
                  <Textarea
                    id="doc-email-message"
                    placeholder={getDefaultMessage()}
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={6}
                  />
                </div>
                <Button onClick={handleSendEmail} disabled={isSending || !recipientEmail} className="w-full">
                  {isSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                  Send Email
                </Button>
              </TabsContent>

              <TabsContent value="whatsapp" className="space-y-4 m-0">
                <div className="space-y-2">
                  <Label htmlFor="doc-wa-phone">Phone Number (optional)</Label>
                  <Input
                    id="doc-wa-phone"
                    type="tel"
                    placeholder="+1234567890"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Leave empty to open WhatsApp and choose a contact</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doc-wa-message">Custom Message (optional)</Label>
                  <Textarea
                    id="doc-wa-message"
                    placeholder={getSummary()}
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={4}
                  />
                </div>
                <Button onClick={handleSendWhatsApp} disabled={isSending} className="w-full">
                  {isSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageSquare className="w-4 h-4 mr-2" />}
                  Send via WhatsApp
                </Button>
              </TabsContent>

              <TabsContent value="sms" className="space-y-4 m-0">
                <div className="space-y-2">
                  <Label htmlFor="doc-sms-phone">Phone Number (optional)</Label>
                  <Input
                    id="doc-sms-phone"
                    type="tel"
                    placeholder="+1234567890"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Leave empty to open SMS app and choose a contact</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doc-sms-message">Additional Message (optional)</Label>
                  <Input
                    id="doc-sms-message"
                    placeholder="Thank you for your business!"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">SMS includes document summary automatically</p>
                </div>
                <Button onClick={handleSendSMS} disabled={isSending} className="w-full">
                  {isSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Phone className="w-4 h-4 mr-2" />}
                  Send SMS
                </Button>
              </TabsContent>

              <TabsContent value="print" className="space-y-4 m-0">
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <p className="text-sm font-medium">{documentTitle} #{document.number}</p>
                  {contact?.name && <p className="text-sm text-muted-foreground">Recipient: {contact.name}</p>}
                  <p className="text-sm text-muted-foreground">Amount: {formatCurrency(amount)}</p>
                  {document.dueDate && (
                    <p className="text-sm text-muted-foreground">
                      Due: {format(parseLocalDate(document.dueDate), 'MMMM d, yyyy')}
                    </p>
                  )}
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
