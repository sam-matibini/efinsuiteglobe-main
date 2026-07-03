import { useState } from 'react';
import { Mail, MessageSquare, Phone, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useTwilioShare } from '@/hooks/useTwilioShare';
import { generateDonationReceiptWithLogo } from '@/lib/print/donationReceiptGenerator';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';
import type { DonationReceipt } from '@/types/donations';

interface ShareReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: DonationReceipt;
}

export function ShareReceiptDialog({ open, onOpenChange, receipt }: ShareReceiptDialogProps) {
  const [channel, setChannel] = useState<'email' | 'whatsapp' | 'sms'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const { shareWhatsApp, shareSMS } = useTwilioShare();
  const { organization } = useCurrentOrganization();
  const logoUrl = (() => {
    if (organization?.receipt_show_logo === false) return undefined;
    return organization?.receipt_logo_url || organization?.logo_url;
  })();

  const taxYear = new Date(receipt.date_of_donation).getFullYear();
  const defaultMessage = `Your official donation receipt (${receipt.receipt_number}) for tax year ${taxYear} — Eligible amount: $${receipt.eligible_amount.toFixed(2)} CAD.`;

  const [message, setMessage] = useState(defaultMessage);

  const handleSendEmail = async () => {
    if (!email) { toast.error('Please enter an email address'); return; }
    setSending(true);
    try {
      const doc = await generateDonationReceiptWithLogo(receipt, logoUrl);
      const base64 = doc.output('datauristring').split(',')[1];

      const { data, error } = await supabase.functions.invoke('resend-integration', {
        body: {
          action: 'send-email',
          to: email,
          subject: `Official Donation Receipt — ${receipt.receipt_number}`,
          html: `<p>Dear ${receipt.donor_name},</p><p>Please find your official donation receipt attached.</p><p>Receipt #: ${receipt.receipt_number}<br/>Tax Year: ${taxYear}<br/>Eligible Amount: $${receipt.eligible_amount.toFixed(2)} CAD</p><p>Thank you for your generous contribution.</p>`,
          attachments: [{ content: base64, filename: `Receipt-${receipt.receipt_number}.pdf`, type: 'application/pdf' }],
        },
      });

      if (error || !data?.success) throw new Error(error?.message || data?.error || 'Failed to send');
      toast.success(`Receipt emailed to ${email}`);
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!phone) { toast.error('Please enter a phone number'); return; }
    setSending(true);
    try {
      await shareWhatsApp(phone, message);
      onOpenChange(false);
    } finally {
      setSending(false);
    }
  };

  const handleSendSMS = async () => {
    if (!phone) { toast.error('Please enter a phone number'); return; }
    setSending(true);
    try {
      await shareSMS(phone, message);
      onOpenChange(false);
    } finally {
      setSending(false);
    }
  };

  const handleSend = () => {
    if (channel === 'email') handleSendEmail();
    else if (channel === 'whatsapp') handleSendWhatsApp();
    else handleSendSMS();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Receipt — {receipt.receipt_number}</DialogTitle>
        </DialogHeader>

        <Tabs value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="email"><Mail className="w-4 h-4 mr-1" />Email</TabsTrigger>
            <TabsTrigger value="whatsapp"><MessageSquare className="w-4 h-4 mr-1" />WhatsApp</TabsTrigger>
            <TabsTrigger value="sms"><Phone className="w-4 h-4 mr-1" />SMS</TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-3 mt-3">
            <div>
              <Label>Recipient Email</Label>
              <Input type="email" placeholder="donor@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="text-xs text-muted-foreground">PDF will be attached to the email.</div>
          </TabsContent>

          <TabsContent value="whatsapp" className="space-y-3 mt-3">
            <div>
              <Label>Phone Number</Label>
              <Input type="tel" placeholder="+1234567890" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
            </div>
          </TabsContent>

          <TabsContent value="sms" className="space-y-3 mt-3">
            <div>
              <Label>Phone Number</Label>
              <Input type="tel" placeholder="+1234567890" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
            </div>
          </TabsContent>
        </Tabs>

        {/* Receipt summary */}
        <div className="rounded-md border p-3 text-sm space-y-1 bg-muted/30">
          <div className="flex justify-between"><span className="text-muted-foreground">Donor</span><span className="font-medium">{receipt.donor_name}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Tax Year</span><span>{taxYear}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Eligible</span><span className="font-medium text-success">${receipt.eligible_amount.toFixed(2)}</span></div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
