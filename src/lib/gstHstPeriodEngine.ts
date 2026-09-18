/**
 * CRA GST/HST period engine.
 *
 * Builds a GST34 working copy from invoices, bills, and expenses in the
 * selected reporting period — not from lifetime tax GL balances.
 *
 * Line mapping (GST/HST NETFILE / GST34):
 *   90  Taxable sales including zero-rated supplies (except zero-rated exports)
 *   90A Taxable sales (GST/HST charged)
 *   90B Zero-rated sales (GST/HST at 0%)
 *   91  Exempt supplies, zero-rated exports, and other revenue
 *   101 Sales and other revenue (90 + 91)
 *   103 GST/HST collected or collectible
 *   106 Input tax credits (ITCs)
 *   109 Net tax (105 − 108)
 *
 * @see https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/calculate-prepare-report/instructions-preparing-return.html
 */
import { buildGstHstReturn } from '@/lib/filings/canadaGstHst';
import type { FilingFormResult, PeriodTaxRow, PeriodTotals } from '@/lib/filings/types';
import type { TaxCodePeriodRow } from '@/lib/taxPeriodReport';

export type GstHstSupplyClass = 'taxable' | 'zero_rated' | 'exempt';

export interface GstHstTaxCodeFlag {
  code: string;
  name?: string | null;
  tax_type?: string | null;
  rate?: number | null;
  is_zero_rated?: boolean | null;
  is_exempt?: boolean | null;
  is_recoverable?: boolean | null;
}

export interface GstHstDocumentTax {
  tax_code?: string | null;
  tax_type?: string | null;
  rate?: number | null;
  taxable_amount?: number | null;
  tax_amount?: number | null;
  is_recoverable?: boolean | null;
  authority?: string | null;
}

export interface GstHstInvoiceDocument {
  id: string;
  date: string;
  number: string;
  description?: string | null;
  status?: string | null;
  subtotal?: number | null;
  tax_amount?: number | null;
  gst_hst_amount?: number | null;
  is_gst_hst_exempt?: boolean | null;
  taxes?: GstHstDocumentTax[] | null;
}

export interface GstHstPurchaseDocument {
  source: 'bill' | 'expense';
  id: string;
  date: string;
  number: string;
  description?: string | null;
  status?: string | null;
  subtotal?: number | null;
  tax_amount?: number | null;
  taxes?: GstHstDocumentTax[] | null;
}

export interface GstHstSupportRow {
  date: string;
  type: 'Invoice' | 'Bill' | 'Expense';
  number: string;
  description: string;
  taxCode: string;
  supplyClass: GstHstSupplyClass | 'itc' | 'non_recoverable';
  craLine: string;
  taxableAmount: number;
  taxAmount: number;
}

export interface GstHstPeriodSnapshot {
  periodStart: string;
  periodEnd: string;
  taxableSales: number;
  zeroRatedSales: number;
  exemptSales: number;
  exemptZeroRatedSales: number;
  line90: number;
  line91: number;
  line101: number;
  gstHstCollected: number;
  itc: number;
  netTax: number;
  invoiceCount: number;
  purchaseCount: number;
  usedDocumentCollected: boolean;
  usedDocumentItc: boolean;
  supportRows: GstHstSupportRow[];
  rows: PeriodTaxRow[];
  totals: PeriodTotals;
  byTaxCode: TaxCodePeriodRow[];
  form: FilingFormResult;
}

export interface GstHstJournalFallback {
  taxCollected: number;
  itcClaimed: number;
  taxableSales: number;
  rows?: PeriodTaxRow[];
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const EXCLUDED_GST_HST_STATUSES = new Set([
  'draft',
  'void',
  'cancelled',
  'canceled',
  'rejected',
]);

export function isIncludedGstHstDocument(status?: string | null): boolean {
  if (!status) return true;
  return !EXCLUDED_GST_HST_STATUSES.has(status.toLowerCase());
}

export function isGstHstTax(row: {
  tax_type?: string | null;
  tax_code?: string | null;
  authority?: string | null;
}): boolean {
  if (/^(gst|hst)$/i.test(String(row.tax_type ?? ''))) return true;
  const code = String(row.tax_code ?? '').toUpperCase();
  if (code.startsWith('GST') || code.startsWith('HST')) return true;
  const auth = String(row.authority ?? '').toUpperCase();
  return auth.includes('GST') || auth.includes('HST');
}

export function isProvincialSalesTax(row: {
  tax_type?: string | null;
  tax_code?: string | null;
  authority?: string | null;
}): boolean {
  if (/^(pst|qst|rst|tvq)$/i.test(String(row.tax_type ?? ''))) return true;
  const hay = `${row.tax_code ?? ''} ${row.authority ?? ''}`.toUpperCase();
  return hay.includes('PST') || hay.includes('QST') || hay.includes('RST') || hay.includes('TVQ');
}

export function classifyGstHstSupply(
  tax: GstHstDocumentTax | undefined,
  flags: GstHstTaxCodeFlag | undefined,
  invoiceExempt?: boolean | null,
): GstHstSupplyClass {
  if (invoiceExempt) return 'exempt';
  if (flags?.is_exempt) return 'exempt';
  if (flags?.is_zero_rated) return 'zero_rated';
  const rate = Number(tax?.rate ?? flags?.rate ?? 0);
  const taxAmount = Number(tax?.tax_amount ?? 0);
  if (tax && isGstHstTax({ ...tax, tax_type: tax.tax_type ?? flags?.tax_type }) && rate === 0 && taxAmount === 0) {
    return 'zero_rated';
  }
  return 'taxable';
}

function flagMap(flags: GstHstTaxCodeFlag[]): Map<string, GstHstTaxCodeFlag> {
  const map = new Map<string, GstHstTaxCodeFlag>();
  for (const flag of flags) {
    if (flag.code) map.set(flag.code.toUpperCase(), flag);
  }
  return map;
}

function lookupFlag(map: Map<string, GstHstTaxCodeFlag>, code?: string | null): GstHstTaxCodeFlag | undefined {
  if (!code) return undefined;
  return map.get(code.toUpperCase());
}

function toPeriodRow(
  source: PeriodTaxRow['source'],
  tax: GstHstDocumentTax,
  flags: GstHstTaxCodeFlag | undefined,
  supply: GstHstSupplyClass,
): PeriodTaxRow {
  return {
    source,
    tax_type: String(tax.tax_type || flags?.tax_type || 'hst').toLowerCase(),
    tax_code: tax.tax_code ?? flags?.code ?? null,
    authority: tax.authority ?? 'CRA',
    jurisdiction_code: null,
    rate: Number(tax.rate ?? flags?.rate ?? 0),
    taxable_amount: Number(tax.taxable_amount ?? 0),
    tax_amount: Number(tax.tax_amount ?? 0),
    is_recoverable: tax.is_recoverable !== false && flags?.is_recoverable !== false,
    is_zero_rated: supply === 'zero_rated',
    is_exempt: supply === 'exempt',
  };
}

function bumpCode(
  map: Map<string, TaxCodePeriodRow>,
  code: string,
  name: string,
  rate: number,
  patch: Partial<Pick<TaxCodePeriodRow, 'taxableAmount' | 'taxCollected' | 'itcClaimed'>>,
) {
  if (!map.has(code)) {
    map.set(code, {
      code,
      name,
      rate,
      taxableAmount: 0,
      taxCollected: 0,
      itcClaimed: 0,
      taxDue: 0,
    });
  }
  const row = map.get(code)!;
  if (patch.taxableAmount) row.taxableAmount += patch.taxableAmount;
  if (patch.taxCollected) row.taxCollected += patch.taxCollected;
  if (patch.itcClaimed) row.itcClaimed += patch.itcClaimed;
}

export function summarizeGstHstDocuments(input: {
  periodStart: string;
  periodEnd: string;
  invoices: GstHstInvoiceDocument[];
  purchases: GstHstPurchaseDocument[];
  taxCodes?: GstHstTaxCodeFlag[];
  journal?: GstHstJournalFallback;
  authority?: string;
}): GstHstPeriodSnapshot {
  const flags = flagMap(input.taxCodes ?? []);
  const invoices = input.invoices.filter((inv) => isIncludedGstHstDocument(inv.status));
  const purchases = input.purchases.filter((doc) => isIncludedGstHstDocument(doc.status));

  let taxableSales = 0;
  let zeroRatedSales = 0;
  let exemptSales = 0;
  let gstHstCollected = 0;
  let itc = 0;
  let totalPurchases = 0;
  let invoiceGstTaxPosted = 0;
  let purchaseGstTaxPosted = 0;

  const supportRows: GstHstSupportRow[] = [];
  const rows: PeriodTaxRow[] = [];
  const codeMap = new Map<string, TaxCodePeriodRow>();

  for (const inv of invoices) {
    const gstRows = (inv.taxes ?? []).filter((tax) => isGstHstTax(tax));
    const subtotal = Number(inv.subtotal ?? 0);
    const headerGst = Number(inv.gst_hst_amount ?? 0);
    const description = inv.description || inv.number || 'Invoice';

    if (gstRows.length > 0) {
      for (const tax of gstRows) {
        const flag = lookupFlag(flags, tax.tax_code);
        const supply = classifyGstHstSupply(tax, flag, inv.is_gst_hst_exempt);
        const taxable = Number(tax.taxable_amount ?? 0);
        const taxAmount = Number(tax.tax_amount ?? 0);
        const code = tax.tax_code || flag?.code || 'GST/HST';
        rows.push(toPeriodRow('invoice', tax, flag, supply));
        invoiceGstTaxPosted += taxAmount;

        if (supply === 'exempt') {
          exemptSales += taxable || subtotal;
          supportRows.push({
            date: inv.date,
            type: 'Invoice',
            number: inv.number,
            description,
            taxCode: code,
            supplyClass: 'exempt',
            craLine: '91',
            taxableAmount: taxable || subtotal,
            taxAmount: 0,
          });
          bumpCode(codeMap, code, flag?.name || code, Number(tax.rate ?? flag?.rate ?? 0), {
            taxableAmount: taxable || subtotal,
          });
          continue;
        }

        if (supply === 'zero_rated') {
          zeroRatedSales += taxable || subtotal;
          supportRows.push({
            date: inv.date,
            type: 'Invoice',
            number: inv.number,
            description,
            taxCode: code,
            supplyClass: 'zero_rated',
            craLine: '90B',
            taxableAmount: taxable || subtotal,
            taxAmount: 0,
          });
          bumpCode(codeMap, code, flag?.name || code, 0, { taxableAmount: taxable || subtotal });
          continue;
        }

        taxableSales += taxable;
        gstHstCollected += taxAmount;
        supportRows.push({
          date: inv.date,
          type: 'Invoice',
          number: inv.number,
          description,
          taxCode: code,
          supplyClass: 'taxable',
          craLine: '90A / 103',
          taxableAmount: taxable,
          taxAmount,
        });
        bumpCode(codeMap, code, flag?.name || code, Number(tax.rate ?? flag?.rate ?? 0), {
          taxableAmount: taxable,
          taxCollected: taxAmount,
        });
      }
      continue;
    }

    if (inv.is_gst_hst_exempt) {
      exemptSales += subtotal;
      supportRows.push({
        date: inv.date,
        type: 'Invoice',
        number: inv.number,
        description,
        taxCode: 'EXEMPT',
        supplyClass: 'exempt',
        craLine: '91',
        taxableAmount: subtotal,
        taxAmount: 0,
      });
      continue;
    }

    if (headerGst > 0) {
      taxableSales += subtotal;
      gstHstCollected += headerGst;
      invoiceGstTaxPosted += headerGst;
      supportRows.push({
        date: inv.date,
        type: 'Invoice',
        number: inv.number,
        description,
        taxCode: 'GST/HST',
        supplyClass: 'taxable',
        craLine: '90A / 103',
        taxableAmount: subtotal,
        taxAmount: headerGst,
      });
      rows.push({
        source: 'invoice',
        tax_type: 'hst',
        tax_code: 'GST/HST',
        authority: 'CRA',
        jurisdiction_code: null,
        rate: subtotal > 0 ? round2((headerGst / subtotal) * 100) : 0,
        taxable_amount: subtotal,
        tax_amount: headerGst,
        is_recoverable: true,
        is_zero_rated: false,
        is_exempt: false,
      });
      bumpCode(codeMap, 'GST/HST', 'GST/HST', subtotal > 0 ? round2((headerGst / subtotal) * 100) : 0, {
        taxableAmount: subtotal,
        taxCollected: headerGst,
      });
      continue;
    }

    if (subtotal > 0 && Number(inv.tax_amount ?? 0) === 0) {
      exemptSales += subtotal;
      supportRows.push({
        date: inv.date,
        type: 'Invoice',
        number: inv.number,
        description,
        taxCode: 'OTHER',
        supplyClass: 'exempt',
        craLine: '91',
        taxableAmount: subtotal,
        taxAmount: 0,
      });
    }
  }

  for (const doc of purchases) {
    const gstRows = (doc.taxes ?? []).filter((tax) => isGstHstTax(tax));
    const type = doc.source === 'expense' ? 'Expense' : 'Bill';
    const description = doc.description || doc.number || type;

    for (const tax of gstRows) {
      const flag = lookupFlag(flags, tax.tax_code);
      const taxable = Number(tax.taxable_amount ?? 0);
      const taxAmount = Number(tax.tax_amount ?? 0);
      const recoverable = tax.is_recoverable !== false && flag?.is_recoverable !== false;
      const code = tax.tax_code || flag?.code || 'GST/HST';
      purchaseGstTaxPosted += taxAmount;
      totalPurchases += taxable;
      rows.push(toPeriodRow(doc.source, tax, flag, 'taxable'));

      if (recoverable) {
        itc += taxAmount;
        supportRows.push({
          date: doc.date,
          type,
          number: doc.number,
          description,
          taxCode: code,
          supplyClass: 'itc',
          craLine: '106',
          taxableAmount: taxable,
          taxAmount,
        });
        bumpCode(codeMap, code, flag?.name || code, Number(tax.rate ?? flag?.rate ?? 0), {
          itcClaimed: taxAmount,
        });
      } else {
        supportRows.push({
          date: doc.date,
          type,
          number: doc.number,
          description,
          taxCode: code,
          supplyClass: 'non_recoverable',
          craLine: '—',
          taxableAmount: taxable,
          taxAmount,
        });
      }
    }
  }

  const journal = input.journal;
  const usedDocumentCollected = invoiceGstTaxPosted !== 0 || gstHstCollected !== 0;
  const usedDocumentItc = purchaseGstTaxPosted !== 0 || itc !== 0;
  const usedDocumentSales = invoices.length > 0;

  if (journal) {
    if (!usedDocumentCollected) {
      gstHstCollected = journal.taxCollected;
      if (!usedDocumentSales && journal.taxableSales) taxableSales = journal.taxableSales;
    }
    if (!usedDocumentItc) itc = journal.itcClaimed;
    if (!usedDocumentSales && journal.rows?.length) {
      for (const row of journal.rows) {
        if (!rows.some((existing) => existing.tax_code === row.tax_code && existing.source === row.source && existing.tax_amount === row.tax_amount)) {
          rows.push(row);
        }
      }
    }
  }

  taxableSales = round2(taxableSales);
  zeroRatedSales = round2(zeroRatedSales);
  exemptSales = round2(exemptSales);
  gstHstCollected = round2(gstHstCollected);
  itc = round2(itc);
  const line90 = round2(taxableSales + zeroRatedSales);
  const line91 = exemptSales;
  const line101 = round2(line90 + line91);
  const netTax = round2(gstHstCollected - itc);
  const exemptZeroRatedSales = round2(zeroRatedSales + exemptSales);

  const byTaxCode = Array.from(codeMap.values())
    .map((row) => ({
      ...row,
      taxableAmount: round2(row.taxableAmount),
      taxCollected: round2(row.taxCollected),
      itcClaimed: round2(row.itcClaimed),
      taxDue: round2(row.taxCollected - row.itcClaimed),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  supportRows.sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));

  const totals: PeriodTotals = {
    rows,
    totalSales: line101,
    totalPurchases: round2(totalPurchases),
    taxableSales,
    zeroRatedSales,
    exemptSales,
  };

  const form = buildGstHstReturn(totals, {
    authority: input.authority ?? 'CRA',
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    currency: 'CAD',
  });

  return {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    taxableSales,
    zeroRatedSales,
    exemptSales,
    exemptZeroRatedSales,
    line90,
    line91,
    line101,
    gstHstCollected,
    itc,
    netTax,
    invoiceCount: invoices.length,
    purchaseCount: purchases.length,
    usedDocumentCollected,
    usedDocumentItc,
    supportRows,
    rows,
    totals,
    byTaxCode,
    form,
  };
}

export function emptyGstHstSnapshot(periodStart: string, periodEnd: string, authority = 'CRA'): GstHstPeriodSnapshot {
  return summarizeGstHstDocuments({
    periodStart,
    periodEnd,
    invoices: [],
    purchases: [],
    authority,
  });
}

export function groupGstHstSupportByLine(rows: GstHstSupportRow[]): { line: string; label: string; rows: GstHstSupportRow[]; taxableAmount: number; taxAmount: number }[] {
  const order = ['90A / 103', '90B', '91', '106', '—'];
  const labels: Record<string, string> = {
    '90A / 103': 'Taxable sales and GST/HST collected',
    '90B': 'Zero-rated sales',
    '91': 'Exempt / other revenue',
    '106': 'Input tax credits (ITCs)',
    '—': 'Non-recoverable GST/HST',
  };
  const map = new Map<string, GstHstSupportRow[]>();
  for (const row of rows) {
    if (!map.has(row.craLine)) map.set(row.craLine, []);
    map.get(row.craLine)!.push(row);
  }
  const extra = Array.from(map.keys()).filter((line) => !order.includes(line)).sort();
  return [...order, ...extra]
    .filter((line) => map.has(line))
    .map((line) => {
      const groupRows = map.get(line)!;
      return {
        line,
        label: labels[line] || line,
        rows: groupRows,
        taxableAmount: round2(groupRows.reduce((s, r) => s + r.taxableAmount, 0)),
        taxAmount: round2(groupRows.reduce((s, r) => s + r.taxAmount, 0)),
      };
    });
}
