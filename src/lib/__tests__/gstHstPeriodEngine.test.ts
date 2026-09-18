import { describe, it, expect } from 'vitest';
import { buildGstHstReturn } from '../filings/canadaGstHst';
import {
  classifyGstHstSupply,
  emptyGstHstSnapshot,
  groupGstHstSupportByLine,
  isGstHstTax,
  summarizeGstHstDocuments,
  type GstHstInvoiceDocument,
  type GstHstPurchaseDocument,
} from '../gstHstPeriodEngine';

const taxCodes = [
  { code: 'HST-ON', name: 'HST Ontario', tax_type: 'hst', rate: 13, is_zero_rated: false, is_exempt: false, is_recoverable: true },
  { code: 'GST-ZR', name: 'GST zero-rated', tax_type: 'gst', rate: 0, is_zero_rated: true, is_exempt: false, is_recoverable: true },
  { code: 'GST-EX', name: 'GST exempt', tax_type: 'gst', rate: 0, is_zero_rated: false, is_exempt: true, is_recoverable: false },
];

const taxableInvoice = (overrides: Partial<GstHstInvoiceDocument> = {}): GstHstInvoiceDocument => ({
  id: 'inv-1',
  date: '2026-08-15',
  number: 'INV-100',
  description: 'Consulting',
  status: 'sent',
  subtotal: 1000,
  tax_amount: 130,
  gst_hst_amount: 130,
  taxes: [{ tax_code: 'HST-ON', tax_type: 'hst', rate: 13, taxable_amount: 1000, tax_amount: 130, is_recoverable: true }],
  ...overrides,
});

describe('isGstHstTax', () => {
  it('accepts GST and HST codes and rejects PST', () => {
    expect(isGstHstTax({ tax_type: 'hst', tax_code: 'HST-ON' })).toBe(true);
    expect(isGstHstTax({ tax_type: 'gst', tax_code: 'GST' })).toBe(true);
    expect(isGstHstTax({ tax_type: 'pst', tax_code: 'PST-BC' })).toBe(false);
  });
});

describe('classifyGstHstSupply', () => {
  it('classifies taxable, zero-rated, and exempt supplies', () => {
    expect(classifyGstHstSupply(
      { tax_code: 'HST-ON', tax_type: 'hst', rate: 13, tax_amount: 130 },
      taxCodes[0],
    )).toBe('taxable');
    expect(classifyGstHstSupply(
      { tax_code: 'GST-ZR', tax_type: 'gst', rate: 0, tax_amount: 0 },
      taxCodes[1],
    )).toBe('zero_rated');
    expect(classifyGstHstSupply(
      { tax_code: 'GST-EX', tax_type: 'gst', rate: 0, tax_amount: 0 },
      taxCodes[2],
    )).toBe('exempt');
    expect(classifyGstHstSupply(undefined, undefined, true)).toBe('exempt');
  });
});

describe('summarizeGstHstDocuments', () => {
  it('builds CRA taxable, exempt/zero-rated, collected, and ITC totals for one quarter', () => {
    const invoices: GstHstInvoiceDocument[] = [
      taxableInvoice(),
      {
        id: 'inv-zr',
        date: '2026-08-20',
        number: 'INV-101',
        description: 'Basic groceries',
        status: 'paid',
        subtotal: 400,
        tax_amount: 0,
        taxes: [{ tax_code: 'GST-ZR', tax_type: 'gst', rate: 0, taxable_amount: 400, tax_amount: 0 }],
      },
      {
        id: 'inv-ex',
        date: '2026-09-01',
        number: 'INV-102',
        description: 'Residential rent',
        status: 'sent',
        subtotal: 250,
        tax_amount: 0,
        is_gst_hst_exempt: true,
        taxes: [],
      },
    ];
    const purchases: GstHstPurchaseDocument[] = [
      {
        source: 'bill',
        id: 'bill-1',
        date: '2026-07-12',
        number: 'BILL-9',
        description: 'Office supplies',
        status: 'open',
        subtotal: 200,
        tax_amount: 26,
        taxes: [{ tax_code: 'HST-ON', tax_type: 'hst', rate: 13, taxable_amount: 200, tax_amount: 26, is_recoverable: true }],
      },
    ];

    const q3 = summarizeGstHstDocuments({
      periodStart: '2026-07-01',
      periodEnd: '2026-09-30',
      invoices,
      purchases,
      taxCodes,
    });

    expect(q3.taxableSales).toBe(1000);
    expect(q3.zeroRatedSales).toBe(400);
    expect(q3.exemptSales).toBe(250);
    expect(q3.exemptZeroRatedSales).toBe(650);
    expect(q3.line90).toBe(1400);
    expect(q3.line91).toBe(250);
    expect(q3.line101).toBe(1650);
    expect(q3.gstHstCollected).toBe(130);
    expect(q3.itc).toBe(26);
    expect(q3.netTax).toBe(104);

    const line = (code: string) => q3.form.lines.find((l) => l.code === code)?.amount;
    expect(line('90')).toBe(1400);
    expect(line('90A')).toBe(1000);
    expect(line('90B')).toBe(400);
    expect(line('91')).toBe(250);
    expect(line('101')).toBe(1650);
    expect(line('103')).toBe(130);
    expect(line('106')).toBe(26);
    expect(line('109')).toBe(104);
  });

  it('keeps Q2 and Q3 independent so comparison columns are not dashes or reused totals', () => {
    const q3 = summarizeGstHstDocuments({
      periodStart: '2026-07-01',
      periodEnd: '2026-09-30',
      invoices: [taxableInvoice({ subtotal: 2307.69, tax_amount: 300, gst_hst_amount: 300, taxes: [{ tax_code: 'HST-ON', tax_type: 'hst', rate: 13, taxable_amount: 2307.69, tax_amount: 300 }] })],
      purchases: [],
      taxCodes,
    });
    const q2 = summarizeGstHstDocuments({
      periodStart: '2026-04-01',
      periodEnd: '2026-06-30',
      invoices: [taxableInvoice({
        id: 'inv-q2',
        date: '2026-05-10',
        number: 'INV-050',
        subtotal: 5000,
        tax_amount: 650,
        gst_hst_amount: 650,
        taxes: [{ tax_code: 'HST-ON', tax_type: 'hst', rate: 13, taxable_amount: 5000, tax_amount: 650 }],
      })],
      purchases: [{
        source: 'bill',
        id: 'bill-q2',
        date: '2026-04-08',
        number: 'BILL-4',
        status: 'paid',
        subtotal: 800,
        tax_amount: 104,
        taxes: [{ tax_code: 'HST-ON', tax_type: 'hst', rate: 13, taxable_amount: 800, tax_amount: 104, is_recoverable: true }],
      }],
      taxCodes,
    });
    const emptyQ1 = emptyGstHstSnapshot('2026-01-01', '2026-03-31');

    expect(q3.gstHstCollected).toBe(300);
    expect(q3.itc).toBe(0);
    expect(q2.gstHstCollected).toBe(650);
    expect(q2.itc).toBe(104);
    expect(q2.taxableSales).toBe(5000);
    expect(emptyQ1.gstHstCollected).toBe(0);
    expect(emptyQ1.taxableSales).toBe(0);
    expect(q3.gstHstCollected).not.toBe(q2.gstHstCollected);
    expect(q3.itc).not.toBe(68265.98);
  });

  it('excludes draft and void invoices and ignores PST on a GST/HST return', () => {
    const snapshot = summarizeGstHstDocuments({
      periodStart: '2026-07-01',
      periodEnd: '2026-09-30',
      invoices: [
        taxableInvoice({ status: 'draft', number: 'DRAFT-1' }),
        taxableInvoice({
          id: 'inv-pst',
          number: 'INV-PST',
          taxes: [
            { tax_code: 'HST-ON', tax_type: 'hst', rate: 13, taxable_amount: 1000, tax_amount: 130 },
            { tax_code: 'PST-BC', tax_type: 'pst', rate: 7, taxable_amount: 1000, tax_amount: 70 },
          ],
        }),
      ],
      purchases: [],
      taxCodes,
    });
    expect(snapshot.invoiceCount).toBe(1);
    expect(snapshot.gstHstCollected).toBe(130);
    expect(snapshot.taxableSales).toBe(1000);
  });

  it('falls back to journal collected/ITC only when documents have no GST/HST tax rows', () => {
    const snapshot = summarizeGstHstDocuments({
      periodStart: '2026-07-01',
      periodEnd: '2026-09-30',
      invoices: [],
      purchases: [],
      journal: { taxCollected: 300, itcClaimed: 50, taxableSales: 2307.69 },
    });
    expect(snapshot.gstHstCollected).toBe(300);
    expect(snapshot.itc).toBe(50);
    expect(snapshot.taxableSales).toBe(2307.69);
    expect(snapshot.usedDocumentCollected).toBe(false);
  });

  it('does not let a lifetime journal ITC overwrite document-period ITCs', () => {
    const snapshot = summarizeGstHstDocuments({
      periodStart: '2026-07-01',
      periodEnd: '2026-09-30',
      invoices: [taxableInvoice({ taxes: [{ tax_code: 'HST-ON', tax_type: 'hst', rate: 13, taxable_amount: 2307.69, tax_amount: 300 }] })],
      purchases: [{
        source: 'expense',
        id: 'exp-1',
        date: '2026-08-01',
        number: 'EXP-1',
        status: 'approved',
        taxes: [{ tax_code: 'HST-ON', tax_type: 'hst', rate: 13, taxable_amount: 100, tax_amount: 13, is_recoverable: true }],
      }],
      journal: { taxCollected: 45134.93, itcClaimed: 68265.98, taxableSales: 347191 },
      taxCodes,
    });
    expect(snapshot.gstHstCollected).toBe(300);
    expect(snapshot.itc).toBe(13);
    expect(snapshot.itc).not.toBe(68265.98);
  });

  it('builds a detailed support listing grouped by CRA line', () => {
    const snapshot = summarizeGstHstDocuments({
      periodStart: '2026-07-01',
      periodEnd: '2026-09-30',
      invoices: [
        taxableInvoice(),
        {
          id: 'inv-zr',
          date: '2026-08-20',
          number: 'INV-101',
          status: 'paid',
          subtotal: 400,
          taxes: [{ tax_code: 'GST-ZR', tax_type: 'gst', rate: 0, taxable_amount: 400, tax_amount: 0 }],
        },
      ],
      purchases: [{
        source: 'bill',
        id: 'bill-1',
        date: '2026-07-12',
        number: 'BILL-9',
        status: 'open',
        taxes: [{ tax_code: 'HST-ON', tax_type: 'hst', rate: 13, taxable_amount: 200, tax_amount: 26, is_recoverable: true }],
      }],
      taxCodes,
    });
    const groups = groupGstHstSupportByLine(snapshot.supportRows);
    expect(snapshot.supportRows).toHaveLength(3);
    expect(groups.map((g) => g.line)).toEqual(['90A / 103', '90B', '106']);
    expect(groups[0].taxAmount).toBe(130);
    expect(groups[1].taxableAmount).toBe(400);
    expect(groups[2].taxAmount).toBe(26);
  });
});

describe('buildGstHstReturn CRA working copy', () => {
  it('reports taxable, zero-rated, exempt, collected, and ITC on the GST34 lines', () => {
    const form = buildGstHstReturn({
      totalSales: 1650,
      totalPurchases: 200,
      taxableSales: 1000,
      zeroRatedSales: 400,
      exemptSales: 250,
      rows: [
        {
          source: 'invoice',
          tax_type: 'hst',
          tax_code: 'HST-ON',
          authority: 'CRA',
          jurisdiction_code: 'ON',
          rate: 13,
          taxable_amount: 1000,
          tax_amount: 130,
          is_recoverable: true,
        },
        {
          source: 'bill',
          tax_type: 'hst',
          tax_code: 'HST-ON',
          authority: 'CRA',
          jurisdiction_code: 'ON',
          rate: 13,
          taxable_amount: 200,
          tax_amount: 26,
          is_recoverable: true,
        },
      ],
    }, { authority: 'CRA', periodStart: '2026-07-01', periodEnd: '2026-09-30' });

    const line = (code: string) => form.lines.find((l) => l.code === code)?.amount;
    expect(line('90A')).toBe(1000);
    expect(line('90B')).toBe(400);
    expect(line('91')).toBe(250);
    expect(line('90')).toBe(1400);
    expect(line('101')).toBe(1650);
    expect(line('103')).toBe(130);
    expect(line('106')).toBe(26);
  });
});
