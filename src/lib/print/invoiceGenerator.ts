/**
 * Invoice PDF Generator
 * Uses PrintService for consistent branding and formatting
 */

import jsPDF from 'jspdf';
import { printService } from './PrintService';
import { formatPrintCurrency, formatPrintDate } from './localization';
import type { PrintBranding, PrintLocalization, PrintOptions, PrintMargins } from './types';
import { DEFAULT_MARGINS } from './types';

export interface InvoiceLineItem {
  description: string;
  notes?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate?: number;
  taxAmount?: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  // Seller contact
  sellerEmail?: string;
  sellerPhone?: string;
  // Tax registration
  dealerPermitNumber?: string;
  gstHstNumber?: string;
  pstNumber?: string;
  // Tax exemptions
  isGstHstExempt?: boolean;
  isPstExempt?: boolean;
  lines: InvoiceLineItem[];
  subtotal: number;
  taxAmount: number;
  gstHstAmount?: number;
  pstAmount?: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  notes?: string;
  terms?: string;
  // New totals breakdown fields
  discountAmount?: number;
  shippingCharges?: number;
  adjustment?: number;
  adjustmentLabel?: string;
  orderNumber?: string;
  subject?: string;
}

export interface InvoiceGeneratorConfig {
  invoice: InvoiceData;
  branding: PrintBranding;
  localization: PrintLocalization;
  options: PrintOptions;
}

export function generateInvoiceDocument(config: InvoiceGeneratorConfig): jsPDF {
  const { invoice, branding, localization, options } = config;
  const margins: PrintMargins = DEFAULT_MARGINS;

  // Create document with configured settings
  const { doc, pageWidth, contentWidth } = printService.createDocument(
    options.paperSize,
    options.orientation,
    margins
  );

  let y = margins.top;

  // Add organization header
  y = printService.addHeader(doc, branding, y, margins);

  // Document title
  y = printService.addTitle(doc, 'INVOICE', `#${invoice.invoiceNumber}`, y, margins);

  // Status badge
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(invoice.status.toUpperCase(), pageWidth - margins.right, y - 5, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  // Tax Registration Numbers
  if (invoice.dealerPermitNumber || invoice.gstHstNumber || invoice.pstNumber) {
    y += 5;
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    const regNumbers: string[] = [];
    if (invoice.dealerPermitNumber) regNumbers.push(`Dealer Permit#: ${invoice.dealerPermitNumber}`);
    if (invoice.gstHstNumber) regNumbers.push(`GST/HST#: ${invoice.gstHstNumber}`);
    if (invoice.pstNumber) regNumbers.push(`PST#: ${invoice.pstNumber}`);
    doc.text(regNumbers.join('  |  '), margins.left, y);
    doc.setTextColor(0, 0, 0);
  }

  // Dates section
  y += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Invoice Date', margins.left, y);
  doc.text('Due Date', margins.left + 60, y);

  y += 5;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(formatPrintDate(invoice.invoiceDate, localization.dateFormat), margins.left, y);
  doc.text(formatPrintDate(invoice.dueDate, localization.dateFormat), margins.left + 60, y);

  // Seller contact (if provided)
  if (invoice.sellerEmail || invoice.sellerPhone) {
    y += 10;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Seller Contact', margins.left, y);
    y += 4;
    doc.setTextColor(0, 0, 0);
    const sellerContact: string[] = [];
    if (invoice.sellerEmail) sellerContact.push(invoice.sellerEmail);
    if (invoice.sellerPhone) sellerContact.push(invoice.sellerPhone);
    doc.text(sellerContact.join('  |  '), margins.left, y);
  }

  // Bill To section
  y += 12;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Bill To', margins.left, y);

  y += 5;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.customerName, margins.left, y);

  // Buyer contact info
  if (invoice.customerEmail || invoice.customerPhone) {
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const buyerContact: string[] = [];
    if (invoice.customerEmail) buyerContact.push(invoice.customerEmail);
    if (invoice.customerPhone) buyerContact.push(invoice.customerPhone);
    doc.text(buyerContact.join('  |  '), margins.left, y);
    doc.setFontSize(9);
  }

  if (invoice.customerAddress) {
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.customerAddress, margins.left, y);
  }

  // Line items table
  y += 20;
  y = renderLineItemsTable(doc, invoice, y, margins, pageWidth, contentWidth, localization);

  // Totals section
  y = renderTotals(doc, invoice, y, margins, pageWidth, localization);

  // Notes section
  if (options.includeNotes && invoice.notes) {
    y += 25;
    if (printService.needsPageBreak(doc, y, margins, 40)) {
      doc.addPage();
      y = margins.top;
    }
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes', margins.left, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    const splitNotes = doc.splitTextToSize(invoice.notes, contentWidth);
    doc.text(splitNotes, margins.left, y);
    y += splitNotes.length * 4;
  }

  // Terms section
  if (invoice.terms) {
    y += 10;
    if (printService.needsPageBreak(doc, y, margins, 30)) {
      doc.addPage();
      y = margins.top;
    }
    doc.setFont('helvetica', 'bold');
    doc.text('Terms & Conditions', margins.left, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    const splitTerms = doc.splitTextToSize(invoice.terms, contentWidth);
    doc.text(splitTerms, margins.left, y);
  }

  // Add watermark if configured
  if (options.watermark !== 'none' || options.isDraft) {
    printService.addWatermark(doc, {
      type: options.isDraft ? 'draft' : options.watermark,
      text: options.isDraft ? 'DRAFT' : options.watermark.toUpperCase(),
      opacity: 0.1,
    });
  }

  // Add branding footer
  printService.addBrandingFooter(doc);

  return doc;
}

function renderLineItemsTable(
  doc: jsPDF,
  invoice: InvoiceData,
  startY: number,
  margins: PrintMargins,
  pageWidth: number,
  _contentWidth: number,
  localization: PrintLocalization
): number {
  let y = startY;

  // Table header
  doc.setFillColor(245, 245, 245);
  doc.rect(margins.left, y - 5, pageWidth - margins.left - margins.right, 10, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Description', margins.left + 2, y);
  doc.text('Qty', margins.left + 90, y, { align: 'center' });
  doc.text('Unit Price', margins.left + 115, y, { align: 'right' });
  doc.text('Tax', margins.left + 140, y, { align: 'right' });
  doc.text('Amount', pageWidth - margins.right - 2, y, { align: 'right' });

  y += 8;
  doc.setFont('helvetica', 'normal');

  // Table rows
  for (const line of invoice.lines) {
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = margins.top + 10;
    }

    // Truncate long descriptions
    const description = line.description.length > 45
      ? line.description.substring(0, 42) + '...'
      : line.description;

    doc.text(description, margins.left + 2, y);
    doc.text(line.quantity.toString(), margins.left + 90, y, { align: 'center' });
    doc.text(formatPrintCurrency(line.unitPrice, localization.currency), margins.left + 115, y, { align: 'right' });
    doc.text(line.taxRate ? `${line.taxRate}%` : '-', margins.left + 140, y, { align: 'right' });
    doc.text(formatPrintCurrency(line.amount, localization.currency), pageWidth - margins.right - 2, y, { align: 'right' });

    y += 7;

    // Render line notes if present
    if (line.notes) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(120, 120, 120);
      const noteText = line.notes.length > 80 ? line.notes.substring(0, 77) + '...' : line.notes;
      doc.text(noteText, margins.left + 4, y);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      y += 5;
    }
  }

  return y;
}

function renderTotals(
  doc: jsPDF,
  invoice: InvoiceData,
  startY: number,
  margins: PrintMargins,
  pageWidth: number,
  localization: PrintLocalization
): number {
  let y = startY + 10;

  // Line separator
  doc.setDrawColor(200, 200, 200);
  doc.line(margins.left + 100, y - 5, pageWidth - margins.right, y - 5);

  doc.setFontSize(9);

  // Subtotal
  doc.text('Subtotal', margins.left + 110, y);
  doc.text(formatPrintCurrency(invoice.subtotal, localization.currency), pageWidth - margins.right - 2, y, { align: 'right' });

  // Discount
  if (invoice.discountAmount && invoice.discountAmount > 0) {
    y += 7;
    doc.text('Discount', margins.left + 110, y);
    doc.text('-' + formatPrintCurrency(invoice.discountAmount, localization.currency), pageWidth - margins.right - 2, y, { align: 'right' });
  }

  // Shipping Charges
  if (invoice.shippingCharges && invoice.shippingCharges > 0) {
    y += 7;
    doc.text('Shipping Charges', margins.left + 110, y);
    doc.text(formatPrintCurrency(invoice.shippingCharges, localization.currency), pageWidth - margins.right - 2, y, { align: 'right' });
  }

  // Adjustment
  if (invoice.adjustment && invoice.adjustment !== 0) {
    y += 7;
    const adjLabel = invoice.adjustmentLabel || 'Adjustment';
    doc.text(adjLabel, margins.left + 110, y);
    doc.text(formatPrintCurrency(invoice.adjustment, localization.currency), pageWidth - margins.right - 2, y, { align: 'right' });
  }

  // Split Tax Display - GST/HST
  if (invoice.gstHstAmount !== undefined || invoice.taxAmount > 0) {
    y += 7;
    const gstHstLabel = invoice.isGstHstExempt ? 'GST/HST (EXEMPT)' : 'GST/HST';
    const gstHstAmount = invoice.isGstHstExempt ? 0 : (invoice.gstHstAmount ?? invoice.taxAmount);
    doc.text(gstHstLabel, margins.left + 110, y);
    doc.text(formatPrintCurrency(gstHstAmount, localization.currency), pageWidth - margins.right - 2, y, { align: 'right' });
  }

  // Split Tax Display - PST (if applicable)
  if (invoice.pstAmount !== undefined && invoice.pstAmount > 0) {
    y += 7;
    const pstLabel = invoice.isPstExempt ? 'PST (EXEMPT)' : 'PST';
    const pstAmount = invoice.isPstExempt ? 0 : invoice.pstAmount;
    doc.text(pstLabel, margins.left + 110, y);
    doc.text(formatPrintCurrency(pstAmount, localization.currency), pageWidth - margins.right - 2, y, { align: 'right' });
  }

  // Total
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Total', margins.left + 110, y);
  doc.text(formatPrintCurrency(invoice.total, localization.currency), pageWidth - margins.right - 2, y, { align: 'right' });

  // Amount Paid
  if (invoice.amountPaid > 0) {
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.text('Amount Paid', margins.left + 110, y);
    doc.text(formatPrintCurrency(invoice.amountPaid, localization.currency), pageWidth - margins.right - 2, y, { align: 'right' });
  }

  // Balance Due
  y += 10;
  doc.setFillColor(240, 240, 240);
  doc.rect(margins.left + 100, y - 5, pageWidth - margins.right - margins.left - 100, 12, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Balance Due', margins.left + 105, y + 2);
  doc.text(formatPrintCurrency(invoice.balanceDue, localization.currency), pageWidth - margins.right - 5, y + 2, { align: 'right' });

  return y + 10;
}

/**
 * Generate and download an invoice PDF
 */
export async function downloadInvoicePdf(
  config: InvoiceGeneratorConfig
): Promise<void> {
  const doc = generateInvoiceDocument(config);
  const filename = `Invoice-${config.invoice.invoiceNumber}.pdf`;
  
  if (config.options.outputType === 'browser_print') {
    printService.openPrintDialog(doc);
  } else {
    printService.downloadPdf(doc, filename);
  }
}
