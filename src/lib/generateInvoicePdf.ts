import jsPDF from 'jspdf';

interface CustomField {
  id: string;
  label: string;
  value: string;
  type: 'text' | 'number' | 'date';
}

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  documentTitle?: string;
  customerName: string;
  customerEmail?: string;
  customerAddress?: string;
  customerCity?: string;
  customerProvince?: string;
  customerPostalCode?: string;
  customerCountry?: string;
  customerPhone?: string;
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  buyerAddressLine1?: string;
  buyerAddressLine2?: string;
  buyerCity?: string;
  buyerProvince?: string;
  buyerPostalCode?: string;
  buyerCountry?: string;
  lines: {
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    taxRate?: number;
    taxAmount?: number;
    notes?: string;
  }[];
  subtotal: number;
  taxAmount: number;
  gstHstAmount?: number;
  pstAmount?: number;
  gstHstRate?: number;
  pstRate?: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  notes?: string;
  terms?: string;
  organizationName?: string;
  organizationAddress?: string;
  organizationCity?: string;
  organizationProvince?: string;
  organizationPostalCode?: string;
  organizationCountry?: string;
  organizationPhone?: string;
  organizationEmail?: string;
  organizationWebsite?: string;
  logoUrl?: string;
  logoBase64?: string;
  currency?: string;
  locale?: string;
  // Tax registration
  dealerPermitNumber?: string;
  gstHstNumber?: string;
  pstNumber?: string;
  // Tax exemptions
  isGstHstExempt?: boolean;
  isPstExempt?: boolean;
  exemptionReason?: string;
  // Seller info
  sellerEmail?: string;
  sellerPhone?: string;
  // Signatures
  sellerSignatureData?: string;
  sellerSignatureName?: string;
  buyerSignatureData?: string;
  buyerSignatureDate?: string;
  // Custom fields
  customFields?: CustomField[];
  // Payment instructions
  paymentInstructions?: string;
  footer?: string;
  // Column visibility
  showLineNumbers?: boolean;
  showQuantityColumn?: boolean;
  showRateColumn?: boolean;
  // Signature visibility
  showSellerSignature?: boolean;
  showBuyerSignature?: boolean;
  // Charity registration
  charityBn?: string;
  // Attention of
  attentionOf?: string;
  // Payment methods
  enableOnlinePayments?: boolean;
  creditCardEnabled?: boolean;
  achEnabled?: boolean;
  interacEnabled?: boolean;
  ccInstructions?: string;
  achInstitution?: string;
  achAccountName?: string;
  achAccountNumber?: string;
  achTransitNumber?: string;
  etransferEmail?: string;
  ccPaymentUrl?: string;
  // Wise bank transfer
  wiseEnabled?: boolean;
  wiseAccount?: {
    currency: string;
    account_holder_name?: string | null;
    bank_name?: string | null;
    account_number?: string | null;
    routing_number?: string | null;
    iban?: string | null;
    bic_swift?: string | null;
    sort_code?: string | null;
    institution_address?: string | null;
  } | null;
  wiseReference?: string | null;
}

export async function generateInvoicePdf(invoice: InvoiceData): Promise<void> {
  const doc = await generateInvoicePdfDoc(invoice);
  const filePrefix = invoice.documentTitle ? invoice.documentTitle.replace(/\s+/g, '-') : 'Invoice';
  doc.save(`${filePrefix}-${invoice.invoiceNumber}.pdf`);
}

/**
 * Generate the jsPDF document without saving - useful for sharing as blob
 */
export async function generateInvoicePdfDoc(invoice: InvoiceData): Promise<jsPDF> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // Helper function for currency formatting
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(invoice.locale || 'en-CA', {
      style: 'currency',
      currency: invoice.currency || 'CAD',
    }).format(value);
  };

  const hasVehicleCustomFields = invoice.customFields && invoice.customFields.some(field => {
    const label = field.label.toLowerCase();
    const hasValue = field.value && String(field.value).trim() !== '';
    const isVehicleField = ['vehicle make', 'vehicle model', 'vin', 'vehicle year', 'color', 'condition', 'make', 'model', 'year'].some(keyword => label.includes(keyword));
    return hasValue && isVehicleField;
  });
  
  const isBillOfSale = invoice.documentTitle?.toLowerCase().includes('bill of sale') || hasVehicleCustomFields;

  if (isBillOfSale) {
    await generateBillOfSalePdf(doc, invoice, formatCurrency, pageWidth, pageHeight, margin, contentWidth);
  } else {
    await generateStandardInvoicePdf(doc, invoice, formatCurrency, pageWidth, pageHeight, margin, contentWidth);
  }

  return doc;
}

/**
 * Generate Bill of Sale PDF - Matches BillOfSalePreview.tsx exactly
 */
async function generateBillOfSalePdf(
  doc: jsPDF,
  invoice: InvoiceData,
  formatCurrency: (value: number) => string,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  contentWidth: number
): Promise<void> {
  let yPos = 15;
  const primaryColor = { r: 30, g: 64, b: 175 }; // Blue #1e40af
  const secondaryColor = { r: 100, g: 116, b: 139 }; // Slate #64748b
  const mutedColor = { r: 107, g: 114, b: 128 }; // Gray #6b7280

  // ==================== HEADER (Logo + Title) ====================
  let logoEndX = margin;
  if (invoice.logoBase64 || invoice.logoUrl) {
    try {
      const logoData = invoice.logoBase64 || await loadImageAsBase64(invoice.logoUrl!);
      if (logoData) {
        // Calculate aspect-ratio-preserving dimensions
        const dims = getImageDimensions(logoData);
        const maxW = 30;
        const maxH = 15;
        const scale = Math.min(maxW / dims.width, maxH / dims.height);
        const logoWidth = dims.width * scale;
        const logoHeight = dims.height * scale;
        doc.addImage(logoData, 'PNG', margin, yPos, logoWidth, logoHeight);
        logoEndX = margin + logoWidth + 5;
      }
    } catch (e) {
      console.warn('Failed to load logo:', e);
    }
  }

  // Document Title - Bold, Blue
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.text('BILL OF SALE', logoEndX, yPos + 10);
  doc.setTextColor(0, 0, 0);

  yPos += 25;

  // Separator line
  doc.setDrawColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.setLineWidth(0.2);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  // ==================== TAX REGISTRATION BADGES ====================
  const badges: { label: string; value: string }[] = [];
  if (invoice.charityBn) badges.push({ label: 'BN', value: invoice.charityBn });
  if (invoice.dealerPermitNumber) badges.push({ label: 'Dealer Permit#', value: invoice.dealerPermitNumber });
  if (invoice.gstHstNumber) badges.push({ label: 'GST/HST#', value: invoice.gstHstNumber });
  if (invoice.pstNumber) badges.push({ label: 'PST#', value: invoice.pstNumber });

  if (badges.length > 0) {
    doc.setFontSize(7);
    let badgeX = margin;
    
    badges.forEach((badge, idx) => {
      const text = `${badge.label}: ${badge.value}`;
      const badgeWidth = doc.getTextWidth(text) + 8;
      
      // Light blue background
      doc.setFillColor(240, 245, 255);
      doc.roundedRect(badgeX, yPos - 1, badgeWidth, 6, 1, 1, 'F');
      
      // Text in primary color
      doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
      doc.setFont('helvetica', 'normal');
      doc.text(text, badgeX + 4, yPos + 3);
      
      badgeX += badgeWidth + 5;
    });
    doc.setTextColor(0, 0, 0);
    yPos += 12;
  }

  // ==================== SELLER & BUYER INFO (Side by Side Boxes) ====================
  const colWidth = (contentWidth - 8) / 2;
  const boxHeight = 42;
  
  // --- SELLER BOX (Left) ---
  doc.setDrawColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, yPos, colWidth, boxHeight, 2, 2, 'S');
  
  // "From (Seller)" header
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.text('From (Seller)', margin + 4, yPos + 6);
  doc.setTextColor(0, 0, 0);
  
  let sellerY = yPos + 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(invoice.organizationName || 'Seller', margin + 4, sellerY);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
  sellerY += 4;
  
  const sellerAddress = [
    invoice.organizationAddress,
    [invoice.organizationCity, invoice.organizationProvince, invoice.organizationPostalCode].filter(Boolean).join(', '),
    invoice.organizationCountry
  ].filter(Boolean);
  
  sellerAddress.forEach(line => {
    doc.text(line!, margin + 4, sellerY);
    sellerY += 3.5;
  });
  
  // Separator line
  sellerY += 2;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin + 4, sellerY, margin + colWidth - 4, sellerY);
  sellerY += 4;
  
  // Email and Phone
  doc.setTextColor(0, 0, 0);
  const sellerEmail = invoice.sellerEmail || invoice.organizationEmail;
  const sellerPhone = invoice.sellerPhone || invoice.organizationPhone;
  if (sellerEmail) {
    doc.text(`Email: ${sellerEmail}`, margin + 4, sellerY);
    sellerY += 3.5;
  }
  if (sellerPhone) {
    doc.text(`Tel: ${sellerPhone}`, margin + 4, sellerY);
  }

  // --- BUYER BOX (Right) ---
  const buyerBoxX = margin + colWidth + 8;
  doc.setDrawColor(secondaryColor.r, secondaryColor.g, secondaryColor.b);
  doc.roundedRect(buyerBoxX, yPos, colWidth, boxHeight, 2, 2, 'S');
  
  // "To (Buyer)" header
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.text('To (Buyer)', buyerBoxX + 4, yPos + 6);
  doc.setTextColor(0, 0, 0);
  
  let buyerY = yPos + 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const buyerDisplayName = invoice.buyerName || invoice.customerName;
  doc.text(buyerDisplayName, buyerBoxX + 4, buyerY);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
  buyerY += 4;

  if (invoice.attentionOf) {
    doc.text(`Attn: ${invoice.attentionOf}`, buyerBoxX + 4, buyerY);
    buyerY += 3.5;
  }
  
  const buyerAddress = [
    invoice.buyerAddressLine1 || invoice.customerAddress,
    [invoice.buyerCity || invoice.customerCity, invoice.buyerProvince || invoice.customerProvince, invoice.buyerPostalCode || invoice.customerPostalCode].filter(Boolean).join(', '),
    invoice.buyerCountry || invoice.customerCountry
  ].filter(Boolean);
  
  buyerAddress.forEach(line => {
    doc.text(line!, buyerBoxX + 4, buyerY);
    buyerY += 3.5;
  });
  
  // Separator line
  buyerY += 2;
  doc.setDrawColor(220, 220, 220);
  doc.line(buyerBoxX + 4, buyerY, buyerBoxX + colWidth - 4, buyerY);
  buyerY += 4;
  
  // Email and Phone
  doc.setTextColor(0, 0, 0);
  const buyerEmail = invoice.buyerEmail || invoice.customerEmail;
  const buyerPhone = invoice.buyerPhone || invoice.customerPhone;
  if (buyerEmail) {
    doc.text(`Email: ${buyerEmail}`, buyerBoxX + 4, buyerY);
    buyerY += 3.5;
  }
  if (buyerPhone) {
    doc.text(`Tel: ${buyerPhone}`, buyerBoxX + 4, buyerY);
  }

  yPos += boxHeight + 8;

  // ==================== DOCUMENT INFO (Document # and Date) ====================
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  // Document #
  doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.text('Document #:', margin, yPos);
  doc.setTextColor(0, 0, 0);
  doc.text(invoice.invoiceNumber, margin + 25, yPos);
  
  // Date (right side)
  const dateX = buyerBoxX;
  doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.text('Date:', dateX, yPos);
  doc.setTextColor(0, 0, 0);
  doc.text(invoice.invoiceDate, dateX + 15, yPos);

  yPos += 8;

  // ==================== VEHICLE/ITEM DETAILS (Custom Fields Box) ====================
  const hasCustomFields = invoice.customFields && invoice.customFields.filter(f => f.value && String(f.value).trim() !== '').length > 0;
  
  if (hasCustomFields) {
    const fieldsWithValues = invoice.customFields!.filter(f => f.value && String(f.value).trim() !== '');
    const boxHeightForFields = Math.max(24, 12 + Math.ceil(fieldsWithValues.length / 2) * 4);
    
    // Box with light background
    doc.setDrawColor(secondaryColor.r, secondaryColor.g, secondaryColor.b);
    doc.setFillColor(250, 251, 252);
    doc.roundedRect(margin, yPos, contentWidth, boxHeightForFields, 2, 2, 'FD');
    
    // Header
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
    doc.text('Vehicle / Item Details', margin + 4, yPos + 6);
    doc.setTextColor(0, 0, 0);
    
    // Display fields in 2-column grid (3 pairs per row)
    doc.setFontSize(7);
    const fieldStartY = yPos + 12;
    const leftColX = margin + 4;
    const midColX = margin + contentWidth / 3;
    const rightColX = margin + (contentWidth * 2) / 3;
    
    fieldsWithValues.forEach((field, idx) => {
      const colIdx = idx % 3;
      const rowIdx = Math.floor(idx / 3);
      const xPos = colIdx === 0 ? leftColX : colIdx === 1 ? midColX : rightColX;
      const fieldY = fieldStartY + rowIdx * 4;
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
      doc.text(`${field.label}:`, xPos, fieldY);
      
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      const labelWidth = doc.getTextWidth(`${field.label}: `);
      const value = String(field.value).length > 20 ? String(field.value).substring(0, 17) + '...' : String(field.value);
      doc.text(value, xPos + Math.max(labelWidth, 25), fieldY);
    });

    yPos += boxHeightForFields + 6;
  }

  // ==================== LINE ITEMS TABLE ====================
  // Table header with primary color background
  doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.rect(margin, yPos, contentWidth, 7, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  const headerY = yPos + 5;
  doc.text('Description', margin + 3, headerY);
  doc.text('Qty', margin + 110, headerY, { align: 'center' });
  doc.text('Price', margin + 140, headerY, { align: 'right' });
  doc.text('Amount', pageWidth - margin - 3, headerY, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  yPos += 9;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  // Table rows
  invoice.lines.forEach((line, idx) => {
    if (yPos > pageHeight - 80) {
      doc.addPage();
      yPos = 20;
    }
    
    // Alternate row background
    if (idx % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, yPos - 3, contentWidth, 7, 'F');
    }
    
    const description = line.description.length > 55 
      ? line.description.substring(0, 52) + '...' 
      : line.description;
    
    doc.text(description, margin + 3, yPos);
    doc.text(line.quantity.toString(), margin + 110, yPos, { align: 'center' });
    doc.text(formatCurrency(line.unitPrice), margin + 140, yPos, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(line.amount), pageWidth - margin - 3, yPos, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    
    yPos += 7;

    // Render line-level notes
    if (line.notes && line.notes.trim()) {
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
      doc.text(line.notes.trim(), margin + 6, yPos - 2);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      yPos += 4;
    }
  });

  yPos += 3;

  // ==================== TAX EXEMPTIONS BOX ====================
  if (invoice.isGstHstExempt || invoice.isPstExempt) {
    doc.setFillColor(240, 245, 255);
    doc.setDrawColor(primaryColor.r, primaryColor.g, primaryColor.b);
    doc.roundedRect(margin, yPos, contentWidth, 10, 2, 2, 'FD');
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
    doc.text('Tax Exemptions', margin + 4, yPos + 6);
    
    let exemptX = margin + 35;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    
    if (invoice.isGstHstExempt) {
      doc.text('[X] GST/HST Exempt (Export Sale)', exemptX, yPos + 6);
      exemptX += 50;
    }
    if (invoice.isPstExempt) {
      doc.text('[X] PST Exempt', exemptX, yPos + 6);
    }
    doc.setTextColor(0, 0, 0);
    yPos += 14;
  }

  // ==================== TOTALS SECTION ====================
  yPos += 5;
  const totalsX = margin + 100;
  const valuesX = pageWidth - margin - 3;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  // Subtotal
  doc.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
  doc.text('Subtotal:', totalsX, yPos);
  doc.setTextColor(0, 0, 0);
  doc.text(formatCurrency(invoice.subtotal), valuesX, yPos, { align: 'right' });
  yPos += 5;
  
  // GST/HST
  const gstRate = invoice.gstHstRate || 5;
  const gstLabel = invoice.isGstHstExempt ? 'GST/HST (EXEMPT):' : `GST/HST (${gstRate}%):`;
  doc.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
  doc.text(gstLabel, totalsX, yPos);
  doc.setTextColor(0, 0, 0);
  const gstAmount = invoice.isGstHstExempt ? 0 : (invoice.gstHstAmount ?? (invoice.subtotal * gstRate / 100));
  doc.text(formatCurrency(gstAmount), valuesX, yPos, { align: 'right' });
  yPos += 5;
  
  // PST (if applicable)
  if (invoice.pstAmount !== undefined && invoice.pstAmount > 0 || invoice.pstRate) {
    const pstRate = invoice.pstRate || 7;
    const pstLabel = invoice.isPstExempt ? 'PST (EXEMPT):' : `PST (${pstRate}%):`;
    doc.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
    doc.text(pstLabel, totalsX, yPos);
    doc.setTextColor(0, 0, 0);
    const pstAmount = invoice.isPstExempt ? 0 : (invoice.pstAmount ?? (invoice.subtotal * pstRate / 100));
    doc.text(formatCurrency(pstAmount), valuesX, yPos, { align: 'right' });
    yPos += 5;
  }
  
  // Separator
  doc.setDrawColor(200, 200, 200);
  doc.line(totalsX, yPos, pageWidth - margin, yPos);
  yPos += 5;
  
  // Total
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Total:', totalsX, yPos);
  doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.text(formatCurrency(invoice.total), valuesX, yPos, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  yPos += 10;

  // ==================== SIGNATURES SECTION ====================
  const signatureBoxWidth = (contentWidth - 20) / 2;
  const signatureY = yPos + 5;
  
  // Ensure signatures fit on the page
  if (signatureY + 35 > pageHeight) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');

  // --- Seller Signature (Left) ---
  doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.text('Seller Signature', margin, signatureY);
  doc.setTextColor(0, 0, 0);
  
  // Dashed signature line
  doc.setDrawColor(secondaryColor.r, secondaryColor.g, secondaryColor.b);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(margin, signatureY + 15, margin + signatureBoxWidth, signatureY + 15);
  doc.setLineDashPattern([], 0);
  
  // Add signature image if available
  if (invoice.sellerSignatureData) {
    try {
      doc.addImage(invoice.sellerSignatureData, 'PNG', margin + 5, signatureY + 3, signatureBoxWidth - 10, 10);
    } catch (e) {
      console.warn('Failed to add seller signature:', e);
    }
  }
  
  // Seller name below line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
  doc.text(invoice.sellerSignatureName || invoice.organizationName || '', margin, signatureY + 20);
  doc.setTextColor(0, 0, 0);

  // --- Buyer Signature (Right) ---
  const buyerSigX = margin + signatureBoxWidth + 20;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.text('Buyer Signature', buyerSigX, signatureY);
  doc.setTextColor(0, 0, 0);
  
  // Dashed signature line
  doc.setDrawColor(secondaryColor.r, secondaryColor.g, secondaryColor.b);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(buyerSigX, signatureY + 15, buyerSigX + signatureBoxWidth, signatureY + 15);
  doc.setLineDashPattern([], 0);
  
  // Add signature image if available
  if (invoice.buyerSignatureData) {
    try {
      doc.addImage(invoice.buyerSignatureData, 'PNG', buyerSigX + 5, signatureY + 3, signatureBoxWidth - 10, 10);
    } catch (e) {
      console.warn('Failed to add buyer signature:', e);
    }
  }
  
  // Buyer name below line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
  const buyerSigName = invoice.buyerName || invoice.customerName;
  doc.text(buyerSigName, buyerSigX, signatureY + 20);
  doc.setTextColor(0, 0, 0);

  // ==================== BARCODE SECTION ====================
  yPos = Math.min(yPos + 25, signatureY + 30);
  
  // Draw barcode placeholder with invoice number
  const barcodeWidth = 80;
  const barcodeX = (pageWidth - barcodeWidth) / 2;
  
  // Draw barcode lines (simple CODE128-like representation)
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  
  const invoiceStr = invoice.invoiceNumber;
  let barX = barcodeX;
  const barHeight = 15;
  const barcodeY = yPos;
  
  // Generate visual barcode pattern from invoice number
  for (let i = 0; i < invoiceStr.length; i++) {
    const charCode = invoiceStr.charCodeAt(i);
    // Create varying bar widths based on character
    const wide = (charCode % 3) + 1;
    const narrow = 1;
    
    // Draw bars
    doc.setFillColor(0, 0, 0);
    doc.rect(barX, barcodeY, wide * 0.5, barHeight, 'F');
    barX += wide * 0.5 + narrow * 0.5;
    
    doc.rect(barX, barcodeY, narrow * 0.5, barHeight, 'F');
    barX += narrow * 0.5 + 1;
    
    if (barX > barcodeX + barcodeWidth - 5) break;
  }
  
  // Invoice number below barcode
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(invoice.invoiceNumber, pageWidth / 2, barcodeY + barHeight + 4, { align: 'center' });
  
  yPos = barcodeY + barHeight + 10;

  // ==================== FOOTER ====================
  const footerY = pageHeight - 15;
  
  // Separator line above footer
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, footerY - 6, pageWidth - margin, footerY - 6);
  
  // Transfer notice
  doc.setFontSize(7);
  doc.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
  doc.text('This Bill of Sale transfers ownership of the above item(s) from seller to buyer.', pageWidth / 2, footerY - 2, { align: 'center' });
  
  // Branding
  doc.setFontSize(6);
  doc.setTextColor(180, 180, 180);
  doc.text('Powered by eFinsuite Globe', pageWidth / 2, footerY + 2, { align: 'center' });
}

/**
 * Generate standard invoice PDF (original layout)
 */
async function generateStandardInvoicePdf(
  doc: jsPDF,
  invoice: InvoiceData,
  formatCurrency: (value: number) => string,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  contentWidth: number
): Promise<void> {
  let yPos = 12;

  // ==================== HEADER ROW (Logo + Title + Org Info) ====================
  const headerStartY = yPos;
  
  // Logo on left (smaller)
  let logoEndX = margin;
  if (invoice.logoBase64 || invoice.logoUrl) {
    try {
      const logoData = invoice.logoBase64 || await loadImageAsBase64(invoice.logoUrl!);
      if (logoData) {
        const dims = getImageDimensions(logoData);
        const maxW = 28;
        const maxH = 14;
        const scale = Math.min(maxW / dims.width, maxH / dims.height);
        const logoWidth = dims.width * scale;
        const logoHeight = dims.height * scale;
        doc.addImage(logoData, 'PNG', margin, yPos, logoWidth, logoHeight);
        logoEndX = margin + logoWidth + 5;
      }
    } catch (e) {
      console.warn('Failed to load logo:', e);
    }
  }

  // Document title and invoice number (center-left)
  const docTitle = invoice.documentTitle || 'INVOICE';
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(docTitle.toUpperCase(), logoEndX, yPos + 5);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`#${invoice.invoiceNumber}`, logoEndX, yPos + 10);

  // Organization info (right side, compact) - rendered FIRST so we know height
  let orgBlockBottom = yPos;
  if (invoice.organizationName) {
    let orgY = yPos;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.organizationName, pageWidth - margin, orgY, { align: 'right' });
    orgY += 3.5;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    
    const orgAddressParts = [
      invoice.organizationAddress,
      [invoice.organizationCity, invoice.organizationProvince, invoice.organizationPostalCode].filter(Boolean).join(', ')
    ].filter(Boolean);
    
    orgAddressParts.forEach(part => {
      doc.text(part!, pageWidth - margin, orgY, { align: 'right' });
      orgY += 3;
    });
    
    const contactParts: string[] = [];
    if (invoice.organizationPhone) contactParts.push(`Tel: ${invoice.organizationPhone}`);
    if (invoice.organizationEmail) contactParts.push(`Email: ${invoice.organizationEmail}`);
    const contactLine = contactParts.join(' | ');
    if (contactLine) {
      doc.text(contactLine, pageWidth - margin, orgY, { align: 'right' });
      orgY += 3;
    }
    doc.setTextColor(0, 0, 0);
    orgBlockBottom = orgY;
  }

  // Status badge - placed BELOW org info block to avoid overlap
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(invoice.status.toUpperCase(), pageWidth - margin, orgBlockBottom + 1, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  yPos = Math.max(headerStartY + 18, orgBlockBottom + 5);

  // ==================== TAX REGISTRATION NUMBERS ====================
  const taxRegParts: string[] = [];
  if (invoice.charityBn) taxRegParts.push(`BN: ${invoice.charityBn}`);
  if (invoice.dealerPermitNumber) taxRegParts.push(`Dealer Permit#: ${invoice.dealerPermitNumber}`);
  if (invoice.gstHstNumber) taxRegParts.push(`GST/HST#: ${invoice.gstHstNumber}`);
  if (invoice.pstNumber) taxRegParts.push(`PST#: ${invoice.pstNumber}`);
  
  if (taxRegParts.length > 0) {
    doc.setFontSize(6.5);
    doc.setTextColor(80, 80, 80);
    doc.text(taxRegParts.join('  |  '), margin, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 4;
  }

  // Divider
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 4;

  // ==================== DATE & CUSTOMER ROW (Side by side) ====================
  const leftColWidth = contentWidth * 0.5;
  
  // Dates (left)
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('Date', margin, yPos);
  doc.text('Due', margin + 35, yPos);
  
  yPos += 3;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(invoice.invoiceDate, margin, yPos);
  doc.text(invoice.dueDate, margin + 35, yPos);

  // Bill To (right of dates)
  const billToX = margin + leftColWidth;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Bill To', billToX, yPos - 3);
  
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(invoice.customerName, billToX, yPos);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  let custY = yPos + 3.5;

  if (invoice.attentionOf) {
    doc.text(`Attn: ${invoice.attentionOf}`, billToX, custY);
    custY += 3;
  }
  
  const customerDetails = [
    invoice.customerEmail ? `Email: ${invoice.customerEmail}` : null,
    invoice.customerPhone ? `Tel: ${invoice.customerPhone}` : null,
    invoice.customerAddress,
    [invoice.customerCity, invoice.customerProvince, invoice.customerPostalCode].filter(Boolean).join(', ')
  ].filter(Boolean);
  
  customerDetails.slice(0, 4).forEach(detail => {
    doc.text(detail!, billToX, custY);
    custY += 3;
  });

  yPos = Math.max(yPos + 12, custY + 2);

  // ==================== LINE ITEMS TABLE (Compact) ====================
  // Table header
  doc.setFillColor(248, 248, 248);
  doc.rect(margin, yPos, contentWidth, 6, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  yPos += 4;
  
  const showLineNums = invoice.showLineNumbers ?? false;
  const showQty = invoice.showQuantityColumn ?? true;
  const showRate = invoice.showRateColumn ?? true;
  
  let colX = margin + 2;
  if (showLineNums) {
    doc.text('#', colX, yPos, { align: 'center' });
    colX += 8;
  }
  doc.text('Description', colX, yPos);
  if (showQty) doc.text('Qty', margin + 85, yPos, { align: 'center' });
  if (showRate) doc.text('Price', margin + 105, yPos, { align: 'right' });
  doc.text('Tax', margin + 125, yPos, { align: 'right' });
  doc.text('Amount', pageWidth - margin - 2, yPos, { align: 'right' });

  yPos += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  // Table rows - show all lines with page break support
  invoice.lines.forEach((line, idx) => {
    if (yPos > pageHeight - 50) {
      doc.addPage();
      yPos = 20;
    }
    
    const description = line.description.length > 50 
      ? line.description.substring(0, 47) + '...' 
      : line.description;
    
    let lineX = margin + 2;
    if (showLineNums) {
      doc.text((idx + 1).toString(), lineX, yPos, { align: 'center' });
      lineX += 8;
    }
    doc.text(description, lineX, yPos);
    if (showQty) doc.text(line.quantity.toString(), margin + 85, yPos, { align: 'center' });
    if (showRate) doc.text(formatCurrency(line.unitPrice), margin + 105, yPos, { align: 'right' });
    doc.text(line.taxRate ? `${line.taxRate}%` : '-', margin + 125, yPos, { align: 'right' });
    doc.text(formatCurrency(line.amount), pageWidth - margin - 2, yPos, { align: 'right' });
    
    yPos += 5;

    // Render line-level notes
    if (line.notes && line.notes.trim()) {
      doc.setFontSize(6);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      const noteX = showLineNums ? margin + 10 : margin + 2;
      doc.text(line.notes.trim(), noteX, yPos);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      yPos += 4;
    }
  });

  // ==================== TOTALS (Right-aligned, compact) ====================
  yPos += 2;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin + 100, yPos, pageWidth - margin, yPos);
  yPos += 4;

  doc.setFontSize(8);
  const totalsX = margin + 110;
  
  doc.text('Subtotal', totalsX, yPos);
  doc.text(formatCurrency(invoice.subtotal), pageWidth - margin - 2, yPos, { align: 'right' });
  yPos += 4;
  
  // Split tax display if GST/HST and PST are available
  if (invoice.gstHstAmount !== undefined || invoice.gstHstRate) {
    const gstRate = invoice.gstHstRate || 5;
    const gstLabel = invoice.isGstHstExempt ? 'GST/HST (EXEMPT)' : `GST/HST (${gstRate}%)`;
    doc.text(gstLabel, totalsX, yPos);
    const gstAmt = invoice.isGstHstExempt ? 0 : (invoice.gstHstAmount ?? (invoice.subtotal * gstRate / 100));
    doc.text(formatCurrency(gstAmt), pageWidth - margin - 2, yPos, { align: 'right' });
    yPos += 4;
    
    // Only show PST if there's actual PST data (amount > 0 or explicit rate configured)
    if ((invoice.pstAmount !== undefined && invoice.pstAmount > 0) || (invoice.pstRate && invoice.pstRate > 0)) {
      const pstRate = invoice.pstRate || 7;
      const pstLabel = invoice.isPstExempt ? 'PST (EXEMPT)' : `PST (${pstRate}%)`;
      doc.text(pstLabel, totalsX, yPos);
      const pstAmt = invoice.isPstExempt ? 0 : (invoice.pstAmount ?? (invoice.subtotal * pstRate / 100));
      doc.text(formatCurrency(pstAmt), pageWidth - margin - 2, yPos, { align: 'right' });
      yPos += 4;
    }
  } else {
    doc.text('Tax', totalsX, yPos);
    doc.text(formatCurrency(invoice.taxAmount), pageWidth - margin - 2, yPos, { align: 'right' });
    yPos += 4;
  }
  
  doc.setFont('helvetica', 'bold');
  doc.text('Total', totalsX, yPos);
  doc.text(formatCurrency(invoice.total), pageWidth - margin - 2, yPos, { align: 'right' });
  
  if (invoice.amountPaid > 0) {
    yPos += 4;
    doc.setFont('helvetica', 'normal');
    doc.text('Paid', totalsX, yPos);
    doc.text(formatCurrency(invoice.amountPaid), pageWidth - margin - 2, yPos, { align: 'right' });
  }

  // Balance Due box
  yPos += 5;
  doc.setFillColor(245, 245, 245);
  doc.rect(margin + 100, yPos, pageWidth - margin - 100 - margin, 8, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Balance Due', margin + 103, yPos + 5.5);
  doc.text(formatCurrency(invoice.balanceDue), pageWidth - margin - 3, yPos + 5.5, { align: 'right' });

  yPos += 12;

  // ==================== CUSTOM FIELDS ====================
  const hasCustomFields = invoice.customFields && invoice.customFields.filter(f => f.value).length > 0;
  
  if (hasCustomFields) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('Additional Details', margin, yPos);
    yPos += 4;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    invoice.customFields!.filter(f => f.value).slice(0, 6).forEach((field) => {
      doc.setTextColor(100, 100, 100);
      const label = field.label.length > 12 ? field.label.substring(0, 10) + '..' : field.label;
      doc.text(`${label}:`, margin, yPos);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      const value = String(field.value).length > 25 ? String(field.value).substring(0, 22) + '...' : String(field.value);
      doc.text(value, margin + 28, yPos);
      doc.setFont('helvetica', 'normal');
      yPos += 3.5;
    });
    yPos += 4;
  }

  // ==================== NOTES & TERMS (Always full-width) ====================
  if (invoice.notes) {
    if (yPos > pageHeight - 30) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes', margin, yPos);
    yPos += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const splitNotes = doc.splitTextToSize(invoice.notes, contentWidth);
    splitNotes.forEach((line: string) => {
      if (yPos > pageHeight - 20) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(line, margin, yPos);
      yPos += 3.5;
    });
    yPos += 3;
  }

  if (invoice.terms) {
    if (yPos > pageHeight - 30) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Terms', margin, yPos);
    yPos += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const splitTerms = doc.splitTextToSize(invoice.terms, contentWidth);
    splitTerms.forEach((line: string) => {
      if (yPos > pageHeight - 20) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(line, margin, yPos);
      yPos += 3.5;
    });
    yPos += 3;
  }

  // ==================== PAYMENT INSTRUCTIONS ====================
  if (invoice.paymentInstructions) {
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = 20;
    }
    yPos += 2;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('Payment Instructions', margin, yPos);
    yPos += 3.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    const splitInstructions = doc.splitTextToSize(invoice.paymentInstructions, contentWidth);
    doc.text(splitInstructions.slice(0, 4), margin, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += Math.min(splitInstructions.length, 4) * 3 + 3;
  }

  // ==================== ACCEPTED PAYMENT METHODS ====================
  const hasWise = !!invoice.wiseEnabled && !!invoice.wiseAccount;
  const hasPaymentMethods = (invoice.enableOnlinePayments && (invoice.creditCardEnabled || invoice.achEnabled || invoice.interacEnabled)) || hasWise;
  if (hasPaymentMethods) {
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = 20;
    }
    yPos += 3;
    // Header bar
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, yPos - 3, contentWidth, 6, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text('Accepted Payment Methods', margin + 2, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 6;

    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    let badgeX = margin;

    // Track badge positions for hyperlinks
    const badgePositions: { x: number; y: number; w: number; h: number; url: string }[] = [];

    const drawBadge = (label: string, linkUrl?: string) => {
      const tw = doc.getTextWidth(label) + 4;
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(badgeX, yPos - 2.5, tw, 4.5, 1, 1, 'FD');
      if (linkUrl) {
        doc.setTextColor(0, 100, 200);
      }
      doc.text(label, badgeX + 2, yPos + 0.5);
      if (linkUrl) {
        badgePositions.push({ x: badgeX, y: yPos - 2.5, w: tw, h: 4.5, url: linkUrl });
        doc.setTextColor(0, 0, 0);
      }
      badgeX += tw + 3;
    };

    if (invoice.creditCardEnabled) drawBadge('Visa / Mastercard / Amex', invoice.ccPaymentUrl || undefined);
    if (invoice.achEnabled) drawBadge('ACH / EFT Bank Transfer');
    if (invoice.interacEnabled) drawBadge('Interac e-Transfer', invoice.etransferEmail ? `mailto:${invoice.etransferEmail}` : undefined);
    if (hasWise) drawBadge(`Wise Bank Transfer (${invoice.wiseAccount!.currency})`);
    yPos += 6;

    // Add clickable link overlays for badges
    badgePositions.forEach(bp => {
      doc.link(bp.x, bp.y, bp.w, bp.h, { url: bp.url });
    });

    // Details
    doc.setFontSize(6);
    doc.setTextColor(80, 80, 80);

    if (invoice.creditCardEnabled) {
      if (invoice.ccPaymentUrl) {
        // Render clickable payment URL
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 100, 200);
        const urlText = `Pay online: ${invoice.ccPaymentUrl}`;
        doc.text(urlText, margin, yPos);
        const urlWidth = doc.getTextWidth(urlText);
        // Underline
        doc.setDrawColor(0, 100, 200);
        doc.setLineWidth(0.15);
        doc.line(margin, yPos + 0.5, margin + urlWidth, yPos + 0.5);
        // Clickable area
        doc.link(margin, yPos - 2, urlWidth, 4, { url: invoice.ccPaymentUrl });
        doc.setTextColor(80, 80, 80);
        yPos += 3.5;
      } else if (invoice.ccInstructions) {
        doc.setFont('helvetica', 'italic');
        const ccLines = doc.splitTextToSize(invoice.ccInstructions, contentWidth);
        doc.text(ccLines.slice(0, 2), margin, yPos);
        yPos += Math.min(ccLines.length, 2) * 3 + 1;
      }
    }

    if (invoice.achEnabled) {
      doc.setFont('helvetica', 'normal');
      const achParts: string[] = [];
      if (invoice.achInstitution) achParts.push(`Institution: ${invoice.achInstitution}`);
      if (invoice.achAccountName) achParts.push(`Account: ${invoice.achAccountName}`);
      if (invoice.achTransitNumber) achParts.push(`Transit: ${invoice.achTransitNumber}`);
      if (invoice.achAccountNumber) achParts.push(`Acct #: ${invoice.achAccountNumber}`);
      if (achParts.length > 0) {
        doc.text(achParts.join('   |   '), margin, yPos);
        yPos += 3.5;
      }
    }

    if (invoice.interacEnabled && invoice.etransferEmail) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 100, 200);
      const emailText = `Interac e-Transfer to: ${invoice.etransferEmail}`;
      doc.text(emailText, margin, yPos);
      const emailWidth = doc.getTextWidth(emailText);
      doc.setDrawColor(0, 100, 200);
      doc.setLineWidth(0.15);
      doc.line(margin, yPos + 0.5, margin + emailWidth, yPos + 0.5);
      doc.link(margin, yPos - 2, emailWidth, 4, { url: `mailto:${invoice.etransferEmail}` });
      doc.setTextColor(80, 80, 80);
      yPos += 3.5;
    }

    if (hasWise) {
      const w = invoice.wiseAccount!;
      doc.setFont('helvetica', 'bold');
      doc.text(`Wise bank transfer (${w.currency})`, margin, yPos);
      yPos += 3.5;
      doc.setFont('helvetica', 'normal');
      const wiseParts: string[] = [];
      if (w.account_holder_name) wiseParts.push(`Beneficiary: ${w.account_holder_name}`);
      if (w.bank_name) wiseParts.push(`Bank: ${w.bank_name}`);
      if (w.account_number) wiseParts.push(`Acct #: ${w.account_number}`);
      if (w.routing_number) wiseParts.push(`Routing: ${w.routing_number}`);
      if (w.sort_code) wiseParts.push(`Sort code: ${w.sort_code}`);
      if (w.iban) wiseParts.push(`IBAN: ${w.iban}`);
      if (w.bic_swift) wiseParts.push(`BIC/SWIFT: ${w.bic_swift}`);
      if (w.institution_address) wiseParts.push(`Bank address: ${w.institution_address}`);
      if (wiseParts.length > 0) {
        const wiseLines = doc.splitTextToSize(wiseParts.join('   |   '), contentWidth);
        doc.text(wiseLines.slice(0, 4), margin, yPos);
        yPos += Math.min(wiseLines.length, 4) * 3 + 1;
      }
      if (invoice.wiseReference) {
        doc.setFont('helvetica', 'bold');
        doc.text(`Transfer reference: ${invoice.wiseReference}`, margin, yPos);
        yPos += 3.5;
        doc.setFont('helvetica', 'italic');
        doc.text('Include this reference exactly so your payment is matched automatically.', margin, yPos);
        yPos += 3.5;
        doc.setFont('helvetica', 'normal');
      }
    }

    doc.setTextColor(0, 0, 0);
    yPos += 2;
  }

  // ==================== SIGNATURE SECTION (Compact, side by side) ====================
  const showSellerSig = invoice.showSellerSignature ?? false;
  const showBuyerSig = invoice.showBuyerSignature ?? false;
  
  if (showSellerSig || showBuyerSig) {
    const signatureBoxWidth = (contentWidth - 15) / 2;
    const signatureBoxHeight = 22;
    
    // Ensure signatures fit on the page
    const signatureY = Math.max(yPos + 5, pageHeight - 60);
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');

    if (showSellerSig) {
      doc.text('Authorized Signature', margin, signatureY);
      doc.setDrawColor(200, 200, 200);
      doc.rect(margin, signatureY + 2, signatureBoxWidth, signatureBoxHeight);
      
      if (invoice.sellerSignatureData) {
        try {
          doc.addImage(invoice.sellerSignatureData, 'PNG', margin + 3, signatureY + 4, signatureBoxWidth - 6, signatureBoxHeight - 8);
        } catch (e) {
          console.warn('Failed to add seller signature:', e);
        }
      }
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      if (invoice.sellerSignatureName || invoice.organizationName) {
        doc.text(invoice.sellerSignatureName || invoice.organizationName || '', margin, signatureY + signatureBoxHeight + 5);
      }
      doc.setTextColor(100, 100, 100);
      doc.text('Seller', margin, signatureY + signatureBoxHeight + 8);
      doc.setTextColor(0, 0, 0);
    }

    if (showBuyerSig) {
      const buyerX = margin + signatureBoxWidth + 15;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('Buyer Signature', buyerX, signatureY);
      doc.rect(buyerX, signatureY + 2, signatureBoxWidth, signatureBoxHeight);
      
      if (invoice.buyerSignatureData) {
        try {
          doc.addImage(invoice.buyerSignatureData, 'PNG', buyerX + 3, signatureY + 4, signatureBoxWidth - 6, signatureBoxHeight - 8);
        } catch (e) {
          console.warn('Failed to add buyer signature:', e);
        }
      }
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      if (invoice.buyerName || invoice.customerName) {
        doc.text(invoice.buyerName || invoice.customerName, buyerX, signatureY + signatureBoxHeight + 5);
      }
      doc.setTextColor(100, 100, 100);
      const buyerLabel = invoice.buyerSignatureDate ? `Buyer | ${invoice.buyerSignatureDate}` : 'Buyer';
      doc.text(buyerLabel, buyerX, signatureY + signatureBoxHeight + 8);
      doc.setTextColor(0, 0, 0);
    }
    
    yPos = Math.max(yPos + 25, (Math.max(yPos + 5, pageHeight - 60)) + 30);
  }

  // ==================== BARCODE SECTION ====================
  const barcodeY = yPos + 5;
  
  if (barcodeY + 20 < pageHeight - 20) {
    const barcodeWidth = 60;
    const barcodeX = (pageWidth - barcodeWidth) / 2;
    const barHeight = 12;
    
    const invoiceStr = invoice.invoiceNumber;
    let barX = barcodeX;
    
    doc.setFillColor(0, 0, 0);
    for (let i = 0; i < invoiceStr.length; i++) {
      const charCode = invoiceStr.charCodeAt(i);
      const wide = (charCode % 3) + 1;
      const narrow = 1;
      
      doc.rect(barX, barcodeY, wide * 0.4, barHeight, 'F');
      barX += wide * 0.4 + narrow * 0.4;
      
      doc.rect(barX, barcodeY, narrow * 0.4, barHeight, 'F');
      barX += narrow * 0.4 + 0.8;
      
      if (barX > barcodeX + barcodeWidth - 4) break;
    }
    
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(invoice.invoiceNumber, pageWidth / 2, barcodeY + barHeight + 3, { align: 'center' });
  }

  // ==================== FOOTER ====================
  const footerY = pageHeight - 12;
  
  // Custom footer / footnote
  if (invoice.footer) {
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const splitFooter = doc.splitTextToSize(invoice.footer, contentWidth);
    const footerLines = splitFooter.slice(0, 3);
    const footerStartY = footerY - 3 - (footerLines.length * 3);
    footerLines.forEach((line: string, idx: number) => {
      doc.text(line, pageWidth / 2, footerStartY + idx * 3, { align: 'center' });
    });
    doc.setTextColor(0, 0, 0);
  }
  
  // Branding footer
  doc.setFontSize(6);
  doc.setTextColor(150, 150, 150);
  doc.text('Powered by eFinsuite Globe', pageWidth / 2, footerY, { align: 'center' });
}

/**
 * Extract image dimensions from a base64 data URL for aspect ratio calculation
 */
function getImageDimensions(dataUrl: string): { width: number; height: number } {
  // Default fallback dimensions (2:1 aspect ratio)
  const defaultDims = { width: 200, height: 100 };
  
  try {
    // Check for PNG dimensions in binary header
    if (dataUrl.includes('image/png')) {
      const base64 = dataUrl.split(',')[1];
      if (base64) {
        const binary = atob(base64);
        if (binary.length > 24) {
          const width = (binary.charCodeAt(16) << 24) | (binary.charCodeAt(17) << 16) | (binary.charCodeAt(18) << 8) | binary.charCodeAt(19);
          const height = (binary.charCodeAt(20) << 24) | (binary.charCodeAt(21) << 16) | (binary.charCodeAt(22) << 8) | binary.charCodeAt(23);
          if (width > 0 && height > 0 && width < 10000 && height < 10000) {
            return { width, height };
          }
        }
      }
    }
    
    // Check for JPEG dimensions (SOF0 marker)
    if (dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg')) {
      const base64 = dataUrl.split(',')[1];
      if (base64) {
        const binary = atob(base64);
        for (let i = 0; i < binary.length - 8; i++) {
          if (binary.charCodeAt(i) === 0xFF && binary.charCodeAt(i + 1) === 0xC0) {
            const height = (binary.charCodeAt(i + 5) << 8) | binary.charCodeAt(i + 6);
            const width = (binary.charCodeAt(i + 7) << 8) | binary.charCodeAt(i + 8);
            if (width > 0 && height > 0) return { width, height };
          }
        }
      }
    }
  } catch {
    // Fallback silently
  }
  
  return defaultDims;
}

/**
 * Helper to load an image from URL as base64
 * Uses fetch first, then falls back to Image+Canvas for CORS-protected URLs
 */
async function loadImageAsBase64(url: string): Promise<string | null> {
  if (!url) return null;
  
  // Try fetch first
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (response.ok) {
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  } catch {
    // fetch failed (CORS), try Image+Canvas fallback
  }

  // Fallback: load via Image element + Canvas (handles most CORS scenarios)
  try {
    return await new Promise<string | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      // Add cache-busting to avoid stale CORS preflight
      img.src = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
    });
  } catch {
    console.error('Failed to load image via all methods:', url);
    return null;
  }
}
