import { describe, it, expect } from 'vitest';
import { summarizeGstHstDocuments } from '../gstHstPeriodEngine';
import {
  buildGstHstDetailShareData,
  buildGstHstSummaryShareData,
  buildRstPeriodShareData,
} from '../rstReportShare';

const money = (value: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value);

describe('RST share and export payloads', () => {
  const snapshot = summarizeGstHstDocuments({
    periodStart: '2026-07-01',
    periodEnd: '2026-09-30',
    invoices: [{
      id: 'inv-1',
      date: '2026-08-15',
      number: 'INV-100',
      description: 'Consulting',
      status: 'sent',
      subtotal: 1000,
      tax_amount: 130,
      gst_hst_amount: 130,
      taxes: [{ tax_code: 'HST-ON', tax_type: 'hst', rate: 13, taxable_amount: 1000, tax_amount: 130 }],
    }],
    purchases: [{
      source: 'bill',
      id: 'bill-1',
      date: '2026-08-03',
      number: 'BILL-22',
      status: 'paid',
      subtotal: 200,
      tax_amount: 26,
      taxes: [{ tax_code: 'HST-ON', tax_type: 'hst', rate: 13, taxable_amount: 200, tax_amount: 26, is_recoverable: true }],
    }],
    taxCodes: [
      { code: 'HST-ON', name: 'HST Ontario', tax_type: 'hst', rate: 13, is_recoverable: true },
    ],
  });

  it('packs GST/HST summary lines and net tax for email, WhatsApp, PDF, and Excel', () => {
    const data = buildGstHstSummaryShareData({
      organizationName: 'VIP Dutts',
      snapshot,
      formatCurrency: money,
    });
    expect(data.title).toBe('GST/HST Summary Report');
    expect(data.organizationName).toBe('VIP Dutts');
    expect(data.headers).toEqual(['Line description', 'Amount', 'Exception amount', 'Total line amount', 'Balance']);
    expect(data.rows.some((row) => String(row[0]).includes('GST/HST collected'))).toBe(true);
    expect(data.totals?.map((row) => row.label)).toEqual([
      'Sales and other revenue (line 101)',
      'GST/HST collected (line 103)',
      'Input tax credits (line 106)',
      'Net tax (line 109)',
    ]);
    expect(data.totals?.[3].value).toBe(money(104));
  });

  it('packs GST/HST detail transactions grouped by CRA line', () => {
    const data = buildGstHstDetailShareData({
      organizationName: 'VIP Dutts',
      snapshot,
      formatCurrency: money,
    });
    expect(data.title).toBe('GST/HST Detail Report');
    expect(data.rows.some((row) => String(row[0]).startsWith('Line 103'))).toBe(true);
    expect(data.rows.some((row) => row.includes('INV-100'))).toBe(true);
    expect(data.rows.some((row) => row.includes('BILL-22'))).toBe(true);
    expect(data.totals?.some((row) => row.label.includes('Net tax'))).toBe(true);
  });

  it('includes comparison columns on the Tax Reports RST payload', () => {
    const data = buildRstPeriodShareData({
      title: 'CRA GST/HST Report',
      organizationName: 'VIP Dutts',
      dateRange: 'Jul 1, 2026 - Sep 30, 2026',
      formatCurrency: money,
      comparisonLabels: ['Q2 2026', 'Q1 2026'],
      metrics: [
        { label: 'Taxable sales', current: 39394.77, comparisons: [6160, 3080] },
        { label: 'GST/HST collected', current: 5121.32, comparisons: [800.8, 400.4] },
        { label: 'Input tax credits', current: 460.78, comparisons: [56.66, 130.07] },
        { label: 'Net tax', current: 4660.54, comparisons: [744.14, 270.33] },
      ],
      formLines: [{ code: '109', label: 'Net tax', amount: 4660.54 }],
    });
    expect(data.headers).toEqual(['Metric', 'Current Period', 'Q2 2026', 'Q1 2026']);
    const collected = data.rows.find((row) => row[0] === 'GST/HST collected');
    expect(collected?.[1]).toBe(money(5121.32));
    expect(collected?.[2]).toBe(money(800.8));
    expect(collected?.[3]).toBe(money(400.4));
    expect(data.totals?.find((row) => row.label === 'Net tax')?.value).toBe(money(4660.54));
  });
});
