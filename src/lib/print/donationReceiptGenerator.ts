/**
 * CRA-Compliant Donation Receipt PDF Generator
 * Generates official tax receipts per Canada Revenue Agency requirements
 * Supports both individual and consolidated annual receipts
 */

import jsPDF from 'jspdf';
import type { DonationReceipt } from '@/types/donations';

export interface ReceiptGeneratorConfig {
  paperSize?: 'letter' | 'a4';
  showWatermark?: boolean;
  logoBase64?: string;
}

const CRA_DISCLAIMER_DEFAULT =
  'This is an official receipt for income tax purposes. ' +
  'Canada Revenue Agency: www.canada.ca/charities-giving';

export function generateDonationReceiptPdf(
  receipt: DonationReceipt,
  config: ReceiptGeneratorConfig = {}
): jsPDF {
  const { paperSize = 'letter' } = config;
  const dims = paperSize === 'a4'
    ? { width: 210, height: 297 }
    : { width: 215.9, height: 279.4 };

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [dims.width, dims.height] });
  const pageWidth = doc.internal.pageSize.getWidth();
  const ml = 20; // margin left
  const mr = 20; // margin right
  const cw = pageWidth - ml - mr; // content width

  let y = 20;

  // ── Logo + Header ──
  const logoMaxW = 30;
  const logoMaxH = 15;
  let titleStartX = pageWidth / 2;

  if (config.logoBase64) {
    try {
      doc.addImage(config.logoBase64, ml, y - 2, logoMaxW, logoMaxH);
      // Shift title to the right of the logo
      titleStartX = ml + logoMaxW + ((cw - logoMaxW) / 2);
    } catch (e) {
      console.warn('Failed to add logo to receipt:', e);
    }
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('OFFICIAL DONATION RECEIPT', config.logoBase64 ? titleStartX : pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFontSize(10);
  doc.text('FOR INCOME TAX PURPOSES', config.logoBase64 ? titleStartX : pageWidth / 2, y, { align: 'center' });
  y += 5;

  // Consolidated subtitle
  if (receipt.is_consolidated && receipt.items && receipt.items.length > 0) {
    const taxYear = new Date(receipt.date_of_donation).getFullYear();
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 80, 160);
    doc.text(`CONSOLIDATED ANNUAL RECEIPT - TAX YEAR ${taxYear}`, config.logoBase64 ? titleStartX : pageWidth / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 3;
  }

  // Ensure y is below logo if logo is taller than text
  if (config.logoBase64) {
    y = Math.max(y, 20 - 2 + logoMaxH + 3);
  }

  y += 3;

  // Divider
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(ml, y, pageWidth - mr, y);
  y += 8;

  // ── Receipt Info Box ──
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Receipt Number:', ml, y);
  doc.setFont('helvetica', 'normal');
  doc.text(receipt.receipt_number, ml + 35, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Date Issued:', pageWidth / 2, y);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(receipt.date_of_issue), pageWidth / 2 + 28, y);
  y += 6;

  if (receipt.location_issued) {
    doc.setFont('helvetica', 'bold');
    doc.text('Location Issued:', ml, y);
    doc.setFont('helvetica', 'normal');
    doc.text(receipt.location_issued, ml + 35, y);
    y += 6;
  }

  if (receipt.replaces_receipt_id) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 0, 0);
    doc.text('** This receipt replaces a previously issued receipt **', ml, y);
    doc.setTextColor(0, 0, 0);
    y += 6;
  }

  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(ml, y, pageWidth - mr, y);
  y += 8;

  // ── Charity Information ──
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('CHARITY INFORMATION', ml, y);
  y += 6;

  doc.setFontSize(9);
  const charityInfo = [
    { label: 'Charity Name:', value: receipt.charity_legal_name },
    { label: 'Business Number:', value: receipt.charity_bn },
    { label: 'Address:', value: receipt.charity_address },
  ];

  for (const item of charityInfo) {
    doc.setFont('helvetica', 'bold');
    doc.text(item.label, ml, y);
    doc.setFont('helvetica', 'normal');
    doc.text(item.value, ml + 35, y);
    y += 5;
  }

  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(ml, y, pageWidth - mr, y);
  y += 8;

  // ── Donor Information ──
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('DONOR INFORMATION', ml, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Name:', ml, y);
  doc.setFont('helvetica', 'normal');
  doc.text(receipt.donor_name, ml + 35, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.text('Address:', ml, y);
  doc.setFont('helvetica', 'normal');
  const addrLines = doc.splitTextToSize(receipt.donor_address, cw - 35);
  doc.text(addrLines, ml + 35, y);
  y += addrLines.length * 4 + 2;

  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(ml, y, pageWidth - mr, y);
  y += 8;

  // ── Donation Details ──
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('DONATION DETAILS', ml, y);
  y += 6;

  const taxYear = new Date(receipt.date_of_donation).getFullYear().toString();

  // Consolidated: render line-item table
  if (receipt.is_consolidated && receipt.items && receipt.items.length > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Tax Year:', ml, y);
    doc.setFont('helvetica', 'normal');
    doc.text(taxYear, ml + 40, y);
    y += 7;

    // Table header
    const colX = { date: ml, type: ml + 40, amount: ml + 90, eligible: ml + 130 };
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(245, 245, 245);
    doc.rect(ml, y - 3.5, cw, 5, 'F');
    doc.text('Date', colX.date, y);
    doc.text('Type', colX.type, y);
    doc.text('Amount', colX.amount, y);
    doc.text('Eligible', colX.eligible, y);
    y += 5;

    doc.setDrawColor(200, 200, 200);
    doc.line(ml, y, pageWidth - mr, y);
    y += 4;

    // Sort items by date
    const sortedItems = [...receipt.items].sort(
      (a, b) => new Date(a.date_received).getTime() - new Date(b.date_received).getTime()
    );

    doc.setFont('helvetica', 'normal');
    for (const item of sortedItems) {
      // Check if we need a new page
      if (y > dims.height - 60) {
        doc.addPage();
        y = 20;
      }
      doc.text(formatDateShort(item.date_received), colX.date, y);
      doc.text(formatDonationType(item.donation_type), colX.type, y);
      doc.text(formatCurrency(item.amount), colX.amount, y);
      doc.text(formatCurrency(item.eligible_amount), colX.eligible, y);
      y += 5;
    }

    // Totals row
    y += 2;
    doc.setDrawColor(0);
    doc.line(ml, y, pageWidth - mr, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTALS (${sortedItems.length} donations)`, colX.date, y);
    doc.text(formatCurrency(receipt.amount), colX.amount, y);
    doc.text(formatCurrency(receipt.eligible_amount), colX.eligible, y);
    y += 8;

    if (receipt.advantage_value && receipt.advantage_value > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Total Advantage Value:', ml, y);
      doc.setFont('helvetica', 'normal');
      doc.text(formatCurrency(receipt.advantage_value), ml + 50, y);
      y += 5;
      if (receipt.advantage_description) {
        doc.setFont('helvetica', 'bold');
        doc.text('Advantage Desc.:', ml, y);
        doc.setFont('helvetica', 'normal');
        doc.text(receipt.advantage_description, ml + 50, y);
        y += 5;
      }
    }
  } else {
    // Individual receipt: original layout
    doc.setFontSize(9);
    const donationDetails = [
      { label: 'Tax Year:', value: taxYear },
      { label: 'Date of Donation:', value: formatDate(receipt.date_of_donation) },
      { label: 'Total Amount:', value: formatCurrency(receipt.amount) },
      { label: 'Eligible Amount:', value: formatCurrency(receipt.eligible_amount) },
    ];

    if (receipt.advantage_value && receipt.advantage_value > 0) {
      donationDetails.push(
        { label: 'Advantage Value:', value: formatCurrency(receipt.advantage_value) },
      );
      if (receipt.advantage_description) {
        donationDetails.push(
          { label: 'Advantage Desc.:', value: receipt.advantage_description },
        );
      }
    }

    for (const item of donationDetails) {
      doc.setFont('helvetica', 'bold');
      doc.text(item.label, ml, y);
      doc.setFont('helvetica', 'normal');
      doc.text(item.value, ml + 40, y);
      y += 5;
    }
  }

  y += 6;

  // ── Highlighted Eligible Amount Box ──
  doc.setFillColor(240, 248, 240);
  doc.setDrawColor(34, 139, 34);
  doc.roundedRect(ml, y, cw, 14, 2, 2, 'FD');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 100, 0);
  doc.text(
    `ELIGIBLE AMOUNT FOR TAX PURPOSES: ${formatCurrency(receipt.eligible_amount)}`,
    pageWidth / 2,
    y + 9,
    { align: 'center' }
  );
  doc.setTextColor(0, 0, 0);
  y += 22;

  // ── Signatory ──
  if (receipt.signatory_name) {
    doc.setDrawColor(0);
    doc.line(ml, y, ml + 60, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(receipt.signatory_name, ml, y);
    if (receipt.signatory_position) {
      y += 4;
      doc.text(receipt.signatory_position, ml, y);
    }
    y += 8;
  }

  // ── CRA Disclaimer ──
  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(ml, y, pageWidth - mr, y);
  y += 6;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  const disclaimerText = receipt.cra_disclaimer || CRA_DISCLAIMER_DEFAULT;
  const disclaimerLines = doc.splitTextToSize(disclaimerText, cw);
  doc.text(disclaimerLines, ml, y);
  y += disclaimerLines.length * 3 + 4;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'Duplicate receipts are not official receipts and cannot be used for tax purposes.',
    ml,
    y
  );
  y += 6;

  // ── Receipt Status (cancelled watermark) ──
  if (receipt.status === 'cancelled') {
    const pCount = doc.getNumberOfPages();
    for (let i = 1; i <= pCount; i++) {
      doc.setPage(i);
      doc.setFontSize(60);
      doc.setTextColor(255, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('CANCELLED', pageWidth / 2, dims.height / 2, {
        align: 'center',
        angle: 45,
      });
    }
    doc.setTextColor(0, 0, 0);
  }

  // ── eFinsuite Globe branding footer ──
  const footerY = dims.height - 20;
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('Powered by eFinsuite Globe', pageWidth / 2, footerY, { align: 'center' });
  doc.setFontSize(6);
  doc.text(
    `Generated: ${new Date().toLocaleDateString('en-CA')}`,
    pageWidth / 2,
    footerY + 4,
    { align: 'center' }
  );
  doc.setTextColor(0, 0, 0);

  return doc;
}

export function downloadDonationReceiptPdf(receipt: DonationReceipt, config?: ReceiptGeneratorConfig): void {
  const doc = generateDonationReceiptPdf(receipt, config);
  doc.save(`Receipt-${receipt.receipt_number}.pdf`);
}

export function printDonationReceipt(receipt: DonationReceipt, config?: ReceiptGeneratorConfig): void {
  const doc = generateDonationReceiptPdf(receipt, config);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-10000px';
  iframe.style.left = '-10000px';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';

  const cleanup = () => {
    if (iframe.parentNode) document.body.removeChild(iframe);
    URL.revokeObjectURL(url);
  };

  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        window.open(url, '_blank');
      }
      setTimeout(cleanup, 1000);
    }, 100);
  };

  iframe.src = url;
  document.body.appendChild(iframe);
}

// ── Logo-aware async helpers ──

let _logoCache: { url: string; base64: string } | null = null;

async function fetchLogoBase64(logoUrl: string): Promise<string | null> {
  if (!logoUrl) return null;
  if (_logoCache && _logoCache.url === logoUrl) return _logoCache.base64;
  try {
    const response = await fetch(logoUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    const base64: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    _logoCache = { url: logoUrl, base64 };
    return base64;
  } catch (e) {
    console.error('Failed to load logo for receipt:', e);
    return null;
  }
}

export async function generateDonationReceiptWithLogo(
  receipt: DonationReceipt,
  logoUrl?: string | null,
  config: ReceiptGeneratorConfig = {}
): Promise<jsPDF> {
  let logoBase64: string | undefined;
  if (logoUrl) {
    const result = await fetchLogoBase64(logoUrl);
    if (result) logoBase64 = result;
  }
  return generateDonationReceiptPdf(receipt, { ...config, logoBase64 });
}

export async function downloadDonationReceiptWithLogo(
  receipt: DonationReceipt,
  logoUrl?: string | null,
  config?: ReceiptGeneratorConfig
): Promise<void> {
  const doc = await generateDonationReceiptWithLogo(receipt, logoUrl, config);
  doc.save(`Receipt-${receipt.receipt_number}.pdf`);
}

export async function printDonationReceiptWithLogo(
  receipt: DonationReceipt,
  logoUrl?: string | null,
  config?: ReceiptGeneratorConfig
): Promise<void> {
  const doc = await generateDonationReceiptWithLogo(receipt, logoUrl, config);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-10000px';
  iframe.style.left = '-10000px';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';

  const cleanup = () => {
    if (iframe.parentNode) document.body.removeChild(iframe);
    URL.revokeObjectURL(url);
  };

  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        window.open(url, '_blank');
      }
      setTimeout(cleanup, 1000);
    }, 100);
  };

  iframe.src = url;
  document.body.appendChild(iframe);
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatDateShort(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount);
}

function formatDonationType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
