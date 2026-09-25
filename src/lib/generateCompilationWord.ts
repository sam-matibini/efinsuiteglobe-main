import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, Packer, PageBreak, Header, Footer, PageNumber, NumberFormat } from 'docx';
import { format, parseISO } from 'date-fns';
import { CompilationReport, aspeNoteTemplates, getFrameworkNoteTemplates, resolveNoteTemplate, NoteTemplateContext } from '@/hooks/useCompilationReports';
import { isExcludedFromCompilationEquityTotal, sumEquityExcludingREandCYE, type LeaseNoteData } from './generateCompilationPdfEnhanced';

export interface WordExportFinancialData {
  balanceSheet: {
    assets: Array<{ name: string; calculated_balance: number; code?: string; normal_balance?: string }>;
    liabilities: Array<{ name: string; calculated_balance: number; code?: string; normal_balance?: string }>;
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
    totalRevenue: number;
    totalCogs: number;
    grossProfit: number;
    totalExpenses: number;
    operatingIncome: number;
    netIncome: number;
  };
  organizationName: string;
  leaseNotes?: LeaseNoteData[];
  retainedEarningsOpening?: number;
  shareCapitalOpening?: number;
  shareCapitalContributions?: number;
}

const formatCurrency = (amount: number): string => {
  const absAmount = Math.abs(amount);
  const formatted = `$${absAmount.toLocaleString('en-CA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
  return amount < 0 ? `(${formatted})` : formatted;
};

const formatPeriodDate = (dateStr: string): string => {
  try {
    return format(parseISO(dateStr), 'MMMM d, yyyy');
  } catch {
    return dateStr;
  }
};

export interface ExecSignerSlotForWord {
  signerName: string;
  signerTitle: string;
  secondaryTitle?: string;
  signedAt?: string | null;
}

export interface ExecutiveSignatureForWord {
  primary?: ExecSignerSlotForWord | null;
  secondary?: ExecSignerSlotForWord | null;
  // Legacy single-signer fields (still treated as primary)
  signerName?: string;
  signerTitle?: string;
  secondaryTitle?: string;
  signedAt?: string | null;
  certificationText?: string;
}

export async function generateCompilationWord(
  compilation: CompilationReport,
  financialData: WordExportFinancialData,
  orgContext: NoteTemplateContext = {},
  executiveSignature: ExecutiveSignatureForWord | null = null,
): Promise<Blob> {

  const orgName = financialData.organizationName || 'Organization Name';
  const fiscalYear = compilation.fiscal_year;
  const periodType = compilation.reporting_period_type || 'annual';
  const isInterim = periodType === 'interim' || periodType === 'quarterly';
  const periodEndFormatted = formatPeriodDate(compilation.fiscal_year_end);
  const periodEndShort = isInterim 
    ? `${periodType === 'interim' ? 'Period' : 'Quarter'} Ended ${periodEndFormatted}`
    : `Year Ended ${periodEndFormatted}`;
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
    statementOfEquity: isASNPO ? 'STATEMENT OF CHANGES IN NET ASSETS' : 'STATEMENT OF CHANGES IN EQUITY',
    balanceSheet: isASNPO ? 'STATEMENT OF FINANCIAL POSITION' : 'BALANCE SHEET',
    commonShares: isASNPO ? '' : 'Common Shares',
    retainedEarnings: isASNPO ? 'Unrestricted Net Assets' : 'Retained Earnings',
    totalEquityHeader: isASNPO ? 'Total Net Assets' : 'Total Equity',
    shareIssuances: isASNPO ? 'Contributions' : 'Share issuances',
    netIncomeForYear: isASNPO ? 'Excess (deficiency) of revenue over expenses' : 'Net income for the year',
    entity: isASNPO ? 'the organization' : 'the company',
    entityCap: isASNPO ? 'The organization' : 'The company',
  };

  const noBorder = {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  };

  // Standard font size: 12pt = 24 half-points in docx
  const STANDARD_FONT_SIZE = 24;

  // Helper to create financial table rows
  const createFinancialRow = (label: string, amount: number, isBold = false, indent = 0): TableRow => {
    return new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: '  '.repeat(indent) + label, bold: isBold, size: STANDARD_FONT_SIZE })],
          })],
          width: { size: 70, type: WidthType.PERCENTAGE },
          borders: noBorder,
        }),
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: formatCurrency(amount), bold: isBold, size: STANDARD_FONT_SIZE })],
            alignment: AlignmentType.RIGHT,
          })],
          width: { size: 30, type: WidthType.PERCENTAGE },
          borders: noBorder,
        }),
      ],
    });
  };

  const sections = [];

  // ===== TITLE PAGE =====
  sections.push({
    properties: {},
    headers: {
      default: new Header({
        children: [new Paragraph({ children: [] })],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Page ', size: STANDARD_FONT_SIZE }),
              new TextRun({ children: [PageNumber.CURRENT], size: STANDARD_FONT_SIZE }),
              new TextRun({ text: ' - See accompanying notes to financial statements', size: STANDARD_FONT_SIZE, italics: true }),
            ],
          }),
        ],
      }),
    },
    children: [
      new Paragraph({ children: [] }),
      new Paragraph({ children: [] }),
      new Paragraph({ children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: orgName.toUpperCase(), bold: true, size: 32 })],
      }),
      new Paragraph({ children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ 
          text: isInterim ? 'Interim Financial Statements' : 'Financial Statements', 
          size: 28 
        })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ 
          text: '(Unaudited - See Compilation Engagement Report)', 
          size: STANDARD_FONT_SIZE, 
          italics: true 
        })],
      }),
      new Paragraph({ children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: periodEndFormatted, size: STANDARD_FONT_SIZE })],
      }),
      new Paragraph({ children: [] }),
      new Paragraph({ children: [] }),
      new Paragraph({ children: [] }),
      ...(compilation.prepared_by || compilation.firm_name ? [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'Prepared by:', size: STANDARD_FONT_SIZE })],
        }),
        ...(compilation.firm_name ? [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: compilation.firm_name, bold: true, size: STANDARD_FONT_SIZE })],
        })] : []),
        ...(compilation.prepared_by ? [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: compilation.prepared_by, size: STANDARD_FONT_SIZE })],
        })] : []),
        ...(compilation.firm_address ? [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: compilation.firm_address, size: STANDARD_FONT_SIZE })],
        })] : []),
      ] : []),
    ],
  });

  // ===== COMPILATION ENGAGEMENT REPORT =====
  const statementsIncluded = (compilation.statement_types || ['balance_sheet', 'income_statement', 'retained_earnings'])
    .map(s => {
      switch(s) {
        case 'balance_sheet': return isASNPO ? 'statement of financial position' : 'balance sheet';
        case 'income_statement': return isASNPO ? 'statement of operations' : 'statement of income';
        case 'retained_earnings': return isASNPO ? 'statement of changes in net assets' : 'statement of retained earnings';
        case 'cash_flow': return 'statement of cash flows';
        default: return s;
      }
    }).join(', ');

  sections.push({
    properties: {},
    children: [
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'COMPILATION ENGAGEMENT REPORT', bold: true })],
      }),
      new Paragraph({ children: [] }),
      new Paragraph({
        children: [new TextRun({ text: 'To the Director(s) of' })],
      }),
      new Paragraph({
        children: [new TextRun({ text: orgName, bold: true })],
      }),
      new Paragraph({ children: [] }),
      new Paragraph({
        children: [new TextRun({ 
          text: `On the basis of information provided by management, we have compiled the ${statementsIncluded} of ${orgName} as at ${periodEndFormatted} and for the ${isInterim ? 'period' : 'year'} then ended.`,
          size: STANDARD_FONT_SIZE
        })],
      }),
      new Paragraph({ children: [] }),
      new Paragraph({
        children: [new TextRun({ 
          text: 'Management is responsible for these financial statements, including the accuracy and completeness of the underlying information used to compile them and the selection of the accounting policies.',
          size: STANDARD_FONT_SIZE
        })],
      }),
      new Paragraph({ children: [] }),
      new Paragraph({
        children: [new TextRun({ 
          text: 'We performed this engagement in accordance with Canadian Standard on Related Services (CSRS) 4200, Compilation Engagements, which requires us to comply with relevant ethical requirements. Our responsibility is to assist management in the preparation and presentation of these financial statements.',
          size: STANDARD_FONT_SIZE
        })],
      }),
      new Paragraph({ children: [] }),
      new Paragraph({
        children: [new TextRun({ 
          text: 'We did not perform an audit engagement or a review engagement, nor were we required to perform procedures to verify the accuracy or completeness of the information provided by management. Accordingly, we do not express an audit opinion or a review conclusion on these financial statements.',
          size: STANDARD_FONT_SIZE
        })],
      }),
      new Paragraph({ children: [] }),
      new Paragraph({
        children: [new TextRun({ 
          text: 'Readers are cautioned that these statements may not be appropriate for their purposes.',
          size: STANDARD_FONT_SIZE,
          italics: true
        })],
      }),
      new Paragraph({ children: [] }),
      new Paragraph({ children: [] }),
      new Paragraph({
        children: [new TextRun({ text: '_'.repeat(40) })],
      }),
      ...(compilation.firm_name ? [new Paragraph({
        children: [new TextRun({ text: compilation.firm_name, bold: true })],
      })] : []),
      ...(compilation.prepared_by ? [new Paragraph({
        children: [new TextRun({ text: compilation.prepared_by })],
      })] : []),
      ...(compilation.preparer_license_number ? [new Paragraph({
        children: [new TextRun({ text: `License No: ${compilation.preparer_license_number}`, size: STANDARD_FONT_SIZE })],
      })] : []),
      new Paragraph({ children: [] }),
      new Paragraph({
        children: [new TextRun({ text: compilation.firm_address?.split(',')[0] || '' })],
      }),
      new Paragraph({
        children: [new TextRun({ 
          text: compilation.issued_at 
            ? format(parseISO(compilation.issued_at), 'MMMM d, yyyy')
            : format(new Date(), 'MMMM d, yyyy')
        })],
      }),
      ...(() => {
        if (!executiveSignature) return [];
        // Build primary + secondary slots (legacy fields map to primary)
        const primary: ExecSignerSlotForWord | null =
          executiveSignature.primary ??
          (executiveSignature.signerName
            ? {
                signerName: executiveSignature.signerName,
                signerTitle: executiveSignature.signerTitle || 'CEO/President',
                secondaryTitle: executiveSignature.secondaryTitle,
                signedAt: executiveSignature.signedAt ?? null,
              }
            : null);
        const secondary: ExecSignerSlotForWord | null =
          executiveSignature.secondary ?? null;
        if (!primary && !secondary) return [];

        const buildSlotCell = (slot: ExecSignerSlotForWord | null): TableCell => {
          const paragraphs: Paragraph[] = [];
          paragraphs.push(new Paragraph({
            children: [new TextRun({ text: '_'.repeat(30) })],
          }));
          if (slot) {
            paragraphs.push(new Paragraph({
              children: [new TextRun({ text: slot.signerName, bold: true, size: STANDARD_FONT_SIZE })],
            }));
            paragraphs.push(new Paragraph({
              children: [new TextRun({ text: slot.signerTitle, size: STANDARD_FONT_SIZE })],
            }));
            if (slot.secondaryTitle) {
              paragraphs.push(new Paragraph({
                children: [new TextRun({ text: slot.secondaryTitle, size: STANDARD_FONT_SIZE })],
              }));
            }
            paragraphs.push(new Paragraph({ children: [] }));
            paragraphs.push(new Paragraph({
              children: [new TextRun({
                text: slot.signedAt
                  ? format(parseISO(slot.signedAt), 'MMMM d, yyyy')
                  : format(new Date(), 'MMMM d, yyyy'),
                size: STANDARD_FONT_SIZE,
              })],
            }));
          } else {
            paragraphs.push(new Paragraph({ children: [new TextRun({ text: ' ', size: STANDARD_FONT_SIZE })] }));
          }
          return new TableCell({
            children: paragraphs,
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorder,
          });
        };

        const showSecondary = !!secondary;
        const cells: TableCell[] = [buildSlotCell(primary)];
        if (showSecondary) cells.push(buildSlotCell(secondary));

        return [
          new Paragraph({ children: [] }),
          new Paragraph({ children: [] }),
          new Paragraph({
            children: [new TextRun({ text: 'Approved on behalf of the Board / Management:', bold: true, size: STANDARD_FONT_SIZE })],
          }),
          new Paragraph({ children: [] }),
          new Paragraph({
            children: [new TextRun({
              text: executiveSignature.certificationText || 'I, the undersigned, certify that I have reviewed these financial statements and approve them on behalf of the organization.',
              size: STANDARD_FONT_SIZE,
            })],
          }),
          new Paragraph({ children: [] }),
          new Paragraph({ children: [] }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [new TableRow({ children: cells })],
          }),
        ];
      })(),

    ],
  });


  // ===== BALANCE SHEET =====
  const balanceSheetRows: TableRow[] = [];
  
  // Assets header
  balanceSheetRows.push(new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: 'ASSETS', bold: true, size: STANDARD_FONT_SIZE })],
        })],
        columnSpan: 2,
        borders: noBorder,
      }),
    ],
  }));

  financialData.balanceSheet.assets.forEach(asset => {
    balanceSheetRows.push(createFinancialRow(asset.name, asset.calculated_balance, false, 1));
  });

  balanceSheetRows.push(createFinancialRow('Total Assets', financialData.balanceSheet.totalAssets, true, 1));
  balanceSheetRows.push(new TableRow({ children: [new TableCell({ children: [new Paragraph({})], columnSpan: 2, borders: noBorder })] }));

  // Liabilities
  balanceSheetRows.push(new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: 'LIABILITIES', bold: true, size: STANDARD_FONT_SIZE })],
        })],
        columnSpan: 2,
        borders: noBorder,
      }),
    ],
  }));

  financialData.balanceSheet.liabilities.forEach(liability => {
    balanceSheetRows.push(createFinancialRow(liability.name, liability.calculated_balance, false, 1));
  });

  balanceSheetRows.push(createFinancialRow('Total Liabilities', financialData.balanceSheet.totalLiabilities, true, 1));
  balanceSheetRows.push(new TableRow({ children: [new TableCell({ children: [new Paragraph({})], columnSpan: 2, borders: noBorder })] }));

  // Equity
  balanceSheetRows.push(new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: t.shareholdersEquity, bold: true, size: STANDARD_FONT_SIZE })],
        })],
        columnSpan: 2,
        borders: noBorder,
      }),
    ],
  }));

  const hasReClosing = typeof financialData.balanceSheet.reClosingBalance === 'number';

  if (hasReClosing) {
    // Canonical formula: exclude RE + CYE from account list, show single RE closing line
    financialData.balanceSheet.equity
      .filter(eq => !isExcludedFromCompilationEquityTotal(eq))
      .forEach(eq => {
        balanceSheetRows.push(createFinancialRow(eq.name, eq.calculated_balance, false, 1));
      });
    const reClosing = financialData.balanceSheet.reClosingBalance ?? 0;
    balanceSheetRows.push(createFinancialRow(t.retainedEarnings, reClosing, false, 1));
    const totalEquity = sumEquityExcludingREandCYE(financialData.balanceSheet.equity) + reClosing;
    balanceSheetRows.push(createFinancialRow(t.totalEquity, totalEquity, true, 1));
    balanceSheetRows.push(createFinancialRow(t.totalLiabAndEquity, financialData.balanceSheet.totalLiabilities + totalEquity, true, 0));
  } else {
    // Legacy fallback
    financialData.balanceSheet.equity.forEach(eq => {
      balanceSheetRows.push(createFinancialRow(eq.name, eq.calculated_balance, false, 1));
    });
    if (financialData.balanceSheet.netIncome !== 0) {
      balanceSheetRows.push(createFinancialRow(t.currentYearEarnings, financialData.balanceSheet.netIncome, false, 1));
    }
    const totalEquity = financialData.balanceSheet.totalEquity + financialData.balanceSheet.netIncome;
    balanceSheetRows.push(createFinancialRow(t.totalEquity, totalEquity, true, 1));
    balanceSheetRows.push(createFinancialRow(t.totalLiabAndEquity, financialData.balanceSheet.totalLiabilities + totalEquity, true, 0));
  }

  sections.push({
    properties: {},
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: orgName.toUpperCase(), bold: true, size: STANDARD_FONT_SIZE })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: t.balanceSheet, bold: true, size: STANDARD_FONT_SIZE })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: '(Unaudited - See Compilation Engagement Report)', italics: true, size: STANDARD_FONT_SIZE })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `As at ${periodEndFormatted}`, size: STANDARD_FONT_SIZE })],
      }),
      new Paragraph({ children: [] }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: balanceSheetRows,
      }),
    ],
  });

  // ===== INCOME STATEMENT =====
  const incomeRows: TableRow[] = [];

  incomeRows.push(new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: 'REVENUE', bold: true, size: STANDARD_FONT_SIZE })] })],
        columnSpan: 2,
        borders: noBorder,
      }),
    ],
  }));

  financialData.incomeStatement.income.forEach(inc => {
    incomeRows.push(createFinancialRow(inc.name, inc.calculated_balance, false, 1));
  });

  incomeRows.push(createFinancialRow('Total Revenue', financialData.incomeStatement.totalRevenue, true, 1));
  incomeRows.push(new TableRow({ children: [new TableCell({ children: [new Paragraph({})], columnSpan: 2, borders: noBorder })] }));

  if (financialData.incomeStatement.cogs.length > 0) {
    incomeRows.push(new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'COST OF GOODS SOLD', bold: true, size: STANDARD_FONT_SIZE })] })],
          columnSpan: 2,
          borders: noBorder,
        }),
      ],
    }));

    financialData.incomeStatement.cogs.forEach(cog => {
      incomeRows.push(createFinancialRow(cog.name, cog.calculated_balance, false, 1));
    });

    incomeRows.push(createFinancialRow('Total Cost of Goods Sold', financialData.incomeStatement.totalCogs, true, 1));
    incomeRows.push(createFinancialRow('GROSS PROFIT', financialData.incomeStatement.grossProfit, true, 0));
    incomeRows.push(new TableRow({ children: [new TableCell({ children: [new Paragraph({})], columnSpan: 2, borders: noBorder })] }));
  }

  incomeRows.push(new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: 'OPERATING EXPENSES', bold: true, size: STANDARD_FONT_SIZE })] })],
        columnSpan: 2,
        borders: noBorder,
      }),
    ],
  }));

  financialData.incomeStatement.expenses.forEach(exp => {
    incomeRows.push(createFinancialRow(exp.name, exp.calculated_balance, false, 1));
  });

  incomeRows.push(createFinancialRow('Total Operating Expenses', financialData.incomeStatement.totalExpenses, true, 1));
  incomeRows.push(createFinancialRow(t.incomeFromOps, financialData.incomeStatement.operatingIncome, true, 0));
  incomeRows.push(new TableRow({ children: [new TableCell({ children: [new Paragraph({})], columnSpan: 2, borders: noBorder })] }));
  incomeRows.push(createFinancialRow(t.netIncome, financialData.incomeStatement.netIncome, true, 0));

  sections.push({
    properties: {},
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: orgName.toUpperCase(), bold: true, size: STANDARD_FONT_SIZE })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: t.statementOfIncome, bold: true, size: STANDARD_FONT_SIZE })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: '(Unaudited - See Compilation Engagement Report)', italics: true, size: STANDARD_FONT_SIZE })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `For the ${periodEndShort}`, size: STANDARD_FONT_SIZE })],
      }),
      new Paragraph({ children: [] }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: incomeRows,
      }),
    ],
  });

  // ===== STATEMENT OF CHANGES IN EQUITY =====
  const scOpening = financialData.shareCapitalOpening ?? 0;
  const scContributions = financialData.shareCapitalContributions ?? 0;
  const scClosing = scOpening + scContributions;
  const reOpening = financialData.retainedEarningsOpening ?? 0;
  const netIncome = financialData.incomeStatement.netIncome;
  const reClosing = reOpening + netIncome;

  const noBorderSoce = { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } };
  
  const createSOCERow = (label: string, sc: number | string, re: number | string, total: number | string, bold = false, indent = 0) => {
    const scText = typeof sc === 'string' ? sc : formatCurrency(sc);
    const reText = typeof re === 'string' ? re : formatCurrency(re);
    const totalText = typeof total === 'string' ? total : formatCurrency(total);
    return new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: label, bold, size: STANDARD_FONT_SIZE })],
            indent: { left: indent * 360 },
          })],
          borders: noBorderSoce,
          width: { size: 40, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: scText, bold, size: STANDARD_FONT_SIZE })],
          })],
          borders: noBorderSoce,
          width: { size: 20, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: reText, bold, size: STANDARD_FONT_SIZE })],
          })],
          borders: noBorderSoce,
          width: { size: 20, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: totalText, bold, size: STANDARD_FONT_SIZE })],
          })],
          borders: noBorderSoce,
          width: { size: 20, type: WidthType.PERCENTAGE },
        }),
      ],
    });
  };

  const soceRows: TableRow[] = [];
  if (isASNPO) {
    // ASNPO: two columns only — Unrestricted Net Assets and Total Net Assets (no share capital)
    soceRows.push(createSOCERow('Description', '', t.retainedEarnings, t.totalEquityHeader, true));
    soceRows.push(createSOCERow('Balance, beginning of year', '', scOpening + reOpening, scOpening + reOpening));
    if (scContributions !== 0) {
      soceRows.push(createSOCERow(t.shareIssuances, '', scContributions, scContributions, false, 1));
    }
    soceRows.push(createSOCERow(t.netIncomeForYear, '', netIncome, netIncome, false, 1));
    soceRows.push(createSOCERow('Balance, end of year', '', scClosing + reClosing, scClosing + reClosing, true));
  } else {
    // Header row
    soceRows.push(createSOCERow('Description', t.commonShares, t.retainedEarnings, t.totalEquityHeader, true));
    // Opening balance
    soceRows.push(createSOCERow('Balance, beginning of year', scOpening, reOpening, scOpening + reOpening));
    // Share issuances
    if (scContributions !== 0) {
      soceRows.push(createSOCERow(t.shareIssuances, scContributions, '–', scContributions, false, 1));
    }
    // Net income
    soceRows.push(createSOCERow(t.netIncomeForYear, '–', netIncome, netIncome, false, 1));
    // Closing balance
    soceRows.push(createSOCERow('Balance, end of year', scClosing, reClosing, scClosing + reClosing, true));
  }

  sections.push({
    properties: {},
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: orgName.toUpperCase(), bold: true, size: STANDARD_FONT_SIZE })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: isInterim ? `INTERIM ${t.statementOfEquity}` : t.statementOfEquity, bold: true, size: STANDARD_FONT_SIZE })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: '(Unaudited - See Compilation Engagement Report)', italics: true, size: STANDARD_FONT_SIZE })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `For the ${periodEndShort}`, size: STANDARD_FONT_SIZE })],
      }),
      new Paragraph({ children: [] }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: soceRows,
      }),
    ],
  });

  // ===== NOTES TO FINANCIAL STATEMENTS =====
  const noteChildren: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: orgName.toUpperCase(), bold: true, size: STANDARD_FONT_SIZE })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'NOTES TO FINANCIAL STATEMENTS', bold: true, size: STANDARD_FONT_SIZE })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: periodEndFormatted, size: STANDARD_FONT_SIZE })],
    }),
    new Paragraph({ children: [] }),
  ];

  let noteNum = 1;
  // Note: Skip 'ppe' template if fixed assets data will generate a comprehensive PPE note
  // This is handled at the PDF level; Word export uses the same selected templates
  (compilation.selected_note_templates || []).forEach(noteId => {
    // Skip 'ppe' note template - the comprehensive PPE note with schedule is preferred
    if (noteId === 'ppe') {
      return;
    }
    // Skip static 'finance_lease' template when actual lease data is available
    if (noteId === 'finance_lease' && financialData.leaseNotes && financialData.leaseNotes.length > 0) {
      return;
    }
    
    const note = getFrameworkNoteTemplates(compilation.accounting_framework || 'ASPE').find(n => n.id === noteId);
    if (note) {
      noteChildren.push(new Paragraph({
        children: [new TextRun({ 
          text: `${noteNum}. ${note.title.replace(/^\d+\.\s*/, '')}`, 
          bold: true, 
          size: STANDARD_FONT_SIZE 
        })],
      }));
      noteChildren.push(new Paragraph({
        children: [new TextRun({ text: resolveNoteTemplate(note.template, orgContext), size: STANDARD_FONT_SIZE })],
      }));
      noteChildren.push(new Paragraph({ children: [] }));
      noteNum++;
    }
  });

  // Finance Lease Obligations Note (auto-populated from lease data)
  if (financialData.leaseNotes && financialData.leaseNotes.length > 0) {
    noteChildren.push(new Paragraph({
      children: [new TextRun({ text: `${noteNum}. Finance Lease Obligations`, bold: true, size: STANDARD_FONT_SIZE })],
    }));
    
    const fiscalYear = compilation.fiscal_year_end ? format(parseISO(compilation.fiscal_year_end), 'yyyy') : '';
    
    financialData.leaseNotes.forEach(lease => {
      const leaseIntro = `${t.entityCap} has a finance lease obligation for a ${lease.leaseName}, ` +
        `commencing ${format(parseISO(lease.commencementDate), 'MMMM d, yyyy')} and expiring ` +
        `${format(parseISO(lease.endDate), 'MMMM d, yyyy')}. ` +
        `Payments of $${lease.paymentAmount.toLocaleString('en-CA', { minimumFractionDigits: 2 })} are made ${lease.paymentFrequency}, ` +
        `bearing interest at ${lease.discountRate}% per annum. ` +
        `The right-of-use asset was initially recognized at $${Math.round(lease.rouAssetInitial).toLocaleString('en-CA')}.`;
      
      noteChildren.push(new Paragraph({
        children: [new TextRun({ text: leaseIntro, size: STANDARD_FONT_SIZE })],
      }));
      noteChildren.push(new Paragraph({ children: [] }));
      
      noteChildren.push(new Paragraph({
        children: [new TextRun({ text: 'Finance lease obligations consist of:', bold: true, size: STANDARD_FONT_SIZE })],
      }));
      
      // Current portion
      noteChildren.push(new Paragraph({
        children: [
          new TextRun({ text: `Current portion of finance lease: `, size: STANDARD_FONT_SIZE }),
          new TextRun({ text: formatCurrency(lease.currentPortionCurrent), size: STANDARD_FONT_SIZE }),
          ...(lease.currentPortionPrior !== undefined ? [
            new TextRun({ text: ` (${parseInt(fiscalYear) - 1}: ${formatCurrency(lease.currentPortionPrior)})`, size: STANDARD_FONT_SIZE }),
          ] : []),
        ],
      }));
      
      // Non-current portion
      noteChildren.push(new Paragraph({
        children: [
          new TextRun({ text: `Non-current portion of finance lease: `, size: STANDARD_FONT_SIZE }),
          new TextRun({ text: formatCurrency(lease.nonCurrentPortionCurrent), size: STANDARD_FONT_SIZE }),
          ...(lease.nonCurrentPortionPrior !== undefined ? [
            new TextRun({ text: ` (${parseInt(fiscalYear) - 1}: ${formatCurrency(lease.nonCurrentPortionPrior)})`, size: STANDARD_FONT_SIZE }),
          ] : []),
        ],
      }));
      
      // Total
      noteChildren.push(new Paragraph({
        children: [
          new TextRun({ text: `Total finance lease obligation: `, bold: true, size: STANDARD_FONT_SIZE }),
          new TextRun({ text: formatCurrency(lease.currentLiabilityTotal), bold: true, size: STANDARD_FONT_SIZE }),
          ...(lease.priorLiabilityTotal !== undefined ? [
            new TextRun({ text: ` (${parseInt(fiscalYear) - 1}: ${formatCurrency(lease.priorLiabilityTotal)})`, bold: true, size: STANDARD_FONT_SIZE }),
          ] : []),
        ],
      }));
      noteChildren.push(new Paragraph({ children: [] }));
      
      // Interest expense
      const interestText = `Interest expense on finance lease obligations for the year was $${Math.round(lease.totalInterestCurrent).toLocaleString('en-CA')}` +
        (lease.totalInterestPrior ? ` (${parseInt(fiscalYear) - 1}: $${Math.round(lease.totalInterestPrior).toLocaleString('en-CA')}).` : '.');
      noteChildren.push(new Paragraph({
        children: [new TextRun({ text: interestText, size: STANDARD_FONT_SIZE })],
      }));
      noteChildren.push(new Paragraph({ children: [] }));
      
      // Maturity schedule
      if (lease.maturitySchedule.length > 0) {
        noteChildren.push(new Paragraph({
          children: [new TextRun({ text: 'Future minimum lease payments are as follows:', bold: true, size: STANDARD_FONT_SIZE })],
        }));
        
        let totalFuture = 0;
        lease.maturitySchedule.forEach(entry => {
          totalFuture += entry.amount;
          noteChildren.push(new Paragraph({
            children: [
              new TextRun({ text: `${entry.year}: `, size: STANDARD_FONT_SIZE }),
              new TextRun({ text: formatCurrency(entry.amount), size: STANDARD_FONT_SIZE }),
            ],
          }));
        });
        
        noteChildren.push(new Paragraph({
          children: [
            new TextRun({ text: `Total: `, bold: true, size: STANDARD_FONT_SIZE }),
            new TextRun({ text: formatCurrency(totalFuture), bold: true, size: STANDARD_FONT_SIZE }),
          ],
        }));
      }
      noteChildren.push(new Paragraph({ children: [] }));
    });
    
    noteNum++;
  }

  if (compilation.custom_notes) {
    noteChildren.push(new Paragraph({
      children: [new TextRun({ text: `${noteNum}. Additional Notes`, bold: true, size: STANDARD_FONT_SIZE })],
    }));
    noteChildren.push(new Paragraph({
      children: [new TextRun({ text: compilation.custom_notes, size: STANDARD_FONT_SIZE })],
    }));
  }

  sections.push({
    properties: {},
    children: noteChildren,
  });

  // Create document
  const doc = new Document({
    sections,
    title: `${orgName} Financial Statements ${fiscalYear}`,
    creator: compilation.prepared_by || 'EFinSuite Globe',
  });

  return await Packer.toBlob(doc);
}


export async function downloadCompilationWord(
  compilation: CompilationReport,
  financialData: WordExportFinancialData,
  orgContext: NoteTemplateContext = {},
  executiveSignature?: ExecutiveSignatureForWord | null,
): Promise<void> {
  try {
    const blob = await generateCompilationWord(compilation, financialData, orgContext, executiveSignature ?? null);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${financialData.organizationName.replace(/[^a-zA-Z0-9]/g, '_')}_Financial_Statements_${compilation.fiscal_year}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error generating Word document:', error);
    throw error;
  }
}

