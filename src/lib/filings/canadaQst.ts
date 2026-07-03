/**
 * Quebec Sales Tax (QST/TVQ) return mapper — Revenu Québec FPZ-500.
 * QST is recoverable similar to GST/HST for registered businesses.
 */
import { PeriodTotals, FilingFormResult, FilingFormLine, sumWhere } from './types';

export function buildQstReturn(
  totals: PeriodTotals,
  meta: { authority: string; periodStart: string; periodEnd: string; currency?: string }
): FilingFormResult {
  const { rows, totalSales } = totals;
  const qstRows = rows.filter((r) => /^qst|tvq$/i.test(r.tax_type));

  const taxCollected = sumWhere(qstRows, (r) => r.source === 'invoice');
  const itr = sumWhere(qstRows, (r) => (r.source === 'bill' || r.source === 'expense') && r.is_recoverable);
  const netTax = Math.round((taxCollected - itr) * 100) / 100;

  const lines: FilingFormLine[] = [
    { code: '201', label: 'Total taxable sales', amount: totalSales, category: 'sales' },
    { code: '203', label: 'QST collected', amount: taxCollected, category: 'tax_collected' },
    { code: '206', label: 'Input tax refunds (ITRs)', amount: itr, category: 'itc' },
    { code: '209', label: 'Net QST', amount: netTax, category: 'net', formula: '203 - 206' },
  ];

  return {
    formCode: 'FPZ-500',
    formName: 'QST Return (FPZ-500)',
    authority: meta.authority,
    periodStart: meta.periodStart,
    periodEnd: meta.periodEnd,
    currency: meta.currency ?? 'CAD',
    lines,
    netPayable: netTax,
  };
}
