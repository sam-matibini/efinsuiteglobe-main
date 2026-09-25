/**
 * Centralized Document Logo Resolver
 * Resolves the correct logo URL for any document type based on organization settings.
 */

import type { Organization } from '@/hooks/useOrganization';

export type DocumentType = 'invoice' | 'receipt' | 'payroll' | 'statement';

/**
 * Resolves the logo URL for a given document type.
 * 
 * Resolution order:
 * 1. Check document-specific toggle — if false, return null (no logo)
 * 2. Check document-specific override URL — if set, return it
 * 3. Fall back to the primary organization logo_url
 */
export function getDocumentLogoUrl(
  organization: Organization | null | undefined,
  documentType: DocumentType
): string | null {
  if (!organization) return null;

  switch (documentType) {
    case 'invoice': {
      if (organization.invoice_show_logo === false) return null;
      return organization.invoice_logo_url || organization.logo_url || null;
    }
    case 'receipt': {
      if (organization.receipt_show_logo === false) return null;
      return organization.receipt_logo_url || organization.logo_url || null;
    }
    case 'payroll': {
      if (organization.payroll_show_logo === false) return null;
      return organization.payroll_logo_url || organization.logo_url || null;
    }
    case 'statement': {
      if (organization.statement_show_logo === false) return null;
      return organization.statement_logo_url || organization.logo_url || null;
    }
    default:
      return organization.logo_url || null;
  }
}
