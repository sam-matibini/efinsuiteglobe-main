import { describe, it, expect } from 'vitest';
import { summarizeGstHstDocuments, type GstHstInvoiceDocument, type GstHstPurchaseDocument } from '../gstHstPeriodEngine';
import { buildGstHstQbDetail, buildGstHstQbSummary } from '../gstHstStatement';
import { rstAgencyNet } from '../rstAgencies';
import { buildGstHstReturn } from '../filings/canadaGstHst';

const taxCodes = [
  { code: 'HST-ON', name: 'HST Ontario', tax_type: 'hst', rate: 13, is_zero_rated: false, is_exempt: false, is_recoverable: true },
  { code: 'GST-ZR', name: 'GST zero-rated', tax_type: 'gst', rate: 0, is_zero_rated: true, is_exempt: false, is_recoverable: true },
  { code: 'PST-MB', name: 'Manitoba RST', tax_type: 'pst', rate: 7, is_zero_rated: false, is_exempt: false, is_recoverable: false },
];

describe('QuickBooks GST/HST summary and detail', () => {
  it('builds summary columns with credit-note exceptions and running balances', () => {
    const invoices: GstHstInvoiceDocument[] = [
      {
        id: 'inv-1',
        date: '2026-04-10',
        number: '15721',
        partyName: 'Benipal Brothers Ltd.',
        status: 'sent',
        subtotal: 60,
        taxes: [{ tax_code: 'HST-ON', tax_type: 'hst', rate: 5, taxable_amount: 60, tax_amount: 3 }],
      },
      {
        id: 'cn-1',
        date: '2026-04-12',
        number: 'CN-1',
        partyName: 'Credit customer',
        status: 'sent',
        subtotal: -20,
        taxes: [{ tax_code: 'HST-ON', tax_type: 'hst', rate: 5, taxable_amount: -20, tax_amount: -1 }],
      },
      {
        id: 'zr-1',
        date: '2026-04-01',
        number: '5742',
        partyName: 'Manitoba Association for Safety in Healthcare Inc. (MASH)',
        status: 'sent',
        subtotal: 296.4,
        taxes: [{ tax_code: 'GST-ZR', tax_type: 'gst', rate: 0, taxable_amount: 296.4, tax_amount: 0 }],
      },
    ];
    const purchases: GstHstPurchaseDocument[] = [
      {
        source: 'bill',
        id: 'bill-1',
        date: '2026-04-08',
        number: 'BILL-9',
        partyName: 'Office Store',
        status: 'open',
        taxes: [{ tax_code: 'HST-ON', tax_type: 'hst', rate: 13, taxable_amount: 200, tax_amount: 26, is_recoverable: true }],
      },
    ];

    const snapshot = summarizeGstHstDocuments({
      periodStart: '2026-04-01',
      periodEnd: '2026-06-30',
      invoices,
      purchases,
      taxCodes,
    });

    expect(snapshot.gstHstCollectedGross).toBe(3);
    expect(snapshot.gstHstCollectedException).toBe(-1);
    expect(snapshot.gstHstCollected).toBe(2);
    expect(snapshot.itc).toBe(26);

    const summary = buildGstHstQbSummary(snapshot);
    const collected = summary.find((line) => line.code === '103')!;
    expect(collected.description).toBe('GST/HST collected or collectible');
    expect(collected.amount).toBe(3);
    expect(collected.exceptionAmount).toBe(-1);
    expect(collected.totalLineAmount).toBe(2);

    const totalGst = summary.find((line) => line.code === '105')!;
    expect(totalGst.balance).toBe(2);
    expect(totalGst.totalLineAmount).toBe(0);

    const itc = summary.find((line) => line.code === '106')!;
    expect(itc.amount).toBe(26);
    expect(itc.exceptionAmount).toBe(0);

    const net = summary.find((line) => line.code === '109')!;
    expect(net.balance).toBe(-24);
    expect(summary.find((line) => line.code === '111')?.description).toBe('Rebates');
    expect(summary.find((line) => line.code === '205')?.description).toMatch(/real property/i);
    expect(summary.find((line) => line.code === '405')?.description).toMatch(/self-assessed/i);
    expect(summary.find((line) => line.code === '114')?.description).toMatch(/Transfer Amount/i);

    const detail = buildGstHstQbDetail(snapshot.supportRows);
    const line103 = detail.find((group) => group.line === '103')!;
    expect(line103.label).toBe('GST/HST collected or collectible');
    expect(line103.rows.some((row) => row.taxCode === 'GST-ZR' && row.taxRate === 0)).toBe(true);
    expect(line103.rows[0].number).toBe('5742');
    expect(line103.rows[0].balance).toBe(0);
    expect(line103.rows[0].name).toContain('MASH');
    const last = line103.rows[line103.rows.length - 1];
    expect(last.balance).toBe(2);
  });

  it('nets GST/HST as collected minus ITC and PST as collected plus paid', () => {
    const snapshot = summarizeGstHstDocuments({
      periodStart: '2026-07-01',
      periodEnd: '2026-09-30',
      invoices: [{
        id: 'inv-1',
        date: '2026-08-01',
        number: 'INV-1',
        status: 'sent',
        taxes: [
          { tax_code: 'HST-ON', tax_type: 'hst', rate: 13, taxable_amount: 1000, tax_amount: 130 },
          { tax_code: 'PST-MB', tax_type: 'pst', rate: 7, taxable_amount: 1000, tax_amount: 70, authority: 'Manitoba Finance' },
        ],
      }],
      purchases: [{
        source: 'bill',
        id: 'bill-1',
        date: '2026-08-02',
        number: 'BILL-1',
        status: 'open',
        taxes: [
          { tax_code: 'HST-ON', tax_type: 'hst', rate: 13, taxable_amount: 200, tax_amount: 26, is_recoverable: true },
          { tax_code: 'PST-MB', tax_type: 'pst', rate: 7, taxable_amount: 200, tax_amount: 14, authority: 'Manitoba Finance' },
        ],
      }],
      taxCodes,
    });

    const cra = snapshot.agencies.find((agency) => agency.id === 'cra-gst-hst')!;
    const mb = snapshot.agencies.find((agency) => agency.id === 'pst-mb')!;
    expect(cra.agency).toBe('Canada Revenue Agency');
    expect(cra.collected).toBe(130);
    expect(cra.paidOnPurchases).toBe(26);
    expect(cra.net).toBe(104);
    expect(rstAgencyNet(cra)).toBe(104);

    expect(mb.agency).toBe('Manitoba Finance');
    expect(mb.collected).toBe(70);
    expect(mb.paidOnPurchases).toBe(14);
    expect(mb.net).toBe(84);
  });
});

describe('GST34 exception lines', () => {
  it('reports gross collected and exception separately on line 103', () => {
    const form = buildGstHstReturn({
      totalSales: 80,
      totalPurchases: 0,
      taxableSales: 80,
      zeroRatedSales: 0,
      exemptSales: 0,
      rows: [
        {
          source: 'invoice',
          tax_type: 'hst',
          tax_code: 'HST-ON',
          authority: 'CRA',
          jurisdiction_code: 'ON',
          rate: 5,
          taxable_amount: 100,
          tax_amount: 5,
          is_recoverable: true,
        },
        {
          source: 'invoice',
          tax_type: 'hst',
          tax_code: 'HST-ON',
          authority: 'CRA',
          jurisdiction_code: 'ON',
          rate: 5,
          taxable_amount: -20,
          tax_amount: -1,
          is_recoverable: true,
        },
      ],
    }, { authority: 'CRA', periodStart: '2026-04-01', periodEnd: '2026-06-30' });

    const line103 = form.lines.find((line) => line.code === '103')!;
    expect(line103.amount).toBe(5);
    expect(line103.exceptionAmount).toBe(-1);
    expect(line103.totalLineAmount).toBe(4);
    expect(form.lines.some((line) => line.code === '205')).toBe(true);
    expect(form.lines.some((line) => line.code === '405')).toBe(true);
    expect(form.netPayable).toBe(4);
  });
});
