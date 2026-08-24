/**
 * Paid / ITC retail sales tax rates for pickers and derived tax codes.
 * Collect-side codes stay as-is; this appends purchase-side siblings
 * (GST-ITC, HST-ITC, PST-PAID, VAT-INPUT, …) using localized paid names.
 */
import {
  classifyRetailTaxFamily,
  getCountryLocalization,
  resolveCountryCode,
  resolveRetailTaxType,
  type TaxAppliesTo,
} from '@/data/countryLocalizations';
export interface RetailTaxCodeLike {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  rate: number;
  jurisdiction: string | null;
  tax_type: string;
  is_recoverable: boolean;
  is_compound: boolean;
  is_active: boolean;
  gl_collected_account_id: string | null;
  gl_paid_account_id: string | null;
  created_at: string;
  updated_at: string;
  applies_to?: 'sales' | 'purchases' | 'both' | string | null;
  paid_name?: string | null;
}

const SKIP_TYPES = new Set([
  'exempt',
  'zero-rated',
  'out-of-scope',
  'wht',
  'levy',
]);

const SKIP_CODES = new Set(['E', 'EXEMPT', 'O/S', 'Z', 'ZR-EXP', 'NONE', 'PROFITS']);

export function isPaidRetailTaxCode(code: string, appliesTo?: TaxAppliesTo | string | null): boolean {
  const upper = (code || '').toUpperCase();
  if (appliesTo === 'purchases') return true;
  return /-(ITC|PAID|ITR|INPUT)$/.test(upper) || upper === 'USE_TAX';
}

export function paidCodeFor(code: string): string {
  const upper = (code || '').toUpperCase();
  if (isPaidRetailTaxCode(upper)) return upper;
  if (upper === 'QST' || upper.startsWith('QST')) return 'QST-ITR';
  if (upper === 'PST' || upper.startsWith('PST')) {
    return upper === 'PST' ? 'PST-PAID' : `${upper}-PAID`;
  }
  if (upper === 'SALES_TAX' || upper === 'SST' || upper === 'ST') return `${upper}-PAID`;
  return `${upper}-ITC`;
}

export function paidDisplayName(code: string, countryCode?: string | null, fallbackName?: string): string {
  const country = resolveCountryCode(countryCode);
  const family = classifyRetailTaxFamily(code);
  const loc = getCountryLocalization(country);
  const match = loc.taxTypes.find(
    (t) => t.code === code || code.toUpperCase().startsWith(t.code),
  );
  if (match?.paidName) return match.paidName;
  if (family === 'hst') return 'HST Paid (ITC)';
  if (family === 'gst') return 'GST Paid (ITC)';
  if (family === 'pst') return code.toUpperCase().includes('QST') ? 'QST Paid (ITR)' : 'PST Paid';
  if (family === 'sales_tax') return 'Sales Tax Paid / Use Tax';
  if (family === 'vat') {
    const primary = loc.taxTypes[0];
    return primary ? resolveRetailTaxType(primary).paidName : 'VAT Paid (Input VAT)';
  }
  if (fallbackName && /paid|itc|input/i.test(fallbackName)) return fallbackName;
  return fallbackName ? `${fallbackName} Paid` : `${code} Paid`;
}

function shouldExpandToPaid(code: RetailTaxCodeLike): boolean {
  const upper = (code.code || '').toUpperCase();
  if (isPaidRetailTaxCode(upper, code.applies_to)) return false;
  if (SKIP_CODES.has(upper)) return false;
  if (SKIP_TYPES.has((code.tax_type || '').toLowerCase())) return false;
  if ((code.tax_type || '').toLowerCase() === 'combined') return false;
  if (code.rate <= 0) return false;
  return true;
}

/**
 * Append purchase-side ITC / Input VAT / PST Paid siblings for every collect rate.
 * Existing paid rows (from the DB or a previous expand) are left untouched.
 */
export function appendPaidRetailTaxCodes<T extends RetailTaxCodeLike>(
  codes: T[],
  countryCode?: string | null,
  makeId?: (source: T, paidCode: string) => string,
): T[] {
  const existing = new Set(codes.map((c) => c.code.toUpperCase()));
  const extras: T[] = [];

  for (const code of codes) {
    if (!shouldExpandToPaid(code)) continue;
    const paidCode = paidCodeFor(code.code);
    if (existing.has(paidCode)) continue;
    existing.add(paidCode);
    extras.push({
      ...code,
      id: makeId ? makeId(code, paidCode) : `${code.id}-paid`,
      code: paidCode,
      name: paidDisplayName(code.code, countryCode, code.paid_name || code.name),
      applies_to: 'purchases',
      paid_name: paidDisplayName(code.code, countryCode, code.paid_name || undefined),
      is_recoverable: classifyRetailTaxFamily(code.code) === 'pst'
        ? code.tax_type === 'QST' || code.code.toUpperCase() === 'QST'
        : code.is_recoverable,
      gl_collected_account_id: null,
      gl_paid_account_id: code.gl_paid_account_id,
    });
  }

  return extras.length ? [...codes, ...extras] : codes;
}

export function taxCodeGroupLabel(code: RetailTaxCodeLike): 'Paid / ITC' | 'Exempt' | 'Collect' {
  if (isPaidRetailTaxCode(code.code, code.applies_to)) return 'Paid / ITC';
  if (code.rate === 0 || SKIP_TYPES.has((code.tax_type || '').toLowerCase())) return 'Exempt';
  return 'Collect';
}
