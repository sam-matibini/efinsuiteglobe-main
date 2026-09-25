/**
 * Smart Tax Resolver
 *
 * Resolution order (highest priority first):
 *   1. Line-level override (explicit tax_code_id on the line)
 *   2. Product / inventory item default tax code
 *   3. Customer / vendor exemption (returns the org's "EXEMPT" code)
 *   4. Customer / vendor default tax code
 *   5. Org default per jurisdiction (auto-detected from ship-to address)
 *   6. Fallback: null (UI may surface a missing-tax-code exception)
 *
 * Pure function — no side effects, no network calls. Pass in the candidate
 * objects and the resolver returns the chosen tax_code_id plus a reason
 * string for audit / debugging purposes.
 */

export interface ResolvableTaxCode {
  id: string;
  code: string;
  is_exempt?: boolean | null;
  is_zero_rated?: boolean | null;
  jurisdiction?: string | null;
}

export interface ResolvableEntity {
  id?: string;
  default_tax_code_id?: string | null;
  tax_exempt?: boolean | null;
  province?: string | null;
  country?: string | null;
}

export interface ResolvableProduct {
  id?: string;
  default_tax_code_id?: string | null;
  tax_category?: 'standard' | 'zero_rated' | 'exempt' | 'reduced' | null;
}

export interface TaxResolutionInput {
  /** Explicit override on the line item (wins if present) */
  lineOverrideTaxCodeId?: string | null;
  /** Product / inventory item being sold or purchased */
  product?: ResolvableProduct | null;
  /** Customer (sales) or vendor (purchases) */
  entity?: ResolvableEntity | null;
  /** Jurisdiction code (e.g. 'CA-ON', 'CA-BC') derived from ship-to */
  jurisdictionCode?: string | null;
  /** All available tax codes for the organization */
  availableTaxCodes: ResolvableTaxCode[];
  /** Org-level default tax code id for the jurisdiction */
  orgDefaultTaxCodeId?: string | null;
}

export interface TaxResolutionResult {
  taxCodeId: string | null;
  reason:
    | 'line_override'
    | 'product_default'
    | 'entity_exempt'
    | 'product_zero_rated'
    | 'product_exempt'
    | 'entity_default'
    | 'org_default_jurisdiction'
    | 'no_match';
  exempt: boolean;
}

/**
 * Find a tax code in the available list matching the given predicate.
 */
function findCode(
  codes: ResolvableTaxCode[],
  predicate: (c: ResolvableTaxCode) => boolean
): ResolvableTaxCode | null {
  return codes.find(predicate) ?? null;
}

/**
 * Resolve the appropriate tax code for a transaction line.
 */
export function resolveTaxCode(input: TaxResolutionInput): TaxResolutionResult {
  const {
    lineOverrideTaxCodeId,
    product,
    entity,
    jurisdictionCode,
    availableTaxCodes,
    orgDefaultTaxCodeId,
  } = input;

  // 1. Explicit line override
  if (lineOverrideTaxCodeId) {
    const match = findCode(availableTaxCodes, (c) => c.id === lineOverrideTaxCodeId);
    return {
      taxCodeId: lineOverrideTaxCodeId,
      reason: 'line_override',
      exempt: match?.is_exempt === true,
    };
  }

  // 2. Product-level zero-rated / exempt category beats entity defaults
  if (product?.tax_category === 'zero_rated') {
    const zr = findCode(availableTaxCodes, (c) => c.is_zero_rated === true);
    return {
      taxCodeId: zr?.id ?? product.default_tax_code_id ?? null,
      reason: 'product_zero_rated',
      exempt: false,
    };
  }
  if (product?.tax_category === 'exempt') {
    const ex = findCode(availableTaxCodes, (c) => c.is_exempt === true);
    return {
      taxCodeId: ex?.id ?? product.default_tax_code_id ?? null,
      reason: 'product_exempt',
      exempt: true,
    };
  }

  // 3. Product-level explicit default
  if (product?.default_tax_code_id) {
    return {
      taxCodeId: product.default_tax_code_id,
      reason: 'product_default',
      exempt: false,
    };
  }

  // 4. Entity-level exemption
  if (entity?.tax_exempt) {
    const ex = findCode(availableTaxCodes, (c) => c.is_exempt === true);
    return {
      taxCodeId: ex?.id ?? null,
      reason: 'entity_exempt',
      exempt: true,
    };
  }

  // 5. Entity-level default
  if (entity?.default_tax_code_id) {
    return {
      taxCodeId: entity.default_tax_code_id,
      reason: 'entity_default',
      exempt: false,
    };
  }

  // 6. Org default per jurisdiction (from ship-to address)
  if (jurisdictionCode) {
    const byJur = findCode(
      availableTaxCodes,
      (c) => (c.jurisdiction ?? '').toUpperCase() === jurisdictionCode.toUpperCase()
    );
    if (byJur) {
      return {
        taxCodeId: byJur.id,
        reason: 'org_default_jurisdiction',
        exempt: false,
      };
    }
  }

  // 7. Org-wide fallback default
  if (orgDefaultTaxCodeId) {
    return {
      taxCodeId: orgDefaultTaxCodeId,
      reason: 'org_default_jurisdiction',
      exempt: false,
    };
  }

  return { taxCodeId: null, reason: 'no_match', exempt: false };
}

/**
 * Best-effort jurisdiction inference from a customer/vendor address.
 * Returns canonical codes like 'CA-ON', 'CA-BC', 'US-CA'.
 */
export function inferJurisdictionCode(entity?: {
  country?: string | null;
  province?: string | null;
} | null): string | null {
  if (!entity) return null;
  const country = (entity.country ?? '').trim().toUpperCase();
  const province = (entity.province ?? '').trim().toUpperCase();
  if (!country || !province) return null;

  // Map common country names to ISO 3166-1 alpha-2
  const countryCode =
    country === 'CANADA' ? 'CA' :
    country === 'UNITED STATES' || country === 'USA' ? 'US' :
    country === 'UNITED KINGDOM' || country === 'UK' ? 'GB' :
    country.length === 2 ? country : country.slice(0, 2);

  // Province may already be a code (ON, BC) or a name
  const provinceCode =
    province.length === 2 ? province :
    province === 'ONTARIO' ? 'ON' :
    province === 'BRITISH COLUMBIA' ? 'BC' :
    province === 'ALBERTA' ? 'AB' :
    province === 'QUEBEC' || province === 'QUÉBEC' ? 'QC' :
    province === 'MANITOBA' ? 'MB' :
    province === 'SASKATCHEWAN' ? 'SK' :
    province === 'NOVA SCOTIA' ? 'NS' :
    province === 'NEW BRUNSWICK' ? 'NB' :
    province === 'NEWFOUNDLAND AND LABRADOR' ? 'NL' :
    province === 'PRINCE EDWARD ISLAND' ? 'PE' :
    province === 'YUKON' ? 'YT' :
    province === 'NORTHWEST TERRITORIES' ? 'NT' :
    province === 'NUNAVUT' ? 'NU' :
    province.slice(0, 2);

  return `${countryCode}-${provinceCode}`;
}
