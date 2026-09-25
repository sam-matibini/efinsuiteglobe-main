/**
 * Filing form mapper registry — selects the right mapper given a tax authority's region.
 */
import { PeriodTotals, FilingFormResult } from './types';
import { buildGstHstReturn } from './canadaGstHst';
import { buildPstReturn } from './canadaPst';
import { buildQstReturn } from './canadaQst';
import { buildUsSalesTaxReturn } from './usSalesTax';
import { buildEuVatReturn } from './euVat';

export type FilingMeta = {
  authority: string;
  periodStart: string;
  periodEnd: string;
  currency?: string;
  region?: string | null;       // e.g. "CA-ON", "CA-BC", "CA-QC", "US-CA", "GB"
  countryCode?: string | null;  // ISO country
};

export type FormKind = 'gst_hst' | 'pst' | 'qst' | 'us_sales' | 'eu_vat';

export function detectFormKind(meta: FilingMeta, rows: PeriodTotals['rows']): FormKind {
  const region = (meta.region ?? '').toUpperCase();
  const country = (meta.countryCode ?? '').toUpperCase();
  const types = new Set(rows.map((r) => r.tax_type.toLowerCase()));

  if (region.startsWith('CA-QC') || types.has('qst') || types.has('tvq')) return 'qst';
  if (region.startsWith('CA-BC') || region.startsWith('CA-SK') || region.startsWith('CA-MB') || types.has('pst') || types.has('rst')) return 'pst';
  if (country === 'CA' || region.startsWith('CA-') || types.has('gst') || types.has('hst')) return 'gst_hst';
  if (country === 'US' || region.startsWith('US-')) return 'us_sales';
  if (types.has('vat')) return 'eu_vat';
  return 'gst_hst';
}

export function buildFilingForm(totals: PeriodTotals, meta: FilingMeta): FilingFormResult {
  const kind = detectFormKind(meta, totals.rows);
  const region = meta.region ?? undefined;
  switch (kind) {
    case 'qst':
      return buildQstReturn(totals, meta);
    case 'pst':
      return buildPstReturn(totals, { ...meta, province: region?.split('-')[1] });
    case 'us_sales':
      return buildUsSalesTaxReturn(totals, { ...meta, state: region?.split('-')[1] });
    case 'eu_vat':
      return buildEuVatReturn(totals, { ...meta, country: meta.countryCode ?? undefined });
    case 'gst_hst':
    default:
      return buildGstHstReturn(totals, meta);
  }
}

export * from './types';
