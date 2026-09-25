/**
 * Branding Loader
 * Fetches and manages organization branding for print output
 */

import { supabase } from '@/integrations/supabase/client';
import type { PrintBranding } from './types';

// Default branding fallback
const DEFAULT_BRANDING: PrintBranding = {
  logoWidth: 60,
  logoPosition: 'left',
  organizationName: 'Organization',
  primaryColor: '#1e40af',
  secondaryColor: '#64748b',
  fontFamily: 'Helvetica',
  showAddress: true,
  showContact: true,
  showWebsite: true,
  showPageNumbers: true,
  pageNumberFormat: 'Page {page} of {pages}',
};

/**
 * Load branding profile for an organization
 */
export async function loadBrandingProfile(organizationId: string): Promise<PrintBranding> {
  // First, try to get the print brand profile
  const { data: brandProfile } = await supabase
    .from('print_brand_profiles')
    .select('*')
    .eq('organization_id', organizationId)
    .single();
  
  // Get organization details for fallback data
  const { data: org } = await supabase
    .from('organizations')
    .select('name, logo_url, address_line1, city, province, country, postal_code, phone, email, website, statement_show_logo, statement_logo_url')
    .eq('id', organizationId)
    .single();
  
  if (!org) {
    return DEFAULT_BRANDING;
  }
  
  // Merge brand profile with organization data
  return {
    logoUrl: (() => {
      // Statement-specific logo resolution: toggle → override → org logo → brand profile
      if ((org as any).statement_show_logo === false) return undefined;
      const statementLogo = (org as any).statement_logo_url;
      if (statementLogo) return statementLogo;
      if ((org as any).logo_url) return (org as any).logo_url;
      return brandProfile?.logo_url ?? undefined;
    })(),
    logoWidth: brandProfile?.logo_width || DEFAULT_BRANDING.logoWidth,
    logoPosition: (brandProfile?.logo_position as 'left' | 'center' | 'right') || DEFAULT_BRANDING.logoPosition,
    organizationName: org.name || DEFAULT_BRANDING.organizationName,
    address: org.address_line1 ?? undefined,
    city: org.city ?? undefined,
    province: org.province ?? undefined,
    country: org.country ?? undefined,
    postalCode: org.postal_code ?? undefined,
    phone: org.phone ?? undefined,
    email: org.email ?? undefined,
    website: org.website ?? undefined,
    primaryColor: brandProfile?.primary_color || DEFAULT_BRANDING.primaryColor,
    secondaryColor: brandProfile?.secondary_color || DEFAULT_BRANDING.secondaryColor,
    fontFamily: brandProfile?.font_family || DEFAULT_BRANDING.fontFamily,
    showAddress: brandProfile?.show_address ?? DEFAULT_BRANDING.showAddress,
    showContact: brandProfile?.show_contact ?? DEFAULT_BRANDING.showContact,
    showWebsite: brandProfile?.show_website ?? DEFAULT_BRANDING.showWebsite,
    showPageNumbers: brandProfile?.show_page_numbers ?? DEFAULT_BRANDING.showPageNumbers,
    pageNumberFormat: brandProfile?.page_number_format || DEFAULT_BRANDING.pageNumberFormat,
    footerText: brandProfile?.footer_text ?? undefined,
    authorizedSignatureUrl: brandProfile?.authorized_signature_url ?? undefined,
    signatureName: brandProfile?.signature_name ?? undefined,
    signatureTitle: brandProfile?.signature_title ?? undefined,
  };
}

/**
 * Save or update branding profile
 */
export async function saveBrandingProfile(
  organizationId: string,
  branding: Partial<PrintBranding>
): Promise<{ success: boolean; error?: string }> {
  const payload = {
    organization_id: organizationId,
    logo_url: branding.logoUrl,
    logo_width: branding.logoWidth,
    logo_position: branding.logoPosition,
    header_style: {},
    show_address: branding.showAddress,
    show_contact: branding.showContact,
    show_website: branding.showWebsite,
    footer_style: {},
    footer_text: branding.footerText,
    show_page_numbers: branding.showPageNumbers,
    page_number_format: branding.pageNumberFormat,
    authorized_signature_url: branding.authorizedSignatureUrl,
    signature_name: branding.signatureName,
    signature_title: branding.signatureTitle,
    primary_color: branding.primaryColor,
    secondary_color: branding.secondaryColor,
    font_family: branding.fontFamily,
  };
  
  const { error } = await supabase
    .from('print_brand_profiles')
    .upsert(payload, { onConflict: 'organization_id' });
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true };
}

/**
 * Load logo as base64 for PDF embedding
 */
export async function loadLogoAsBase64(logoUrl: string): Promise<string | null> {
  if (!logoUrl) return null;
  
  try {
    const response = await fetch(logoUrl);
    if (!response.ok) return null;
    
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to load logo:', error);
    return null;
  }
}

/**
 * Get watermark configuration
 */
export function getWatermarkConfig(
  isDraft: boolean,
  isConfidential: boolean,
  brandProfile?: { draft_watermark_text?: string; confidential_watermark_text?: string; watermark_opacity?: number }
) {
  if (isDraft) {
    return {
      type: 'draft' as const,
      text: brandProfile?.draft_watermark_text || 'DRAFT',
      opacity: brandProfile?.watermark_opacity || 0.15,
    };
  }
  
  if (isConfidential) {
    return {
      type: 'confidential' as const,
      text: brandProfile?.confidential_watermark_text || 'CONFIDENTIAL',
      opacity: brandProfile?.watermark_opacity || 0.15,
    };
  }
  
  return {
    type: 'none' as const,
    text: undefined,
    opacity: 0,
  };
}
