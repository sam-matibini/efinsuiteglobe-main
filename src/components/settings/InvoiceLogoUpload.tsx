import { useState, useRef } from 'react';
import { Upload, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { invoiceLogoObjectPath, logoObjectPathFromPublicUrl } from '@/lib/invoiceLogoStorage';
import { logoFileAllowed, logoUploadErrorMessage, prepareLogoUpload } from '@/lib/logoUpload';
import { toast } from 'sonner';

interface InvoiceLogoUploadProps {
  organizationId: string;
  currentLogoUrl: string | null;
  onLogoChange: (url: string | null) => void;
}

export function InvoiceLogoUpload({
  organizationId,
  currentLogoUrl,
  onLogoChange,
}: InvoiceLogoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowed = logoFileAllowed(file);
    if (!allowed.ok) {
      toast.error(allowed.reason === 'size' ? 'Image must be smaller than 2MB' : 'Please select an image file');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);

    try {
      const prepared = await prepareLogoUpload(file);
      // First folder must be the organization id. Storage policies reject
      // paths that start with "invoice-logos".
      const fileName = invoiceLogoObjectPath(organizationId, `logo.${prepared.extension}`);

      const { error: uploadError } = await supabase.storage
        .from('organization-logos')
        .upload(fileName, prepared.body, {
          contentType: prepared.contentType,
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      if (currentLogoUrl) {
        const oldPath = logoObjectPathFromPublicUrl(currentLogoUrl);
        if (oldPath && oldPath !== fileName) {
          await supabase.storage.from('organization-logos').remove([oldPath]);
        }
      }

      const { data: { publicUrl } } = supabase.storage
        .from('organization-logos')
        .getPublicUrl(fileName);

      onLogoChange(publicUrl);
      toast.success('Invoice logo uploaded successfully');
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error(logoUploadErrorMessage(error));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = async () => {
    if (!currentLogoUrl) return;

    setUploading(true);

    try {
      // Extract path from URL
      const path = logoObjectPathFromPublicUrl(currentLogoUrl);
      if (path) {
        await supabase.storage.from('organization-logos').remove([path]);
      }

      onLogoChange(null);
      toast.success('Invoice logo removed');
    } catch (error) {
      console.error('Error removing logo:', error);
      toast.error('Failed to remove logo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-16 w-16 border-2 border-border rounded-md">
        <AvatarImage src={currentLogoUrl || undefined} alt="Invoice logo" className="object-contain" />
        <AvatarFallback className="bg-muted rounded-md">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </AvatarFallback>
      </Avatar>

      <div className="space-y-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? 'Uploading...' : currentLogoUrl ? 'Change' : 'Upload'}
          </Button>
          {currentLogoUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={uploading}
            >
              <X className="w-4 h-4 mr-2" />
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Square image, max 2MB (PNG, JPG)
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />
    </div>
  );
}
