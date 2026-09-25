/**
 * Generic EU VAT return mapper (modeled on UK VAT100, transferable to most EU member states).
 */
import { PeriodTotals, FilingFormResult, FilingFormLine, sumWhere } from './types';

export function buildEuVatReturn(
  totals: PeriodTotals,
  meta: { authority: string; periodStart: string; periodEnd: string; currency?: string; country?: string }
): FilingFormResult {
  const { rows } = totals;
  const vatRows = rows.filter((r) => /^vat$/i.test(r.tax_type));

  const outputVat = sumWhere(vatRows, (r) => r.source === 'invoice');
  const inputVat = sumWhere(vatRows, (r) => (r.source === 'bill' || r.source === 'expense') && r.is_recoverable);
  const ecAcquisitionsVat = 0;
  const totalVatDue = Math.round((outputVat + ecAcquisitionsVat) * 100) / 100;
  const netVat = Math.round((totalVatDue - inputVat) * 100) / 100;

  const totalSalesExVat = sumWhere(vatRows, (r) => r.source === 'invoice', 'taxable_amount');
  const totalPurchasesExVat = sumWhere(vatRows, (r) => r.source === 'bill' || r.source === 'expense', 'taxable_amount');

  const lines: FilingFormLine[] = [
    { code: 'Box 1', label: 'VAT due on sales and other outputs', amount: outputVat, category: 'tax_collected' },
    { code: 'Box 2', label: 'VAT due on EC acquisitions', amount: ecAcquisitionsVat, category: 'tax_collected' },
    { code: 'Box 3', label: 'Total VAT due', amount: totalVatDue, category: 'tax_collected', formula: 'Box 1 + Box 2' },
    { code: 'Box 4', label: 'VAT reclaimed on purchases (input VAT)', amount: inputVat, category: 'itc' },
    { code: 'Box 5', label: 'Net VAT to pay (or reclaim)', amount: netVat, category: 'net', formula: 'Box 3 - Box 4' },
    { code: 'Box 6', label: 'Total value of sales ex VAT', amount: totalSalesExVat, category: 'memo' },
    { code: 'Box 7', label: 'Total value of purchases ex VAT', amount: totalPurchasesExVat, category: 'memo' },
  ];

  return {
    formCode: meta.country ? `VAT-${meta.country}` : 'VAT100',
    formName: `VAT Return${meta.country ? ` (${meta.country})` : ''}`,
    authority: meta.authority,
    periodStart: meta.periodStart,
    periodEnd: meta.periodEnd,
    currency: meta.currency ?? 'EUR',
    lines,
    netPayable: netVat,
  };
}
