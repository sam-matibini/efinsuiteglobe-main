import jsPDF from 'jspdf';

// ============================================================================
// ENHANCED BANK RECONCILIATION REPORT - AUDIT-READY
// Compliant with IFRS/ASPE, Canadian CPA/CA audit expectations
// ============================================================================

export interface ReconciliationReportLine {
  date: string;
  description: string;
  reference?: string | null;
  amount: number; // signed: +deposit, -payment
  isCleared: boolean;
  source?: string;
  journalEntryId?: string | null;
  aging?: number; // days outstanding
  category?: string; // e.g., 'deposit_in_transit', 'outstanding_cheque', etc.
}

export interface AdjustingEntry {
  journalNumber: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  approvalStatus: 'pending' | 'approved' | 'posted';
}

export interface ReconciliationReportData {
  // Header Information
  organizationName?: string;
  bankAccountName: string;
  bankAccountNumberLast4?: string;
  bankInstitution?: string;
  
  // Statement Period
  statementDate: string;
  periodStart?: string;
  periodEnd?: string;
  
  // Balances
  openingBalance: number;
  statementEndingBalance: number;
  glEndingBalance?: number;
  bookBalance?: number;

  // Cleared Totals
  clearedDeposits: number;
  clearedPayments: number;
  clearedBalance: number;
  difference: number;

  // Outstanding Items (Bank-Side)
  depositsInTransit?: number;
  bankErrors?: number;
  pendingCredits?: number;

  // Outstanding Items (Book-Side)
  outstandingCheques?: number;
  unrecordedCharges?: number;
  nsfItems?: number;

  // Adjustments
  adjustingEntries?: AdjustingEntry[];

  // Transaction Lines
  lines: ReconciliationReportLine[];

  // Audit Metadata
  reconciliationId?: string;
  preparedBy?: string;
  reviewedBy?: string;
  approvedBy?: string;
  preparedDate?: string;
  reviewedDate?: string;
  approvedDate?: string;
  status?: 'draft' | 'in_progress' | 'completed' | 'approved';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value);

const formatShortDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const formatFullDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const generateChecksum = (data: ReconciliationReportData): string => {
  const checkString = `${data.bankAccountName}|${data.statementDate}|${data.statementEndingBalance}|${data.clearedBalance}|${data.lines.length}`;
  let hash = 0;
  for (let i = 0; i < checkString.length; i++) {
    const char = checkString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
};

const calculateAging = (transactionDate: string, statementDate: string): number => {
  const txDate = new Date(transactionDate);
  const stmtDate = new Date(statementDate);
  const diffTime = stmtDate.getTime() - txDate.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
};

// ============================================================================
// MAIN PDF GENERATOR
// ============================================================================

export function downloadReconciliationPdf(data: ReconciliationReportData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;
  let pageNumber = 1;
  const checksum = generateChecksum(data);
  const generatedAt = new Date().toLocaleString('en-CA');

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const addPageFooter = () => {
    // Branding footer
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    doc.text('Powered By:', pageWidth / 2, pageHeight - 22, { align: 'center' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text('eFinsuite Globe', pageWidth / 2, pageHeight - 18, { align: 'center' });
    
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('For more information or clarification email: info@efintax.biz', pageWidth / 2, pageHeight - 14, { align: 'center' });
    
    // System watermark line
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    
    // Page number
    doc.text(`Page ${pageNumber}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    
    // Checksum and watermark
    doc.text(`Checksum: ${checksum}`, margin, pageHeight - 8);
    doc.text('eFinsuite Globe - Audit Report', pageWidth - margin, pageHeight - 8, { align: 'right' });
    
    doc.setTextColor(0, 0, 0);
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 20) {
      addPageFooter();
      doc.addPage();
      pageNumber++;
      y = margin;
    }
  };

  const drawSectionHeader = (title: string) => {
    ensureSpace(14);
    doc.setFillColor(30, 58, 95); // Professional dark blue
    doc.rect(margin, y - 4, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(title, margin + 4, y + 1);
    doc.setTextColor(0, 0, 0);
    y += 10;
  };

  const drawSubHeader = (title: string) => {
    ensureSpace(10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 58, 95);
    doc.text(title, margin, y);
    doc.setTextColor(0, 0, 0);
    y += 6;
  };

  const drawLabelValue = (label: string, value: string, labelX: number, valueX: number, rightAlign = true) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(label, labelX, y);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(value, valueX, y, rightAlign ? { align: 'right' } : undefined);
  };

  const drawLine = () => {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 2;
  };

  const drawDoubleLine = () => {
    doc.setDrawColor(30, 58, 95);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 1;
    doc.line(margin, y, pageWidth - margin, y);
    doc.setLineWidth(0.2);
    y += 2;
  };

  // ============================================================================
  // REPORT HEADER
  // ============================================================================

  // Title Banner
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, pageWidth, 28, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('BANK RECONCILIATION REPORT', margin, 14);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Audit-Ready • IFRS/ASPE Compliant', margin, 22);
  
  // Reconciliation ID
  if (data.reconciliationId) {
    doc.text(`Rec ID: ${data.reconciliationId.slice(0, 8).toUpperCase()}`, pageWidth - margin, 14, { align: 'right' });
  }
  doc.text(`Generated: ${generatedAt}`, pageWidth - margin, 22, { align: 'right' });
  
  doc.setTextColor(0, 0, 0);
  y = 36;

  // ============================================================================
  // ORGANIZATION & ACCOUNT INFORMATION
  // ============================================================================

  drawSectionHeader('1. ACCOUNT INFORMATION');
  
  const col1X = margin;
  const col2X = margin + 90;
  const valueWidth = 75;

  // Organization
  if (data.organizationName) {
    drawLabelValue('Organization:', data.organizationName, col1X, col1X + valueWidth, false);
    y += 5;
  }

  // Bank Account Details
  const acctSuffix = data.bankAccountNumberLast4 ? ` (****${data.bankAccountNumberLast4})` : '';
  drawLabelValue('Bank Account:', `${data.bankAccountName}${acctSuffix}`, col1X, col1X + valueWidth, false);
  
  if (data.bankInstitution) {
    drawLabelValue('Institution:', data.bankInstitution, col2X, col2X + valueWidth, false);
  }
  y += 5;

  // Statement Period
  const periodStr = data.periodStart && data.periodEnd 
    ? `${formatShortDate(data.periodStart)} to ${formatShortDate(data.periodEnd)}`
    : formatFullDate(data.statementDate);
  drawLabelValue('Statement Period:', periodStr, col1X, col1X + valueWidth, false);
  
  // Status Badge
  if (data.status) {
    const statusLabels: Record<string, string> = {
      draft: 'DRAFT',
      in_progress: 'IN PROGRESS',
      completed: 'COMPLETED',
      approved: 'APPROVED'
    };
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    const statusColor = data.status === 'approved' || data.status === 'completed' ? [34, 139, 34] : [200, 150, 50];
    doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.text(`Status: ${statusLabels[data.status] || data.status.toUpperCase()}`, col2X, y);
    doc.setTextColor(0, 0, 0);
  }
  y += 8;

  // Audit Trail - Prepared/Reviewed/Approved
  if (data.preparedBy || data.reviewedBy || data.approvedBy) {
    drawLine();
    y += 2;
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    
    if (data.preparedBy) {
      doc.text(`Prepared by: ${data.preparedBy}${data.preparedDate ? ` on ${formatShortDate(data.preparedDate)}` : ''}`, col1X, y);
    }
    if (data.reviewedBy) {
      doc.text(`Reviewed by: ${data.reviewedBy}${data.reviewedDate ? ` on ${formatShortDate(data.reviewedDate)}` : ''}`, col2X, y);
    }
    y += 4;
    if (data.approvedBy) {
      doc.text(`Approved by: ${data.approvedBy}${data.approvedDate ? ` on ${formatShortDate(data.approvedDate)}` : ''}`, col1X, y);
    }
    doc.setTextColor(0, 0, 0);
    y += 6;
  }

  // ============================================================================
  // RECONCILIATION SUMMARY
  // ============================================================================

  y += 4;
  drawSectionHeader('2. RECONCILIATION SUMMARY');

  const leftColX = margin + 4;
  const rightColX = margin + 100;
  const amountX = margin + 85;
  const amountX2 = pageWidth - margin - 5;

  // Bank Statement Side
  drawSubHeader('Bank Statement Balance');
  
  ensureSpace(35);
  drawLabelValue('Statement Ending Balance:', formatCurrency(data.statementEndingBalance), leftColX, amountX);
  y += 5;
  
  if (data.depositsInTransit) {
    drawLabelValue('(+) Deposits in Transit:', formatCurrency(data.depositsInTransit), leftColX, amountX);
    y += 5;
  }
  
  if (data.outstandingCheques) {
    drawLabelValue('(-) Outstanding Cheques:', formatCurrency(-data.outstandingCheques), leftColX, amountX);
    y += 5;
  }

  if (data.bankErrors) {
    drawLabelValue('(±) Bank Errors/Adjustments:', formatCurrency(data.bankErrors), leftColX, amountX);
    y += 5;
  }

  // Calculate adjusted bank balance
  const adjustedBankBalance = data.statementEndingBalance 
    + (data.depositsInTransit || 0) 
    - (data.outstandingCheques || 0)
    + (data.bankErrors || 0);

  drawLine();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  drawLabelValue('Adjusted Bank Balance:', formatCurrency(adjustedBankBalance), leftColX, amountX);
  y += 8;

  // Book/GL Side
  drawSubHeader('General Ledger Balance');
  
  const glBalance = data.glEndingBalance ?? data.bookBalance ?? (data.openingBalance + data.clearedDeposits - data.clearedPayments);
  drawLabelValue('GL Ending Balance:', formatCurrency(glBalance), leftColX, amountX);
  y += 5;

  if (data.unrecordedCharges) {
    drawLabelValue('(-) Unrecorded Charges:', formatCurrency(-data.unrecordedCharges), leftColX, amountX);
    y += 5;
  }

  if (data.nsfItems) {
    drawLabelValue('(-) NSF Items:', formatCurrency(-data.nsfItems), leftColX, amountX);
    y += 5;
  }

  // Calculate adjusted book balance
  const adjustedGLBalance = glBalance 
    - (data.unrecordedCharges || 0) 
    - (data.nsfItems || 0);

  drawLine();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  drawLabelValue('Adjusted GL Balance:', formatCurrency(adjustedGLBalance), leftColX, amountX);
  y += 8;

  // Reconciliation Result Box
  ensureSpace(25);
  const resultBoxY = y;
  const isReconciled = Math.abs(data.difference) < 0.01;
  
  doc.setFillColor(isReconciled ? 240 : 255, isReconciled ? 255 : 240, isReconciled ? 240 : 240);
  doc.setDrawColor(isReconciled ? 34 : 200, isReconciled ? 139 : 50, isReconciled ? 34 : 50);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, resultBoxY, contentWidth, 18, 2, 2, 'FD');
  doc.setLineWidth(0.2);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(isReconciled ? 34 : 180, isReconciled ? 139 : 50, isReconciled ? 34 : 50);
  
  const resultText = isReconciled 
    ? '✓ RECONCILED - Adjusted Bank Balance = Adjusted GL Balance'
    : `✗ UNRECONCILED - Difference: ${formatCurrency(data.difference)}`;
  doc.text(resultText, pageWidth / 2, resultBoxY + 11, { align: 'center' });
  
  doc.setTextColor(0, 0, 0);
  y = resultBoxY + 25;

  // ============================================================================
  // CLEARED TRANSACTIONS SUMMARY
  // ============================================================================

  drawSectionHeader('3. CLEARED TRANSACTIONS SUMMARY');
  
  ensureSpace(25);
  drawLabelValue('Opening Balance:', formatCurrency(data.openingBalance), leftColX, amountX);
  y += 5;
  drawLabelValue('(+) Cleared Deposits:', formatCurrency(data.clearedDeposits), leftColX, amountX);
  y += 5;
  drawLabelValue('(-) Cleared Payments:', formatCurrency(data.clearedPayments), leftColX, amountX);
  y += 5;
  drawLine();
  doc.setFont('helvetica', 'bold');
  drawLabelValue('Cleared Balance:', formatCurrency(data.clearedBalance), leftColX, amountX);
  y += 8;

  // ============================================================================
  // SECTION A: RECONCILED TRANSACTIONS
  // ============================================================================

  const clearedTransactions = data.lines.filter(l => l.isCleared);
  
  if (clearedTransactions.length > 0) {
    drawSectionHeader('A. RECONCILED TRANSACTIONS');
    
    // Table header
    ensureSpace(12);
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y - 3, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    
    const tColDate = margin + 2;
    const tColRef = margin + 25;
    const tColDesc = margin + 50;
    const tColDep = margin + 130;
    const tColPay = pageWidth - margin - 2;
    
    doc.text('Date', tColDate, y);
    doc.text('Reference', tColRef, y);
    doc.text('Description', tColDesc, y);
    doc.text('Deposits', tColDep, y, { align: 'right' });
    doc.text('Payments', tColPay, y, { align: 'right' });
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);

    let rowCount = 0;
    for (const line of clearedTransactions) {
      ensureSpace(5);
      
      // Alternating row colors
      if (rowCount % 2 === 0) {
        doc.setFillColor(252, 252, 252);
        doc.rect(margin, y - 3, contentWidth, 5, 'F');
      }
      
      const date = formatShortDate(line.date);
      const ref = (line.reference || '').slice(0, 15);
      const desc = (line.description || '').slice(0, 45);
      const isDeposit = line.amount > 0;
      
      doc.text(date, tColDate, y);
      doc.text(ref, tColRef, y);
      doc.text(desc, tColDesc, y);
      doc.text(isDeposit ? formatCurrency(line.amount) : '', tColDep, y, { align: 'right' });
      doc.text(!isDeposit ? formatCurrency(Math.abs(line.amount)) : '', tColPay, y, { align: 'right' });
      
      y += 4;
      rowCount++;
    }
    
    // Subtotal
    drawLine();
    doc.setFont('helvetica', 'bold');
    const totalDep = clearedTransactions.filter(l => l.amount > 0).reduce((s, l) => s + l.amount, 0);
    const totalPay = clearedTransactions.filter(l => l.amount < 0).reduce((s, l) => s + Math.abs(l.amount), 0);
    doc.text('Subtotal:', tColDesc, y);
    doc.text(formatCurrency(totalDep), tColDep, y, { align: 'right' });
    doc.text(formatCurrency(totalPay), tColPay, y, { align: 'right' });
    y += 8;
  }

  // ============================================================================
  // SECTION B: OUTSTANDING BANK ITEMS (Deposits in Transit)
  // ============================================================================

  const depositsInTransit = data.lines.filter(l => !l.isCleared && l.amount > 0);
  
  if (depositsInTransit.length > 0) {
    drawSectionHeader('B. OUTSTANDING BANK ITEMS - Deposits in Transit');
    
    ensureSpace(12);
    doc.setFillColor(255, 250, 240);
    doc.rect(margin, y - 3, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    
    const tColDate = margin + 2;
    const tColRef = margin + 25;
    const tColDesc = margin + 55;
    const tColAging = margin + 120;
    const tColAmt = pageWidth - margin - 2;
    
    doc.text('Date', tColDate, y);
    doc.text('Reference', tColRef, y);
    doc.text('Description', tColDesc, y);
    doc.text('Days Out', tColAging, y, { align: 'right' });
    doc.text('Amount', tColAmt, y, { align: 'right' });
    y += 6;

    doc.setFont('helvetica', 'normal');
    
    let total = 0;
    for (const line of depositsInTransit) {
      ensureSpace(5);
      
      const aging = line.aging ?? calculateAging(line.date, data.statementDate);
      const agingColor = aging > 30 ? [200, 50, 50] : aging > 14 ? [200, 150, 50] : [80, 80, 80];
      
      doc.setTextColor(0, 0, 0);
      doc.text(formatShortDate(line.date), tColDate, y);
      doc.text((line.reference || '').slice(0, 18), tColRef, y);
      doc.text((line.description || '').slice(0, 40), tColDesc, y);
      
      doc.setTextColor(agingColor[0], agingColor[1], agingColor[2]);
      doc.text(aging.toString(), tColAging, y, { align: 'right' });
      
      doc.setTextColor(0, 0, 0);
      doc.text(formatCurrency(line.amount), tColAmt, y, { align: 'right' });
      
      total += line.amount;
      y += 4;
    }
    
    drawLine();
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Deposits in Transit (${depositsInTransit.length} items):`, tColDesc, y);
    doc.text(formatCurrency(total), tColAmt, y, { align: 'right' });
    y += 8;
  }

  // ============================================================================
  // SECTION C: OUTSTANDING BOOK ITEMS (Outstanding Cheques/Payments)
  // ============================================================================

  const outstandingPayments = data.lines.filter(l => !l.isCleared && l.amount < 0);
  
  if (outstandingPayments.length > 0) {
    drawSectionHeader('C. OUTSTANDING BOOK ITEMS - Outstanding Cheques');
    
    ensureSpace(12);
    doc.setFillColor(255, 245, 245);
    doc.rect(margin, y - 3, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    
    const tColDate = margin + 2;
    const tColRef = margin + 25;
    const tColDesc = margin + 55;
    const tColAging = margin + 120;
    const tColAmt = pageWidth - margin - 2;
    
    doc.text('Date', tColDate, y);
    doc.text('Cheque/Ref', tColRef, y);
    doc.text('Description / Payee', tColDesc, y);
    doc.text('Days Out', tColAging, y, { align: 'right' });
    doc.text('Amount', tColAmt, y, { align: 'right' });
    y += 6;

    doc.setFont('helvetica', 'normal');
    
    let total = 0;
    for (const line of outstandingPayments) {
      ensureSpace(5);
      
      const aging = line.aging ?? calculateAging(line.date, data.statementDate);
      const agingColor = aging > 90 ? [200, 50, 50] : aging > 30 ? [200, 150, 50] : [80, 80, 80];
      
      doc.setTextColor(0, 0, 0);
      doc.text(formatShortDate(line.date), tColDate, y);
      doc.text((line.reference || '').slice(0, 18), tColRef, y);
      doc.text((line.description || '').slice(0, 40), tColDesc, y);
      
      doc.setTextColor(agingColor[0], agingColor[1], agingColor[2]);
      doc.text(aging.toString(), tColAging, y, { align: 'right' });
      
      doc.setTextColor(0, 0, 0);
      doc.text(formatCurrency(Math.abs(line.amount)), tColAmt, y, { align: 'right' });
      
      total += Math.abs(line.amount);
      y += 4;
    }
    
    drawLine();
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Outstanding Cheques (${outstandingPayments.length} items):`, tColDesc, y);
    doc.text(formatCurrency(total), tColAmt, y, { align: 'right' });
    y += 8;
  }

  // ============================================================================
  // SECTION D: ADJUSTING ENTRIES (if any)
  // ============================================================================

  if (data.adjustingEntries && data.adjustingEntries.length > 0) {
    drawSectionHeader('D. ADJUSTING ENTRIES');
    
    ensureSpace(12);
    doc.setFillColor(245, 250, 255);
    doc.rect(margin, y - 3, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    
    const tColJE = margin + 2;
    const tColDate = margin + 30;
    const tColDesc = margin + 55;
    const tColDr = margin + 125;
    const tColCr = margin + 150;
    const tColStatus = pageWidth - margin - 2;
    
    doc.text('Journal #', tColJE, y);
    doc.text('Date', tColDate, y);
    doc.text('Description', tColDesc, y);
    doc.text('Debit', tColDr, y, { align: 'right' });
    doc.text('Credit', tColCr, y, { align: 'right' });
    doc.text('Status', tColStatus, y, { align: 'right' });
    y += 6;

    doc.setFont('helvetica', 'normal');
    
    for (const entry of data.adjustingEntries) {
      ensureSpace(5);
      
      doc.text(entry.journalNumber.slice(0, 15), tColJE, y);
      doc.text(formatShortDate(entry.date), tColDate, y);
      doc.text(entry.description.slice(0, 40), tColDesc, y);
      doc.text(entry.debit > 0 ? formatCurrency(entry.debit) : '', tColDr, y, { align: 'right' });
      doc.text(entry.credit > 0 ? formatCurrency(entry.credit) : '', tColCr, y, { align: 'right' });
      
      // Status badge
      const statusColor = entry.approvalStatus === 'approved' ? [34, 139, 34] : 
                          entry.approvalStatus === 'posted' ? [30, 58, 95] : [200, 150, 50];
      doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.text(entry.approvalStatus.toUpperCase(), tColStatus, y, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      
      y += 4;
    }
    y += 6;
  }

  // ============================================================================
  // AUDIT CONTROL SECTION
  // ============================================================================

  ensureSpace(30);
  drawSectionHeader('AUDIT CONTROL INFORMATION');
  
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  
  const auditInfo = [
    ['Report Generated:', generatedAt],
    ['Document Checksum:', checksum],
    ['Total Transactions:', data.lines.length.toString()],
    ['Cleared Transactions:', clearedTransactions.length.toString()],
    ['Outstanding Items:', (depositsInTransit.length + outstandingPayments.length).toString()],
  ];
  
  for (const [label, value] of auditInfo) {
    doc.text(`${label} ${value}`, margin + 4, y);
    y += 4;
  }
  
  y += 4;
  doc.setFontSize(6);
  doc.text('This report is system-generated and constitutes an official reconciliation record.', margin + 4, y);
  y += 3;
  doc.text('Historical reconciliations are immutable. Adjustments require reversing entries.', margin + 4, y);
  y += 3;
  doc.text('For audit inquiries, reference the Reconciliation ID and Document Checksum.', margin + 4, y);
  
  doc.setTextColor(0, 0, 0);

  // ============================================================================
  // ADD FINAL PAGE FOOTER
  // ============================================================================

  addPageFooter();

  // ============================================================================
  // SAVE PDF
  // ============================================================================

  const safeDate = data.statementDate.replace(/\//g, '-');
  const safeName = data.bankAccountName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
  doc.save(`Bank_Reconciliation_${safeName}_${safeDate}.pdf`);
}
