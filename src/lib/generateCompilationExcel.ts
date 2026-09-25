import * as XLSX from 'xlsx';
import { isExcludedFromCompilationEquityTotal, sumEquityExcludingREandCYE, type ComparativeFinancialData } from './generateCompilationPdfEnhanced';
import type { CompilationReport } from '@/hooks/useCompilationReports';

type ExecSlot = {
  signerName: string;
  signerTitle: string;
  secondaryTitle?: string;
  signatureImageUrl?: string | null;
  signedAt?: string | null;
};

export interface ExecutiveSignatureForExcel {
  primary?: ExecSlot | null;
  secondary?: ExecSlot | null;
  certificationText?: string;
}

interface OrgContext {
  incorporation_jurisdiction?: string | null;
  principal_activities?: string | null;
}

type Row = (string | number)[];

const fmt = (n: number | undefined | null): number => {
  if (n === undefined || n === null || isNaN(Number(n))) return 0;
  return Math.round(Number(n) * 100) / 100;
};

// Apply sign for contra accounts when totaling Balance Sheet sections.
const signedAmount = (a: { calculated_balance: number; normal_balance?: string | null }, expectedNormal: 'debit' | 'credit') => {
  const v = Number(a.calculated_balance) || 0;
  // If account normal_balance opposes section's expected normal, treat as contra (negate)
  if (a.normal_balance && a.normal_balance !== expectedNormal) return -v;
  return v;
};

const styleSheet = (ws: XLSX.WorkSheet, totalRowIdx: Set<number>, headerRowIdx: Set<number>, sectionRowIdx: Set<number>) => {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (!cell) continue;
      if (!cell.s) cell.s = {};
      if (C > 0 && typeof cell.v === 'number') {
        cell.z = '#,##0.00;(#,##0.00)';
        cell.s = { ...cell.s, alignment: { horizontal: 'right' }, numFmt: '#,##0.00;(#,##0.00)' };
      }
      if (headerRowIdx.has(R)) {
        cell.s = {
          ...cell.s,
          font: { bold: true },
          fill: { fgColor: { rgb: 'F0F0F0' } },
          alignment: C === 0 ? { horizontal: 'left' } : { horizontal: 'right' },
          border: { bottom: { style: 'medium', color: { rgb: '000000' } } },
        };
      }
      if (totalRowIdx.has(R)) {
        cell.s = {
          ...cell.s,
          font: { bold: true },
          alignment: C === 0 ? { horizontal: 'left' } : { horizontal: 'right' },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'double', color: { rgb: '000000' } },
          },
        };
      }
      if (sectionRowIdx.has(R)) {
        cell.s = { ...cell.s, font: { bold: true } };
      }
    }
  }
};

const setCols = (ws: XLSX.WorkSheet, widths: number[]) => {
  ws['!cols'] = widths.map((w) => ({ wch: w }));
};

function buildCoverSheet(
  compilation: CompilationReport,
  orgName: string,
  orgContext: OrgContext,
  executiveSignature: ExecutiveSignatureForExcel | null
): XLSX.WorkSheet {
  const rows: Row[] = [];
  rows.push([orgName]);
  rows.push(['Compilation Engagement Report']);
  rows.push([`Fiscal Year ${compilation.fiscal_year}`]);
  rows.push([`Period: ${compilation.period_start_date || ''} to ${compilation.fiscal_year_end}`]);
  rows.push([`Framework: ${compilation.accounting_framework || 'ASPE'}`]);
  rows.push([`Status: ${compilation.status}`]);
  rows.push([`Generated: ${new Date().toLocaleDateString()}`]);
  rows.push([]);
  if (orgContext.incorporation_jurisdiction) rows.push(['Jurisdiction', orgContext.incorporation_jurisdiction]);
  if (orgContext.principal_activities) rows.push(['Principal Activities', orgContext.principal_activities]);
  rows.push([]);
  rows.push(['Compilation Engagement Statement']);
  rows.push([
    'On the basis of information provided by management, we have compiled the financial information of the entity as at the period end and for the period then ended. Management is responsible for the accompanying financial information, including its accuracy, completeness, and the selection of the basis of accounting. We did not perform an audit engagement or a review engagement in respect of these financial statements and accordingly, no assurance is expressed.',
  ]);

  if (executiveSignature?.primary || executiveSignature?.secondary) {
    rows.push([]);
    rows.push(['Executive Certification']);
    if (executiveSignature.certificationText) rows.push([executiveSignature.certificationText]);
    rows.push([]);
    const headerCols = ['', 'Primary Signer', 'Secondary Signer'];
    rows.push(headerCols);
    const p = executiveSignature.primary;
    const s = executiveSignature.secondary;
    rows.push(['Name', p?.signerName || '', s?.signerName || '']);
    rows.push(['Title', p?.signerTitle || '', s?.signerTitle || '']);
    rows.push([
      'Signed',
      p?.signedAt ? new Date(p.signedAt).toLocaleDateString() : '—',
      s?.signedAt ? new Date(s.signedAt).toLocaleDateString() : '—',
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setCols(ws, [32, 40, 40]);
  return ws;
}

function buildIncomeStatementSheet(data: ComparativeFinancialData): XLSX.WorkSheet {
  const cur = data.currentYear.incomeStatement;
  const prior = data.priorYear?.incomeStatement;
  const hasPrior = !!prior;
  const headers: Row = hasPrior
    ? ['Account', `FY ${data.currentYear.label}`, `FY ${data.priorYear!.label}`]
    : ['Account', `FY ${data.currentYear.label}`];

  const rows: Row[] = [];
  rows.push(['Statement of Operations']);
  rows.push([]);
  rows.push(headers);
  const headerRow = rows.length - 1;
  const totalRows = new Set<number>();
  const sectionRows = new Set<number>();

  const addSection = (label: string, items: Array<{ name: string; calculated_balance: number }>, priorItems?: Array<{ name: string; calculated_balance: number }>) => {
    rows.push([label]);
    sectionRows.add(rows.length - 1);
    items.forEach((it) => {
      const prow: Row = hasPrior
        ? [it.name, fmt(Math.abs(it.calculated_balance)), fmt(Math.abs(priorItems?.find((p) => p.name === it.name)?.calculated_balance ?? 0))]
        : [it.name, fmt(Math.abs(it.calculated_balance))];
      rows.push(prow);
    });
  };

  addSection('Revenue', cur.income, prior?.income);
  rows.push(hasPrior ? ['Total Revenue', fmt(cur.totalRevenue), fmt(prior?.totalRevenue ?? 0)] : ['Total Revenue', fmt(cur.totalRevenue)]);
  totalRows.add(rows.length - 1);

  if (cur.cogs.length > 0) {
    addSection('Cost of Goods Sold', cur.cogs, prior?.cogs);
    rows.push(hasPrior ? ['Total COGS', fmt(cur.totalCogs), fmt(prior?.totalCogs ?? 0)] : ['Total COGS', fmt(cur.totalCogs)]);
    totalRows.add(rows.length - 1);
    rows.push(hasPrior ? ['Gross Profit', fmt(cur.grossProfit), fmt(prior?.grossProfit ?? 0)] : ['Gross Profit', fmt(cur.grossProfit)]);
    totalRows.add(rows.length - 1);
  }

  addSection('Operating Expenses', cur.expenses, prior?.expenses);
  rows.push(hasPrior ? ['Total Expenses', fmt(cur.totalExpenses), fmt(prior?.totalExpenses ?? 0)] : ['Total Expenses', fmt(cur.totalExpenses)]);
  totalRows.add(rows.length - 1);

  rows.push(hasPrior ? ['Operating Income', fmt(cur.operatingIncome), fmt(prior?.operatingIncome ?? 0)] : ['Operating Income', fmt(cur.operatingIncome)]);
  totalRows.add(rows.length - 1);

  if ((cur.otherIncome?.length ?? 0) > 0) addSection('Other Income', cur.otherIncome || [], prior?.otherIncome);
  if ((cur.otherExpenses?.length ?? 0) > 0) addSection('Other Expenses', cur.otherExpenses || [], prior?.otherExpenses);

  rows.push(hasPrior ? ['Net Income (Loss)', fmt(cur.netIncome), fmt(prior?.netIncome ?? 0)] : ['Net Income (Loss)', fmt(cur.netIncome)]);
  totalRows.add(rows.length - 1);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setCols(ws, [44, 18, 18]);
  styleSheet(ws, totalRows, new Set([headerRow]), sectionRows);
  return ws;
}

function buildBalanceSheetSheet(data: ComparativeFinancialData, hideZeroBalances: boolean): XLSX.WorkSheet {
  const cur = data.currentYear.balanceSheet;
  const prior = data.priorYear?.balanceSheet;
  const hasPrior = !!prior;
  const headers: Row = hasPrior
    ? ['Account', `FY ${data.currentYear.label}`, `FY ${data.priorYear!.label}`]
    : ['Account', `FY ${data.currentYear.label}`];

  const rows: Row[] = [];
  rows.push(['Balance Sheet']);
  rows.push([]);
  rows.push(headers);
  const headerRow = rows.length - 1;
  const totalRows = new Set<number>();
  const sectionRows = new Set<number>();

  const addAccounts = (
    items: Array<{ name: string; calculated_balance: number; normal_balance?: string | null }>,
    priorItems: Array<{ name: string; calculated_balance: number; normal_balance?: string | null }> | undefined,
    expectedNormal: 'debit' | 'credit'
  ) => {
    items.forEach((it) => {
      const curVal = signedAmount(it, expectedNormal);
      const priorMatch = priorItems?.find((p) => p.name === it.name);
      const priorVal = priorMatch ? signedAmount(priorMatch, expectedNormal) : 0;
      if (hideZeroBalances && curVal === 0 && priorVal === 0) return;
      rows.push(hasPrior ? [it.name, fmt(curVal), fmt(priorVal)] : [it.name, fmt(curVal)]);
    });
  };

  rows.push(['ASSETS']); sectionRows.add(rows.length - 1);
  addAccounts(cur.assets, prior?.assets, 'debit');
  rows.push(hasPrior ? ['Total Assets', fmt(cur.totalAssets), fmt(prior?.totalAssets ?? 0)] : ['Total Assets', fmt(cur.totalAssets)]);
  totalRows.add(rows.length - 1);

  rows.push([]);
  rows.push(['LIABILITIES']); sectionRows.add(rows.length - 1);
  addAccounts(cur.liabilities, prior?.liabilities, 'credit');
  rows.push(hasPrior ? ['Total Liabilities', fmt(cur.totalLiabilities), fmt(prior?.totalLiabilities ?? 0)] : ['Total Liabilities', fmt(cur.totalLiabilities)]);
  totalRows.add(rows.length - 1);

  rows.push([]);
  rows.push(['EQUITY']); sectionRows.add(rows.length - 1);

  const hasReClosing = typeof cur.reClosingBalance === 'number';
  if (hasReClosing) {
    // Canonical formula: filter out RE + CYE, then add reClosingBalance
    const curEquityFiltered = cur.equity.filter(a => !isExcludedFromCompilationEquityTotal(a));
    const priorEquityFiltered = prior?.equity.filter(a => !isExcludedFromCompilationEquityTotal(a));
    addAccounts(curEquityFiltered, priorEquityFiltered, 'credit');
    const reCur = cur.reClosingBalance ?? 0;
    const rePrior = prior?.reClosingBalance ?? 0;
    rows.push(hasPrior ? ['Retained Earnings', fmt(reCur), fmt(rePrior)] : ['Retained Earnings', fmt(reCur)]);
    const totalEquityCur = sumEquityExcludingREandCYE(cur.equity) + reCur;
    const totalEquityPrior = prior ? sumEquityExcludingREandCYE(prior.equity) + rePrior : 0;
    rows.push(hasPrior ? ['Total Equity', fmt(totalEquityCur), fmt(totalEquityPrior)] : ['Total Equity', fmt(totalEquityCur)]);
    totalRows.add(rows.length - 1);

    rows.push([]);
    rows.push(
      hasPrior
        ? ['Total Liabilities and Equity', fmt(cur.totalLiabilities + totalEquityCur), fmt((prior?.totalLiabilities ?? 0) + totalEquityPrior)]
        : ['Total Liabilities and Equity', fmt(cur.totalLiabilities + totalEquityCur)]
    );
    totalRows.add(rows.length - 1);
  } else {
    // Legacy fallback
    addAccounts(cur.equity, prior?.equity, 'credit');
    rows.push(hasPrior ? ['Net Income (Current Period)', fmt(cur.netIncome), fmt(prior?.netIncome ?? 0)] : ['Net Income (Current Period)', fmt(cur.netIncome)]);
    const totalEquityCur = cur.totalEquity + cur.netIncome;
    const totalEquityPrior = prior ? prior.totalEquity + prior.netIncome : 0;
    rows.push(hasPrior ? ['Total Equity', fmt(totalEquityCur), fmt(totalEquityPrior)] : ['Total Equity', fmt(totalEquityCur)]);
    totalRows.add(rows.length - 1);

    rows.push([]);
    rows.push(
      hasPrior
        ? ['Total Liabilities and Equity', fmt(cur.totalLiabilities + totalEquityCur), fmt((prior?.totalLiabilities ?? 0) + totalEquityPrior)]
        : ['Total Liabilities and Equity', fmt(cur.totalLiabilities + totalEquityCur)]
    );
    totalRows.add(rows.length - 1);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setCols(ws, [44, 18, 18]);
  styleSheet(ws, totalRows, new Set([headerRow]), sectionRows);
  return ws;
}

function buildCashFlowSheet(data: ComparativeFinancialData): XLSX.WorkSheet {
  const cur = data.currentYear.cashFlow;
  const prior = data.priorYear?.cashFlow;
  const hasPrior = !!prior;
  const headers: Row = hasPrior
    ? ['', `FY ${data.currentYear.label}`, `FY ${data.priorYear!.label}`]
    : ['', `FY ${data.currentYear.label}`];

  const rows: Row[] = [];
  rows.push(['Statement of Cash Flows']);
  rows.push([]);
  rows.push(headers);
  const headerRow = rows.length - 1;
  const totalRows = new Set<number>();
  const sectionRows = new Set<number>();

  const addActivities = (label: string, items: Array<{ name: string; amount: number }>, priorItems?: Array<{ name: string; amount: number }>, totalCur?: number, totalPrior?: number) => {
    rows.push([label]); sectionRows.add(rows.length - 1);
    items.forEach((it) => {
      const priorVal = priorItems?.find((p) => p.name === it.name)?.amount ?? 0;
      rows.push(hasPrior ? [it.name, fmt(it.amount), fmt(priorVal)] : [it.name, fmt(it.amount)]);
    });
    rows.push(hasPrior ? [`Net Cash from ${label}`, fmt(totalCur ?? 0), fmt(totalPrior ?? 0)] : [`Net Cash from ${label}`, fmt(totalCur ?? 0)]);
    totalRows.add(rows.length - 1);
  };

  addActivities('Operating Activities', cur.operatingActivities, prior?.operatingActivities, cur.netOperating, prior?.netOperating);
  addActivities('Investing Activities', cur.investingActivities, prior?.investingActivities, cur.netInvesting, prior?.netInvesting);
  addActivities('Financing Activities', cur.financingActivities, prior?.financingActivities, cur.netFinancing, prior?.netFinancing);

  rows.push([]);
  rows.push(hasPrior ? ['Net Change in Cash', fmt(cur.netChange), fmt(prior?.netChange ?? 0)] : ['Net Change in Cash', fmt(cur.netChange)]);
  totalRows.add(rows.length - 1);
  rows.push(hasPrior ? ['Beginning Cash Balance', fmt(cur.beginningCash), fmt(prior?.beginningCash ?? 0)] : ['Beginning Cash Balance', fmt(cur.beginningCash)]);
  rows.push(hasPrior ? ['Ending Cash Balance', fmt(cur.endingCash), fmt(prior?.endingCash ?? 0)] : ['Ending Cash Balance', fmt(cur.endingCash)]);
  totalRows.add(rows.length - 1);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setCols(ws, [44, 18, 18]);
  styleSheet(ws, totalRows, new Set([headerRow]), sectionRows);
  return ws;
}

function buildEquitySheet(data: ComparativeFinancialData, retainedEarningsOpening: number, priorRetainedEarningsOpening?: number): XLSX.WorkSheet {
  const cur = data.currentYear;
  const prior = data.priorYear;
  const hasPrior = !!prior;
  const rows: Row[] = [];
  rows.push(['Statement of Changes in Equity / Net Assets']);
  rows.push([]);
  const headers: Row = hasPrior
    ? ['', `FY ${cur.label}`, `FY ${prior!.label}`]
    : ['', `FY ${cur.label}`];
  rows.push(headers);
  const headerRow = rows.length - 1;
  const totalRows = new Set<number>();

  rows.push(hasPrior
    ? ['Opening Retained Earnings', fmt(retainedEarningsOpening), fmt(priorRetainedEarningsOpening ?? 0)]
    : ['Opening Retained Earnings', fmt(retainedEarningsOpening)]);
  rows.push(hasPrior
    ? ['Add: Net Income (Loss) for the Period', fmt(cur.incomeStatement.netIncome), fmt(prior!.incomeStatement.netIncome)]
    : ['Add: Net Income (Loss) for the Period', fmt(cur.incomeStatement.netIncome)]);
  const closingCur = retainedEarningsOpening + cur.incomeStatement.netIncome;
  const closingPrior = (priorRetainedEarningsOpening ?? 0) + (prior?.incomeStatement.netIncome ?? 0);
  rows.push(hasPrior
    ? ['Closing Retained Earnings', fmt(closingCur), fmt(closingPrior)]
    : ['Closing Retained Earnings', fmt(closingCur)]);
  totalRows.add(rows.length - 1);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setCols(ws, [44, 18, 18]);
  styleSheet(ws, totalRows, new Set([headerRow]), new Set());
  return ws;
}

function buildNotesSheet(compilation: CompilationReport): XLSX.WorkSheet {
  const rows: Row[] = [];
  rows.push(['Notes to Financial Statements']);
  rows.push([]);
  const notes = (compilation as unknown as { notes?: Array<{ title?: string; content?: string }> }).notes;
  if (Array.isArray(notes) && notes.length > 0) {
    notes.forEach((n, i) => {
      rows.push([`Note ${i + 1}: ${n.title || ''}`]);
      rows.push([n.content || '']);
      rows.push([]);
    });
  } else {
    rows.push(['No notes recorded for this compilation.']);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setCols(ws, [110]);
  return ws;
}

export interface CompilationExcelOptions {
  hideZeroBalances?: boolean;
  orgContext?: OrgContext;
  executiveSignature?: ExecutiveSignatureForExcel | null;
  retainedEarningsOpening?: number;
  priorRetainedEarningsOpening?: number;
}

export async function downloadCompilationExcel(
  compilation: CompilationReport,
  data: ComparativeFinancialData,
  options: CompilationExcelOptions = {}
): Promise<void> {
  const wb = XLSX.utils.book_new();
  const orgName = data.organizationName || 'Organization';

  XLSX.utils.book_append_sheet(
    wb,
    buildCoverSheet(compilation, orgName, options.orgContext || {}, options.executiveSignature || null),
    'Cover'
  );
  XLSX.utils.book_append_sheet(wb, buildIncomeStatementSheet(data), 'Income Statement');
  XLSX.utils.book_append_sheet(wb, buildBalanceSheetSheet(data, options.hideZeroBalances ?? true), 'Balance Sheet');
  XLSX.utils.book_append_sheet(
    wb,
    buildEquitySheet(data, options.retainedEarningsOpening ?? 0, options.priorRetainedEarningsOpening),
    'Changes in Equity'
  );
  XLSX.utils.book_append_sheet(wb, buildCashFlowSheet(data), 'Cash Flow');
  XLSX.utils.book_append_sheet(wb, buildNotesSheet(compilation), 'Notes');

  const filename = `Compilation_${orgName.replace(/\s+/g, '_')}_FY${compilation.fiscal_year}.xlsx`;
  XLSX.writeFile(wb, filename, { bookSST: false, cellStyles: true });
}
