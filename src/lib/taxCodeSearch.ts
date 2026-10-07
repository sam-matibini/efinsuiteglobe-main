/**
 * Search text for the banking tax picker.
 * Collected and Paid (ITC) codes match on province, rate, and tax name.
 */

export interface TaxSearchOption {
  code: string;
  name: string;
  provinceCode?: string;
  taxModel?: string;
  combinedRate?: number;
  breakdown?: Array<{ code: string; rate: number; authority?: string }>;
}

export interface TaxSearchCode {
  code: string;
  name: string;
  tax_type?: string | null;
  rate?: number | null;
  jurisdiction?: string | null;
  applies_to?: string | null;
}

function queryParts(term: string): string[] {
  return term.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

export function taxOptionSearchText(option: TaxSearchOption, side: 'collected' | 'paid'): string {
  const sideWords = side === 'paid'
    ? 'paid itc input itr recoverable'
    : 'collected collect sales payable';
  return [
    option.code,
    option.name,
    option.provinceCode,
    option.taxModel,
    option.combinedRate,
    sideWords,
    ...(option.breakdown || []).flatMap((part) => [part.code, part.rate, part.authority]),
  ].filter((part) => part !== undefined && part !== null).join(' ').toLowerCase();
}

export function taxOptionMatches(option: TaxSearchOption, term: string, side: 'collected' | 'paid'): boolean {
  const parts = queryParts(term);
  if (parts.length === 0) return true;
  const text = taxOptionSearchText(option, side);
  return parts.every((part) => text.includes(part));
}

export function taxCodeMatches(code: TaxSearchCode, term: string): boolean {
  const parts = queryParts(term);
  if (parts.length === 0) return true;
  const paid = code.applies_to === 'purchases' || /-(ITC|PAID|ITR|INPUT)$/i.test(code.code || '');
  const text = [
    code.code,
    code.name,
    code.tax_type,
    code.jurisdiction,
    code.rate,
    paid ? 'paid itc input' : 'collected collect',
  ].filter((part) => part !== undefined && part !== null).join(' ').toLowerCase();
  return parts.every((part) => text.includes(part));
}

export function noTaxMatches(term: string): boolean {
  const parts = queryParts(term);
  if (parts.length === 0) return true;
  const text = 'no tax none exempt';
  return parts.every((part) => text.includes(part));
}
