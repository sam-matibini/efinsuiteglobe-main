import { useState } from 'react';
import { Download, Printer, Mail, MessageCircle, Share2, Loader2, Eye, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useTwilioShare } from '@/hooks/useTwilioShare';
import { copyTextToClipboard } from '@/lib/share';
import { toast } from 'sonner';
import type { Document } from '@/hooks/useDocuments';

interface DocumentShareDialogProps {
  document: Document | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocumentShareDialog({
  document,
  open,
  onOpenChange,
}: DocumentShareDialogProps) {
  const [activeTab, setActiveTab] = useState('download');
  const [isLoading, setIsLoading] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [smsMessage, setSmsMessage] = useState('');

  const { shareSMS, shareWhatsApp } = useTwilioShare({ fallbackToApp: true });

  // Determine which file URL to use (signed PDF preferred, otherwise original)
  const getFileUrl = () => {
    if (document?.signed_pdf_url) return document.signed_pdf_url;
    if (document?.file_url) return document.file_url;
    return null;
  };

  // Initialize email content when document changes
  const initializeEmailContent = () => {
    if (document) {
      setEmailSubject(`Signed Document: ${document.title}`);
      setEmailMessage(`Please find attached the signed document "${document.title}".`);
    }
  };

  // Initialize SMS/WhatsApp content
  const initializeSmsContent = () => {
    if (document) {
      const fileUrl = getFileUrl();
      setSmsMessage(
        `Signed Document: ${document.title}\n\n` +
        (fileUrl ? `Download: ${fileUrl}` : 'Document attached.')
      );
    }
  };

  const handleViewDocument = () => {
    const fileUrl = getFileUrl();
    if (fileUrl) {
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
    } else {
      toast.error('No document file available');
    }
  };

  const handleDownload = async () => {
    const fileUrl = getFileUrl();
    if (!fileUrl) {
      toast.error('No document file available for download');
      return;
    }

    setIsLoading(true);
    try {
      // Fetch the file
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error('Failed to fetch document');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Create download link
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `${document?.title || 'document'}.pdf`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('Document downloaded');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download document');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = async () => {
    const fileUrl = getFileUrl();
    if (!fileUrl) {
      toast.error('No document file available for printing');
      return;
    }

    setIsLoading(true);
    try {
      // Open print in new window
      const printWindow = window.open(fileUrl, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 500);
        };
      } else {
        // Fallback: download instead
        toast.info('Pop-up blocked. Downloading instead...');
        await handleDownload();
      }
    } catch (error) {
      console.error('Print error:', error);
      toast.error('Failed to open print dialog');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailShare = async () => {
    if (!emailTo) {
      toast.error('Please enter an email address');
      return;
    }

    setIsLoading(true);
    try {
      const fileUrl = getFileUrl();
      
      // Use SendGrid edge function
      const { data, error } = await supabase.functions.invoke('resend-integration', {
        body: {
          action: 'send-email',
          to: emailTo,
          subject: emailSubject || `Signed Document: ${document?.title}`,
          message: emailMessage || `Please find the signed document "${document?.title}".`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1e40af;">Signed Document</h2>
              <p>${emailMessage || `Please find the signed document "${document?.title}".`}</p>
              ${fileUrl ? `
                <p>
                  <a href="${fileUrl}" 
                     style="display: inline-block; background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
                    Download Document
                  </a>
                </p>
              ` : ''}
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
              <p style="color: #999; font-size: 12px;">Sent via eFinsuite Globe</p>
            </div>
          `,
          attachmentUrl: fileUrl && (document?.file_size ?? 0) <= 10 * 1024 * 1024 ? fileUrl : undefined,
          attachmentFilename: fileUrl ? `${document?.title || 'document'}.pdf` : undefined,
          attachmentMimeType: 'application/pdf',
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Failed to send email');
      }

      toast.success(`Document sent to ${emailTo}`);
      setEmailTo('');
      onOpenChange(false);
    } catch (error) {
      console.error('Email error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWhatsAppShare = async () => {
    if (!phoneNumber) {
      toast.error('Please enter a phone number');
      return;
    }

    setIsLoading(true);
    try {
      const fileUrl = getFileUrl();
      const message = smsMessage || `Signed Document: ${document?.title}\n${fileUrl || ''}`;
      
      await shareWhatsApp(phoneNumber, message);
      onOpenChange(false);
    } catch (error) {
      console.error('WhatsApp error:', error);
      toast.error('Failed to share via WhatsApp');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSmsShare = async () => {
    if (!phoneNumber) {
      toast.error('Please enter a phone number');
      return;
    }

    setIsLoading(true);
    try {
      const fileUrl = getFileUrl();
      const message = smsMessage || `Signed Document: ${document?.title}\n${fileUrl || ''}`;
      
      await shareSMS(phoneNumber, message);
      onOpenChange(false);
    } catch (error) {
      console.error('SMS error:', error);
      toast.error('Failed to send SMS');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    const fileUrl = getFileUrl();
    if (!fileUrl) {
      toast.error('No document link available');
      return;
    }

    const copied = await copyTextToClipboard(fileUrl);
    if (copied) {
      toast.success('Document link copied to clipboard');
    } else {
      toast.error('Failed to copy link');
    }
  };

  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-accent" />
            Share Document
          </DialogTitle>
          <DialogDescription>
            View, download, print, or share "{document.title}"
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="download">Download</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
            <TabsTrigger value="sms">SMS</TabsTrigger>
          </TabsList>

          {/* Download & Print Tab */}
          <TabsContent value="download" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                className="h-24 flex-col gap-2"
                onClick={handleViewDocument}
              >
                <Eye className="w-6 h-6" />
                <span>View Document</span>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-24 flex-col gap-2"
                onClick={handleDownload}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <Download className="w-6 h-6" />
                )}
                <span>Download PDF</span>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-24 flex-col gap-2"
                onClick={handlePrint}
                disabled={isLoading}
              >
                <Printer className="w-6 h-6" />
                <span>Print</span>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-24 flex-col gap-2"
                onClick={handleCopyLink}
              >
                <Share2 className="w-6 h-6" />
                <span>Copy Link</span>
              </Button>
            </div>
          </TabsContent>

          {/* Email Tab */}
          <TabsContent value="email" className="space-y-4 mt-4" onFocus={initializeEmailContent}>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Recipient Email</Label>
                <Input
                  type="email"
                  placeholder="recipient@example.com"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  placeholder="Email subject"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  onFocus={() => !emailSubject && setEmailSubject(`Signed Document: ${document.title}`)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  placeholder="Add a message..."
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  rows={3}
                />
              </div>
              
              <Button 
                className="w-full bg-accent hover:bg-accent/90"
                onClick={handleEmailShare}
                disabled={isLoading || !emailTo}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4 mr-2" />
                )}
                Send Email
              </Button>
            </div>
          </TabsContent>

          {/* WhatsApp Tab */}
          <TabsContent value="whatsapp" className="space-y-4 mt-4" onFocus={initializeSmsContent}>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  type="tel"
                  placeholder="+1234567890"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  placeholder="Message with document link..."
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  onFocus={() => !smsMessage && initializeSmsContent()}
                  rows={4}
                />
              </div>
              
              <Button 
                className="w-full bg-[hsl(142,76%,36%)] hover:bg-[hsl(142,76%,30%)] text-white"
                onClick={handleWhatsAppShare}
                disabled={isLoading || !phoneNumber}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <MessageCircle className="w-4 h-4 mr-2" />
                )}
                Send via WhatsApp
              </Button>
            </div>
          </TabsContent>

          {/* SMS Tab */}
          <TabsContent value="sms" className="space-y-4 mt-4" onFocus={initializeSmsContent}>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  type="tel"
                  placeholder="+1234567890"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  placeholder="Message with document link..."
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  onFocus={() => !smsMessage && initializeSmsContent()}
                  rows={4}
                />
              </div>
              
              <Button 
                className="w-full"
                onClick={handleSmsShare}
                disabled={isLoading || !phoneNumber}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Phone className="w-4 h-4 mr-2" />
                )}
                Send SMS
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
