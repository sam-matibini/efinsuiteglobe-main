/**
 * Invoice Signature Request Dialog
 * Request digital signatures for invoices/Bill of Sales via email
 */

import { useState, useEffect } from 'react';
import { parseLocalDate } from '@/lib/utils';
import { FileSignature, Mail, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Invoice } from '@/hooks/useInvoices';
import { useCustomers } from '@/hooks/useCustomers';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useMessaging } from '@/hooks/useMessaging';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getCountryLocalization } from '@/data/countryLocalizations';

interface Signer {
  id: string;
  name: string;
  email: string;
  role: 'buyer' | 'seller' | 'witness';
  order: number;
}

interface InvoiceSignatureRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  onRequestSent?: () => void;
}

export function InvoiceSignatureRequestDialog({
  open,
  onOpenChange,
  invoice,
  onRequestSent,
}: InvoiceSignatureRequestDialogProps) {
  const [signers, setSigners] = useState<Signer[]>([]);
  const [customMessage, setCustomMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const { customers } = useCustomers();
  const { organization } = useCurrentOrganization();
  const { sendEmail } = useMessaging();

  const customer = customers.find(c => c.id === invoice?.customer_id);
  const documentTitle = (invoice as any)?.document_title || 'Invoice';
  const countryCode = organization?.country || 'CA';
  const localization = getCountryLocalization(countryCode);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: localization.currency,
    }).format(value);
  };

  // Initialize signers with customer info
  useEffect(() => {
    if (customer && open) {
      setSigners([
        {
          id: crypto.randomUUID(),
          name: customer.name,
          email: customer.email || '',
          role: 'buyer',
          order: 1,
        },
      ]);
      setCustomMessage('');
    }
  }, [customer, open]);

  const addSigner = () => {
    setSigners([
      ...signers,
      {
        id: crypto.randomUUID(),
        name: '',
        email: '',
        role: 'witness',
        order: signers.length + 1,
      },
    ]);
  };

  const removeSigner = (id: string) => {
    setSigners(signers.filter(s => s.id !== id));
  };

  const updateSigner = (id: string, field: keyof Signer, value: string) => {
    setSigners(signers.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    ));
  };

  const handleSendRequest = async () => {
    if (!invoice || signers.length === 0) {
      toast.error('Please add at least one signer');
      return;
    }

    const validSigners = signers.filter(s => s.name && s.email);
    if (validSigners.length === 0) {
      toast.error('Please provide name and email for all signers');
      return;
    }

    setIsSending(true);
    try {
      // Create signature token
      const signatureToken = crypto.randomUUID();

      // Send signature request emails to each signer
      for (const signer of validSigners) {
        const signingUrl = `${window.location.origin}/sign/${invoice.id}?token=${signatureToken}&email=${encodeURIComponent(signer.email)}`;
        
        const subject = `Signature Request: ${documentTitle} #${invoice.invoice_number}`;
        const message = customMessage || 
          `You have been requested to sign ${documentTitle} #${invoice.invoice_number} from ${organization?.name || 'eFinsuite Globe'}.`;

        const htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #1e40af, #1e3a8a); padding: 24px; border-radius: 8px 8px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Signature Request</h1>
              <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">${organization?.name || 'eFinsuite Globe'}</p>
            </div>
            <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb;">
              <p style="font-size: 16px; color: #374151;">Hi ${signer.name},</p>
              <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">${message}</p>
              
              <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <h3 style="margin: 0 0 12px; color: #1e40af;">${documentTitle} Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 6px 0; color: #6b7280;">${documentTitle} Number:</td>
                    <td style="padding: 6px 0; color: #374151; font-weight: 500;">#${invoice.invoice_number}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #6b7280;">Amount:</td>
                    <td style="padding: 6px 0; color: #1e40af; font-weight: bold; font-size: 18px;">${formatCurrency(Number(invoice.total))}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #6b7280;">Date:</td>
                    <td style="padding: 6px 0; color: #374151;">${format(parseLocalDate(invoice.invoice_date), 'MMMM d, yyyy')}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #6b7280;">Your Role:</td>
                    <td style="padding: 6px 0; color: #374151; text-transform: capitalize;">${signer.role}</td>
                  </tr>
                </table>
              </div>

              <div style="text-align: center; margin: 24px 0;">
                <a href="${signingUrl}" 
                   style="display: inline-block; background: linear-gradient(135deg, #1e40af, #1e3a8a); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Review &amp; Sign Document
                </a>
              </div>

              <p style="font-size: 12px; color: #9ca3af; text-align: center;">
                If the button doesn't work, copy and paste this link:<br>
                <a href="${signingUrl}" style="color: #1e40af;">${signingUrl}</a>
              </p>
              
              <p style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 16px;">
                This request expires in 30 days.
              </p>
            </div>
            <div style="background: #1e40af; padding: 16px; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="color: rgba(255,255,255,0.8); margin: 0; font-size: 12px;">
                Powered by eFinsuite Globe • Secure Digital Signatures
              </p>
            </div>
          </div>
        `;

        const result = await sendEmail(signer.email, subject, message, htmlContent);
        
        if (!result.success) {
          console.error(`Failed to send to ${signer.email}:`, result.error);
        }
      }

      // Update invoice status to indicate signature requested
      await supabase
        .from('invoices')
        .update({ status: 'sent' })
        .eq('id', invoice.id);

      toast.success(`Signature request sent to ${validSigners.length} recipient(s)`);
      onRequestSent?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Failed to send signature request: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-primary" />
            Request Signature
          </DialogTitle>
          <DialogDescription>
            Request digital signature for {documentTitle} #{invoice.invoice_number}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6 py-4 pr-4">
            {/* Document Summary */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <h4 className="text-sm font-medium mb-2">{documentTitle} Summary</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Number:</span>
                <span>#{invoice.invoice_number}</span>
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-semibold">{formatCurrency(Number(invoice.total))}</span>
                <span className="text-muted-foreground">Customer:</span>
                <span>{customer?.name}</span>
              </div>
            </div>

            <Separator />

            {/* Signers */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Signers</Label>
                <Button variant="outline" size="sm" onClick={addSigner}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Signer
                </Button>
              </div>

              {signers.map((signer, index) => (
                <div key={signer.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Signer {index + 1}</span>
                    {signers.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive h-8 w-8 p-0"
                        onClick={() => removeSigner(signer.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Name</Label>
                      <Input
                        placeholder="Full name"
                        value={signer.name}
                        onChange={(e) => updateSigner(signer.id, 'name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Role</Label>
                      <Select
                        value={signer.role}
                        onValueChange={(v) => updateSigner(signer.id, 'role', v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="buyer">Buyer</SelectItem>
                          <SelectItem value="seller">Seller</SelectItem>
                          <SelectItem value="witness">Witness</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      value={signer.email}
                      onChange={(e) => updateSigner(signer.id, 'email', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            {/* Custom Message */}
            <div className="space-y-2">
              <Label htmlFor="custom-message">Custom Message (optional)</Label>
              <Textarea
                id="custom-message"
                placeholder="Add a personalized message to include in the signature request email..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSendRequest} 
            disabled={isSending || signers.length === 0}
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Mail className="w-4 h-4 mr-2" />
            )}
            Send Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
