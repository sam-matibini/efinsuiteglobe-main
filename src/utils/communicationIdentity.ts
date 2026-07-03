import { supabase } from "@/integrations/supabase/client";

export interface ResolvedIdentity {
  displayName: string | null;
  legalName: string | null;
  logoUrl: string | null;
  logoPosition: 'left' | 'center' | 'right';
  signatureHtml: string | null;
  signaturePlainText: string | null;
  signatureImageUrl: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
}

/**
 * Resolves the communication identity for an organization following
 * the precedence hierarchy: User → Department → Organization
 */
export async function resolveIdentity(
  organizationId: string,
  departmentId?: string,
  userId?: string
): Promise<ResolvedIdentity | null> {
  try {
    // Use the database function to resolve identity
    const { data, error } = await supabase.rpc('resolve_communication_identity', {
      p_organization_id: organizationId,
      p_department_id: departmentId || null,
      p_user_id: userId || null,
    });

    if (error) {
      console.error('Error resolving identity:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    // Build full address string
    const addressParts = [
      data.address_line1,
      data.address_line2,
      data.city,
      data.province,
      data.postal_code,
      data.country,
    ].filter(Boolean);

    return {
      displayName: data.display_name,
      legalName: data.legal_name,
      logoUrl: data.logo_url,
      logoPosition: (data.logo_position as 'left' | 'center' | 'right') || 'left',
      signatureHtml: data.signature_html,
      signaturePlainText: data.signature_plain_text,
      signatureImageUrl: data.signature_image_url,
      phone: data.phone,
      email: data.email,
      website: data.website,
      address: addressParts.length > 0 ? addressParts.join(', ') : null,
    };
  } catch (err) {
    console.error('Exception resolving identity:', err);
    return null;
  }
}

/**
 * Applies variable substitutions to signature templates
 */
export function applySignatureVariables(
  template: string,
  variables: {
    name?: string;
    title?: string;
    company?: string;
    phone?: string;
    email?: string;
    address?: string;
    website?: string;
  }
): string {
  let result = template;
  
  if (variables.name) result = result.replace(/\{\{name\}\}/g, variables.name);
  if (variables.title) result = result.replace(/\{\{title\}\}/g, variables.title);
  if (variables.company) result = result.replace(/\{\{company\}\}/g, variables.company);
  if (variables.phone) result = result.replace(/\{\{phone\}\}/g, variables.phone);
  if (variables.email) result = result.replace(/\{\{email\}\}/g, variables.email);
  if (variables.address) result = result.replace(/\{\{address\}\}/g, variables.address);
  if (variables.website) result = result.replace(/\{\{website\}\}/g, variables.website);
  
  // Remove any unreplaced variables
  result = result.replace(/\{\{[^}]+\}\}/g, '');
  
  return result;
}

/**
 * Builds an email signature block with logo and signature
 * Format: "Name, Credentials | Title | Company" on line 1
 *         "📞 Phone | 📧 Email | 🌐 Website" on line 2
 */
export function buildEmailSignature(
  identity: ResolvedIdentity,
  senderName?: string,
  senderTitle?: string,
  options?: {
    phone?: string;
    email?: string;
    website?: string;
  }
): string {
  const companyName = identity.displayName || identity.legalName || '';
  
  // Contact details
  const phonePart = options?.phone || identity.phone;
  const emailPart = options?.email || identity.email;
  const websitePart = options?.website || identity.website;

  // Build signature line: "Name, Credentials | Title | Company"
  // Parse sender name to separate name from credentials (comma-separated)
  let signatureLineParts: string[] = [];
  
  if (senderName) {
    // Check if name contains credentials (comma-separated)
    // e.g., "Sam Matibini, CPA, FCCA, MBA" -> keep as-is for first part
    signatureLineParts.push(senderName);
  }
  if (senderTitle) {
    signatureLineParts.push(senderTitle);
  }
  if (companyName) {
    signatureLineParts.push(companyName);
  }
  
  const signatureLine = signatureLineParts.join(' | ');

  if (!identity.signatureHtml) {
    // Default simple signature with proper HTML formatting
    // Line 1: Name, Credentials | Title | Company
    // Line 2: 📞 Phone | 📧 Email | 🌐 Website
    let signatureHtml = `<br><br><div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-family: Arial, sans-serif; font-size: 14px; color: #333;">`;
    
    if (signatureLine) {
      signatureHtml += `<div style="margin-bottom: 6px;"><strong>${signatureLine}</strong></div>`;
    }
    
    // Contact details on one line with pipe separators
    const contactParts: string[] = [];
    if (phonePart) contactParts.push(`📞 ${phonePart}`);
    if (emailPart) contactParts.push(`📧 ${emailPart}`);
    if (websitePart) contactParts.push(`🌐 ${websitePart}`);
    
    if (contactParts.length > 0) {
      signatureHtml += `<div style="color: #666; font-size: 13px;">${contactParts.join(' | ')}</div>`;
    }
    
    signatureHtml += '</div>';
    return signatureHtml;
  }

  const processedSignature = applySignatureVariables(identity.signatureHtml, {
    name: senderName,
    title: senderTitle,
    company: companyName || undefined,
    phone: phonePart || undefined,
    email: emailPart || undefined,
    address: identity.address || undefined,
    website: websitePart || undefined,
  });

  let signatureHtml = `<br><br><div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e5e5;">`;
  
  // Add logo if available
  if (identity.logoUrl) {
    const alignStyle = identity.logoPosition === 'center' ? 'text-align: center;' : 
                       identity.logoPosition === 'right' ? 'text-align: right;' : '';
    signatureHtml += `<div style="${alignStyle} margin-bottom: 16px;">
      <img src="${identity.logoUrl}" alt="${identity.displayName || 'Company'}" style="max-height: 48px; max-width: 200px;">
    </div>`;
  }
  
  // Add text signature
  signatureHtml += `<div style="white-space: pre-wrap;">${processedSignature.replace(/\n/g, '<br>')}</div>`;
  
  // Add handwritten signature if available
  if (identity.signatureImageUrl) {
    signatureHtml += `<div style="margin-top: 8px;">
      <img src="${identity.signatureImageUrl}" alt="Signature" style="max-height: 40px;">
    </div>`;
  }
  
  signatureHtml += '</div>';
  
  return signatureHtml;
}

/**
 * WhatsApp logo URL for branding (stored in Supabase Storage)
 */
export const WHATSAPP_LOGO_URL = 'https://boskmqywofwekszhgryb.supabase.co/storage/v1/object/public/organization-logos/global/efinsuite-globe-logo-whatsapp.png';

/**
 * Builds a short plain text signature for SMS/WhatsApp
 * Includes sender name, company, and contact details
 * For WhatsApp: breaks URL to prevent dark banner link preview
 */
export function buildShortSignature(
  identity: ResolvedIdentity,
  senderName?: string,
  senderTitle?: string,
  options?: {
    phone?: string;
    email?: string;
    website?: string;
    channel?: 'sms' | 'whatsapp';
    preventLinkPreview?: boolean; // If true, breaks URL format
  }
): string {
  const isWhatsApp = options?.channel === 'whatsapp';
  const preventPreview = options?.preventLinkPreview ?? false;
  
  if (identity.signaturePlainText) {
    // For custom signatures, apply variable substitution
    let websiteValue = options?.website || identity.website || undefined;
    
    // Break URL to prevent link preview if requested
    if (websiteValue && isWhatsApp && preventPreview) {
      websiteValue = websiteValue.replace(/^https?:\/\//, '');
    }
    
    return '\n\n' + applySignatureVariables(identity.signaturePlainText, {
      name: senderName,
      title: senderTitle,
      company: identity.displayName || identity.legalName || undefined,
      phone: options?.phone || identity.phone || undefined,
      email: options?.email || identity.email || undefined,
      website: websiteValue,
    });
  }

  // Company name
  const companyPart = identity.displayName || identity.legalName;
  
  // Contact details
  const phonePart = options?.phone || identity.phone;
  const emailPart = options?.email || identity.email;
  let websitePart = options?.website || identity.website;
  
  // Break URL to prevent WhatsApp dark banner if requested
  if (websitePart && isWhatsApp && preventPreview) {
    websitePart = websitePart.replace(/^https?:\/\//, '');
  }

  // Build signature line: "*Name*, credentials | Title | Company" format
  // Name is bold, credentials after comma are regular text
  let signatureLine = '';
  if (senderName) {
    // Check if name contains credentials (comma-separated)
    const commaIndex = senderName.indexOf(',');
    if (commaIndex > 0) {
      // Bold only the name part, keep credentials regular
      const namePart = senderName.substring(0, commaIndex);
      const credentialsPart = senderName.substring(commaIndex); // includes the comma
      signatureLine = `*${namePart}*${credentialsPart}`;
    } else {
      signatureLine = `*${senderName}*`;
    }
    if (senderTitle) {
      signatureLine += ` | ${senderTitle}`;
    }
    if (companyPart) {
      signatureLine += ` | ${companyPart}`;
    }
  } else if (companyPart) {
    // If no sender name, just show company
    signatureLine = `*${companyPart}*`;
  }

  // Build contact details all on ONE line with spacing
  const contactParts: string[] = [];
  
  if (phonePart) {
    contactParts.push(`📞 ${phonePart}`);
  }
  if (emailPart) {
    contactParts.push(`✉ ${emailPart}`);
  }
  if (websitePart) {
    contactParts.push(`🌐 ${websitePart}`);
  }

  let signature = '';
  
  if (signatureLine) {
    signature = '\n\n' + signatureLine;
  }
  
  // All contact parts on one line with double-space separation
  if (contactParts.length > 0) {
    signature += '\n' + contactParts.join('  ');
  }

  return signature;
}

/**
 * Options for WhatsApp message formatting
 */
export interface WhatsAppMessageOptions {
  sendLogoFirst?: boolean;      // If true, logo should be sent before text
  preventLinkPreview?: boolean; // If true, breaks URL to prevent dark banner
  logoUrl?: string;             // Custom logo URL (defaults to global)
}

/**
 * Prepares a WhatsApp message with optional logo-first branding
 * Returns structured data for the messaging system to handle
 */
export function prepareWhatsAppMessage(
  body: string,
  identity: ResolvedIdentity,
  senderName?: string,
  senderTitle?: string,
  options?: WhatsAppMessageOptions
): {
  logoUrl: string | null;
  textMessage: string;
  shouldSendLogoFirst: boolean;
} {
  const sendLogoFirst = options?.sendLogoFirst ?? true;
  const preventLinkPreview = options?.preventLinkPreview ?? true;
  const logoUrl = options?.logoUrl || WHATSAPP_LOGO_URL;
  
  // Build signature with URL breaking if needed
  const signature = buildShortSignature(identity, senderName, senderTitle, {
    channel: 'whatsapp',
    preventLinkPreview,
  });
  
  const textMessage = body + signature;
  
  return {
    logoUrl: sendLogoFirst ? logoUrl : null,
    textMessage,
    shouldSendLogoFirst: sendLogoFirst,
  };
}

/**
 * Check if a channel is enabled for branding
 */
export async function isChannelBrandingEnabled(
  identityId: string,
  channel: 'email' | 'sms' | 'whatsapp' | 'pdf' | 'esign'
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('communication_identity_channels')
      .select('enabled')
      .eq('communication_identity_id', identityId)
      .eq('channel', channel)
      .maybeSingle();

    if (error) {
      console.error('Error checking channel config:', error);
      return true; // Default to enabled
    }

    return data?.enabled ?? true;
  } catch (err) {
    console.error('Exception checking channel config:', err);
    return true;
  }
}
