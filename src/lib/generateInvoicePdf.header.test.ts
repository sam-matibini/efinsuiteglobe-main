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

describe('standard invoice PDF header', () => {
  it('centers the title and places the BN between the phone line and the status', async () => {
    const doc = await generateInvoicePdfDoc({
      invoiceNumber: 'INV-0003',
      invoiceDate: '2026-09-24',
      dueDate: '2026-09-24',
      status: 'issued',
      documentTitle: 'Invoice',
      customerName: 'Pluri-elles',
      lines: [{ description: 'Events Fees', quantity: 1, unitPrice: 100, amount: 100 }],
      subtotal: 100,
      taxAmount: 0,
      total: 100,
      amountPaid: 0,
      balanceDue: 100,
      organizationName: 'Humanitarian Solidarity for Development and Empowerment Canada',
      organizationAddress: '112 Market Avenue, Unit 310',
      organizationCity: 'WINNIPEG',
      organizationProvince: 'MB',
      organizationPostalCode: 'R3B 0P4',
      organizationPhone: '+12048081123',
      organizationEmail: 'info@hsde.ca',
      charityBn: '725966758RR0001',
      currency: 'CAD',
      locale: 'en-CA',
    });

    const items = pdfTextItems(doc.output());
    const pageWidthPt = (doc.internal.pageSize.getWidth() * 72) / 25.4;
    const title = items.find((item) => item.text === 'INVOICE');
    const number = items.find((item) => item.text === '#INV-0003');
    const phone = items.find((item) => item.text.includes('Tel: +12048081123'));
    const bn = items.find((item) => item.text === 'BN: 725966758RR0001');
    const issued = items.find((item) => item.text === 'ISSUED');

    expect(title).toBeDefined();
    expect(number).toBeDefined();
    expect(phone).toBeDefined();
    expect(bn).toBeDefined();
    expect(issued).toBeDefined();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    const titleWidthPt = (doc.getTextWidth('INVOICE') * 72) / 25.4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const numberWidthPt = (doc.getTextWidth('#INV-0003') * 72) / 25.4;
    expect(Math.abs(title!.x + titleWidthPt / 2 - pageWidthPt / 2)).toBeLessThan(1);
    expect(Math.abs(number!.x + numberWidthPt / 2 - pageWidthPt / 2)).toBeLessThan(1);

    // PDF y grows upward, so the phone line is above the BN, and the BN is above ISSUED.
    expect(phone!.y).toBeGreaterThan(bn!.y);
    expect(bn!.y).toBeGreaterThan(issued!.y);

    doc.setFontSize(7);
    const phoneWidthPt = (doc.getTextWidth(phone!.text) * 72) / 25.4;
    const bnWidthPt = (doc.getTextWidth(bn!.text) * 72) / 25.4;
    const rightEdge = pageWidthPt - (15 * 72) / 25.4;
    expect(Math.abs(phone!.x + phoneWidthPt - rightEdge)).toBeLessThan(2);
    expect(Math.abs(bn!.x + bnWidthPt - rightEdge)).toBeLessThan(2);
  });
});
