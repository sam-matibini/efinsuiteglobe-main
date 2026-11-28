// Monthly Nigerian payroll statutory schedules built from a month's paid pay slips.
// Column mapping for Nigerian pay slips (see nigeriaPayStub.ts):
//   cpp_contribution = pension (employee 8%)   cpp_employer = pension (employer 10%)
//   ei_premium       = NHF (employee 2.5%)     ei_employer  = NSITF (employer 1%)
//   federal_tax + provincial_tax = PAYE
import { COUNTRY_LOCALIZATIONS } from '@/data/countryLocalizations';
import { NIGERIA_COMPLIANCE_CALENDAR } from '@/data/payrollLocalization';
import { buildComplianceCalendar, type CalendarEntry } from './complianceCalendar';

export interface NgScheduleEmployee {
  id: string;
  employee_number?: string | null;
  first_name: string;
  last_name: string;
  province?: string | null;             // state of residence (PAYE goes to that State IRS)
  department?: string | null;
  bank_institution?: string | null;
  bank_account?: string | null;
  statutory_profile?: Record<string, unknown> | null;
}

export interface NgScheduleStub {
  employee_id: string;
  gross_pay: number;
  regular_earnings?: number | null;
  overtime_earnings?: number | null;
  bonus?: number | null;
  commission?: number | null;
  other_earnings?: number | null;
  cpp_contribution?: number | null;
  cpp_employer?: number | null;
  ei_premium?: number | null;
  ei_employer?: number | null;
  federal_tax?: number | null;
  provincial_tax?: number | null;
  other_deductions?: number | null;
  total_deductions?: number | null;
  net_pay: number;
}

export interface NgRegisterRow {
  employeeNumber: string;
  name: string;
  department: string;
  state: string;
  tin: string;
  rsaPin: string;
  pfa: string;
  nhfNumber: string;
  bank: string;
  accountNumber: string;
  basicAndAllowances: number;
  overtime: number;
  bonusAndOther: number;
  gross: number;
  pensionEmployee: number;
  nhf: number;
  paye: number;
  otherDeductions: number;
  totalDeductions: number;
  net: number;
  pensionEmployer: number;
  nsitf: number;
}

export interface NgGroup { key: string; label: string; rows: NgRegisterRow[]; totals: Record<string, number> }

export interface NgJournalLine { account: string; debit: number; credit: number }

export interface NgLiability {
  obligation: string;
  authority: string;
  amountDue: number;
  dueDate: string | null;
  deadlineNote: string;
}

export interface NgStatutorySchedules {
  month: string;
  register: NgRegisterRow[];
  totals: Record<string, number>;
  payeByState: NgGroup[];
  pensionByPfa: NgGroup[];
  nhf: NgRegisterRow[];
  nsitf: NgRegisterRow[];
  journal: NgJournalLine[];
  liabilities: NgLiability[];
  calendar: CalendarEntry[];
  /** Data problems a payroll officer should fix before filing (missing RSA PIN, TIN, state…). */
  warnings: string[];
}

const n = (v: number | null | undefined) => Number(v) || 0;
const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v));

const STATES = new Map((COUNTRY_LOCALIZATIONS.NG?.jurisdictions ?? []).map((j) => [j.code, j.name]));

/** "Lagos State Internal Revenue Service" / "FCT Internal Revenue Service". */
export function stateIrsName(code?: string | null): string {
  if (!code) return 'State not set';
  const name = STATES.get(code.toUpperCase()) ?? code;
  if (code.toUpperCase() === 'FC') return 'FCT Internal Revenue Service';
  return `${name} State Internal Revenue Service`;
}

const SUM_KEYS: (keyof NgRegisterRow)[] = ['basicAndAllowances', 'overtime', 'bonusAndOther', 'gross', 'pensionEmployee', 'nhf', 'paye', 'otherDeductions', 'totalDeductions', 'net', 'pensionEmployer', 'nsitf'];
function sum(rows: NgRegisterRow[]): Record<string, number> {
  const t: Record<string, number> = {};
  for (const k of SUM_KEYS) t[k] = r2(rows.reduce((s, r) => s + (r[k] as number), 0));
  t.pensionTotal = r2(t.pensionEmployee + t.pensionEmployer);
  t.headcount = rows.length;
  return t;
}
function groupBy(rows: NgRegisterRow[], key: (r: NgRegisterRow) => string, label: (k: string) => string): NgGroup[] {
  const m = new Map<string, NgRegisterRow[]>();
  for (const r of rows) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
  return [...m.entries()]
    .map(([k, rs]) => ({ key: k, label: label(k), rows: rs, totals: sum(rs) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function buildNgStatutorySchedules(input: {
  month: string;                         // 'YYYY-MM'
  employees: NgScheduleEmployee[];
  stubs: NgScheduleStub[];
  salaryPaymentDate?: string;
  holidays?: string[];
}): NgStatutorySchedules {
  const emp = new Map(input.employees.map((e) => [e.id, e]));
  const warnings: string[] = [];

  const register: NgRegisterRow[] = input.stubs.map((s) => {
    const e = emp.get(s.employee_id);
    const p = (e?.statutory_profile ?? {}) as Record<string, unknown>;
    const name = e ? `${e.last_name}, ${e.first_name}` : `Unknown (${s.employee_id})`;
    const overtime = n(s.overtime_earnings);
    const bonusAndOther = n(s.bonus) + n(s.commission) + n(s.other_earnings);
    const gross = n(s.gross_pay);
    return {
      employeeNumber: str(e?.employee_number),
      name,
      department: str(e?.department),
      state: str(e?.province).toUpperCase(),
      tin: str(p.tax_id),
      rsaPin: str(p.rsa_number),
      pfa: str(p.pension_fund_administrator),
      nhfNumber: str(p.nhf_number),
      bank: str(e?.bank_institution),
      accountNumber: str(e?.bank_account),
      basicAndAllowances: r2(Math.max(0, gross - overtime - bonusAndOther)),
      overtime: r2(overtime),
      bonusAndOther: r2(bonusAndOther),
      gross: r2(gross),
      pensionEmployee: r2(n(s.cpp_contribution)),
      nhf: r2(n(s.ei_premium)),
      paye: r2(n(s.federal_tax) + n(s.provincial_tax)),
      otherDeductions: r2(n(s.other_deductions)),
      totalDeductions: r2(n(s.total_deductions)),
      net: r2(n(s.net_pay)),
      pensionEmployer: r2(n(s.cpp_employer)),
      nsitf: r2(n(s.ei_employer)),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  for (const r of register) {
    const who = `${r.name}${r.employeeNumber ? ` (${r.employeeNumber})` : ''}`;
    if (!r.state) warnings.push(`${who}: no state of residence, so PAYE cannot be assigned to a State IRS.`);
    if (!r.tin) warnings.push(`${who}: no TIN on file for the PAYE schedule.`);
    if (r.pensionEmployee > 0 && !r.rsaPin) warnings.push(`${who}: no RSA PIN for the pension schedule.`);
    if (r.pensionEmployee > 0 && !r.pfa) warnings.push(`${who}: no Pension Fund Administrator on file.`);
    if (r.nhf > 0 && !r.nhfNumber) warnings.push(`${who}: NHF deducted but no NHF number on file.`);
  }

  const totals = sum(register);
  const payeByState = groupBy(register, (r) => r.state || '—', (k) => (k === '—' ? 'State not set' : stateIrsName(k)));
  const pensionByPfa = groupBy(register.filter((r) => r.pensionEmployee + r.pensionEmployer > 0), (r) => r.pfa || '—', (k) => (k === '—' ? 'PFA not set' : k));
  const nhf = register.filter((r) => r.nhf > 0);
  const nsitf = register;

  // Payroll journal (accrual at payroll date). Debits = gross + employer costs; credits = liabilities.
  const journal: NgJournalLine[] = [
    { account: 'Salaries and wages expense', debit: totals.gross, credit: 0 },
    { account: 'Employer pension contribution expense', debit: totals.pensionEmployer, credit: 0 },
    { account: 'NSITF (employees’ compensation) expense', debit: totals.nsitf, credit: 0 },
    { account: 'PAYE payable (State IRS)', debit: 0, credit: totals.paye },
    { account: 'Pension payable (employee + employer)', debit: 0, credit: totals.pensionTotal },
    { account: 'NHF payable (FMBN)', debit: 0, credit: totals.nhf },
    { account: 'NSITF payable', debit: 0, credit: totals.nsitf },
    { account: 'Other payroll deductions payable', debit: 0, credit: totals.otherDeductions },
    { account: 'Net salaries payable', debit: 0, credit: totals.net },
  ].filter((l) => l.debit !== 0 || l.credit !== 0);
  const dr = r2(journal.reduce((s, l) => s + l.debit, 0));
  const cr = r2(journal.reduce((s, l) => s + l.credit, 0));
  if (Math.abs(dr - cr) > 0.05) warnings.push(`Payroll journal does not balance: debits ${dr.toFixed(2)} vs credits ${cr.toFixed(2)}. Check pay slip totals.`);

  const calendar = buildComplianceCalendar(NIGERIA_COMPLIANCE_CALENDAR, { month: input.month, salaryPaymentDate: input.salaryPaymentDate, holidays: input.holidays, includeAnnual: true });
  const due = (id: string) => calendar.find((c) => c.id === id);
  const note = (c?: CalendarEntry) => (c ? (c.missingInput ?? c.note ?? '') : '');
  const liabilities: NgLiability[] = [
    ...payeByState.map((g) => ({ obligation: `PAYE (${g.rows.length} employee${g.rows.length === 1 ? '' : 's'})`, authority: g.label, amountDue: g.totals.paye, dueDate: due('paye')?.dueDate ?? null, deadlineNote: note(due('paye')) })),
    ...pensionByPfa.map((g) => ({ obligation: 'Pension (employee 8% + employer 10%)', authority: g.label === 'PFA not set' ? g.label : `${g.label} (via its PFC)`, amountDue: g.totals.pensionTotal, dueDate: due('pension')?.dueDate ?? null, deadlineNote: note(due('pension')) })),
    ...(totals.nhf > 0 ? [{ obligation: 'NHF (2.5% of basic, opted-in staff)', authority: 'Federal Mortgage Bank of Nigeria', amountDue: totals.nhf, dueDate: due('nhf')?.dueDate ?? null, deadlineNote: note(due('nhf')) }] : []),
    { obligation: 'NSITF (employer 1%)', authority: 'Nigeria Social Insurance Trust Fund', amountDue: totals.nsitf, dueDate: due('nsitf')?.dueDate ?? null, deadlineNote: note(due('nsitf')) },
  ].filter((l) => l.amountDue > 0);

  return { month: input.month, register, totals, payeByState, pensionByPfa, nhf, nsitf, journal, liabilities, calendar, warnings };
}
