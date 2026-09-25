/**
 * Phase 12 — Real-time address-based tax types.
 * Provider-agnostic interface for Avalara / TaxJar / future providers.
 */

export type TaxProvider = 'avalara' | 'taxjar' | 'none';

export interface TaxAddress {
  line1?: string;
  line2?: string;
  city?: string;
  region: string; // state/province code, e.g. "CA"
  postalCode: string;
  countryCode: string; // ISO-2, e.g. "US"
}

export interface TaxLineInput {
  id: string;
  amount: number; // pre-tax, in major units (USD)
  quantity?: number;
  productTaxCode?: string; // Avalara tax code or TaxJar product_tax_code
  description?: string;
  isExempt?: boolean;
  exemptionCertificateNumber?: string;
}

export interface AddressTaxRequest {
  organizationId: string;
  documentId?: string; // invoice id for audit trail
  documentDate?: string; // YYYY-MM-DD
  customerCode?: string;
  exemptionCertificateNumber?: string;
  origin: TaxAddress;
  destination: TaxAddress;
  lines: TaxLineInput[];
  currency?: string;
  /** Skip cache and force a fresh provider call */
  skipCache?: boolean;
}

export interface JurisdictionBreakdown {
  jurisdiction: string;
  type: 'state' | 'county' | 'city' | 'special' | 'country' | 'other';
  rate: number;
  taxAmount: number;
}

export interface TaxLineResult {
  id: string;
  taxableAmount: number;
  taxAmount: number;
  effectiveRate: number;
  jurisdictions: JurisdictionBreakdown[];
}

export interface AddressTaxResponse {
  provider: TaxProvider;
  totalTax: number;
  totalTaxableAmount: number;
  effectiveRate: number;
  currency: string;
  lines: TaxLineResult[];
  jurisdictions: JurisdictionBreakdown[];
  cacheHit: boolean;
  warnings?: string[];
}
