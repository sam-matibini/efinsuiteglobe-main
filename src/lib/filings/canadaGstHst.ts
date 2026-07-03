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

  // Line 101 = Total sales and other revenue (taxable + zero-rated + exempt),
  // sourced from the General Ledger income accounts so deposits posted without
  // a tax code are still reflected, per CRA GST34 instructions.
  const taxCodedSales = sumWhere(gstHstRows, (r) => r.source === 'invoice', 'taxable_amount');
  const totalSales = Math.round((totals.totalSales || taxCodedSales) * 100) / 100;

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

  const zeroRatedSales = sumWhere(
    gstHstRows,
    (r) => r.source === 'invoice' && r.is_zero_rated === true,
    'taxable_amount',
  );
  const exemptSales = sumWhere(
    gstHstRows,
    (r) => r.source === 'invoice' && r.is_exempt === true,
    'taxable_amount',
  );

  const lines: FilingFormLine[] = [
    { code: '90', label: 'Sales of zero-rated goods and services (e.g. exports — CRA Sch. VI)', amount: zeroRatedSales, category: 'memo' },
    { code: '91', label: 'Exempt sales', amount: exemptSales, category: 'memo' },
    { code: '101', label: 'Sales and other revenue', amount: totalSales, category: 'sales' },
    { code: '103', label: 'GST/HST collected on sales', amount: taxCollected, category: 'tax_collected' },
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
