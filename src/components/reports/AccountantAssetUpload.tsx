import { useState, useRef } from 'react';
import { Upload, X, Image, Signature, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AccountantAssetUploadProps {
  type: 'logo' | 'signature';
  currentUrl: string | null;
  onUpload: (url: string) => void;
  onRemove: () => void;
}

export function AccountantAssetUpload({ 
  type, 
  currentUrl, 
  onUpload, 
  onRemove 
}: AccountantAssetUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    setIsUploading(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user?.id) {
        toast.error('You must be signed in to upload');
        setIsUploading(false);
        return;
      }
      const userId = userData.user.id;

      const fileExt = file.name.split('.').pop();
      const fileName = `${type}-${Date.now()}.${fileExt}`;
      // Scope storage path to the uploading user so RLS can enforce per-user ownership
      const filePath = `${userId}/${type}s/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('accountant-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('accountant-assets')
        .getPublicUrl(filePath);

      onUpload(publicUrl);
      toast.success(`${type === 'logo' ? 'Logo' : 'Signature'} uploaded successfully`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(`Failed to upload ${type}`);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = async () => {
    if (!currentUrl) return;
    
    // Extract file path from URL
    try {
      const urlPath = new URL(currentUrl).pathname;
      const filePath = urlPath.split('/accountant-assets/')[1];
      
      if (filePath) {
        await supabase.storage
          .from('accountant-assets')
          .remove([filePath]);
      }
    } catch (error) {
      console.error('Error removing file:', error);
    }
    
    onRemove();
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        {type === 'logo' ? (
          <>
            <Image className="w-4 h-4" />
            Firm/Accountant Logo
          </>
        ) : (
          <>
            <Signature className="w-4 h-4" />
            Signature Image
          </>
        )}
      </Label>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {currentUrl ? (
        <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
          <img 
            src={currentUrl} 
            alt={type} 
            className={`object-contain bg-white rounded ${
              type === 'logo' ? 'w-16 h-16' : 'w-24 h-12'
            }`}
          />
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">
              {type === 'logo' ? 'Logo uploaded' : 'Signature uploaded'}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            className="text-destructive hover:text-destructive"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full h-20 border-dashed"
        >
          {isUploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <div className="flex flex-col items-center gap-1">
              <Upload className="w-5 h-5" />
              <span className="text-xs">
                {type === 'logo' ? 'Upload Logo' : 'Upload Signature'}
              </span>
              <span className="text-xs text-muted-foreground">PNG, JPG up to 2MB</span>
            </div>
          )}
        </Button>
      )}
    </div>
  );
}