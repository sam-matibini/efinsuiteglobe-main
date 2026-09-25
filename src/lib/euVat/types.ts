/**
 * Phase 13 — EU VAT OSS / MOSS + Reverse Charge types.
 */

export const EU_COUNTRIES = [
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT',
  'LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',
] as const;
export type EuCountryCode = typeof EU_COUNTRIES[number];

export type OssScheme = 'union' | 'non_union' | 'import_ioss';
export type SupplyType = 'services' | 'goods' | 'triangulation';
export type VatRateType = 'standard' | 'reduced';

export interface EuVatCalcInput {
  organizationId: string;
  /** Supplier country (where the seller is established / OSS-registered) */
  supplierCountry: string;
  /** Customer ship-to country (member state of consumption for B2C) */
  customerCountry: string;
  /** Customer VAT number, if B2B */
  customerVatNumber?: string;
  /** "services" or "goods" */
  supplyType: SupplyType;
  /** Net amount in EUR (or document currency) */
  netAmount: number;
  /** Document date — used for VAT rate effective lookup */
  documentDate?: string;
  /** Force a specific rate type — defaults to standard */
  rateType?: VatRateType;
}

export interface EuVatCalcResult {
  scenario:
    | 'domestic'                  // same country supplier↔customer
    | 'oss_b2c'                   // EU cross-border B2C (OSS applies)
    | 'reverse_charge_b2b'        // EU cross-border B2B with valid VAT ID
    | 'export_outside_eu'         // customer outside EU
    | 'no_eu_context';            // supplier not in EU and customer not in EU
  vatCountry: string;             // country whose VAT rate is applied (or '' if zero-rated)
  vatRate: number;                // %
  vatAmount: number;              // EUR
  netAmount: number;
  grossAmount: number;
  reverseCharge: boolean;
  notes: string[];
}

export interface OssReturnLineInput {
  memberStateOfConsumption: string;
  supplyType: 'services' | 'goods';
  vatRateType: VatRateType;
  vatRate: number;
  taxableBase: number;            // EUR
  vatAmount: number;              // EUR
}

export interface OssReturnPayload {
  organizationId: string;
  registrationId: string;
  scheme: OssScheme;
  ossRegistrationNumber: string;
  memberStateOfIdentification: string;
  periodYear: number;
  periodQuarter: 1 | 2 | 3 | 4;
  periodStart: string;            // YYYY-MM-DD
  periodEnd: string;              // YYYY-MM-DD
  currency: string;               // 'EUR'
  lines: OssReturnLineInput[];
}
