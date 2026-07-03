import jsPDF from 'jspdf';
import { format, parseISO } from 'date-fns';
import { aspeNoteTemplates, getFrameworkNoteTemplates, CompilationReport, resolveNoteTemplate, NoteTemplateContext } from '@/hooks/useCompilationReports';

interface FinancialData {
  balanceSheet: {
    assets: Array<{ name: string; calculated_balance: number }>;
    liabilities: Array<{ name: string; calculated_balance: number }>;
    equity: Array<{ name: string; calculated_balance: number }>;
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    netIncome: number;
  };
  incomeStatement: {
    income: Array<{ name: string; calculated_balance: number }>;
    cogs: Array<{ name: string; calculated_balance: number }>;
    expenses: Array<{ name: string; calculated_balance: number }>;
    otherIncome: Array<{ name: string; calculated_balance: number }>;
    otherExpenses: Array<{ name: string; calculated_balance: number }>;
    totalRevenue: number;
    totalCogs: number;
    grossProfit: number;
    totalExpenses: number;
    operatingIncome: number;
    netIncome: number;
  };
  organizationName: string;
  retainedEarningsOpening?: number;
}

const formatCurrency = (amount: number): string => {
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString('en-CA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return amount < 0 ? `(${formatted})` : formatted;
};

const formatCurrencyWithSign = (amount: number): string => {
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString('en-CA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return amount < 0 ? `$(${formatted})` : `$${formatted}`;
};

export function generateCompilationPDF(
  compilation: CompilationReport,
  financialData: FinancialData,
  orgContext: NoteTemplateContext = {}
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  const fiscalYear = compilation.fiscal_year;
  const noteTemplateIds = compilation.selected_note_templates || [];
  const orgName = financialData.organizationName || 'Organization Name';
  const periodType = compilation.reporting_period_type || 'annual';
  const isInterim = periodType === 'interim' || periodType === 'quarterly';
  const accountingFramework = (compilation as any).accounting_framework || 'ASPE';
  const isASNPO = accountingFramework === 'ASNPO';
  
  // ASNPO terminology
  const t = {
    shareholdersEquity: isASNPO ? 'NET ASSETS' : "SHAREHOLDERS' EQUITY",
    totalEquity: isASNPO ? "Total Net Assets" : "Total Shareholders' Equity",
    totalLiabAndEquity: isASNPO ? 'Total Liabilities and Net Assets' : 'Total Liabilities and Equity',
    statementOfIncome: isASNPO ? 'STATEMENT OF OPERATIONS' : 'STATEMENT OF INCOME',
    netIncome: isASNPO ? 'EXCESS (DEFICIENCY) OF REVENUE OVER EXPENSES' : 'NET INCOME (LOSS)',
    currentYearEarnings: isASNPO ? 'Excess (Deficiency) of Revenue over Expenses' : 'Current Year Earnings',
    incomeFromOps: isASNPO ? 'EXCESS (DEFICIENCY) BEFORE OTHER ITEMS' : 'INCOME FROM OPERATIONS',
    statementOfRE: isASNPO ? 'STATEMENT OF CHANGES IN NET ASSETS' : 'STATEMENT OF RETAINED EARNINGS',
    reBeginning: isASNPO ? 'Net assets, beginning of period' : 'Retained earnings, beginning of period',
    netIncomeForPeriod: isASNPO ? 'Excess (deficiency) of revenue over expenses' : 'Net income (loss) for the period',
    dividends: isASNPO ? null : 'Dividends declared',
    reEnd: isASNPO ? 'Net assets, end of period' : 'Retained earnings, end of period',
    balanceSheet: isASNPO ? 'STATEMENT OF FINANCIAL POSITION' : 'BALANCE SHEET',
  };
  
  // Page counter
  let pageNum = 1;
  
  const addPageFooter = () => {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(128);
    doc.text(`Page ${pageNum}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.text('See accompanying notes to financial statements', pageWidth / 2, pageHeight - 15, { align: 'center' });
    doc.setTextColor(0);
    pageNum++;
  };

  const addNewPage = () => {
    addPageFooter();
    doc.addPage();
  };

  // Helper for date formatting
  const formatPeriodDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'MMMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const periodEndFormatted = formatPeriodDate(compilation.fiscal_year_end);
  const periodEndShort = isInterim ? 
    `${periodType === 'interim' ? 'Nine Months' : 'Quarter'} Ended ${periodEndFormatted}` :
    `Year Ended ${periodEndFormatted}`;

  // ===== PAGE 1: Title Page =====
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(orgName.toUpperCase(), pageWidth / 2, 60, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(isInterim ? 'Interim Financial Statements' : 'Financial Statements', pageWidth / 2, 75, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text(`(Unaudited - See Compilation Engagement Report)`, pageWidth / 2, 85, { align: 'center' });
  
  doc.setFontSize(11);
  doc.text(periodEndFormatted, pageWidth / 2, 100, { align: 'center' });
  
  // Prepared by info at bottom
  if (compilation.prepared_by || compilation.firm_name) {
    let yPos = pageHeight - 60;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Prepared by:', pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
    
    if (compilation.firm_name) {
      doc.setFont('helvetica', 'bold');
      doc.text(compilation.firm_name, pageWidth / 2, yPos, { align: 'center' });
      yPos += 6;
    }
    
    if (compilation.prepared_by) {
      doc.setFont('helvetica', 'normal');
      doc.text(compilation.prepared_by, pageWidth / 2, yPos, { align: 'center' });
      yPos += 6;
    }
    
    if (compilation.firm_address) {
      const addressLines = doc.splitTextToSize(compilation.firm_address, contentWidth);
      addressLines.forEach((line: string) => {
        doc.text(line, pageWidth / 2, yPos, { align: 'center' });
        yPos += 5;
      });
    }
  }
  
  addPageFooter();

  // ===== PAGE 2: Compilation Engagement Report (Notice to Reader) =====
  doc.addPage();
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPILATION ENGAGEMENT REPORT', pageWidth / 2, 30, { align: 'center' });
  
  let yPos = 50;
  
  // Addressee
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('To the Director(s) of', margin, yPos);
  yPos += 7;
  doc.setFont('helvetica', 'bold');
  doc.text(orgName, margin, yPos);
  yPos += 15;
  
  // Report body per CSRS 4200
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  const compilationText = `On the basis of information provided by management, we have compiled the ${isInterim ? 'interim ' : ''}${isASNPO ? 'statement of financial position' : 'balance sheet'} of ${orgName} as at ${periodEndFormatted} and the ${isASNPO ? 'statement of operations and statement of changes in net assets' : 'statements of income and retained earnings'}${!isInterim ? ` and ${isASNPO ? 'statement of' : ''} cash flows` : ''} for the ${isInterim ? 'period' : 'year'} then ended.

Management is responsible for these financial statements, including the accuracy and completeness of the underlying information used to compile them and the selection of the accounting policies.

We performed this engagement in accordance with Canadian Standard on Related Services (CSRS) 4200, Compilation Engagements, which requires us to comply with relevant ethical requirements. Our responsibility is to assist management in the preparation and presentation of these financial statements.

We did not perform an audit engagement or a review engagement, nor were we required to perform procedures to verify the accuracy or completeness of the information provided by management. Accordingly, we do not express an audit opinion or a review conclusion on these financial statements.

Readers are cautioned that these statements may not be appropriate for their purposes.`;

  const splitText = doc.splitTextToSize(compilationText, contentWidth);
  doc.text(splitText, margin, yPos);
  yPos += splitText.length * 5 + 20;
  
  // Signature area
  doc.line(margin, yPos, margin + 80, yPos);
  yPos += 5;
  
  if (compilation.firm_name) {
    doc.setFont('helvetica', 'bold');
    doc.text(compilation.firm_name, margin, yPos);
    yPos += 6;
  }
  
  if (compilation.prepared_by) {
    doc.setFont('helvetica', 'normal');
    doc.text(compilation.prepared_by, margin, yPos);
    yPos += 6;
  }
  
  if (compilation.preparer_license_number) {
    doc.text(`License No: ${compilation.preparer_license_number}`, margin, yPos);
    yPos += 6;
  }
  
  // Location and date
  yPos += 10;
  doc.text(compilation.firm_address?.split(',')[0] || 'City', margin, yPos);
  yPos += 6;
  doc.text(compilation.issued_at ? 
    format(parseISO(compilation.issued_at), 'MMMM d, yyyy') : 
    format(new Date(), 'MMMM d, yyyy'), margin, yPos);
  
  addPageFooter();

  // ===== PAGE 3: Balance Sheet =====
  doc.addPage();
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(orgName.toUpperCase(), pageWidth / 2, 20, { align: 'center' });
  doc.setFontSize(11);
  doc.text(t.balanceSheet, pageWidth / 2, 28, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text(`(Unaudited - See Compilation Engagement Report)`, pageWidth / 2, 35, { align: 'center' });
  doc.text(`As at ${periodEndFormatted}`, pageWidth / 2, 42, { align: 'center' });
  
  yPos = 55;
  const colAmount = pageWidth - margin - 10;
  
  // Assets
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('ASSETS', margin, yPos);
  yPos += 8;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  financialData.balanceSheet.assets.forEach(asset => {
    if (yPos > pageHeight - 40) {
      addNewPage();
      yPos = 30;
    }
    doc.text(asset.name, margin + 5, yPos);
    doc.text(`$${formatCurrency(asset.calculated_balance)}`, colAmount, yPos, { align: 'right' });
    yPos += 6;
  });
  
  yPos += 3;
  doc.setFont('helvetica', 'bold');
  doc.line(colAmount - 40, yPos - 3, colAmount, yPos - 3);
  doc.text('Total Assets', margin + 5, yPos);
  doc.text(`$${formatCurrency(financialData.balanceSheet.totalAssets)}`, colAmount, yPos, { align: 'right' });
  doc.line(colAmount - 40, yPos + 1, colAmount, yPos + 1);
  doc.line(colAmount - 40, yPos + 2.5, colAmount, yPos + 2.5);
  
  yPos += 15;
  
  // Liabilities
  doc.text('LIABILITIES', margin, yPos);
  yPos += 8;
  
  doc.setFont('helvetica', 'normal');
  financialData.balanceSheet.liabilities.forEach(liability => {
    if (yPos > pageHeight - 40) {
      addNewPage();
      yPos = 30;
    }
    doc.text(liability.name, margin + 5, yPos);
    doc.text(`$${formatCurrency(liability.calculated_balance)}`, colAmount, yPos, { align: 'right' });
    yPos += 6;
  });
  
  yPos += 3;
  doc.setFont('helvetica', 'bold');
  doc.line(colAmount - 40, yPos - 3, colAmount, yPos - 3);
  doc.text('Total Liabilities', margin + 5, yPos);
  doc.text(`$${formatCurrency(financialData.balanceSheet.totalLiabilities)}`, colAmount, yPos, { align: 'right' });
  
  yPos += 12;
  
  // Shareholders' Equity
  doc.text(t.shareholdersEquity, margin, yPos);
  yPos += 8;
  
  doc.setFont('helvetica', 'normal');
  financialData.balanceSheet.equity.forEach(eq => {
    if (yPos > pageHeight - 40) {
      addNewPage();
      yPos = 30;
    }
    doc.text(eq.name, margin + 5, yPos);
    doc.text(`$${formatCurrency(eq.calculated_balance)}`, colAmount, yPos, { align: 'right' });
    yPos += 6;
  });
  
  // Add current year earnings if not already included
  if (financialData.balanceSheet.netIncome !== 0) {
    doc.text(t.currentYearEarnings, margin + 5, yPos);
    doc.text(`$${formatCurrency(financialData.balanceSheet.netIncome)}`, colAmount, yPos, { align: 'right' });
    yPos += 6;
  }
  
  yPos += 3;
  doc.setFont('helvetica', 'bold');
  doc.line(colAmount - 40, yPos - 3, colAmount, yPos - 3);
  doc.text(t.totalEquity, margin + 5, yPos);
  const totalEquityWithNet = financialData.balanceSheet.totalEquity + financialData.balanceSheet.netIncome;
  doc.text(`$${formatCurrency(totalEquityWithNet)}`, colAmount, yPos, { align: 'right' });
  
  yPos += 12;
  doc.line(colAmount - 40, yPos - 3, colAmount, yPos - 3);
  doc.text(t.totalLiabAndEquity, margin + 5, yPos);
  doc.text(`$${formatCurrency(financialData.balanceSheet.totalLiabilities + totalEquityWithNet)}`, colAmount, yPos, { align: 'right' });
  doc.line(colAmount - 40, yPos + 1, colAmount, yPos + 1);
  doc.line(colAmount - 40, yPos + 2.5, colAmount, yPos + 2.5);
  
  addPageFooter();

  // ===== PAGE 4: Statement of Income =====
  doc.addPage();
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(orgName.toUpperCase(), pageWidth / 2, 20, { align: 'center' });
  doc.setFontSize(11);
  doc.text(t.statementOfIncome, pageWidth / 2, 28, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text(`(Unaudited - See Compilation Engagement Report)`, pageWidth / 2, 35, { align: 'center' });
  doc.text(`For the ${periodEndShort}`, pageWidth / 2, 42, { align: 'center' });
  
  yPos = 55;
  
  // Revenue
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('REVENUE', margin, yPos);
  yPos += 8;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  financialData.incomeStatement.income.forEach(inc => {
    doc.text(inc.name, margin + 5, yPos);
    doc.text(`$${formatCurrency(inc.calculated_balance)}`, colAmount, yPos, { align: 'right' });
    yPos += 6;
  });
  
  yPos += 3;
  doc.setFont('helvetica', 'bold');
  doc.line(colAmount - 40, yPos - 3, colAmount, yPos - 3);
  doc.text('Total Revenue', margin + 5, yPos);
  doc.text(`$${formatCurrency(financialData.incomeStatement.totalRevenue)}`, colAmount, yPos, { align: 'right' });
  yPos += 10;
  
  // Cost of Goods Sold
  if (financialData.incomeStatement.cogs.length > 0) {
    doc.text('COST OF GOODS SOLD', margin, yPos);
    yPos += 8;
    
    doc.setFont('helvetica', 'normal');
    financialData.incomeStatement.cogs.forEach(cog => {
      doc.text(cog.name, margin + 5, yPos);
      doc.text(`$${formatCurrency(cog.calculated_balance)}`, colAmount, yPos, { align: 'right' });
      yPos += 6;
    });
    
    yPos += 3;
    doc.setFont('helvetica', 'bold');
    doc.line(colAmount - 40, yPos - 3, colAmount, yPos - 3);
    doc.text('Total Cost of Goods Sold', margin + 5, yPos);
    doc.text(`$${formatCurrency(financialData.incomeStatement.totalCogs)}`, colAmount, yPos, { align: 'right' });
    yPos += 8;
    
    doc.text('GROSS PROFIT', margin, yPos);
    doc.text(`$${formatCurrency(financialData.incomeStatement.grossProfit)}`, colAmount, yPos, { align: 'right' });
    yPos += 10;
  }
  
  // Operating Expenses
  doc.text('OPERATING EXPENSES', margin, yPos);
  yPos += 8;
  
  doc.setFont('helvetica', 'normal');
  financialData.incomeStatement.expenses.forEach(exp => {
    if (yPos > pageHeight - 40) {
      addNewPage();
      yPos = 30;
    }
    doc.text(exp.name, margin + 5, yPos);
    doc.text(`$${formatCurrency(exp.calculated_balance)}`, colAmount, yPos, { align: 'right' });
    yPos += 6;
  });
  
  yPos += 3;
  doc.setFont('helvetica', 'bold');
  doc.line(colAmount - 40, yPos - 3, colAmount, yPos - 3);
  doc.text('Total Operating Expenses', margin + 5, yPos);
  doc.text(`$${formatCurrency(financialData.incomeStatement.totalExpenses)}`, colAmount, yPos, { align: 'right' });
  yPos += 10;
  
  // Operating Income
  doc.text(t.incomeFromOps, margin, yPos);
  doc.text(`$${formatCurrency(financialData.incomeStatement.operatingIncome)}`, colAmount, yPos, { align: 'right' });
  yPos += 10;
  
  // Other Income/Expenses
  if (financialData.incomeStatement.otherIncome.length > 0 || financialData.incomeStatement.otherExpenses.length > 0) {
    doc.text('OTHER INCOME (EXPENSES)', margin, yPos);
    yPos += 8;
    
    doc.setFont('helvetica', 'normal');
    financialData.incomeStatement.otherIncome.forEach(oi => {
      doc.text(oi.name, margin + 5, yPos);
      doc.text(`$${formatCurrency(oi.calculated_balance)}`, colAmount, yPos, { align: 'right' });
      yPos += 6;
    });
    financialData.incomeStatement.otherExpenses.forEach(oe => {
      doc.text(oe.name, margin + 5, yPos);
      doc.text(`$(${formatCurrency(oe.calculated_balance)})`, colAmount, yPos, { align: 'right' });
      yPos += 6;
    });
    yPos += 5;
  }
  
  // Net Income
  yPos += 5;
  doc.setFont('helvetica', 'bold');
  doc.line(colAmount - 40, yPos - 3, colAmount, yPos - 3);
  doc.text(t.netIncome, margin, yPos);
  doc.text(`$${formatCurrency(financialData.incomeStatement.netIncome)}`, colAmount, yPos, { align: 'right' });
  doc.line(colAmount - 40, yPos + 1, colAmount, yPos + 1);
  doc.line(colAmount - 40, yPos + 2.5, colAmount, yPos + 2.5);
  
  addPageFooter();

  // ===== PAGE 5: Statement of Retained Earnings =====
  doc.addPage();
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(orgName.toUpperCase(), pageWidth / 2, 20, { align: 'center' });
  doc.setFontSize(11);
  doc.text(t.statementOfRE, pageWidth / 2, 28, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text(`(Unaudited - See Compilation Engagement Report)`, pageWidth / 2, 35, { align: 'center' });
  doc.text(`For the ${periodEndShort}`, pageWidth / 2, 42, { align: 'center' });
  
  yPos = 60;
  
  // Find retained earnings from equity
  const retainedEarnings = financialData.balanceSheet.equity.find(e => {
    const n = e.name.toLowerCase();
    return isASNPO
      ? (n.includes('unrestricted net assets') || n.includes('accumulated surplus') || n.includes('unrestricted funds'))
      : n.includes('retained earnings');
  });
  const openingRE = financialData.retainedEarningsOpening ?? (retainedEarnings?.calculated_balance || 0);
  const netIncomeForPeriod = financialData.incomeStatement.netIncome;
  const closingRE = openingRE + netIncomeForPeriod;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  doc.text(t.reBeginning, margin, yPos);
  doc.text(`$${formatCurrency(openingRE)}`, colAmount, yPos, { align: 'right' });
  yPos += 10;
  
  doc.text(t.netIncomeForPeriod, margin, yPos);
  doc.text(`$${formatCurrency(netIncomeForPeriod)}`, colAmount, yPos, { align: 'right' });
  yPos += 10;
  
  // Dividends (not applicable for NPOs)
  if (!isASNPO) {
    doc.text('Dividends declared', margin, yPos);
    doc.text(`$${formatCurrency(0)}`, colAmount, yPos, { align: 'right' });
    yPos += 10;
  }
  
  doc.setFont('helvetica', 'bold');
  doc.line(colAmount - 40, yPos - 3, colAmount, yPos - 3);
  doc.text(t.reEnd, margin, yPos);
  doc.text(`$${formatCurrency(closingRE)}`, colAmount, yPos, { align: 'right' });
  doc.line(colAmount - 40, yPos + 1, colAmount, yPos + 1);
  doc.line(colAmount - 40, yPos + 2.5, colAmount, yPos + 2.5);
  
  addPageFooter();

  // ===== PAGE 6+: Notes to Financial Statements =====
  doc.addPage();
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(orgName.toUpperCase(), pageWidth / 2, 20, { align: 'center' });
  doc.setFontSize(11);
  doc.text('NOTES TO FINANCIAL STATEMENTS', pageWidth / 2, 28, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text(periodEndFormatted, pageWidth / 2, 35, { align: 'center' });
  
  yPos = 50;
  let noteNum = 1;
  
  noteTemplateIds.forEach(noteId => {
    const note = getFrameworkNoteTemplates((compilation as any).accounting_framework || 'ASPE').find(n => n.id === noteId);
    if (note) {
      // Check if we need a new page
      if (yPos > pageHeight - 60) {
        addNewPage();
        yPos = 30;
      }
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${noteNum}. ${note.title.replace(/^\d+\.\s*/, '')}`, margin, yPos);
      yPos += 8;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const resolvedTemplate = resolveNoteTemplate(note.template, orgContext);
      const splitNote = doc.splitTextToSize(resolvedTemplate, contentWidth);
      
      // Check if note content fits
      if (yPos + splitNote.length * 4.5 > pageHeight - 40) {
        addNewPage();
        yPos = 30;
      }
      
      doc.text(splitNote, margin, yPos);
      yPos += splitNote.length * 4.5 + 10;
      noteNum++;
    }
  });

  // Add custom notes if present
  if (compilation.custom_notes) {
    if (yPos > pageHeight - 60) {
      addNewPage();
      yPos = 30;
    }
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`${noteNum}. Additional Notes`, margin, yPos);
    yPos += 8;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const splitCustom = doc.splitTextToSize(compilation.custom_notes, contentWidth);
    doc.text(splitCustom, margin, yPos);
  }
  
  addPageFooter();
  
  // Save the PDF
  const fileName = `${orgName.replace(/[^a-zA-Z0-9]/g, '_')}_Financial_Statements_${fiscalYear}.pdf`;
  doc.save(fileName);
}
