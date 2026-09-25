import { useState, useRef } from 'react';
import { Upload, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
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

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be smaller than 2MB');
      return;
    }

    setUploading(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `invoice-logos/${organizationId}/logo-${Date.now()}.${fileExt}`;

      // Delete old logo if exists
      if (currentLogoUrl) {
        const oldPath = currentLogoUrl.split('/organization-logos/')[1];
        if (oldPath) {
          await supabase.storage.from('organization-logos').remove([oldPath]);
        }
      }

      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from('organization-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('organization-logos')
        .getPublicUrl(fileName);

      onLogoChange(publicUrl);
      toast.success('Invoice logo uploaded successfully');
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo');
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
      const path = currentLogoUrl.split('/organization-logos/')[1];
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
