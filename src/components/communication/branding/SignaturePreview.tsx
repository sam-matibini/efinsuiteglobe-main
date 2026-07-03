import { Mail, Phone, Globe, MapPin, Building2, User } from 'lucide-react';
import { CommunicationIdentity } from '@/hooks/useCommunicationIdentity';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

interface SignaturePreviewProps {
  identity: CommunicationIdentity | null;
  signatureHtml?: string;
  signatureImageUrl?: string;
  senderName?: string;
  senderTitle?: string;
  variant?: 'compact' | 'full';
}

export function SignaturePreview({
  identity,
  signatureHtml,
  signatureImageUrl,
  senderName = 'John Smith',
  senderTitle = 'Account Manager',
  variant = 'full',
}: SignaturePreviewProps) {
  if (!identity) {
    return (
      <div className="text-center text-muted-foreground text-sm py-8">
        <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No branding configured.</p>
        <p className="text-xs mt-1">Set up your identity in the Branding tab.</p>
      </div>
    );
  }

  const companyName = identity.display_name || identity.legal_name || 'Your Company';
  const logoUrl = identity.logo_url;
  const profileImageUrl = identity.profile_image_url;
  const logoPosition = identity.logo_position || 'left';

  // Build address string
  const addressParts = [
    identity.address_line1,
    identity.address_line2,
    identity.city,
    identity.province,
    identity.postal_code,
    identity.country,
  ].filter(Boolean);
  const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : null;

  // Process signature with variables
  const processedSignature = (signatureHtml || identity.signature_html || '')
    .replace(/\{\{name\}\}/g, senderName)
    .replace(/\{\{title\}\}/g, senderTitle)
    .replace(/\{\{company\}\}/g, companyName)
    .replace(/\{\{phone\}\}/g, identity.phone || '')
    .replace(/\{\{email\}\}/g, identity.email || '')
    .replace(/\{\{address\}\}/g, fullAddress || '')
    .replace(/\{\{website\}\}/g, identity.website || '');

  const finalSignatureImage = signatureImageUrl || identity.signature_image_url;

  if (variant === 'compact') {
    return (
      <div className="space-y-3">
        {/* Logo and Company */}
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-8 w-auto object-contain" />
          ) : (
            <Building2 className="w-6 h-6 text-muted-foreground" />
          )}
          <span className="font-medium text-sm">{companyName}</span>
        </div>

        {/* Signature Text */}
        {processedSignature && (
          <div className="text-sm whitespace-pre-wrap text-muted-foreground">
            {processedSignature}
          </div>
        )}

        {/* Handwritten Signature */}
        {finalSignatureImage && (
          <img
            src={finalSignatureImage}
            alt="Signature"
            className="h-10 object-contain"
          />
        )}
      </div>
    );
  }

  // Full variant
  return (
    <div className="border rounded-lg bg-background overflow-hidden">
      {/* Header with Logo */}
      <div 
        className={`p-4 bg-muted/30 border-b flex items-center gap-3 ${
          logoPosition === 'center' ? 'justify-center' : 
          logoPosition === 'right' ? 'justify-end' : 'justify-start'
        }`}
      >
        {logoUrl ? (
          <img 
            src={logoUrl} 
            alt={companyName} 
            className="h-10 w-auto object-contain max-w-[150px]"
          />
        ) : (
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            <span className="font-semibold text-primary">{companyName}</span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4">
        {/* Sender Info with Profile Picture */}
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14 border-2 border-primary/20">
            {profileImageUrl ? (
              <AvatarImage src={profileImageUrl} alt={senderName} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-primary">
              <User className="h-6 w-6" />
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-foreground">{senderName}</h4>
            <p className="text-sm text-muted-foreground">{senderTitle}</p>
            <p className="text-sm font-medium text-primary">{companyName}</p>
            {identity.tagline && (
              <p className="text-xs text-muted-foreground italic mt-1">
                {identity.tagline}
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* Contact Details */}
        <div className="grid gap-2 text-sm">
          {identity.email && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4 text-primary/70 shrink-0" />
              <span className="truncate">{identity.email}</span>
            </div>
          )}
          {identity.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4 text-primary/70 shrink-0" />
              <span>{identity.phone}</span>
            </div>
          )}
          {identity.website && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Globe className="h-4 w-4 text-primary/70 shrink-0" />
              <span className="truncate">{identity.website}</span>
            </div>
          )}
          {fullAddress && (
            <div className="flex items-start gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 text-primary/70 shrink-0 mt-0.5" />
              <span className="text-xs leading-relaxed">{fullAddress}</span>
            </div>
          )}
        </div>

        {/* Text Signature */}
        {processedSignature && (
          <>
            <Separator />
            <div className="text-sm whitespace-pre-wrap text-muted-foreground bg-muted/30 rounded p-3">
              {processedSignature}
            </div>
          </>
        )}

        {/* Handwritten Signature */}
        {finalSignatureImage && (
          <div className="pt-2">
            <img
              src={finalSignatureImage}
              alt="Handwritten Signature"
              className="h-12 object-contain"
            />
          </div>
        )}
      </div>
    </div>
  );
}
