// Excel workbook of Nigeria's monthly statutory schedules (one sheet per schedule).
import * as XLSX from 'xlsx';
import type { NgGroup, NgRegisterRow, NgStatutorySchedules } from './ngStatutorySchedules';

type Cell = string | number;
const MONEY = '#,##0.00';

function sheet(rows: Cell[][], widths: number[], moneyCols: number[] = []): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (const c of moneyCols) {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (ws[ref] && typeof ws[ref].v === 'number') ws[ref].z = MONEY;
    }
  }
  ws['!cols'] = widths.map((wch) => ({ wch }));
  return ws;
}

const header = (title: string, s: NgStatutorySchedules, org?: string): Cell[][] => [
  [title], [`${org ?? ''}${org ? ' · ' : ''}Payroll month ${s.month}`], [],
];

function groupedRows(groups: NgGroup[], cols: { label: string; get: (r: NgRegisterRow) => Cell }[], totalKeys: (string | null)[]): Cell[][] {
  const out: Cell[][] = [];
  for (const g of groups) {
    out.push([g.label]);
    out.push(cols.map((c) => c.label));
    for (const r of g.rows) out.push(cols.map((c) => c.get(r)));
    out.push(totalKeys.map((k, i) => (i === 0 ? `Total – ${g.label}` : k ? g.totals[k] : '')));
    out.push([]);
  }
  return out;
}

/** Builds the workbook (exported for tests). */
export function buildNgStatutoryWorkbook(s: NgStatutorySchedules, orgName?: string): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const t = s.totals;

  XLSX.utils.book_append_sheet(wb, sheet([
    ...header('Compliance calendar', s, orgName),
    ['Obligation', 'Authority', 'Due date', 'Note', 'Legal basis', 'Confirm with authority'],
    ...s.calendar.map((c) => [c.activity, c.authority, c.dueDate ?? 'Scheme-specific', [c.missingInput, c.onNonWorkingDay ? 'Falls on a weekend/holiday: pay by the previous working day.' : '', c.note].filter(Boolean).join(' '), c.legalBasis, c.confirmWithAuthority ? 'Yes' : '']),
  ], [48, 40, 14, 60, 50, 12]), 'Calendar');

  const regCols: { label: string; get: (r: NgRegisterRow) => Cell }[] = [
    { label: 'Employee ID', get: (r) => r.employeeNumber }, { label: 'Name', get: (r) => r.name }, { label: 'Department', get: (r) => r.department },
    { label: 'State', get: (r) => r.state }, { label: 'Basic & allowances', get: (r) => r.basicAndAllowances }, { label: 'Overtime', get: (r) => r.overtime },
    { label: 'Bonus & other', get: (r) => r.bonusAndOther }, { label: 'Gross pay', get: (r) => r.gross }, { label: 'Pension (8%)', get: (r) => r.pensionEmployee },
    { label: 'NHF (2.5%)', get: (r) => r.nhf }, { label: 'PAYE', get: (r) => r.paye }, { label: 'Other deductions', get: (r) => r.otherDeductions },
    { label: 'Total deductions', get: (r) => r.totalDeductions }, { label: 'Net pay', get: (r) => r.net }, { label: 'Employer pension (10%)', get: (r) => r.pensionEmployer },
    { label: 'NSITF (1%)', get: (r) => r.nsitf }, { label: 'Bank', get: (r) => r.bank }, { label: 'Account number', get: (r) => r.accountNumber },
  ];
  XLSX.utils.book_append_sheet(wb, sheet([
    ...header('Payroll register', s, orgName),
    regCols.map((c) => c.label),
    ...s.register.map((r) => regCols.map((c) => c.get(r))),
    ['Total', '', '', '', t.basicAndAllowances, t.overtime, t.bonusAndOther, t.gross, t.pensionEmployee, t.nhf, t.paye, t.otherDeductions, t.totalDeductions, t.net, t.pensionEmployer, t.nsitf],
  ], [12, 26, 16, 7, 16, 12, 14, 14, 13, 12, 13, 14, 15, 14, 18, 12, 18, 16], [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]), 'Payroll Register');

  XLSX.utils.book_append_sheet(wb, sheet([
    ...header('PAYE deduction schedule (by State IRS of residence)', s, orgName),
    ...groupedRows(s.payeByState, [
      { label: 'Employee ID', get: (r) => r.employeeNumber }, { label: 'Name', get: (r) => r.name }, { label: 'TIN', get: (r) => r.tin },
      { label: 'Gross pay', get: (r) => r.gross }, { label: 'Pension relief', get: (r) => r.pensionEmployee }, { label: 'NHF relief', get: (r) => r.nhf }, { label: 'PAYE', get: (r) => r.paye },
    ], [null, null, null, 'gross', 'pensionEmployee', 'nhf', 'paye']),
    ['Grand total', '', '', t.gross, t.pensionEmployee, t.nhf, t.paye],
  ], [12, 26, 18, 14, 14, 12, 14], [3, 4, 5, 6]), 'PAYE by State');

  XLSX.utils.book_append_sheet(wb, sheet([
    ...header('Pension contribution schedule (by PFA)', s, orgName),
    ...groupedRows(s.pensionByPfa, [
      { label: 'Employee ID', get: (r) => r.employeeNumber }, { label: 'Name', get: (r) => r.name }, { label: 'RSA PIN', get: (r) => r.rsaPin },
      { label: 'Employee (8%)', get: (r) => r.pensionEmployee }, { label: 'Employer (10%)', get: (r) => r.pensionEmployer }, { label: 'Total', get: (r) => r.pensionEmployee + r.pensionEmployer },
    ], [null, null, null, 'pensionEmployee', 'pensionEmployer', 'pensionTotal']),
    ['Grand total', '', '', t.pensionEmployee, t.pensionEmployer, t.pensionTotal],
  ], [12, 26, 18, 14, 14, 14], [3, 4, 5]), 'Pension by PFA');

  XLSX.utils.book_append_sheet(wb, sheet([
    ...header('NHF contribution schedule (opted-in employees)', s, orgName),
    ['Employee ID', 'Name', 'NHF number', 'Gross pay', 'NHF (2.5% of basic)'],
    ...s.nhf.map((r) => [r.employeeNumber, r.name, r.nhfNumber, r.gross, r.nhf]),
    ['Total', '', '', s.nhf.reduce((a, r) => a + r.gross, 0), t.nhf],
    ...(s.nhf.length === 0 ? [[], ['No NHF deductions this month (NHF is voluntary for private-sector employees).']] : []),
  ], [12, 26, 16, 14, 18], [3, 4]), 'NHF');

  XLSX.utils.book_append_sheet(wb, sheet([
    ...header("NSITF (employees' compensation) schedule", s, orgName),
    ['Employee ID', 'Name', 'Total emoluments', 'Employer contribution (1%)'],
    ...s.nsitf.map((r) => [r.employeeNumber, r.name, r.gross, r.nsitf]),
    ['Total', '', t.gross, t.nsitf],
  ], [12, 26, 16, 22], [2, 3]), 'NSITF');

  XLSX.utils.book_append_sheet(wb, sheet([
    ...header('Payroll journal', s, orgName),
    ['Account', 'Debit', 'Credit'],
    ...s.journal.map((l) => [l.account, l.debit || '', l.credit || '']),
    ['Total', s.journal.reduce((a, l) => a + l.debit, 0), s.journal.reduce((a, l) => a + l.credit, 0)],
  ], [44, 16, 16], [1, 2]), 'Payroll Journal');

  XLSX.utils.book_append_sheet(wb, sheet([
    ...header('Statutory liabilities and remittance control', s, orgName),
    ['Obligation', 'Authority', 'Amount due', 'Due date', 'Amount paid', 'Payment date', 'Payment reference / receipt', 'Return filed (Y/N)', 'Note'],
    ...s.liabilities.map((l) => [l.obligation, l.authority, l.amountDue, l.dueDate ?? 'Scheme-specific', '', '', '', '', l.deadlineNote]),
    ['Total', '', s.liabilities.reduce((a, l) => a + l.amountDue, 0)],
    [], ['Filing a return and paying the liability are separate obligations: record both.'],
  ], [36, 40, 14, 14, 14, 14, 26, 14, 50], [2, 4]), 'Statutory Liabilities');

  XLSX.utils.book_append_sheet(wb, sheet([
    ...header('Data checks before filing', s, orgName),
    ...(s.warnings.length ? s.warnings.map((w) => [w]) : [['No issues found.']]),
  ], [110]), 'Checks');

  return wb;
}

export function downloadNgStatutoryWorkbook(s: NgStatutorySchedules, orgName?: string) {
  const slug = (orgName || 'organisation').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'organisation';
  XLSX.writeFile(buildNgStatutoryWorkbook(s, orgName), `${slug}-NG-statutory-schedules-${s.month}.xlsx`);
}
