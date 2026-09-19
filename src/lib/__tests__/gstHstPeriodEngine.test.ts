import { describe, it, expect } from 'vitest';
import { buildGstHstReturn } from '../filings/canadaGstHst';
import {
  classifyGstHstSupply,
  emptyGstHstSnapshot,
  gstHstDocumentsFromJournalEntries,
  groupGstHstSupportByLine,
  isGstHstTax,
  journalTaxDirection,
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

  it('fills GST collected and taxable sales from period journals when only purchase ITCs exist', () => {
    const snapshot = summarizeGstHstDocuments({
      periodStart: '2026-07-01',
      periodEnd: '2026-09-30',
      invoices: [],
      purchases: [{
        source: 'bill',
        id: 'bill-itc',
        date: '2026-08-03',
        number: 'BILL-22',
        status: 'paid',
        subtotal: 3544.46,
        tax_amount: 460.78,
        taxes: [{ tax_code: 'HST-ON', tax_type: 'hst', rate: 13, taxable_amount: 3544.46, tax_amount: 460.78, is_recoverable: true }],
      }],
      journal: { taxCollected: 1250.13, itcClaimed: 68265.98, taxableSales: 9616.38 },
      taxCodes,
    });
    expect(snapshot.itc).toBe(460.78);
    expect(snapshot.gstHstCollected).toBe(1250.13);
    expect(snapshot.taxableSales).toBe(9616.38);
    expect(snapshot.line101).toBe(9616.38);
    expect(snapshot.itc).not.toBe(68265.98);
  });

  it('uses invoice tax_amount as collected when gst_hst_amount and tax rows are missing', () => {
    const snapshot = summarizeGstHstDocuments({
      periodStart: '2026-07-01',
      periodEnd: '2026-09-30',
      invoices: [taxableInvoice({ gst_hst_amount: 0, tax_amount: 130, taxes: [], lines: [] })],
      purchases: [],
      taxCodes,
    });
    expect(snapshot.gstHstCollected).toBe(130);
    expect(snapshot.taxableSales).toBe(1000);
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

  it('does not mix lifetime journal ITCs with current-period invoice tax', () => {
    const snapshot = summarizeGstHstDocuments({
      periodStart: '2026-07-01',
      periodEnd: '2026-09-30',
      invoices: [taxableInvoice({
        subtotal: 2307.69,
        tax_amount: 300,
        gst_hst_amount: 300,
        taxes: [{ tax_code: 'HST-ON', tax_type: 'hst', rate: 13, taxable_amount: 2307.69, tax_amount: 300 }],
      })],
      purchases: [],
      journal: { taxCollected: 300, itcClaimed: 68265.98, taxableSales: 2307.69 },
      taxCodes,
    });
    expect(snapshot.taxableSales).toBe(2307.69);
    expect(snapshot.gstHstCollected).toBe(300);
    expect(snapshot.itc).toBe(0);
  });

  it('classifies invoice lines as taxable, zero-rated, and exempt', () => {
    const snapshot = summarizeGstHstDocuments({
      periodStart: '2026-07-01',
      periodEnd: '2026-09-30',
      invoices: [{
        id: 'inv-lines',
        date: '2026-08-01',
        number: 'INV-200',
        status: 'sent',
        subtotal: 1500,
        tax_amount: 130,
        taxes: [],
        lines: [
          { amount: 1000, tax_amount: 130, tax_rate: 13, description: 'Consulting' },
          { amount: 400, tax_amount: 0, tax_rate: 0, description: 'Groceries' },
          { amount: 100, tax_amount: 0, tax_rate: 0, description: 'Rent' },
        ],
      }, {
        id: 'inv-ex',
        date: '2026-08-02',
        number: 'INV-201',
        status: 'sent',
        subtotal: 100,
        is_gst_hst_exempt: true,
        taxes: [],
        lines: [{ amount: 100, tax_amount: 0, tax_rate: 0, description: 'Exempt fee' }],
      }],
      purchases: [],
      taxCodes,
    });
    expect(snapshot.taxableSales).toBe(1000);
    expect(snapshot.zeroRatedSales).toBe(500);
    expect(snapshot.exemptSales).toBe(100);
    expect(snapshot.gstHstCollected).toBe(130);
    expect(snapshot.exemptZeroRatedSales).toBe(600);
  });

  it('includes posted bank deposits and withdrawals and skips invoice matches', () => {
    const snapshot = summarizeGstHstDocuments({
      periodStart: '2026-07-01',
      periodEnd: '2026-09-30',
      invoices: [],
      purchases: [],
      bankDocuments: [
        {
          source: 'bank',
          direction: 'collected',
          id: 'dep-1',
          date: '2026-08-04',
          number: 'DEP-1',
          description: 'Retail sale',
          taxes: [{ tax_code: 'HST-ON', tax_type: 'hst', rate: 13, taxable_amount: 200, tax_amount: 26 }],
        },
        {
          source: 'credit_card',
          direction: 'paid',
          id: 'cc-1',
          date: '2026-08-05',
          number: 'CC-1',
          description: 'Office store',
          taxes: [{ tax_code: 'HST-ON', tax_type: 'hst', rate: 13, taxable_amount: 80, tax_amount: 10.40, is_recoverable: true }],
        },
        {
          source: 'bank',
          direction: 'collected',
          id: 'dep-match',
          date: '2026-08-06',
          number: 'DEP-2',
          matchedInvoiceId: 'inv-1',
          taxes: [{ tax_code: 'HST-ON', tax_type: 'hst', rate: 13, taxable_amount: 1000, tax_amount: 130 }],
        },
      ],
      taxCodes,
    });
    expect(snapshot.taxableSales).toBe(200);
    expect(snapshot.gstHstCollected).toBe(26);
    expect(snapshot.itc).toBe(10.4);
    expect(snapshot.supportRows.some((row) => row.number === 'DEP-2')).toBe(false);
  });

  it('includes standalone journal tax lines alongside invoices without mixing lifetime journal fallback', () => {
    const snapshot = summarizeGstHstDocuments({
      periodStart: '2026-07-01',
      periodEnd: '2026-09-30',
      invoices: [taxableInvoice()],
      purchases: [],
      bankDocuments: [{
        source: 'journal',
        direction: 'collected',
        id: 'jel-sales-adj',
        date: '2026-08-18',
        number: 'JE-0401',
        description: 'HST on year-end sales accrual',
        taxes: [{ tax_code: 'HST-ON', tax_type: 'hst', rate: 13, taxable_amount: 500, tax_amount: 65 }],
      }, {
        source: 'journal',
        direction: 'paid',
        id: 'jel-itc-adj',
        date: '2026-08-19',
        number: 'JE-0402',
        description: 'HST on prepaid insurance',
        taxes: [{ tax_code: 'HST-ON', tax_type: 'hst', rate: 13, taxable_amount: 100, tax_amount: 13, is_recoverable: true }],
      }],
      journal: { taxCollected: 45134.93, itcClaimed: 68265.98, taxableSales: 347191 },
      taxCodes,
    });
    expect(snapshot.taxableSales).toBe(1500);
    expect(snapshot.gstHstCollected).toBe(195);
    expect(snapshot.itc).toBe(13);
    expect(snapshot.supportRows.some((row) => row.type === 'Journal' && row.number === 'JE-0401')).toBe(true);
    expect(snapshot.supportRows.some((row) => row.type === 'Journal' && row.craLine === '106')).toBe(true);
  });

  it('treats a debit on GST payable as a collected exception, not an ITC', () => {
    const snapshot = summarizeGstHstDocuments({
      periodStart: '2026-07-01',
      periodEnd: '2026-09-30',
      invoices: [],
      purchases: [],
      bankDocuments: [{
        source: 'journal',
        direction: 'collected',
        id: 'jel-cn',
        date: '2026-08-21',
        number: 'JE-0403',
        description: 'Credit note HST',
        taxes: [{ tax_code: 'HST-ON', tax_type: 'hst', rate: 13, taxable_amount: -200, tax_amount: -26 }],
      }],
      taxCodes,
    });
    expect(snapshot.gstHstCollected).toBe(-26);
    expect(snapshot.gstHstCollectedException).toBe(-26);
    expect(snapshot.itc).toBe(0);
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

const payable = 'acct-gst-payable';
const recoverable = 'acct-gst-itc';
const revenue = 'acct-revenue';
const expense = 'acct-expense';
const bank = 'acct-bank';
const journalTaxCodes = [
  {
    id: 'tc-hst',
    code: 'HST-ON',
    name: 'HST Ontario',
    tax_type: 'hst',
    rate: 13,
    is_recoverable: true,
    gl_collected_account_id: payable,
    gl_paid_account_id: recoverable,
  },
];

describe('gstHstDocumentsFromJournalEntries', () => {
  it('maps a debit on GST payable to collected, not paid', () => {
    expect(journalTaxDirection(payable, 26, 0, new Set([payable]), new Set([recoverable]))).toBe('collected');
    expect(journalTaxDirection(recoverable, 13, 0, new Set([payable]), new Set([recoverable]))).toBe('paid');
  });

  it('includes standalone tax JEs and skips invoice-linked, CLOSE, and remittance JEs', () => {
    const docs = gstHstDocumentsFromJournalEntries([
      {
        id: 'je-sales',
        date: '2026-08-18',
        reference: 'JE-0401',
        status: 'posted',
        journalType: 'manual',
        lines: [
          { id: 'l1', accountId: revenue, accountType: 'income', debit: 0, credit: 500, description: 'Sales accrual' },
          { id: 'l2', accountId: payable, accountType: 'liability', accountName: 'GST/HST Payable', debit: 0, credit: 65, taxCodeId: 'tc-hst', description: 'HST-ON on sales' },
        ],
      },
      {
        id: 'je-invoice',
        date: '2026-08-19',
        reference: 'INV-100',
        status: 'posted',
        journalType: 'sales',
        lines: [
          { id: 'l3', accountId: payable, accountType: 'liability', accountName: 'GST/HST Payable', debit: 0, credit: 130, taxCodeId: 'tc-hst', sourceDocumentType: 'invoice' },
          { id: 'l4', accountId: revenue, accountType: 'income', debit: 0, credit: 1000, sourceDocumentType: 'invoice' },
        ],
      },
      {
        id: 'je-close',
        date: '2026-09-30',
        reference: 'CLOSE-2026',
        status: 'posted',
        lines: [
          { id: 'l5', accountId: payable, accountType: 'liability', accountName: 'GST/HST Payable', debit: 65, credit: 0 },
          { id: 'l6', accountId: revenue, accountType: 'income', debit: 500, credit: 0 },
        ],
      },
      {
        id: 'je-remit',
        date: '2026-08-20',
        reference: 'JE-0409',
        status: 'posted',
        journalType: 'manual',
        lines: [
          { id: 'l7', accountId: payable, accountType: 'liability', accountName: 'GST/HST Payable', debit: 195, credit: 0, taxCodeId: 'tc-hst' },
          { id: 'l8', accountId: bank, accountType: 'asset', debit: 0, credit: 195 },
        ],
      },
      {
        id: 'je-itc',
        date: '2026-08-21',
        reference: 'JE-0410',
        status: 'posted',
        journalType: 'adjustment',
        lines: [
          { id: 'l9', accountId: expense, accountType: 'expense', debit: 100, credit: 0 },
          { id: 'l10', accountId: recoverable, accountType: 'asset', accountName: 'GST/HST Recoverable', debit: 13, credit: 0, taxCodeId: 'tc-hst' },
          { id: 'l11', accountId: bank, accountType: 'asset', debit: 0, credit: 113 },
        ],
      },
    ], journalTaxCodes);

    expect(docs.map((doc) => doc.number).sort()).toEqual(['JE-0401', 'JE-0410']);
    const collected = docs.find((doc) => doc.number === 'JE-0401')!;
    const paid = docs.find((doc) => doc.number === 'JE-0410')!;
    expect(collected.direction).toBe('collected');
    expect(collected.taxes?.[0].tax_amount).toBe(65);
    expect(collected.source).toBe('journal');
    expect(paid.direction).toBe('paid');
    expect(paid.taxes?.[0].tax_amount).toBe(13);
  });

  it('does not double-count an invoice JE when invoices are already in the snapshot', () => {
    const journalDocs = gstHstDocumentsFromJournalEntries([{
      id: 'je-inv',
      date: '2026-08-15',
      reference: 'INV-100',
      status: 'posted',
      journalType: 'sales',
      lines: [
        { id: 'l1', accountId: payable, accountType: 'liability', accountName: 'GST/HST Payable', debit: 0, credit: 130, taxCodeId: 'tc-hst', sourceDocumentType: 'invoice' },
        { id: 'l2', accountId: revenue, accountType: 'income', debit: 0, credit: 1000, sourceDocumentType: 'invoice' },
      ],
    }], journalTaxCodes);
    const snapshot = summarizeGstHstDocuments({
      periodStart: '2026-07-01',
      periodEnd: '2026-09-30',
      invoices: [taxableInvoice()],
      purchases: [],
      bankDocuments: journalDocs,
      taxCodes,
    });
    expect(journalDocs).toHaveLength(0);
    expect(snapshot.gstHstCollected).toBe(130);
  });

  it('includes POS/bank tax JEs when the bank deposit itself has no GST amount', () => {
    const posJe = {
      id: 'je-pos',
      date: '2026-08-04',
      reference: 'DEP-88',
      status: 'posted' as const,
      journalType: 'bank',
      lines: [
        { id: 'l1', accountId: bank, accountType: 'asset', debit: 565, credit: 0, sourceDocumentType: 'bank_transaction', sourceDocumentId: 'dep-88' },
        { id: 'l2', accountId: revenue, accountType: 'income', debit: 0, credit: 500, sourceDocumentType: 'bank_transaction', sourceDocumentId: 'dep-88' },
        { id: 'l3', accountId: payable, accountType: 'liability', accountName: 'GST/HST Payable', debit: 0, credit: 65, taxCodeId: 'tc-hst', sourceDocumentType: 'bank_transaction', sourceDocumentId: 'dep-88' },
      ],
    };
    const included = gstHstDocumentsFromJournalEntries([posJe], journalTaxCodes);
    expect(included).toHaveLength(1);
    expect(included[0].direction).toBe('collected');
    expect(included[0].taxes?.[0].tax_amount).toBe(65);

    const skipped = gstHstDocumentsFromJournalEntries([posJe], journalTaxCodes, {
      countedLinkedSources: ['bank_transaction:dep-88'],
    });
    expect(skipped).toHaveLength(0);
  });
});
