import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Save, Upload, X, Image as ImageIcon, User } from 'lucide-react';
import { CommunicationIdentity } from '@/hooks/useCommunicationIdentity';
import { cn } from '@/lib/utils';

interface LogoImagesTabProps {
  identity: CommunicationIdentity | null;
  isSaving: boolean;
  onSave: (data: Partial<CommunicationIdentity>) => Promise<boolean>;
  onUpload: (file: File, type: 'logo' | 'profile' | 'signature') => Promise<string | null>;
}

export function LogoImagesTab({ identity, isSaving, onSave, onUpload }: LogoImagesTabProps) {
  const [logoUrl, setLogoUrl] = useState('');
  const [logoPosition, setLogoPosition] = useState<'left' | 'center' | 'right'>('left');
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (identity) {
      setLogoUrl(identity.logo_url || '');
      setLogoPosition(identity.logo_position || 'left');
      setProfileImageUrl(identity.profile_image_url || '');
    }
  }, [identity]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return;
    }

    setIsUploadingLogo(true);
    const url = await onUpload(file, 'logo');
    if (url) {
      setLogoUrl(url);
    }
    setIsUploadingLogo(false);

    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  const handleProfileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      return;
    }

    setIsUploadingProfile(true);
    const url = await onUpload(file, 'profile');
    if (url) {
      setProfileImageUrl(url);
    }
    setIsUploadingProfile(false);

    if (profileInputRef.current) {
      profileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    await onSave({
      logo_url: logoUrl || undefined,
      logo_position: logoPosition,
      profile_image_url: profileImageUrl || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Company Logo */}
      <div className="space-y-4">
        <div>
          <Label className="text-base font-medium">Company Logo</Label>
          <p className="text-sm text-muted-foreground">
            Upload your company logo (PNG, JPG, SVG, or WebP, max 2MB)
          </p>
        </div>

        <div className="flex items-start gap-6">
          {/* Logo Preview */}
          <div className="w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/30 relative">
            {logoUrl ? (
              <>
                <img
                  src={logoUrl}
                  alt="Company logo"
                  className="max-w-full max-h-full object-contain p-2"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6"
                  onClick={() => setLogoUrl('')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </>
            ) : (
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            )}
          </div>

          <div className="flex-1 space-y-4">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={handleLogoUpload}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => logoInputRef.current?.click()}
              disabled={isUploadingLogo}
            >
              {isUploadingLogo ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Upload Logo
            </Button>

            {/* Logo Position */}
            <div className="space-y-2">
              <Label>Logo Position</Label>
              <RadioGroup
                value={logoPosition}
                onValueChange={(v) => setLogoPosition(v as 'left' | 'center' | 'right')}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="left" id="pos-left" />
                  <Label htmlFor="pos-left" className="cursor-pointer">Left</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="center" id="pos-center" />
                  <Label htmlFor="pos-center" className="cursor-pointer">Center</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="right" id="pos-right" />
                  <Label htmlFor="pos-right" className="cursor-pointer">Right</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Picture */}
      <div className="space-y-4 pt-4 border-t">
        <div>
          <Label className="text-base font-medium">Profile Picture (Optional)</Label>
          <p className="text-sm text-muted-foreground">
            A profile picture for personalized communications
          </p>
        </div>

        <div className="flex items-start gap-6">
          <div className="w-24 h-24 border-2 border-dashed rounded-full flex items-center justify-center bg-muted/30 relative overflow-hidden">
            {profileImageUrl ? (
              <>
                <img
                  src={profileImageUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-1 -right-1 h-6 w-6"
                  onClick={() => setProfileImageUrl('')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </>
            ) : (
              <User className="h-8 w-8 text-muted-foreground" />
            )}
          </div>

          <div className="flex-1">
            <input
              ref={profileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleProfileUpload}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => profileInputRef.current?.click()}
              disabled={isUploadingProfile}
            >
              {isUploadingProfile ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Upload Picture
            </Button>
          </div>
        </div>
      </div>

      {/* Preview */}
      {logoUrl && (
        <div className="pt-4 border-t">
          <Label className="text-base font-medium mb-4 block">Preview</Label>
          <div className="border rounded-lg p-6 bg-background">
            <div
              className={cn(
                'flex items-center gap-4',
                logoPosition === 'center' && 'justify-center',
                logoPosition === 'right' && 'justify-end'
              )}
            >
              <img
                src={logoUrl}
                alt="Logo preview"
                className="h-12 object-contain"
              />
            </div>
          </div>
        </div>
      )}

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
