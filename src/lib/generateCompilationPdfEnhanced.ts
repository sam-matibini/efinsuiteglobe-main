import jsPDF from 'jspdf';
import { format, parseISO, subYears } from 'date-fns';

/**
 * Merges account lists from current and prior periods so that accounts
 * existing only in the prior period are not dropped from the report.
 */
function mergeAccountLists(
  currentAccounts: Array<{ name: string; calculated_balance: number }>,
  priorAccounts?: Array<{ name: string; calculated_balance: number }>
): Array<{ name: string; currentAmount: number; priorAmount: number }> {
  const merged = new Map<string, { currentAmount: number; priorAmount: number }>();

  for (const acc of currentAccounts) {
    const existing = merged.get(acc.name);
    if (existing) {
      existing.currentAmount += acc.calculated_balance;
    } else {
      merged.set(acc.name, { currentAmount: acc.calculated_balance, priorAmount: 0 });
    }
  }

  if (priorAccounts) {
    for (const acc of priorAccounts) {
      const existing = merged.get(acc.name);
      if (existing) {
        existing.priorAmount += acc.calculated_balance;
      } else {
        merged.set(acc.name, { currentAmount: 0, priorAmount: acc.calculated_balance });
      }
    }
  }

  return Array.from(merged.entries()).map(([name, amounts]) => ({
    name,
    ...amounts,
  }));
}

/**
 * Merges Balance Sheet account lists from current and prior periods,
 * preserving normal_balance, is_current, and code fields needed for
 * classification and sign logic.
 */
function mergeBalanceSheetAccounts(
  currentAccounts: Array<{ name: string; calculated_balance: number; normal_balance?: string; is_current?: boolean; code?: string }>,
  priorAccounts?: Array<{ name: string; calculated_balance: number; normal_balance?: string; is_current?: boolean; code?: string }>
): Array<{ name: string; currentBalance: number; priorBalance: number; normal_balance?: string; is_current?: boolean; code?: string }> {
  const merged = new Map<string, { currentBalance: number; priorBalance: number; normal_balance?: string; is_current?: boolean; code?: string }>();

  for (const acc of currentAccounts) {
    merged.set(acc.name, {
      currentBalance: acc.calculated_balance,
      priorBalance: 0,
      normal_balance: acc.normal_balance,
      is_current: acc.is_current,
      code: acc.code,
    });
  }

  if (priorAccounts) {
    for (const acc of priorAccounts) {
      const existing = merged.get(acc.name);
      if (existing) {
        existing.priorBalance = acc.calculated_balance;
      } else {
        merged.set(acc.name, {
          currentBalance: 0,
          priorBalance: acc.calculated_balance,
          normal_balance: acc.normal_balance,
          is_current: acc.is_current,
          code: acc.code,
        });
      }
    }
  }

  return Array.from(merged.entries()).map(([name, data]) => ({ name, ...data }));
}

/**
 * Canonical equity classifier used across compilation exports.
 * Returns true if the account should be EXCLUDED from the "other equity" list
 * because it represents Retained Earnings or Current Year Earnings — those are
 * replaced by the Statement of Retained Earnings closing balance.
 *
 * Predicates mirror AICompilationDialog.tsx and BalanceSheet.tsx.
 */
export function isRetainedEarningsOrCYE(acc: { code?: string | null; name?: string | null }): boolean {
  const code = acc.code ?? '';
  const nameLower = (acc.name ?? '').toLowerCase();
  if (
    code === '3-00-202' ||
    nameLower.includes('current year earnings') ||
    nameLower.includes('current year excess') ||
    nameLower.includes('current year surplus') ||
    nameLower.includes('excess (deficiency)')
  ) return true;
  if (
    code === '3-00-201' ||
    nameLower === 'retained earnings' ||
    nameLower.includes('accumulated deficit') ||
    nameLower.includes('unrestricted net assets') ||
    nameLower.includes('accumulated surplus') ||
    nameLower.includes('unrestricted funds') ||
    nameLower.includes('accumulated funds')
  ) return true;
  return false;
}

/**
 * Sum "other equity" accounts (excluding RE + CYE) with proper contra-equity
 * sign handling. Equity is credit-normal by default; debit-normal accounts
 * (e.g., treasury stock, owner's drawings) are subtracted.
 */
export function sumEquityExcludingREandCYE(
  equity: Array<{ code?: string | null; name?: string | null; normal_balance?: string | null; calculated_balance: number }>
): number {
  return equity.reduce((sum, a) => {
    if (isRetainedEarningsOrCYE(a)) return sum;
    const sign = a.normal_balance === 'debit' ? -1 : 1;
    return sum + (Number(a.calculated_balance) || 0) * sign;
  }, 0);
}


import { aspeNoteTemplates, getFrameworkNoteTemplates, CompilationReport, resolveNoteTemplate, NoteTemplateContext } from '@/hooks/useCompilationReports';

export interface CashFlowStatementData {
  operatingActivities: Array<{ name: string; amount: number }>;
  investingActivities: Array<{ name: string; amount: number }>;
  financingActivities: Array<{ name: string; amount: number }>;
  nonCashActivities?: Array<{ name: string; amount: number }>;
  netOperating: number;
  netInvesting: number;
  netFinancing: number;
  netChange: number;
  beginningCash: number;
  endingCash: number;
}


export interface FixedAssetNoteData {
  assetClass: string;
  acquisitionCost: number;
  accumulatedAmortization: number;
  netBookValue: number;
  depreciationMethod: string;
  depreciationRate: string;
}

export interface FixedAssetsNoteSection {
  currentYear: FixedAssetNoteData[];
  priorYear?: FixedAssetNoteData[];
  totalCost: number;
  totalAccumulatedAmortization: number;
  totalNetBookValue: number;
  priorTotalCost?: number;
  priorTotalAccumulatedAmortization?: number;
  priorTotalNetBookValue?: number;
  currentYearAdditions?: number;
  priorYearAdditions?: number;
}

export interface LeaseNoteData {
  leaseName: string;
  leaseType: string;
  commencementDate: string;
  endDate: string;
  termMonths: number;
  paymentAmount: number;
  paymentFrequency: string;
  discountRate: number;
  rouAssetInitial: number;
  currentLiabilityTotal: number; // total liability at current FYE
  priorLiabilityTotal: number; // total liability at prior FYE
  currentPortionCurrent: number; // current portion at current FYE
  nonCurrentPortionCurrent: number; // non-current portion at current FYE
  currentPortionPrior: number; // current portion at prior FYE
  nonCurrentPortionPrior: number; // non-current portion at prior FYE
  totalInterestCurrent: number; // interest expense current year
  totalInterestPrior: number; // interest expense prior year
  maturitySchedule: Array<{ year: string; amount: number }>; // future minimum payments by year
}

export interface ComparativeFinancialData {
  currentYear: {
    label: string;
    balanceSheet: {
      assets: Array<{ name: string; calculated_balance: number; is_current?: boolean; code?: string; normal_balance?: string }>;
      liabilities: Array<{ name: string; calculated_balance: number; is_current?: boolean; code?: string; normal_balance?: string }>;
      equity: Array<{ name: string; calculated_balance: number; code?: string; normal_balance?: string }>;
      totalAssets: number;
      totalLiabilities: number;
      totalEquity: number;
      netIncome: number;
      reClosingBalance?: number;
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
    cashFlow?: CashFlowStatementData;
  };
  priorYear?: {
    label: string;
    balanceSheet: {
      assets: Array<{ name: string; calculated_balance: number; is_current?: boolean; code?: string; normal_balance?: string }>;
      liabilities: Array<{ name: string; calculated_balance: number; is_current?: boolean; code?: string; normal_balance?: string }>;
      equity: Array<{ name: string; calculated_balance: number; code?: string; normal_balance?: string }>;
      totalAssets: number;
      totalLiabilities: number;
      totalEquity: number;
      netIncome: number;
      reClosingBalance?: number;
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
    cashFlow?: CashFlowStatementData;
  };
  organizationName: string;
  retainedEarningsOpening?: number;
  priorRetainedEarningsOpening?: number;
  shareCapitalOpening?: number;
  shareCapitalContributions?: number;
  priorShareCapitalOpening?: number;
  priorShareCapitalContributions?: number;
  fixedAssets?: FixedAssetsNoteSection;
  leaseNotes?: LeaseNoteData[];
}

/**
 * Format currency for CSRS 4200 compliant financial statements
 * Uses brackets for negative amounts per professional accounting standards
 */
const formatCurrency = (amount: number, includeDollarSign: boolean = false): string => {
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString('en-CA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const prefix = includeDollarSign ? '$' : '';
  // Use brackets for negative numbers (GAAP/ASPE standard)
  return amount < 0 ? `(${prefix}${formatted})` : `${prefix}${formatted}`;
};

/**
 * Format amount with dash for zero values (per professional standards)
 */
const formatCurrencyOrDash = (amount: number | undefined | null, includeDollarSign: boolean = false): string => {
  if (amount === undefined || amount === null || Math.abs(amount) < 0.01) {
    return '–'; // En-dash for zero/missing values
  }
  return formatCurrency(amount, includeDollarSign);
};

/**
 * Align accounts between current and prior periods for side-by-side display
 */
function alignAccountsForDisplay<T extends { name: string; calculated_balance: number }>(
  currentAccounts: T[],
  priorAccounts: T[] | undefined
): Array<{ name: string; currentAmount: number; priorAmount: number; isMissingInCurrent: boolean; isMissingInPrior: boolean }> {
  const aligned: Array<{ name: string; currentAmount: number; priorAmount: number; isMissingInCurrent: boolean; isMissingInPrior: boolean }> = [];
  const priorMap = new Map((priorAccounts ?? []).map(a => [a.name.toLowerCase(), a]));
  const matchedPriorNames = new Set<string>();

  // First pass: align current accounts with prior
  currentAccounts.forEach(curr => {
    const prior = priorMap.get(curr.name.toLowerCase());
    aligned.push({
      name: curr.name,
      currentAmount: curr.calculated_balance,
      priorAmount: prior?.calculated_balance ?? 0,
      isMissingInCurrent: false,
      isMissingInPrior: !prior,
    });
    if (prior) matchedPriorNames.add(curr.name.toLowerCase());
  });

  // Second pass: add accounts that only exist in prior period
  (priorAccounts ?? []).forEach(prior => {
    if (!matchedPriorNames.has(prior.name.toLowerCase()) && prior.calculated_balance !== 0) {
      aligned.push({
        name: prior.name,
        currentAmount: 0,
        priorAmount: prior.calculated_balance,
        isMissingInCurrent: true,
        isMissingInPrior: false,
      });
    }
  });

  return aligned;
}

export interface ExecutiveSignerSlot {
  signerName: string;
  signerTitle: string;
  secondaryTitle?: string;
  signatureImageUrl?: string | null;
  signedAt?: string | null;
}

export interface ExecutiveSignatureForExport {
  /** Backwards-compatible single-signer fields (treated as primary). */
  signerName?: string;
  signerTitle?: string;
  secondaryTitle?: string;
  signatureImageUrl?: string | null;
  signedAt?: string | null;
  certificationText?: string;
  /** New: explicit primary + secondary slots. */
  primary?: ExecutiveSignerSlot | null;
  secondary?: ExecutiveSignerSlot | null;
}

export async function generateEnhancedCompilationPDF(
  compilation: CompilationReport,
  financialData: ComparativeFinancialData,
  options: { hideZeroBalances?: boolean; orgContext?: NoteTemplateContext; executiveSignature?: ExecutiveSignatureForExport | null } = {}
): Promise<void> {
  const { hideZeroBalances = true, orgContext = {}, executiveSignature = null } = options;

  const doc = new jsPDF();
  
  // Determine accounting framework (ASPE, IFRS, or ASNPO)
  const accountingFramework = (compilation as any).accounting_framework || 'ASPE';
  const isIFRS = accountingFramework === 'IFRS';
  const isASNPO = accountingFramework === 'ASNPO';
  const frameworkName = isIFRS 
    ? 'International Financial Reporting Standards (IFRS)' 
    : isASNPO 
      ? 'Canadian accounting standards for not-for-profit organizations (ASNPO)'
      : 'Canadian accounting standards for private enterprises (ASPE)';
  const standardReference = isIFRS ? 'International Standards on Related Services (ISRS) 4410' : 'Canadian Standard on Related Services (CSRS) 4200';
  
  // ASNPO terminology helpers
  const t = {
    equity: isASNPO ? 'NET ASSETS' : 'EQUITY',
    equityLower: isASNPO ? 'Net Assets' : 'Equity',
    shareholdersEquity: isASNPO ? 'NET ASSETS' : "SHAREHOLDERS' EQUITY",
    totalEquity: isASNPO ? 'Total Net Assets' : 'Total Equity',
    totalLiabAndEquity: isASNPO ? 'TOTAL LIABILITIES AND NET ASSETS' : 'TOTAL LIABILITIES AND EQUITY',
    liabAndEquity: isASNPO ? 'LIABILITIES AND NET ASSETS' : 'LIABILITIES AND EQUITY',
    netIncome: isASNPO ? 'EXCESS (DEFICIENCY) OF REVENUE OVER EXPENSES' : 'NET INCOME',
    netIncomeLower: isASNPO ? 'Excess (deficiency) of revenue over expenses' : 'Net income for the year',
    currentYearEarnings: isASNPO ? 'Excess (Deficiency) of Revenue over Expenses' : 'Current Year Earnings',
    profitBeforeTax: isASNPO ? 'EXCESS (DEFICIENCY) BEFORE OTHER ITEMS' : 'PROFIT BEFORE TAX',
    statementOfIncome: isASNPO ? 'Statement of Operations' : 'Statement of Income',
    statementOfEquity: isASNPO ? 'Statement of Changes in Net Assets' : 'Statement of Changes in Equity',
    balanceSheetTitle: isASNPO ? 'Statement of Financial Position' : 'Statement of Financial Position',
    shareIssuances: isASNPO ? 'Contributions' : 'Share issuances',
    commonShares: isASNPO ? '' : 'Common Shares',
    retainedEarnings: isASNPO ? 'Unrestricted Net Assets' : 'Retained Earnings',
    entity: isASNPO ? 'the organization' : 'the company',
    entityCap: isASNPO ? 'The organization' : 'The company',
  };
  
  // Get additional qualifications if available
  const additionalQualifications = (compilation as any).additional_qualifications || [];
  const accountantLogoUrl = (compilation as any).accountant_logo_url;
  const accountantSignatureUrl = (compilation as any).accountant_signature_url;
  
  /**
   * Helper to check if an account should be hidden based on zero balance rule
   * Returns true if the line should be hidden (both current and prior are zero)
   */
  const shouldHideLine = (currentAmount: number, priorAmount: number | undefined): boolean => {
    if (!hideZeroBalances) return false;
    const currentIsZero = Math.abs(currentAmount) < 0.01;
    const priorIsZero = priorAmount === undefined || Math.abs(priorAmount) < 0.01;
    return currentIsZero && priorIsZero;
  };
  
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  const fiscalYear = compilation.fiscal_year;
  const noteTemplateIds = compilation.selected_note_templates || [];
  const orgName = financialData.organizationName || 'Organization Name';
  const periodType = compilation.reporting_period_type || 'annual';
  const isInterim = periodType === 'interim' || periodType === 'quarterly';
  const hasComparative = !!financialData.priorYear;
  
  // --- Dynamically measure logo to preserve original proportions ---
  const logoHeight = 10;
  let logoWidth = 19; // fallback (10 * 1.94)
  const eFinTaxLogoUrl = '/images/efintax-advisors-logo.png';
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = 'anonymous';
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = eFinTaxLogoUrl;
    });
    const aspectRatio = img.naturalWidth / img.naturalHeight;
    logoWidth = logoHeight * aspectRatio;
    // Cap logo width so it doesn't consume too much horizontal space
    if (logoWidth > 35) logoWidth = 35;
  } catch {
    console.warn('Could not measure logo; using fallback 19mm width');
  }

  const logoY = 10;
  const logoX = pageWidth - margin - logoWidth;
  const headerGap = 5;
  const headerTextWidth = (logoX - headerGap) - margin;
  const headerCenterX = margin + headerTextWidth / 2; // Center within safe zone left of logo
  const headerStartY = Math.max(20, logoY + logoHeight + 3); // Vertical clearance below logo

  // Professional column layout
  const descColWidth = contentWidth * 0.58;
  const amountColWidth = contentWidth * 0.20;
  
  // Column end positions (right-aligned amounts)
  const col1End = margin + descColWidth + amountColWidth;
  const col2End = pageWidth - margin;
  const col1Start = col1End - amountColWidth + 5;
  const col2Start = col2End - amountColWidth + 5;
  const singleColEnd = pageWidth - margin;
  
  let pageNum = 1;
  
  // Helper function to draw single underline (for subtotals)
  const drawSingleLine = (y: number, colStart: number, colEnd: number) => {
    doc.setLineWidth(0.3);
    doc.line(colStart, y, colEnd, y);
  };
  
  // Helper function to draw double underline (for grand totals)
  const drawDoubleLine = (y: number, colStart: number, colEnd: number) => {
    doc.setLineWidth(0.3);
    doc.line(colStart, y, colEnd, y);
    doc.line(colStart, y + 1.5, colEnd, y + 1.5);
  };
  // Logo URL already defined and measured above
  
  // Add logo to top-right corner of current page (uses shared layout constants)
  const addPageHeader = () => {
    try {
      doc.addImage(eFinTaxLogoUrl, 'PNG', logoX, logoY, logoWidth, logoHeight);
    } catch (e) {
      console.warn('Could not add page header logo:', e);
    }
  };
  
  const addPageFooter = () => {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100);
    doc.text('See accompanying notes', pageWidth - margin, pageHeight - 15, { align: 'right' });
    doc.text(`Page ${pageNum}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.setTextColor(0);
    pageNum++;
  };

  const addNewPage = () => {
    addPageFooter();
    doc.addPage();
    addPageHeader(); // Add logo to the new page
  };

  const formatPeriodDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'MMMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const periodEndFormatted = formatPeriodDate(compilation.fiscal_year_end);
  const periodEndShort = isInterim ? 
    `${periodType === 'interim' ? 'Period' : 'Quarter'} Ended ${periodEndFormatted}` :
    `Year Ended ${periodEndFormatted}`;

  // ===== TITLE PAGE =====
  addPageHeader(); // Add eFinTax logo to title page
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(orgName.toUpperCase(), contentWidth - 10);
  let titleY = 60;
  titleLines.forEach((line: string) => {
    doc.text(line, pageWidth / 2, titleY, { align: 'center' });
    titleY += 8;
  });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(isInterim ? 'Interim Financial Statements' : 'Financial Statements', pageWidth / 2, titleY + 10, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text('(Unaudited - See Compilation Engagement Report)', pageWidth / 2, titleY + 20, { align: 'center' });
  
  doc.setFontSize(11);
  doc.text(periodEndFormatted, pageWidth / 2, titleY + 35, { align: 'center' });
  
  if (hasComparative) {
    doc.setFontSize(10);
    doc.text('(With Comparative Figures for the Prior Year)', pageWidth / 2, titleY + 45, { align: 'center' });
  }
  
  // Prepared by section (removed centered logo, keeping only header logo)
  if (compilation.prepared_by || compilation.firm_name) {
    let yPos = pageHeight - 80;
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
      // Include additional qualifications with the name
      const qualificationsStr = additionalQualifications.length > 0 
        ? `, ${additionalQualifications.join(', ')}` 
        : '';
      doc.text(`${compilation.prepared_by}${qualificationsStr}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 6;
    }
    
    if (compilation.firm_address) {
      const addressLines = doc.splitTextToSize(compilation.firm_address, contentWidth * 0.6);
      addressLines.forEach((line: string) => {
        doc.text(line, pageWidth / 2, yPos, { align: 'center' });
        yPos += 5;
      });
    }
  }
  
  addPageFooter();

  // ===== COMPILATION ENGAGEMENT REPORT (CSRS 4200) =====
  doc.addPage();
  addPageHeader();
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPILATION ENGAGEMENT REPORT', pageWidth / 2, 30, { align: 'center' });
  
  let yPos = 50;
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('To the Director(s) of', margin, yPos);
  yPos += 7;
  doc.setFont('helvetica', 'bold');
  const cerHeaderLines = doc.splitTextToSize(orgName, headerTextWidth);
  cerHeaderLines.forEach((line: string) => {
    doc.text(line, margin, yPos);
    yPos += 7;
  });
  yPos += 8;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  const statementsIncluded = (compilation.statement_types || ['balance_sheet', 'income_statement', 'retained_earnings', 'cash_flow'])
    .map(s => {
      switch(s) {
        case 'balance_sheet': return isASNPO ? 'statement of financial position' : 'balance sheet';
        case 'income_statement': return isASNPO ? 'statement of operations' : 'statement of income';
        case 'retained_earnings': return isASNPO ? 'statement of changes in net assets' : 'statement of retained earnings';
        case 'cash_flow': return 'statement of cash flows';
        case 'changes_equity': return isASNPO ? 'statement of changes in net assets' : 'statement of changes in equity';
        default: return s;
      }
    }).join(', ');

  const compilationText = `On the basis of information provided by management, we have compiled the ${statementsIncluded} of ${orgName} as at ${periodEndFormatted} and for the ${isInterim ? 'period' : 'year'} then ended.

Management is responsible for these financial statements, including the accuracy and completeness of the underlying information used to compile them and the selection of the accounting policies.

We performed this engagement in accordance with ${standardReference}, Compilation Engagements, which requires us to comply with relevant ethical requirements. Our responsibility is to assist management in the preparation and presentation of these financial statements.

These financial statements have been prepared in accordance with ${frameworkName}.

We did not perform an audit engagement or a review engagement, nor were we required to perform procedures to verify the accuracy or completeness of the information provided by management. Accordingly, we do not express an audit opinion or a review conclusion on these financial statements.

Readers are cautioned that these statements may not be appropriate for their purposes.`;

  const splitText = doc.splitTextToSize(compilationText, contentWidth);
  doc.text(splitText, margin, yPos);
  yPos += splitText.length * 5 + 25;
  
  // Signature image (if available)
  if (accountantSignatureUrl) {
    try {
      const sigWidth = 60;
      const sigHeight = 25;
      doc.addImage(accountantSignatureUrl, 'PNG', margin, yPos, sigWidth, sigHeight);
      yPos += sigHeight + 3;
    } catch (e) {
      console.warn('Could not add signature to PDF:', e);
      // Fall back to signature line
      doc.line(margin, yPos, margin + 80, yPos);
      yPos += 5;
    }
  } else {
    // Signature line
    doc.line(margin, yPos, margin + 80, yPos);
    yPos += 5;
  }
  
  if (compilation.firm_name) {
    doc.setFont('helvetica', 'bold');
    doc.text(compilation.firm_name, margin, yPos);
    yPos += 6;
  }
  
  if (compilation.prepared_by) {
    doc.setFont('helvetica', 'normal');
    // Include additional qualifications with the name
    const qualificationsStr = additionalQualifications.length > 0 
      ? `, ${additionalQualifications.join(', ')}` 
      : '';
    doc.text(`${compilation.prepared_by}${qualificationsStr}`, margin, yPos);
    yPos += 6;
  }
  
  if (compilation.preparer_license_number) {
    doc.text(`License No: ${compilation.preparer_license_number}`, margin, yPos);
    yPos += 6;
  }
  
  yPos += 10;
  const city = compilation.firm_address?.split(',')[0] || '';
  doc.text(city, margin, yPos);
  yPos += 6;
  doc.text(compilation.issued_at ? 
    format(parseISO(compilation.issued_at), 'MMMM d, yyyy') : 
    format(new Date(), 'MMMM d, yyyy'), margin, yPos);
  yPos += 20;

  // ===== EXECUTIVE (BOARD CHAIR / CEO / PRESIDENT) APPROVAL =====
  // Two-column layout: primary signer on the left, secondary signer on the right.
  const execSig = executiveSignature;
  // Backwards compatibility: a legacy single-signer payload becomes the primary slot.
  const primarySlot: ExecutiveSignerSlot | null = execSig
    ? execSig.primary ??
      (execSig.signerName || execSig.signatureImageUrl
        ? {
            signerName: execSig.signerName || '',
            signerTitle: execSig.signerTitle || 'CEO/President',
            secondaryTitle: execSig.secondaryTitle,
            signatureImageUrl: execSig.signatureImageUrl ?? null,
            signedAt: execSig.signedAt ?? null,
          }
        : null)
    : null;
  const secondarySlot: ExecutiveSignerSlot | null =
    execSig?.secondary ?? null;
  const hasExecBlock = !!(primarySlot || secondarySlot);

  if (hasExecBlock) {
    // Page-break if insufficient room (need ~80mm for the two-column block)
    if (yPos > pageHeight - 90) {
      addPageFooter();
      doc.addPage();
      addPageHeader();
      yPos = 50;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Approved on behalf of the Board / Management:', margin, yPos);
    yPos += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const certText = execSig?.certificationText ||
      `I, the undersigned, certify that I have reviewed these financial statements and approve them on behalf of ${t.entity}.`;
    const certLines = doc.splitTextToSize(certText, contentWidth);
    doc.text(certLines, margin, yPos);
    yPos += certLines.length * 4 + 14;

    const showTwoCols = !!(primarySlot && secondarySlot);
    const colGap = 10;
    const colWidth = showTwoCols ? (contentWidth - colGap) / 2 : 90;
    const sigLineWidth = Math.min(colWidth, 90);

    const renderSlot = (slot: ExecutiveSignerSlot | null, colX: number) => {
      if (!slot) return;
      const baselineY = yPos;

      // Signature image sits above the line
      if (slot.signatureImageUrl) {
        try {
          const sigWidth = Math.min(60, sigLineWidth);
          const sigHeight = 22;
          const fmt = slot.signatureImageUrl.includes('image/jpeg') ? 'JPEG' : 'PNG';
          doc.addImage(slot.signatureImageUrl, fmt, colX, baselineY - sigHeight, sigWidth, sigHeight);
        } catch (e) {
          console.warn('Could not add executive signature image:', e);
        }
      }
      doc.setLineWidth(0.3);
      doc.line(colX, baselineY, colX + sigLineWidth, baselineY);

      let lineY = baselineY + 5;
      doc.setFontSize(10);
      if (slot.signerName) {
        doc.setFont('helvetica', 'bold');
        doc.text(slot.signerName, colX, lineY);
        lineY += 5;
      }
      doc.setFont('helvetica', 'normal');
      if (slot.signerTitle) {
        doc.text(slot.signerTitle, colX, lineY);
        lineY += 5;
      }
      if (slot.secondaryTitle) {
        doc.text(slot.secondaryTitle, colX, lineY);
        lineY += 5;
      }
      lineY += 4;
      doc.text(
        slot.signedAt
          ? format(parseISO(slot.signedAt), 'MMMM d, yyyy')
          : format(new Date(), 'MMMM d, yyyy'),
        colX,
        lineY,
      );
      return lineY;
    };

    const leftBottom = renderSlot(primarySlot, margin) ?? yPos;
    const rightBottom = showTwoCols
      ? renderSlot(secondarySlot, margin + colWidth + colGap) ?? yPos
      : yPos;
    // Advance yPos past the taller column
    yPos = Math.max(leftBottom, rightBottom) + 4;
  }


  addPageFooter();


  // ===== COMPARATIVE BALANCE SHEET (STATEMENT OF FINANCIAL POSITION) =====
  doc.addPage();
  addPageHeader();
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const bsHeaderLines = doc.splitTextToSize(orgName.toUpperCase(), headerTextWidth);
  let bsHeaderY = headerStartY;
  bsHeaderLines.forEach((line: string) => {
    doc.text(line, headerCenterX, bsHeaderY, { align: 'center' });
    bsHeaderY += 7;
  });
  doc.setFontSize(11);
  doc.text(isInterim ? 'INTERIM Statement of Financial Position' : 'Statement of Financial Position', headerCenterX, bsHeaderY + 1, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`As at ${periodEndFormatted}`, headerCenterX, bsHeaderY + 8, { align: 'center' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.text('(Unaudited - See Compilation Engagement Report)', headerCenterX, bsHeaderY + 14, { align: 'center' });
  
  yPos = bsHeaderY + 25;
  
  // Column headers with underline
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Description', margin, yPos);
  if (hasComparative) {
    doc.text(fiscalYear, col1End, yPos, { align: 'right' });
    doc.text(String(parseInt(fiscalYear) - 1), col2End, yPos, { align: 'right' });
  } else {
    doc.text(fiscalYear, singleColEnd, yPos, { align: 'right' });
  }
  yPos += 2;
  // Header underline
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;
  
  const currentBS = financialData.currentYear.balanceSheet;
  const priorBS = financialData.priorYear?.balanceSheet;
  
  /**
   * Detect accumulated depreciation/amortization account labels,
   * including common abbreviations (e.g., "Accumm. Dep").
   */
  const isAccumulatedAmortizationAccount = (name: string): boolean => {
    const normalized = name.toLowerCase();
    return /\b(accumulated|accum|accumm?)\.?\s*(depreciation|deprec(?:iation)?|dep|amortization|amort)\b/i.test(normalized);
  };

  /**
   * Check if an account is a contra-asset (accumulated depreciation/amortization)
   * These should always display with parentheses per GAAP/ASPE presentation standards
   */
  const isContraAsset = (name: string): boolean => isAccumulatedAmortizationAccount(name);

  /**
   * Format contra-asset amounts with parentheses regardless of sign
   * Per GAAP/ASPE, accumulated depreciation/amortization should display as (amount)
   */
  const formatContraAsset = (amount: number, includeDollarSign: boolean = false): string => {
    const absAmount = Math.abs(amount);
    const formatted = absAmount.toLocaleString('en-CA', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    const prefix = includeDollarSign ? '$' : '';
    return `(${prefix}${formatted})`;
  };

  // Helper to render a line item
  const renderLineItem = (label: string, currentVal: number, priorVal?: number, indent: number = 0, isBold: boolean = false) => {
    if (yPos > pageHeight - 40) {
      addNewPage();
      yPos = 30;
    }
    
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(9);
    doc.text(label, margin + indent, yPos);
    
    // Check if this is a contra-asset (accumulated depreciation/amortization)
    const isContra = isContraAsset(label);
    const includeDollar = indent === 0 && isBold;
    
    if (hasComparative) {
      const currentFormatted = isContra && currentVal !== 0 
        ? formatContraAsset(currentVal, includeDollar)
        : formatCurrency(currentVal, includeDollar);
      const priorFormatted = isContra && (priorVal ?? 0) !== 0
        ? formatContraAsset(priorVal ?? 0, includeDollar)
        : formatCurrency(priorVal ?? 0, includeDollar);
      doc.text(currentFormatted, col1End, yPos, { align: 'right' });
      doc.text(priorFormatted, col2End, yPos, { align: 'right' });
    } else {
      const currentFormatted = isContra && currentVal !== 0
        ? formatContraAsset(currentVal, includeDollar)
        : formatCurrency(currentVal, includeDollar);
      doc.text(currentFormatted, singleColEnd, yPos, { align: 'right' });
    }
    yPos += 5.5;
  };
  
  // Helper to render a subtotal with single line
  const renderSubtotal = (label: string, currentVal: number, priorVal?: number, indent: number = 0) => {
    if (yPos > pageHeight - 40) {
      addNewPage();
      yPos = 30;
    }
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(label, margin + indent, yPos);
    
    if (hasComparative) {
      doc.text(formatCurrency(currentVal), col1End, yPos, { align: 'right' });
      doc.text(formatCurrency(priorVal ?? 0), col2End, yPos, { align: 'right' });
      // Single underline after the amounts
      drawSingleLine(yPos + 1.5, col1Start, col1End);
      drawSingleLine(yPos + 1.5, col2Start, col2End);
    } else {
      doc.text(formatCurrency(currentVal), singleColEnd, yPos, { align: 'right' });
      drawSingleLine(yPos + 1.5, col1Start, singleColEnd);
    }
    yPos += 8;
  };
  
  // Helper to render a grand total with double line
  const renderGrandTotal = (label: string, currentVal: number, priorVal?: number, includeDollar: boolean = true) => {
    if (yPos > pageHeight - 40) {
      addNewPage();
      yPos = 30;
    }
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(label, margin, yPos);
    
    if (hasComparative) {
      doc.text(formatCurrency(currentVal, includeDollar), col1End, yPos, { align: 'right' });
      doc.text(formatCurrency(priorVal ?? 0, includeDollar), col2End, yPos, { align: 'right' });
      // Double underline after the amounts
      drawDoubleLine(yPos + 1.5, col1Start, col1End);
      drawDoubleLine(yPos + 1.5, col2Start, col2End);
    } else {
      doc.text(formatCurrency(currentVal, includeDollar), singleColEnd, yPos, { align: 'right' });
      drawDoubleLine(yPos + 1.5, col1Start, singleColEnd);
    }
    yPos += 10;
  };
  
  // ASSETS
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('ASSETS', margin, yPos);
  yPos += 8;
  
  /**
   * ASSET CLASSIFICATION LOGIC - ASPE/GAAP COMPLIANT
   * -------------------------------------------------
   * Current Assets: Assets expected to be realized within 12 months (is_current = true)
   * Non-current Assets: Property, Plant & Equipment (PPE) and other long-term assets (is_current = false)
   * 
   * Classification Priority:
   * 1. Contra-asset detection (accumulated dep/amort) => always non-current
   * 2. Use the `is_current` database field
   * 3. Fallback: Account code prefix (1-02 = non-current PPE, 1-01 = current)
   * 4. Fallback: Account name patterns for PPE items
   */
  const isNonCurrentAsset = (a: { name: string; is_current?: boolean; code?: string; normal_balance?: string }) => {
    // Contra-asset accounts should always be presented with long-term assets
    if (isAccumulatedAmortizationAccount(a.name)) return true;

    // Primary: Use the is_current database field
    if (a.is_current === false) return true;
    if (a.is_current === true) return false;
    
    // Fallback: Account code prefix (1-02 typically indicates PPE/non-current)
    if (a.code?.startsWith('1-02') || a.code?.startsWith('1-03')) return true;
    
    // Fallback: Name-based classification for common PPE items
    const nameLower = a.name.toLowerCase();
    const ppePatterns = [
      'property', 'plant', 'equipment', 'machinery', 'vehicles', 'vehicle',
      'furniture', 'fixture', 'computer equipment', 'building', 'land',
      'franchise'
    ];
    
    return ppePatterns.some(pattern => nameLower.includes(pattern));
  };
  
  // Separate current and non-current assets using proper classification logic
  // Merge current + prior assets so prior-only accounts are not dropped
  const allMergedAssets = mergeBalanceSheetAccounts(currentBS.assets, priorBS?.assets);
  const currentAssets = allMergedAssets.filter(a => !isNonCurrentAsset(a));
  const nonCurrentAssets = allMergedAssets.filter(a => isNonCurrentAsset(a));
  
  // Current Assets section
  if (currentAssets.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Current Assets', margin, yPos);
    yPos += 6;
    
    doc.setFont('helvetica', 'normal');
    let currentAssetsTotal = 0;
    let priorCurrentAssetsTotal = 0;
    
    currentAssets.forEach(asset => {
      const sign = asset.normal_balance === 'credit' ? -1 : 1;
      currentAssetsTotal += asset.currentBalance * sign;
      const priorSign = asset.normal_balance === 'credit' ? -1 : 1;
      priorCurrentAssetsTotal += asset.priorBalance * priorSign;
      if (!shouldHideLine(asset.currentBalance, asset.priorBalance)) {
        renderLineItem(asset.name, asset.currentBalance, asset.priorBalance || undefined, 5);
      }
    });
    
    renderSubtotal('Total Current Assets', currentAssetsTotal, priorCurrentAssetsTotal);
  }
  
  // Non-current Assets section
  if (nonCurrentAssets.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Non-current Assets', margin, yPos);
    yPos += 6;
    
    doc.setFont('helvetica', 'normal');
    let nonCurrentAssetsTotal = 0;
    let priorNonCurrentAssetsTotal = 0;
    
    nonCurrentAssets.forEach(asset => {
      const sign = asset.normal_balance === 'credit' ? -1 : 1;
      nonCurrentAssetsTotal += asset.currentBalance * sign;
      const priorSign = asset.normal_balance === 'credit' ? -1 : 1;
      priorNonCurrentAssetsTotal += asset.priorBalance * priorSign;
      if (!shouldHideLine(asset.currentBalance, asset.priorBalance)) {
        renderLineItem(asset.name, asset.currentBalance, asset.priorBalance || undefined, 5);
      }
    });
    
    renderSubtotal('Total Property, Plant and Equipment', nonCurrentAssetsTotal, priorNonCurrentAssetsTotal);
  }
  
  // TOTAL ASSETS
  renderGrandTotal('TOTAL ASSETS', currentBS.totalAssets, priorBS?.totalAssets);
  
  yPos += 5;
  
  // LIABILITIES AND EQUITY
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(t.liabAndEquity, margin, yPos);
  yPos += 8;
  
  /**
   * LIABILITY CLASSIFICATION LOGIC - ASPE/GAAP COMPLIANT
   * -----------------------------------------------------
   * Current Liabilities: Due within 12 months (is_current = true)
   * Non-current Liabilities: Long-term debt (is_current = false)
   * 
   * Classification Priority:
   * 1. Use the `is_current` database field (primary source of truth)
   * 2. Fallback: Account code prefix (2-02 = non-current, 2-01 = current)
   * 3. Fallback: Account name patterns for long-term items
   */
  const isNonCurrentLiability = (l: { name: string; is_current?: boolean; code?: string }) => {
    // Primary: Use the is_current database field
    if (l.is_current === false) return true;
    if (l.is_current === true) return false;
    
    // Fallback: Account code prefix (2-02 typically indicates non-current)
    if (l.code?.startsWith('2-02')) return true;
    
    // Fallback: Name-based classification for common long-term items
    const nameLower = l.name.toLowerCase();
    const longTermPatterns = ['long-term', 'long term', 'mortgage', 'bonds payable', 'debentures'];
    
    return longTermPatterns.some(pattern => nameLower.includes(pattern));
  };
  
  // Separate current and non-current liabilities using proper classification logic
  // Merge current + prior liabilities so prior-only accounts are not dropped
  const allMergedLiabilities = mergeBalanceSheetAccounts(currentBS.liabilities, priorBS?.liabilities);
  const currentLiabilities = allMergedLiabilities.filter(l => !isNonCurrentLiability(l));
  const nonCurrentLiabilities = allMergedLiabilities.filter(l => isNonCurrentLiability(l));
  
  if (currentLiabilities.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Current Liabilities', margin, yPos);
    yPos += 6;
    
    doc.setFont('helvetica', 'normal');
    let currentLiabTotal = 0;
    let priorCurrentLiabTotal = 0;
    
    currentLiabilities.forEach(liability => {
      currentLiabTotal += liability.currentBalance;
      priorCurrentLiabTotal += liability.priorBalance;
      if (!shouldHideLine(liability.currentBalance, liability.priorBalance)) {
        renderLineItem(liability.name, liability.currentBalance, liability.priorBalance || undefined, 5);
      }
    });
    
    renderSubtotal('Total Current Liabilities', currentLiabTotal, priorCurrentLiabTotal);
  }
  
  // Non-current Liabilities
  if (nonCurrentLiabilities.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Non-current Liabilities', margin, yPos);
    yPos += 6;
    
    doc.setFont('helvetica', 'normal');
    let nonCurrentLiabTotal = 0;
    let priorNonCurrentLiabTotal = 0;
    
    nonCurrentLiabilities.forEach(liability => {
      nonCurrentLiabTotal += liability.currentBalance;
      priorNonCurrentLiabTotal += liability.priorBalance;
      if (!shouldHideLine(liability.currentBalance, liability.priorBalance)) {
        renderLineItem(liability.name, liability.currentBalance, liability.priorBalance || undefined, 5);
      }
    });
    
    renderSubtotal('Total Non-current Liabilities', nonCurrentLiabTotal, priorNonCurrentLiabTotal);
  }
  
  // TOTAL LIABILITIES
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('TOTAL LIABILITIES', margin, yPos);
  if (hasComparative) {
    doc.text(formatCurrency(currentBS.totalLiabilities), col1End, yPos, { align: 'right' });
    doc.text(formatCurrency(priorBS?.totalLiabilities ?? 0), col2End, yPos, { align: 'right' });
    drawSingleLine(yPos + 1.5, col1Start, col1End);
    drawSingleLine(yPos + 1.5, col2Start, col2End);
  } else {
    doc.text(formatCurrency(currentBS.totalLiabilities), singleColEnd, yPos, { align: 'right' });
    drawSingleLine(yPos + 1.5, col1Start, singleColEnd);
  }
  yPos += 10;
  
  // EQUITY
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(t.equity, margin, yPos);
  yPos += 6;
  
  doc.setFont('helvetica', 'normal');

  // Canonical formula (matches BalanceSheet.tsx and AICompilationDialog validation):
  //   totalEquity = Σ(equity excluding RE + CYE, signed by normal_balance) + reClosingBalance
  // reClosingBalance comes from the Statement of Retained Earnings RPC — it
  // already contains Net Income and prior direct RE adjustments, so we must
  // NOT render a separate "Current Year Earnings" line here.
  const hasReClosing = typeof currentBS.reClosingBalance === 'number';

  // Filter out RE and CYE from the displayed equity account list. If we don't
  // have a canonical RE closing balance from the RPC, fall back to the legacy
  // behavior so older callers keep working.
  const equityToRender = mergeBalanceSheetAccounts(
    hasReClosing ? currentBS.equity.filter(a => !isRetainedEarningsOrCYE(a)) : currentBS.equity,
    hasReClosing && priorBS ? priorBS.equity.filter(a => !isRetainedEarningsOrCYE(a)) : priorBS?.equity,
  );
  equityToRender.forEach(eq => {
    if (!shouldHideLine(eq.currentBalance, eq.priorBalance)) {
      renderLineItem(eq.name, eq.currentBalance, eq.priorBalance || undefined, 5);
    }
  });

  let totalEquityCurrent: number;
  let totalEquityPrior: number;

  if (hasReClosing) {
    const reCurrent = currentBS.reClosingBalance ?? 0;
    const rePrior = priorBS?.reClosingBalance ?? 0;
    // Show a single Retained Earnings line at the RE closing balance
    renderLineItem(t.retainedEarnings, reCurrent, priorBS ? rePrior : undefined, 5);

    const otherEquityCurrent = sumEquityExcludingREandCYE(currentBS.equity);
    const otherEquityPrior = priorBS ? sumEquityExcludingREandCYE(priorBS.equity) : 0;
    totalEquityCurrent = otherEquityCurrent + reCurrent;
    totalEquityPrior = otherEquityPrior + rePrior;
  } else {
    // Legacy fallback
    if (currentBS.netIncome !== 0) {
      renderLineItem(t.currentYearEarnings, currentBS.netIncome, priorBS?.netIncome, 5);
    }
    totalEquityCurrent = currentBS.totalEquity + currentBS.netIncome;
    totalEquityPrior = priorBS ? priorBS.totalEquity + priorBS.netIncome : 0;
  }

  renderSubtotal(t.totalEquity, totalEquityCurrent, totalEquityPrior);

  // TOTAL LIABILITIES AND EQUITY
  renderGrandTotal(t.totalLiabAndEquity, currentBS.totalLiabilities + totalEquityCurrent,
    (priorBS?.totalLiabilities ?? 0) + totalEquityPrior);
  
  addPageFooter();

  // ===== COMPARATIVE INCOME STATEMENT =====
  doc.addPage();
  addPageHeader();
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const isHeaderLines = doc.splitTextToSize(orgName.toUpperCase(), headerTextWidth);
  let isHeaderY = headerStartY;
  isHeaderLines.forEach((line: string) => {
    doc.text(line, headerCenterX, isHeaderY, { align: 'center' });
    isHeaderY += 7;
  });
  doc.setFontSize(11);
  doc.text(isInterim ? `INTERIM ${t.statementOfIncome}` : t.statementOfIncome, headerCenterX, isHeaderY + 1, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`For the ${periodEndShort}`, headerCenterX, isHeaderY + 8, { align: 'center' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.text('(Unaudited - See Compilation Engagement Report)', headerCenterX, isHeaderY + 14, { align: 'center' });
  
  yPos = isHeaderY + 25;
  
  // Column headers with underline
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Description', margin, yPos);
  if (hasComparative) {
    doc.text(fiscalYear, col1End, yPos, { align: 'right' });
    doc.text(String(parseInt(fiscalYear) - 1), col2End, yPos, { align: 'right' });
  } else {
    doc.text(fiscalYear, singleColEnd, yPos, { align: 'right' });
  }
  yPos += 2;
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;
  
  const currentIS = financialData.currentYear.incomeStatement;
  const priorIS = financialData.priorYear?.incomeStatement;
  
  // REVENUE
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('REVENUE', margin, yPos);
  yPos += 6;
  
  doc.setFont('helvetica', 'normal');
  mergeAccountLists(currentIS.income, priorIS?.income).forEach(item => {
    if (!shouldHideLine(item.currentAmount, item.priorAmount)) {
      renderLineItem(item.name, item.currentAmount, item.priorAmount, 5);
    }
  });
  
  // Total Revenue with single line (only if more than one revenue item)
  if (currentIS.income.length > 1) {
    renderSubtotal('Total Revenue', currentIS.totalRevenue, priorIS?.totalRevenue);
  } else {
    yPos += 3;
  }
  
  // COST OF GOODS SOLD
  if (currentIS.cogs.length > 0 || (priorIS?.cogs?.length ?? 0) > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('COST OF GOODS SOLD', margin, yPos);
    yPos += 6;
    
    doc.setFont('helvetica', 'normal');
    mergeAccountLists(currentIS.cogs, priorIS?.cogs).forEach(item => {
      if (!shouldHideLine(item.currentAmount, item.priorAmount)) {
        renderLineItem(item.name, item.currentAmount, item.priorAmount, 5);
      }
    });
    
    if (currentIS.cogs.length > 1) {
      renderSubtotal('Total Cost of Goods Sold', currentIS.totalCogs, priorIS?.totalCogs);
    } else {
      // Single underline for the single COGS line
      drawSingleLine(yPos - 4, col1Start, col1End);
      if (hasComparative) {
        drawSingleLine(yPos - 4, col2Start, col2End);
      }
      yPos += 3;
    }
    
    // GROSS PROFIT
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('GROSS PROFIT', margin, yPos);
    if (hasComparative) {
      doc.text(formatCurrency(currentIS.grossProfit), col1End, yPos, { align: 'right' });
      doc.text(formatCurrency(priorIS?.grossProfit ?? 0), col2End, yPos, { align: 'right' });
      drawSingleLine(yPos + 1.5, col1Start, col1End);
      drawSingleLine(yPos + 1.5, col2Start, col2End);
    } else {
      doc.text(formatCurrency(currentIS.grossProfit), singleColEnd, yPos, { align: 'right' });
      drawSingleLine(yPos + 1.5, col1Start, singleColEnd);
    }
    
    // Gross Profit Margin percentage
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const gpMarginCurrent = currentIS.totalRevenue > 0 ? Math.round((currentIS.grossProfit / currentIS.totalRevenue) * 100) : 0;
    const gpMarginPrior = (priorIS?.totalRevenue ?? 0) > 0 ? Math.round(((priorIS?.grossProfit ?? 0) / (priorIS?.totalRevenue ?? 1)) * 100) : 0;
    doc.text('Gross Profit Margin', margin + 5, yPos);
    if (hasComparative) {
      doc.text(`${gpMarginCurrent}%`, col1End, yPos, { align: 'right' });
      doc.text(`${gpMarginPrior}%`, col2End, yPos, { align: 'right' });
    } else {
      doc.text(`${gpMarginCurrent}%`, singleColEnd, yPos, { align: 'right' });
    }
    yPos += 8;
  }
  
  // OPERATING EXPENSES
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('OPERATING EXPENSES', margin, yPos);
  yPos += 6;
  
  doc.setFont('helvetica', 'normal');
  mergeAccountLists(currentIS.expenses, priorIS?.expenses).forEach(item => {
    if (yPos > pageHeight - 40) {
      addNewPage();
      yPos = 30;
    }
    if (!shouldHideLine(item.currentAmount, item.priorAmount)) {
      renderLineItem(item.name, item.currentAmount, item.priorAmount, 5);
    }
  });
  
  renderSubtotal('Total Operating Expenses', currentIS.totalExpenses, priorIS?.totalExpenses);
  
  // PROFIT BEFORE TAX / INCOME FROM OPERATIONS
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(t.profitBeforeTax, margin, yPos);
  if (hasComparative) {
    doc.text(formatCurrency(currentIS.operatingIncome), col1End, yPos, { align: 'right' });
    doc.text(formatCurrency(priorIS?.operatingIncome ?? 0), col2End, yPos, { align: 'right' });
    drawSingleLine(yPos + 1.5, col1Start, col1End);
    drawSingleLine(yPos + 1.5, col2Start, col2End);
  } else {
    doc.text(formatCurrency(currentIS.operatingIncome), singleColEnd, yPos, { align: 'right' });
    drawSingleLine(yPos + 1.5, col1Start, singleColEnd);
  }
  yPos += 8;
  
  // Other Income/Expenses
  if (currentIS.otherIncome.length > 0 || currentIS.otherExpenses.length > 0 || (priorIS?.otherIncome?.length ?? 0) > 0 || (priorIS?.otherExpenses?.length ?? 0) > 0) {
    doc.setFont('helvetica', 'normal');
    
    mergeAccountLists(currentIS.otherIncome, priorIS?.otherIncome).forEach(item => {
      if (!shouldHideLine(item.currentAmount, item.priorAmount)) {
        renderLineItem(item.name, item.currentAmount, item.priorAmount);
      }
    });
    
    mergeAccountLists(currentIS.otherExpenses, priorIS?.otherExpenses).forEach(item => {
      if (!shouldHideLine(item.currentAmount, item.priorAmount)) {
        renderLineItem(item.name, -item.currentAmount, -item.priorAmount);
      }
    });
    yPos += 3;
  }
  
  // NET INCOME
  renderGrandTotal(t.netIncome, currentIS.netIncome, priorIS?.netIncome);
  
  addPageFooter();

  // ===== STATEMENT OF CHANGES IN EQUITY =====
  doc.addPage();
  addPageHeader();
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const eqHeaderLines = doc.splitTextToSize(orgName.toUpperCase(), headerTextWidth);
  let eqHeaderY = headerStartY;
  eqHeaderLines.forEach((line: string) => {
    doc.text(line, headerCenterX, eqHeaderY, { align: 'center' });
    eqHeaderY += 7;
  });
  doc.setFontSize(11);
  doc.text(isInterim ? `INTERIM ${t.statementOfEquity}` : t.statementOfEquity, headerCenterX, eqHeaderY + 1, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`For the ${periodEndShort}`, headerCenterX, eqHeaderY + 8, { align: 'center' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.text('(Unaudited - See Compilation Engagement Report)', headerCenterX, eqHeaderY + 14, { align: 'center' });
  
  yPos = eqHeaderY + 28;
  
  // Multi-column layout for Changes in Equity
  const descCol = margin;
  const shareCapitalCol = pageWidth - margin - 90;
  const retainedCol = pageWidth - margin - 45;
  const totalEquityCol = pageWidth - margin;
  
  // Column headers
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Description', descCol, yPos);
  if (!isASNPO) {
    doc.text(t.commonShares, shareCapitalCol, yPos, { align: 'right' });
  }
  doc.text(t.retainedEarnings, retainedCol, yPos, { align: 'right' });
  doc.text(t.totalEquity, totalEquityCol, yPos, { align: 'right' });
  yPos += 2;
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;
  
  // Find equity components — for ASNPO, no share capital exists; all goes through unrestricted net assets
  const commonShares = isASNPO ? undefined : currentBS.equity.find(e => {
    const n = e.name.toLowerCase();
    return n.includes('common') || n.includes('share capital');
  });
  const retainedEarnings = currentBS.equity.find(e => {
    const n = e.name.toLowerCase();
    return isASNPO
      ? (n.includes('unrestricted net assets') || n.includes('accumulated surplus') || n.includes('unrestricted funds'))
      : n.includes('retained earnings');
  });
  
  // Use RPC-provided opening RE (accurate rollforward), fallback to RE account balance
  const openingRECurrent = financialData.retainedEarningsOpening ?? (retainedEarnings?.calculated_balance || 0);
  
  // Share capital: use proper opening/contributions if provided, else fallback to BS balance.
  // If the fetched share-capital totals are zero but the BS shows a non-zero Common Shares
  // balance (org tagging incomplete), treat BS balance as opening so SoCE matches BS.
  const bsCommonSharesCurrent = commonShares?.calculated_balance || 0;
  const fetchedScOpeningCurrent = financialData.shareCapitalOpening ?? 0;
  const fetchedScContribCurrent = financialData.shareCapitalContributions ?? 0;
  const scOpeningCurrent = (fetchedScOpeningCurrent + fetchedScContribCurrent === 0 && bsCommonSharesCurrent !== 0)
    ? bsCommonSharesCurrent
    : fetchedScOpeningCurrent;
  const scContributionsCurrent = (fetchedScOpeningCurrent + fetchedScContribCurrent === 0 && bsCommonSharesCurrent !== 0)
    ? 0
    : fetchedScContribCurrent;
  const scClosingCurrent = scOpeningCurrent + scContributionsCurrent;
  
  // Prior year equity components for comparative SOCE — skip share capital for ASNPO
  const priorCommonShares = isASNPO ? undefined : priorBS?.equity.find(e => {
    const n = e.name.toLowerCase();
    return n.includes('common') || n.includes('share capital');
  });
  const priorRetainedEarnings = priorBS?.equity.find(e => {
    const n = e.name.toLowerCase();
    return isASNPO
      ? (n.includes('unrestricted net assets') || n.includes('accumulated surplus') || n.includes('unrestricted funds'))
      : n.includes('retained earnings');
  });
  const openingREPrior = financialData.priorRetainedEarningsOpening ?? (priorRetainedEarnings?.calculated_balance || 0);
  const bsCommonSharesPrior = priorCommonShares?.calculated_balance || 0;
  const fetchedScOpeningPrior = financialData.priorShareCapitalOpening ?? 0;
  const fetchedScContribPrior = financialData.priorShareCapitalContributions ?? 0;
  const scOpeningPrior = (fetchedScOpeningPrior + fetchedScContribPrior === 0 && bsCommonSharesPrior !== 0)
    ? bsCommonSharesPrior
    : fetchedScOpeningPrior;
  const scContributionsPrior = (fetchedScOpeningPrior + fetchedScContribPrior === 0 && bsCommonSharesPrior !== 0)
    ? 0
    : fetchedScContribPrior;
  const scClosingPrior = scOpeningPrior + scContributionsPrior;

  
  // Helper to render a single year's SOCE block
  // actualClosingRE: if provided, any delta between (reOpening + netIncome) and actualClosingRE
  // is disclosed as a "Prior period adjustment" line (ASPE 1506 / IAS 8)
  const renderSOCEYear = (
    yearLabel: string,
    scOpening: number, scContrib: number, scClosing: number,
    reOpening: number, netIncome: number,
    actualClosingRE?: number
  ) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`Year Ended ${yearLabel}`, descCol, yPos);
    yPos += 7;
    
    // Opening balance
    doc.setFont('helvetica', 'normal');
    doc.text('Balance, beginning of year', descCol, yPos);
    if (!isASNPO) {
      doc.text(formatCurrency(scOpening, true), shareCapitalCol, yPos, { align: 'right' });
    }
    doc.text(formatCurrency(isASNPO ? scOpening + reOpening : reOpening, true), retainedCol, yPos, { align: 'right' });
    doc.text(formatCurrency(scOpening + reOpening, true), totalEquityCol, yPos, { align: 'right' });
    yPos += 6;
    
    // Share issuances / contributions (if any)
    if (scContrib !== 0) {
      doc.text(t.shareIssuances, descCol + 8, yPos);
      if (!isASNPO) {
        doc.text(formatCurrency(scContrib), shareCapitalCol, yPos, { align: 'right' });
        doc.text('–', retainedCol, yPos, { align: 'right' });
      } else {
        doc.text(formatCurrency(scContrib), retainedCol, yPos, { align: 'right' });
      }
      doc.text(formatCurrency(scContrib), totalEquityCol, yPos, { align: 'right' });
      yPos += 6;
    }
    
    // Net income / excess (deficiency)
    doc.text(t.netIncomeLower, descCol + 8, yPos);
    if (!isASNPO) {
      doc.text('–', shareCapitalCol, yPos, { align: 'right' });
    }
    doc.text(formatCurrency(netIncome), retainedCol, yPos, { align: 'right' });
    doc.text(formatCurrency(netIncome), totalEquityCol, yPos, { align: 'right' });
    yPos += 6;
    
    // Prior-period adjustment (if actual closing RE differs from opening + net income)
    // Discloses direct-to-Retained-Earnings activity per ASPE 1506 / IAS 8
    let priorPeriodAdj = 0;
    if (actualClosingRE !== undefined) {
      priorPeriodAdj = actualClosingRE - (reOpening + netIncome);
      if (Math.abs(priorPeriodAdj) > 0.5) {
        doc.text('Prior period adjustment', descCol + 8, yPos);
        if (!isASNPO) {
          doc.text('–', shareCapitalCol, yPos, { align: 'right' });
        }
        doc.text(formatCurrency(priorPeriodAdj), retainedCol, yPos, { align: 'right' });
        doc.text(formatCurrency(priorPeriodAdj), totalEquityCol, yPos, { align: 'right' });
        yPos += 6;
      }
    }
    
    yPos += 2;
    if (!isASNPO) {
      drawSingleLine(yPos, shareCapitalCol - 25, shareCapitalCol);
    }
    drawSingleLine(yPos, retainedCol - 30, retainedCol);
    drawSingleLine(yPos, totalEquityCol - 25, totalEquityCol);
    yPos += 6;
    
    // Closing balance
    const reClosing = actualClosingRE !== undefined ? actualClosingRE : (reOpening + netIncome);
    doc.setFont('helvetica', 'bold');
    doc.text('Balance, end of year', descCol, yPos);
    if (!isASNPO) {
      doc.text(formatCurrency(scClosing, true), shareCapitalCol, yPos, { align: 'right' });
    }
    doc.text(formatCurrency(isASNPO ? scClosing + reClosing : reClosing, true), retainedCol, yPos, { align: 'right' });
    doc.text(formatCurrency(scClosing + reClosing, true), totalEquityCol, yPos, { align: 'right' });
    yPos += 2;
    if (!isASNPO) {
      drawDoubleLine(yPos, shareCapitalCol - 25, shareCapitalCol);
    }
    drawDoubleLine(yPos, retainedCol - 30, retainedCol);
    drawDoubleLine(yPos, totalEquityCol - 25, totalEquityCol);
    yPos += 12;
  };
  
  // Actual RE closing balances (from ledger) for prior-period adjustment disclosure
  // Prior year closing RE = opening RE of current year (year N closing = year N+1 opening)
  const priorActualClosingRE = openingRECurrent;
  // Current year closing RE = RE account balance at report date
  const currentActualClosingRE = retainedEarnings?.calculated_balance;
  
  // Render comparative SOCE: prior year first (if available), then current year
  if (hasComparative && priorBS) {
    renderSOCEYear(
      format(subYears(parseISO(compilation.fiscal_year_end), 1), 'MMMM d, yyyy'),
      scOpeningPrior, scContributionsPrior, scClosingPrior,
      openingREPrior, priorBS.netIncome,
      priorActualClosingRE
    );
  }
  
  // --- Current Year SOCE ---
  renderSOCEYear(
    format(parseISO(compilation.fiscal_year_end), 'MMMM d, yyyy'),
    scOpeningCurrent, scContributionsCurrent, scClosingCurrent,
    openingRECurrent, currentIS.netIncome,
    currentActualClosingRE
  );
  
  addPageFooter();

  // ===== STATEMENT OF CASH FLOWS (Indirect Method) =====
  const currentCashFlow = financialData.currentYear.cashFlow;
  const priorCashFlow = financialData.priorYear?.cashFlow;
  
  if (currentCashFlow) {
    doc.addPage();
    addPageHeader();
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const cfHeaderLines = doc.splitTextToSize(orgName.toUpperCase(), headerTextWidth);
    let cfHeaderY = headerStartY;
    cfHeaderLines.forEach((line: string) => {
      doc.text(line, headerCenterX, cfHeaderY, { align: 'center' });
      cfHeaderY += 7;
    });
    doc.setFontSize(11);
    doc.text(isInterim ? 'INTERIM Statement of Cash Flows' : 'Statement of Cash Flows', headerCenterX, cfHeaderY + 1, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`For the ${periodEndShort}`, headerCenterX, cfHeaderY + 8, { align: 'center' });
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text('(Unaudited - See Compilation Engagement Report)', headerCenterX, cfHeaderY + 14, { align: 'center' });
    
    yPos = cfHeaderY + 25;
    
    // Column headers with underline
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Description', margin, yPos);
    if (hasComparative && priorCashFlow) {
      doc.text(fiscalYear, col1End, yPos, { align: 'right' });
      doc.text(String(parseInt(fiscalYear) - 1), col2End, yPos, { align: 'right' });
    } else {
      doc.text(fiscalYear, singleColEnd, yPos, { align: 'right' });
    }
    yPos += 2;
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;
    
    // Helper for cash flow line items
    const renderCashFlowItem = (label: string, currentVal: number, priorVal?: number, indent: number = 0, isBold: boolean = false) => {
      if (yPos > pageHeight - 40) {
        addNewPage();
        yPos = 30;
      }
      
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setFontSize(9);
      doc.text(label, margin + indent, yPos);
      
      if (hasComparative && priorCashFlow) {
        doc.text(formatCurrency(currentVal), col1End, yPos, { align: 'right' });
        doc.text(formatCurrency(priorVal ?? 0), col2End, yPos, { align: 'right' });
      } else {
        doc.text(formatCurrency(currentVal), singleColEnd, yPos, { align: 'right' });
      }
      yPos += 5.5;
    };
    
    // OPERATING ACTIVITIES
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('CASH FLOWS FROM OPERATING ACTIVITIES', margin, yPos);
    yPos += 7;
    
    // --- Helper: merge current + prior cash-flow line items by key (not index) ---
    const mergeCashFlowRows = (
      currentItems: { name: string; amount: number }[],
      priorItems: { name: string; amount: number }[] | undefined,
      sectionType: 'operating' | 'investing' | 'financing'
    ): { label: string; currentAmount: number; priorAmount: number }[] => {
      const normalizeKey = (label: string): string => {
        let key = label.trim().toLowerCase();
        if (sectionType === 'investing') {
          // Strip directional prefixes so "Purchase of X" and "Sale of X" both key to "x"
          key = key.replace(/^(purchase of|sale of|proceeds from sale of|proceeds from)\s+/i, '');
        }
        return key;
      };

      const merged: { label: string; currentAmount: number; priorAmount: number }[] = [];
      const usedPriorKeys = new Set<string>();

      // 1) Walk current items in order
      for (const item of currentItems) {
        const key = normalizeKey(item.name);
        const priorMatch = priorItems?.find(p => normalizeKey(p.name) === key);
        if (priorMatch) usedPriorKeys.add(normalizeKey(priorMatch.name));
        merged.push({
          label: item.name,
          currentAmount: item.amount,
          priorAmount: priorMatch?.amount ?? 0,
        });
      }

      // 2) Append prior-only items (so nothing disappears)
      if (priorItems) {
        for (const priorItem of priorItems) {
          const key = normalizeKey(priorItem.name);
          if (!usedPriorKeys.has(key)) {
            merged.push({
              label: priorItem.name,
              currentAmount: 0,
              priorAmount: priorItem.amount,
            });
          }
        }
      }

      return merged;
    };

    // OPERATING rows
    const operatingRows = mergeCashFlowRows(
      currentCashFlow.operatingActivities,
      priorCashFlow?.operatingActivities,
      'operating'
    );
    doc.setFont('helvetica', 'normal');
    operatingRows.forEach(row => {
      renderCashFlowItem(row.label, row.currentAmount, row.priorAmount, 5);
    });
    
    // Net Operating subtotal
    renderSubtotal('Net Cash from Operating Activities', currentCashFlow.netOperating, priorCashFlow?.netOperating);
    yPos += 3;
    
    // INVESTING ACTIVITIES
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('CASH FLOWS FROM INVESTING ACTIVITIES', margin, yPos);
    yPos += 7;
    
    const investingRows = mergeCashFlowRows(
      currentCashFlow.investingActivities,
      priorCashFlow?.investingActivities,
      'investing'
    );
    doc.setFont('helvetica', 'normal');
    if (investingRows.length > 0) {
      investingRows.forEach(row => {
        renderCashFlowItem(row.label, row.currentAmount, row.priorAmount, 5);
      });
    } else {
      doc.setFontSize(9);
      doc.text('None', margin + 5, yPos);
      yPos += 5.5;
    }
    
    // Net Investing subtotal
    renderSubtotal('Net Cash from Investing Activities', currentCashFlow.netInvesting, priorCashFlow?.netInvesting);
    yPos += 3;
    
    // FINANCING ACTIVITIES
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('CASH FLOWS FROM FINANCING ACTIVITIES', margin, yPos);
    yPos += 7;
    
    const financingRows = mergeCashFlowRows(
      currentCashFlow.financingActivities,
      priorCashFlow?.financingActivities,
      'financing'
    );
    doc.setFont('helvetica', 'normal');
    if (financingRows.length > 0) {
      financingRows.forEach(row => {
        renderCashFlowItem(row.label, row.currentAmount, row.priorAmount, 5);
      });
    } else {
      doc.setFontSize(9);
      doc.text('None', margin + 5, yPos);
      yPos += 5.5;
    }
    
    // Net Financing subtotal
    renderSubtotal('Net Cash from Financing Activities', currentCashFlow.netFinancing, priorCashFlow?.netFinancing);
    yPos += 5;
    
    // NET CHANGE IN CASH
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('NET CHANGE IN CASH', margin, yPos);
    if (hasComparative && priorCashFlow) {
      doc.text(formatCurrency(currentCashFlow.netChange), col1End, yPos, { align: 'right' });
      doc.text(formatCurrency(priorCashFlow.netChange), col2End, yPos, { align: 'right' });
    } else {
      doc.text(formatCurrency(currentCashFlow.netChange), singleColEnd, yPos, { align: 'right' });
    }
    yPos += 8;
    
    // Beginning cash
    doc.setFont('helvetica', 'normal');
    renderCashFlowItem('Cash at beginning of period', currentCashFlow.beginningCash, priorCashFlow?.beginningCash);
    
    // ENDING CASH (with double line)
    renderGrandTotal('CASH AT END OF PERIOD', currentCashFlow.endingCash, priorCashFlow?.endingCash);
    
    // ===== Supplemental Disclosure of Non-Cash Investing and Financing Activities =====
    // Required under ASPE §1540.46 / IAS 7.43 / ASC 230-10-50-3
    const currentNonCash = currentCashFlow.nonCashActivities || [];
    const priorNonCash = priorCashFlow?.nonCashActivities || [];
    if (currentNonCash.length > 0 || priorNonCash.length > 0) {
      yPos += 8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      const disclosureTitle = doc.splitTextToSize('Supplemental Disclosure of Non-Cash Investing and Financing Activities', pageWidth - margin * 2);
      disclosureTitle.forEach((line: string) => {
        doc.text(line, margin, yPos);
        yPos += 5;
      });
      yPos += 1;
      doc.setFont('helvetica', 'normal');
      const nonCashRows = mergeCashFlowRows(currentNonCash, priorNonCash, 'financing');
      nonCashRows.forEach(row => {
        renderCashFlowItem(row.label, row.currentAmount, row.priorAmount, 5);
      });
    }
    
    addPageFooter();
  }


  // ===== NOTES TO FINANCIAL STATEMENTS =====
  doc.addPage();
  addPageHeader();
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const ntHeaderLines = doc.splitTextToSize(orgName.toUpperCase(), headerTextWidth);
  let ntHeaderY = headerStartY;
  ntHeaderLines.forEach((line: string) => {
    doc.text(line, headerCenterX, ntHeaderY, { align: 'center' });
    ntHeaderY += 7;
  });
  doc.setFontSize(11);
  doc.text('NOTES TO FINANCIAL STATEMENTS', headerCenterX, ntHeaderY + 1, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text(periodEndFormatted, headerCenterX, ntHeaderY + 8, { align: 'center' });
  
  yPos = ntHeaderY + 20;
  let noteNum = 1;
  
  // Track if we have fixed assets data - if so, skip the static 'ppe' note template
  // to avoid duplication with the comprehensive PPE note that includes the schedule
  const hasFixedAssetsNote = financialData.fixedAssets && financialData.fixedAssets.currentYear.length > 0;
  
  noteTemplateIds.forEach(noteId => {
    // Skip the static 'ppe' note if we'll be rendering the comprehensive fixed assets note
    if (noteId === 'ppe' && hasFixedAssetsNote) {
      return;
    }
    // Skip the static 'finance_lease' note if we have actual lease data
    if (noteId === 'finance_lease' && financialData.leaseNotes && financialData.leaseNotes.length > 0) {
      return;
    }
    
    const note = getFrameworkNoteTemplates(accountingFramework || 'ASPE').find(n => n.id === noteId);
    if (note) {
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
      
      if (yPos + splitNote.length * 4.5 > pageHeight - 40) {
        addNewPage();
        yPos = 30;
      }
      
      doc.text(splitNote, margin, yPos);
      yPos += splitNote.length * 4.5 + 10;
      noteNum++;
    }
  });

  // ===== PROPERTY, PLANT & EQUIPMENT NOTE =====
  if (financialData.fixedAssets && financialData.fixedAssets.currentYear.length > 0) {
    if (yPos > pageHeight - 120) {
      addNewPage();
      yPos = 30;
    }
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`${noteNum}. Property, Plant and Equipment`, margin, yPos);
    yPos += 8;
    
    // Introductory text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const introText = 'Property, plant, and equipment are recorded at cost. Amortization is provided over the estimated useful lives of the assets using the following methods and rates:';
    const splitIntro = doc.splitTextToSize(introText, contentWidth);
    doc.text(splitIntro, margin, yPos);
    yPos += splitIntro.length * 4.5 + 5;
    
    // Depreciation methods list
    const methodsUsed = new Map<string, { method: string; rate: string }>();
    financialData.fixedAssets.currentYear.forEach(asset => {
      if (!methodsUsed.has(asset.assetClass)) {
        methodsUsed.set(asset.assetClass, { 
          method: asset.depreciationMethod, 
          rate: asset.depreciationRate 
        });
      }
    });
    
    methodsUsed.forEach((info, assetClass) => {
      const methodText = `• ${assetClass}: ${info.rate} ${info.method}`;
      doc.text(methodText, margin + 5, yPos);
      yPos += 5;
    });
    
    yPos += 5;
    
    // Check for page break before table
    if (yPos > pageHeight - 80) {
      addNewPage();
      yPos = 30;
    }
    
    // Table header - PPE schedule
    const ppeDescColWidth = contentWidth * 0.24;
    const ppeAmountColWidth = contentWidth * 0.19;
    
    // Calculate column positions for 5-column table
    const ppeCol1End = margin + ppeDescColWidth;
    const ppeCol2End = ppeCol1End + ppeAmountColWidth;
    const ppeCol3End = ppeCol2End + ppeAmountColWidth;
    const ppeCol4End = ppeCol3End + ppeAmountColWidth;
    const ppeCol5End = pageWidth - margin;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Asset Class', margin, yPos);
    doc.text('Cost ($)', ppeCol2End - 5, yPos, { align: 'right' });
    doc.text('Accumulated', ppeCol3End - 5, yPos, { align: 'right' });
    doc.text(`${fiscalYear} Net`, ppeCol4End - 5, yPos, { align: 'right' });
    if (hasComparative) {
      doc.text(`${parseInt(fiscalYear) - 1} Net`, ppeCol5End, yPos, { align: 'right' });
    }
    yPos += 4;
    doc.text('', ppeCol3End - 5, yPos, { align: 'right' });
    doc.text('Amortization ($)', ppeCol3End - 5, yPos, { align: 'right' });
    doc.text('Book Value ($)', ppeCol4End - 5, yPos, { align: 'right' });
    if (hasComparative) {
      doc.text('Book Value ($)', ppeCol5End, yPos, { align: 'right' });
    }
    yPos += 2;
    
    // Header underline
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;
    
    // Table rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    
    // Helper to format accumulated amortization with parentheses (contra-asset display)
    const formatAccumAmort = (amount: number): string => {
      if (Math.abs(amount) < 0.01) return '–';
      const absAmount = Math.abs(amount);
      const formatted = absAmount.toLocaleString('en-CA', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
      return `(${formatted})`;
    };
    
    financialData.fixedAssets.currentYear.forEach((asset, idx) => {
      if (yPos > pageHeight - 40) {
        addNewPage();
        yPos = 30;
      }
      
      const priorAsset = financialData.fixedAssets?.priorYear?.[idx];
      
      doc.text(asset.assetClass, margin, yPos);
      doc.text(formatCurrency(asset.acquisitionCost), ppeCol2End - 5, yPos, { align: 'right' });
      // Use parentheses for accumulated amortization (contra-asset per GAAP)
      doc.text(formatAccumAmort(asset.accumulatedAmortization), ppeCol3End - 5, yPos, { align: 'right' });
      doc.text(formatCurrency(asset.netBookValue), ppeCol4End - 5, yPos, { align: 'right' });
      if (hasComparative && priorAsset) {
        doc.text(formatCurrency(priorAsset.netBookValue), ppeCol5End, yPos, { align: 'right' });
      } else if (hasComparative) {
        doc.text('–', ppeCol5End, yPos, { align: 'right' });
      }
      yPos += 5;
    });
    
    // Total row
    yPos += 2;
    doc.setFont('helvetica', 'bold');
    doc.text('Total', margin, yPos);
    doc.text(formatCurrency(financialData.fixedAssets.totalCost), ppeCol2End - 5, yPos, { align: 'right' });
    // Use parentheses for total accumulated amortization (contra-asset per GAAP)
    doc.text(formatAccumAmort(financialData.fixedAssets.totalAccumulatedAmortization), ppeCol3End - 5, yPos, { align: 'right' });
    doc.text(formatCurrency(financialData.fixedAssets.totalNetBookValue), ppeCol4End - 5, yPos, { align: 'right' });
    if (hasComparative && financialData.fixedAssets.priorTotalNetBookValue !== undefined) {
      doc.text(formatCurrency(financialData.fixedAssets.priorTotalNetBookValue), ppeCol5End, yPos, { align: 'right' });
    }
    
    // Total underline
    yPos += 2;
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    doc.line(margin, yPos + 1.5, pageWidth - margin, yPos + 1.5);
    yPos += 8;
    
    // Additions note
    if (financialData.fixedAssets.currentYearAdditions && financialData.fixedAssets.currentYearAdditions > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const priorAdditions = financialData.fixedAssets.priorYearAdditions 
        ? ` (${parseInt(fiscalYear) - 1}: $${financialData.fixedAssets.priorYearAdditions.toLocaleString()})` 
        : '';
      const additionsText = `During the year, ${t.entity} acquired equipment with a total cost of $${financialData.fixedAssets.currentYearAdditions.toLocaleString()}${priorAdditions}.`;
      const splitAdditions = doc.splitTextToSize(additionsText, contentWidth);
      doc.text(splitAdditions, margin, yPos);
      yPos += splitAdditions.length * 4.5 + 5;
    }
    
    // Impairment note
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const impairmentNote = `• Impairment: No impairment loss was recognized in the current year (${parseInt(fiscalYear) - 1}: $nil).`;
    doc.text(impairmentNote, margin, yPos);
    yPos += 10;
    
    noteNum++;
  }

  // ===== FINANCE LEASE OBLIGATIONS NOTE =====
  if (financialData.leaseNotes && financialData.leaseNotes.length > 0) {
    if (yPos > pageHeight - 120) {
      addNewPage();
      yPos = 30;
    }
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`${noteNum}. Finance Lease Obligations`, margin, yPos);
    yPos += 8;
    
    financialData.leaseNotes.forEach(lease => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      
      const leaseIntro = `${t.entityCap} has a finance lease obligation for a ${lease.leaseName}, ` +
        `commencing ${format(parseISO(lease.commencementDate), 'MMMM d, yyyy')} and expiring ` +
        `${format(parseISO(lease.endDate), 'MMMM d, yyyy')}. ` +
        `Payments of $${lease.paymentAmount.toLocaleString('en-CA', { minimumFractionDigits: 2 })} are made ${lease.paymentFrequency}, ` +
        `bearing interest at ${lease.discountRate}% per annum. ` +
        `The right-of-use asset was initially recognized at $${Math.round(lease.rouAssetInitial).toLocaleString('en-CA')}.`;
      
      const splitIntro = doc.splitTextToSize(leaseIntro, contentWidth);
      if (yPos + splitIntro.length * 4.5 > pageHeight - 80) {
        addNewPage();
        yPos = 30;
      }
      doc.text(splitIntro, margin, yPos);
      yPos += splitIntro.length * 4.5 + 8;
      
      // Lease liability breakdown table
      if (yPos > pageHeight - 80) {
        addNewPage();
        yPos = 30;
      }
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Finance lease obligations consist of:', margin, yPos);
      yPos += 7;
      
      const leaseCol1End = margin + contentWidth * 0.55;
      const leaseCol2End = margin + contentWidth * 0.77;
      const leaseCol3End = pageWidth - margin;
      
      // Header
      doc.setFontSize(8);
      doc.text('', margin, yPos);
      if (hasComparative) {
        doc.text(fiscalYear, leaseCol2End, yPos, { align: 'right' });
        doc.text(String(parseInt(fiscalYear) - 1), leaseCol3End, yPos, { align: 'right' });
      } else {
        doc.text(fiscalYear, leaseCol3End, yPos, { align: 'right' });
      }
      yPos += 2;
      doc.setLineWidth(0.3);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 5;
      
      doc.setFont('helvetica', 'normal');
      
      // Current portion
      doc.text('Current portion of finance lease', margin, yPos);
      if (hasComparative) {
        doc.text(formatCurrency(lease.currentPortionCurrent), leaseCol2End, yPos, { align: 'right' });
        doc.text(formatCurrency(lease.currentPortionPrior), leaseCol3End, yPos, { align: 'right' });
      } else {
        doc.text(formatCurrency(lease.currentPortionCurrent), leaseCol3End, yPos, { align: 'right' });
      }
      yPos += 5;
      
      // Non-current portion
      doc.text('Non-current portion of finance lease', margin, yPos);
      if (hasComparative) {
        doc.text(formatCurrency(lease.nonCurrentPortionCurrent), leaseCol2End, yPos, { align: 'right' });
        doc.text(formatCurrency(lease.nonCurrentPortionPrior), leaseCol3End, yPos, { align: 'right' });
      } else {
        doc.text(formatCurrency(lease.nonCurrentPortionCurrent), leaseCol3End, yPos, { align: 'right' });
      }
      yPos += 2;
      doc.setLineWidth(0.3);
      doc.line(leaseCol2End - 30, yPos, leaseCol2End, yPos);
      if (hasComparative) doc.line(leaseCol3End - 30, yPos, leaseCol3End, yPos);
      yPos += 5;
      
      // Total
      doc.setFont('helvetica', 'bold');
      doc.text('Total finance lease obligation', margin, yPos);
      if (hasComparative) {
        doc.text(formatCurrency(lease.currentLiabilityTotal), leaseCol2End, yPos, { align: 'right' });
        doc.text(formatCurrency(lease.priorLiabilityTotal), leaseCol3End, yPos, { align: 'right' });
      } else {
        doc.text(formatCurrency(lease.currentLiabilityTotal), leaseCol3End, yPos, { align: 'right' });
      }
      yPos += 2;
      doc.setLineWidth(0.3);
      doc.line(leaseCol2End - 30, yPos, leaseCol2End, yPos);
      doc.line(leaseCol2End - 30, yPos + 1.5, leaseCol2End, yPos + 1.5);
      if (hasComparative) {
        doc.line(leaseCol3End - 30, yPos, leaseCol3End, yPos);
        doc.line(leaseCol3End - 30, yPos + 1.5, leaseCol3End, yPos + 1.5);
      }
      yPos += 10;
      
      // Interest expense
      doc.setFont('helvetica', 'normal');
      const interestText = `Interest expense on finance lease obligations for the year was $${Math.round(lease.totalInterestCurrent).toLocaleString('en-CA')}` +
        (hasComparative ? ` (${parseInt(fiscalYear) - 1}: $${Math.round(lease.totalInterestPrior).toLocaleString('en-CA')}).` : '.');
      doc.text(interestText, margin, yPos);
      yPos += 8;
      
      // Future minimum lease payments maturity schedule
      if (lease.maturitySchedule.length > 0) {
        if (yPos > pageHeight - 80) {
          addNewPage();
          yPos = 30;
        }
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('Future minimum lease payments are as follows:', margin, yPos);
        yPos += 7;
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('Year', margin, yPos);
        doc.text('Amount ($)', leaseCol2End, yPos, { align: 'right' });
        yPos += 2;
        doc.setLineWidth(0.3);
        doc.line(margin, yPos, leaseCol2End, yPos);
        yPos += 5;
        
        doc.setFont('helvetica', 'normal');
        let totalFuture = 0;
        lease.maturitySchedule.forEach(entry => {
          if (yPos > pageHeight - 30) {
            addNewPage();
            yPos = 30;
          }
          doc.text(entry.year, margin, yPos);
          doc.text(formatCurrency(entry.amount), leaseCol2End, yPos, { align: 'right' });
          totalFuture += entry.amount;
          yPos += 5;
        });
        
        // Total future payments
        yPos += 2;
        doc.setFont('helvetica', 'bold');
        doc.text('Total', margin, yPos);
        doc.text(formatCurrency(totalFuture), leaseCol2End, yPos, { align: 'right' });
        yPos += 2;
        doc.setLineWidth(0.3);
        doc.line(leaseCol2End - 30, yPos, leaseCol2End, yPos);
        doc.line(leaseCol2End - 30, yPos + 1.5, leaseCol2End, yPos + 1.5);
        yPos += 10;
      }
    });
    
    noteNum++;
  }

  // Custom notes
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
    
    // Handle multi-page custom notes
    let customLines = [...splitCustom];
    while (customLines.length > 0) {
      const availableHeight = pageHeight - 40 - yPos;
      const linesPerPage = Math.floor(availableHeight / 4.5);
      const linesToPrint = customLines.splice(0, linesPerPage);
      doc.text(linesToPrint, margin, yPos);
      
      if (customLines.length > 0) {
        addNewPage();
        yPos = 30;
      }
    }
  }
  
  addPageFooter();
  
  // Save
  const fileName = `${orgName.replace(/[^a-zA-Z0-9]/g, '_')}_Financial_Statements_${fiscalYear}${hasComparative ? '_Comparative' : ''}.pdf`;
  doc.save(fileName);
}
