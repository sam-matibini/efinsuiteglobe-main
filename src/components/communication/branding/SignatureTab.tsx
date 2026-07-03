import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, Upload, X, PenTool, Plus, Pencil, Eye } from 'lucide-react';
import { CommunicationIdentity } from '@/hooks/useCommunicationIdentity';
import { SignaturePad } from './SignaturePad';
import { SignaturePreview } from './SignaturePreview';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SignatureTabProps {
  identity: CommunicationIdentity | null;
  isSaving: boolean;
  onSave: (data: Partial<CommunicationIdentity>) => Promise<boolean>;
  onUpload: (file: File, type: 'logo' | 'profile' | 'signature') => Promise<string | null>;
  organizationId?: string;
}

const SIGNATURE_VARIABLES = [
  { label: 'Name', value: '{{name}}' },
  { label: 'Title', value: '{{title}}' },
  { label: 'Company', value: '{{company}}' },
  { label: 'Phone', value: '{{phone}}' },
  { label: 'Email', value: '{{email}}' },
  { label: 'Address', value: '{{address}}' },
  { label: 'Website', value: '{{website}}' },
];

export function SignatureTab({ identity, isSaving, onSave, onUpload, organizationId }: SignatureTabProps) {
  const [signatureHtml, setSignatureHtml] = useState('');
  const [signaturePlainText, setSignaturePlainText] = useState('');
  const [signatureImageUrl, setSignatureImageUrl] = useState('');
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (identity) {
      setSignatureHtml(identity.signature_html || '');
      setSignaturePlainText(identity.signature_plain_text || '');
      setSignatureImageUrl(identity.signature_image_url || '');
    }
  }, [identity]);

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return;
    }

    if (file.size > 1 * 1024 * 1024) {
      return;
    }

    setIsUploadingSignature(true);
    const url = await onUpload(file, 'signature');
    if (url) {
      setSignatureImageUrl(url);
    }
    setIsUploadingSignature(false);

    if (signatureInputRef.current) {
      signatureInputRef.current.value = '';
    }
  };

  // Handle drawn signature from SignaturePad
  const handleDrawnSignature = async (dataUrl: string) => {
    if (!organizationId) {
      toast.error('No organization selected');
      setShowSignaturePad(false);
      return;
    }

    setIsUploadingSignature(true);
    try {
      // Convert data URL to Blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      // Upload to Supabase storage
      const fileName = `branding/${organizationId}/signature-${Date.now()}.png`;
      
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, blob, { 
          contentType: 'image/png',
          upsert: true 
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Failed to save signature');
        return;
      }

      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      if (urlData?.publicUrl) {
        setSignatureImageUrl(urlData.publicUrl);
        toast.success('Signature saved');
      }
    } catch (err) {
      console.error('Error saving drawn signature:', err);
      toast.error('Failed to save signature');
    } finally {
      setIsUploadingSignature(false);
      setShowSignaturePad(false);
    }
  };

  const insertVariable = (variable: string) => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const text = signatureHtml;
      const newText = text.substring(0, start) + variable + text.substring(end);
      setSignatureHtml(newText);
      
      // Set cursor position after inserted variable
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + variable.length;
          textareaRef.current.selectionEnd = start + variable.length;
          textareaRef.current.focus();
        }
      }, 0);
    } else {
      setSignatureHtml(prev => prev + variable);
    }
  };

  const handleSave = async () => {
    await onSave({
      signature_html: signatureHtml || undefined,
      signature_plain_text: signaturePlainText || undefined,
      signature_image_url: signatureImageUrl || undefined,
    });
  };

  // Generate preview with sample data
  const previewSignature = signatureHtml
    .replace(/\{\{name\}\}/g, 'John Smith')
    .replace(/\{\{title\}\}/g, 'Account Manager')
    .replace(/\{\{company\}\}/g, identity?.display_name || identity?.legal_name || 'Your Company')
    .replace(/\{\{phone\}\}/g, identity?.phone || '+1 (555) 123-4567')
    .replace(/\{\{email\}\}/g, identity?.email || 'john@company.com')
    .replace(/\{\{address\}\}/g, identity?.address_line1 || '123 Business St, City')
    .replace(/\{\{website\}\}/g, identity?.website || 'www.company.com');

  return (
    <div className="space-y-6">
      {/* Signature Editor */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-medium">Email Signature</Label>
            <p className="text-sm text-muted-foreground">
              Create your email signature using text and dynamic variables
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Insert Variable
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {SIGNATURE_VARIABLES.map((v) => (
                <DropdownMenuItem
                  key={v.value}
                  onClick={() => insertVariable(v.value)}
                >
                  {v.label} <span className="ml-2 text-muted-foreground">{v.value}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Textarea
          ref={textareaRef}
          placeholder={`Kind regards,

{{name}}
{{title}}
{{company}}

📞 {{phone}}
📧 {{email}}`}
          value={signatureHtml}
          onChange={(e) => setSignatureHtml(e.target.value)}
          rows={8}
          className="font-mono text-sm"
        />
      </div>

      {/* Plain Text Signature (for SMS/WhatsApp) */}
      <div className="space-y-4 pt-4 border-t">
        <div>
          <Label className="text-base font-medium">Short Signature (SMS/WhatsApp)</Label>
          <p className="text-sm text-muted-foreground">
            A shorter version for SMS and WhatsApp (keep it brief)
          </p>
        </div>

        <Textarea
          placeholder="– {{company}} | {{phone}}"
          value={signaturePlainText}
          onChange={(e) => setSignaturePlainText(e.target.value)}
          rows={2}
          className="font-mono text-sm"
        />
      </div>

      {/* Handwritten Signature */}
      <div className="space-y-4 pt-4 border-t">
        <div>
          <Label className="text-base font-medium">Handwritten Signature (Optional)</Label>
          <p className="text-sm text-muted-foreground">
            Draw your signature on your phone/tablet or upload a PNG image
          </p>
        </div>

        {showSignaturePad ? (
          <SignaturePad
            onSave={handleDrawnSignature}
            onCancel={() => setShowSignaturePad(false)}
          />
        ) : (
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="w-full sm:w-48 h-24 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/30 relative">
              {signatureImageUrl ? (
                <>
                  <img
                    src={signatureImageUrl}
                    alt="Signature"
                    className="max-w-full max-h-full object-contain p-2"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={() => setSignatureImageUrl('')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <PenTool className="h-8 w-8 text-muted-foreground" />
              )}
            </div>

            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="default"
                  onClick={() => setShowSignaturePad(true)}
                  disabled={isUploadingSignature}
                  className="bg-accent hover:bg-accent/90"
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Draw Signature
                </Button>
                
                <input
                  ref={signatureInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleSignatureUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => signatureInputRef.current?.click()}
                  disabled={isUploadingSignature}
                >
                  {isUploadingSignature ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Upload Image
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use "Draw Signature" on mobile devices. Max 1MB for uploads.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Full Preview */}
      <div className="pt-4 border-t">
        <div className="flex items-center gap-2 mb-4">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <Label className="text-base font-medium">Full Signature Preview</Label>
        </div>
        <SignaturePreview
          identity={identity}
          signatureHtml={signatureHtml}
          signatureImageUrl={signatureImageUrl}
          senderName="John Smith"
          senderTitle="Account Manager"
          variant="full"
        />
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
