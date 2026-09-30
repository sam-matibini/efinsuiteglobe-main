import { useState, useRef } from 'react';
import { Upload, X, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { logoObjectPathFromPublicUrl, organizationLogoObjectPath } from '@/lib/invoiceLogoStorage';
import { logoFileAllowed, logoUploadErrorMessage, logoUploadFile, prepareLogoUpload } from '@/lib/logoUpload';
import { toast } from 'sonner';

interface OrganizationLogoUploadProps {
  organizationId: string;
  currentLogoUrl: string | null;
  onLogoChange: (url: string | null) => void;
}

export function OrganizationLogoUpload({
  organizationId,
  currentLogoUrl,
  onLogoChange,
}: OrganizationLogoUploadProps) {
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
      const uploadFile = logoUploadFile(prepared);
      const fileName = organizationLogoObjectPath(organizationId, uploadFile.name);

      const { error: uploadError } = await supabase.storage
        .from('organization-logos')
        .upload(fileName, uploadFile, {
          upsert: true,
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

      const { data: updated, error: updateError } = await supabase
        .from('organizations')
        .update({ logo_url: publicUrl })
        .eq('id', organizationId)
        .select('id');

      if (updateError) throw updateError;
      if (!updated?.length) throw new Error('You do not have permission to upload a logo for this organization');

      onLogoChange(publicUrl);
      toast.success('Logo uploaded successfully');
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

      // Update organization
      const { error } = await supabase
        .from('organizations')
        .update({ logo_url: null })
        .eq('id', organizationId);

      if (error) throw error;

      onLogoChange(null);
      toast.success('Logo removed');
    } catch (error) {
      console.error('Error removing logo:', error);
      toast.error('Failed to remove logo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-6">
      <Avatar className="h-24 w-24 border-2 border-border">
        <AvatarImage src={currentLogoUrl || undefined} alt="Organization logo" />
        <AvatarFallback className="bg-muted">
          <Building2 className="h-10 w-10 text-muted-foreground" />
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
            {uploading ? 'Uploading...' : currentLogoUrl ? 'Change Logo' : 'Upload Logo'}
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
          Recommended: Square image, max 2MB (PNG, JPG)
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
