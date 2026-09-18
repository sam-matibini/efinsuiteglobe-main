/**
 * Canada GST/HST return mapper — produces GST34 form lines.
 * Reference: CRA GST34-2 (Goods and Services Tax/Harmonized Sales Tax Return).
 */
import { PeriodTotals, FilingFormResult, FilingFormLine, sumWhere } from './types';

const isGstHst = (r: { tax_type: string; tax_code?: string | null; authority?: string | null }) => {
  if (/^(gst|hst)$/i.test(r.tax_type)) return true;
  const code = String(r.tax_code ?? '').toUpperCase();
  if (code.startsWith('GST') || code.startsWith('HST')) return true;
  const auth = String(r.authority ?? '').toUpperCase();
  return auth.includes('GST') || auth.includes('HST');
};

export function buildGstHstReturn(
  totals: PeriodTotals,
  meta: { authority: string; periodStart: string; periodEnd: string; currency?: string }
): FilingFormResult {
  const { rows } = totals;

  const gstHstRows = rows.filter(isGstHst);

  const taxableFromRows = sumWhere(
    gstHstRows,
    (r) => r.source === 'invoice' && r.is_zero_rated !== true && r.is_exempt !== true,
    'taxable_amount',
  );
  const zeroRatedSales = Math.round(
    ((totals.zeroRatedSales ?? sumWhere(
      gstHstRows,
      (r) => r.source === 'invoice' && r.is_zero_rated === true,
      'taxable_amount',
    )) + Number.EPSILON) * 100,
  ) / 100;
  const exemptSales = Math.round(
    ((totals.exemptSales ?? sumWhere(
      gstHstRows,
      (r) => r.source === 'invoice' && r.is_exempt === true,
      'taxable_amount',
    )) + Number.EPSILON) * 100,
  ) / 100;
  const taxableSales = Math.round(
    ((totals.taxableSales ?? taxableFromRows) + Number.EPSILON) * 100,
  ) / 100;

  // CRA electronic line 90: taxable sales including zero-rated supplies
  // (other than zero-rated exports) made in Canada.
  const line90 = Math.round((taxableSales + zeroRatedSales + Number.EPSILON) * 100) / 100;
  // CRA electronic line 91: exempt supplies, zero-rated exports, and other revenue.
  const line91 = exemptSales;
  const taxCodedSales = sumWhere(gstHstRows, (r) => r.source === 'invoice', 'taxable_amount');
  const totalSales = Math.round(
    ((totals.totalSales || line90 + line91 || taxCodedSales) + Number.EPSILON) * 100,
  ) / 100;

  // Tax collected lives on a liability account (credit-normal). The RPC returns
  // collected as credit−debit, so it is already positive when sales tax was
  // collected during the period.
  const taxCollected = sumWhere(gstHstRows, (r) => r.source === 'invoice');
  const adjustmentsCollected = 0; // reserved for credit notes when wired
  const totalTaxCollected = Math.round((taxCollected + adjustmentsCollected) * 100) / 100;

  // ITCs sit on an asset account (debit-normal). The RPC returns paid as
  // debit−credit, so a positive value represents ITCs accumulated.
  const itc = sumWhere(
    gstHstRows,
    (r) => r.source !== 'invoice' && r.is_recoverable,
  );
  const adjustmentsItc = 0;
  const totalItc = Math.round((itc + adjustmentsItc) * 100) / 100;

  const netTax = Math.round((totalTaxCollected - totalItc) * 100) / 100;
  const instalmentsPaid = 0;
  const netPayable = Math.round((netTax - instalmentsPaid) * 100) / 100;

  const zeroRatedSalesForLines = zeroRatedSales;
  const exemptSalesForLines = exemptSales;

  const lines: FilingFormLine[] = [
    { code: '90', label: 'Taxable sales including zero-rated supplies (except zero-rated exports)', amount: line90, category: 'sales', formula: 'Taxable + zero-rated' },
    { code: '90A', label: 'Taxable sales (GST/HST charged)', amount: taxableSales, category: 'sales' },
    { code: '90B', label: 'Zero-rated sales (GST/HST at 0%)', amount: zeroRatedSalesForLines, category: 'memo' },
    { code: '91', label: 'Exempt sales, zero-rated exports, and other revenue', amount: line91, category: 'memo' },
    { code: '101', label: 'Sales and other revenue', amount: totalSales, category: 'sales', formula: '90 + 91' },
    { code: '103', label: 'GST/HST collected or collectible', amount: taxCollected, category: 'tax_collected' },
    { code: '104', label: 'Adjustments to GST/HST collected', amount: adjustmentsCollected, category: 'adjustment' },
    { code: '105', label: 'Total GST/HST and adjustments', amount: totalTaxCollected, category: 'tax_collected', formula: '103 + 104' },
    { code: '106', label: 'Input tax credits (ITCs)', amount: totalItc, category: 'itc' },
    { code: '107', label: 'Adjustments to ITCs', amount: adjustmentsItc, category: 'adjustment' },
    { code: '108', label: 'Total ITCs and adjustments', amount: totalItc, category: 'itc', formula: '106 + 107' },
    { code: '109', label: 'Net tax', amount: netTax, category: 'net', formula: '105 - 108' },
    { code: '110', label: 'Instalment and other annual filer payments', amount: instalmentsPaid, category: 'instalment' },
    { code: '113A', label: 'Balance (refund if negative)', amount: netPayable, category: 'net', formula: '109 - 110' },
  ];

  return {
    formCode: 'GST34',
    formName: 'GST/HST Return (GST34)',
    authority: meta.authority,
    periodStart: meta.periodStart,
    periodEnd: meta.periodEnd,
    currency: meta.currency ?? 'CAD',
    lines,
    netPayable,
  };
}
