import { describe, expect, it } from 'vitest';
import { generateInvoicePdfDoc } from './generateInvoicePdf';

interface PdfText {
  text: string;
  x: number;
  y: number;
}

function pdfTextItems(content: string): PdfText[] {
  const items: PdfText[] = [];
  const pattern = /([\d.]+) ([\d.]+) Td\s*\(((?:\\\)|[^)])*)\) Tj/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content))) {
    items.push({
      text: match[3].replace(/\\([()\\])/g, '$1'),
      x: Number(match[1]),
      y: Number(match[2]),
    });
  }
  return items;
}

describe('standard invoice PDF layout', () => {
  it('matches the on-screen invoice: title left, company right, three meta columns, one tax line', async () => {
    const doc = await generateInvoicePdfDoc({
      invoiceNumber: 'INV-0003',
      invoiceDate: '2026-09-24',
      dueDate: '2026-09-24',
      status: 'issued',
      documentTitle: 'Invoice',
      customerName: 'Pluri-elles',
      buyerName: 'Pluri-elles',
      attentionOf: 'Pauline Ambec',
      buyerEmail: 'direction@pluri-elles.mb.ca',
      buyerPhone: '2042331735',
      buyerAddressLine1: 'Unit#114 - 420 Des Meurons',
      buyerCity: 'Winnipeg',
      buyerProvince: 'MB',
      buyerPostalCode: 'R2H 2N9',
      buyerCountry: 'CA',
      lines: [{ description: 'Events Fees', quantity: 1, unitPrice: 100, amount: 100, notes: 'Table Registration Fee' }],
      subtotal: 100,
      taxAmount: 0,
      gstHstRate: 5,
      pstRate: 7,
      total: 100,
      amountPaid: 0,
      balanceDue: 100,
      terms: 'Due on Receipt',
      organizationName: 'Humanitarian Solidarity for Development and Empowerment Canada',
      organizationAddress: '112 Market Avenue, Unit 310',
      organizationCity: 'WINNIPEG',
      organizationProvince: 'MB',
      organizationPostalCode: 'R3B 0P4',
      organizationCountry: 'CA',
      organizationPhone: '+12048081123',
      organizationEmail: 'info@hsde.ca',
      charityBn: '725966758RR0001',
      showLineNumbers: true,
      currency: 'CAD',
      locale: 'en-CA',
      primaryColor: '#1e40af',
    });

    const items = pdfTextItems(doc.output());
    const pageWidthPt = (doc.internal.pageSize.getWidth() * 72) / 25.4;
    const leftMarginPt = (15 * 72) / 25.4;
    const title = items.find((item) => item.text === 'INVOICE');
    const number = items.find((item) => item.text === '#INV-0003');
    const contact = items.find((item) => item.text === '+12048081123 | info@hsde.ca');
    const country = items.find((item) => item.text === 'CA' && item.x > pageWidthPt / 2);
    const dateLabel = items.find((item) => item.text === 'Date');
    const dueLabel = items.find((item) => item.text === 'Due');
    const billLabel = items.find((item) => item.text === 'Bill To');
    const tax = items.find((item) => item.text === 'Tax:');
    const subtotal = items.find((item) => item.text === 'Subtotal:');
    const balance = items.find((item) => item.text === 'Balance Due');
    const terms = items.find((item) => item.text === 'Terms');

    expect(title).toBeDefined();
    expect(number).toBeDefined();
    expect(contact).toBeDefined();
    expect(country).toBeDefined();
    expect(dateLabel).toBeDefined();
    expect(dueLabel).toBeDefined();
    expect(billLabel).toBeDefined();
    expect(tax).toBeDefined();
    expect(subtotal).toBeDefined();
    expect(balance).toBeDefined();
    expect(terms).toBeDefined();

    expect(items.some((item) => item.text.includes('BN:'))).toBe(false);
    expect(items.some((item) => item.text === 'ISSUED')).toBe(false);
    expect(items.some((item) => item.text.startsWith('Tel:'))).toBe(false);
    expect(items.some((item) => item.text.startsWith('Email:'))).toBe(false);
    expect(items.some((item) => item.text.includes('GST/HST'))).toBe(false);
    expect(items.some((item) => item.text.includes('PST ('))).toBe(false);

    expect(Math.abs(title!.x - leftMarginPt)).toBeLessThan(1);
    expect(Math.abs(number!.x - leftMarginPt)).toBeLessThan(1);
    expect(title!.y).toBeGreaterThan(number!.y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const contactWidthPt = (doc.getTextWidth(contact!.text) * 72) / 25.4;
    const rightEdge = pageWidthPt - leftMarginPt;
    expect(Math.abs(contact!.x + contactWidthPt - rightEdge)).toBeLessThan(2);

    expect(dateLabel!.x).toBeLessThan(dueLabel!.x);
    expect(dueLabel!.x).toBeLessThan(billLabel!.x);
    expect(billLabel!.x).toBeGreaterThan(pageWidthPt / 2);

    expect(items.some((item) => item.text === 'Attn: Pauline Ambec')).toBe(true);
    expect(items.some((item) => item.text === 'direction@pluri-elles.mb.ca')).toBe(true);
    expect(items.some((item) => item.text === 'Winnipeg, MB R2H 2N9')).toBe(true);
    expect(items.some((item) => item.text === 'Due on Receipt')).toBe(true);
  });
});
