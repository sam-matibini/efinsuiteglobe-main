import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { buildNgStatutoryWorkbook } from './ngStatutoryExport';
import { buildNgStatutorySchedules, stateIrsName, type NgScheduleEmployee, type NgScheduleStub } from './ngStatutorySchedules';

const employees: NgScheduleEmployee[] = [
  { id: 'a', employee_number: 'EMP001', first_name: 'Ada', last_name: 'Obi', province: 'LA', statutory_profile: { tax_id: '12345678-0001', rsa_number: 'PEN100', pension_fund_administrator: 'Stanbic IBTC Pension', nhf_number: 'NHF9' } },
  { id: 'b', employee_number: 'EMP002', first_name: 'Musa', last_name: 'Bello', province: 'FC', statutory_profile: { tax_id: '22222222-0001', rsa_number: 'PEN200', pension_fund_administrator: 'ARM Pension' } },
  { id: 'c', employee_number: 'EMP003', first_name: 'Ngozi', last_name: 'Eze', province: 'LA', statutory_profile: {} },
];
// Illustrative pay slips in the Nigerian column mapping (pension=cpp, NHF=ei_premium, NSITF=ei_employer, PAYE=federal_tax).
const stubs: NgScheduleStub[] = [
  { employee_id: 'a', gross_pay: 500000, cpp_contribution: 40000, cpp_employer: 50000, ei_premium: 6250, ei_employer: 5000, federal_tax: 65000, provincial_tax: 0, total_deductions: 111250, net_pay: 388750 },
  { employee_id: 'b', gross_pay: 300000, bonus: 50000, cpp_contribution: 20000, cpp_employer: 25000, ei_premium: 0, ei_employer: 3000, federal_tax: 30000, provincial_tax: 0, total_deductions: 50000, net_pay: 250000 },
  { employee_id: 'c', gross_pay: 200000, cpp_contribution: 16000, cpp_employer: 20000, ei_premium: 0, ei_employer: 2000, federal_tax: 9000, provincial_tax: 0, other_deductions: 5000, total_deductions: 30000, net_pay: 170000 },
];

const s = buildNgStatutorySchedules({ month: '2026-11', employees, stubs, salaryPaymentDate: '2026-11-27' });

describe('Nigeria statutory schedules', () => {
  it('builds the payroll register with totals', () => {
    expect(s.register.map((r) => r.employeeNumber)).toEqual(['EMP002', 'EMP003', 'EMP001']); // by surname
    expect(s.totals).toMatchObject({ gross: 1_000_000, paye: 104_000, pensionEmployee: 76_000, pensionEmployer: 95_000, pensionTotal: 171_000, nhf: 6_250, nsitf: 10_000, net: 808_750, headcount: 3 });
    const musa = s.register.find((r) => r.employeeNumber === 'EMP002')!;
    expect(musa.bonusAndOther).toBe(50_000);
    expect(musa.basicAndAllowances).toBe(250_000);
  });

  it('groups PAYE by the State IRS of residence', () => {
    expect(s.payeByState.map((g) => [g.label, g.totals.paye, g.rows.length])).toEqual([
      ['FCT Internal Revenue Service', 30_000, 1],
      ['Lagos State Internal Revenue Service', 74_000, 2],
    ]);
  });

  it('groups pension by PFA and flags missing RSA PIN / PFA', () => {
    expect(s.pensionByPfa.map((g) => [g.label, g.totals.pensionTotal])).toEqual([
      ['ARM Pension', 45_000], ['PFA not set', 36_000], ['Stanbic IBTC Pension', 90_000],
    ]);
    expect(s.warnings.some((w) => w.includes('Eze, Ngozi') && w.includes('RSA PIN'))).toBe(true);
    expect(s.warnings.some((w) => w.includes('Eze, Ngozi') && w.includes('TIN'))).toBe(true);
  });

  it('lists only NHF contributors on the NHF schedule; NSITF covers everyone', () => {
    expect(s.nhf.map((r) => r.employeeNumber)).toEqual(['EMP001']);
    expect(s.nsitf).toHaveLength(3);
  });

  it('produces a balanced payroll journal', () => {
    const dr = s.journal.reduce((t, l) => t + l.debit, 0);
    const cr = s.journal.reduce((t, l) => t + l.credit, 0);
    expect(dr).toBeCloseTo(cr, 2);
    expect(dr).toBe(1_000_000 + 95_000 + 10_000);
    expect(s.warnings.some((w) => w.includes('does not balance'))).toBe(false);
  });

  it('lists liabilities with due dates from the compliance calendar', () => {
    const paye = s.liabilities.filter((l) => l.obligation.startsWith('PAYE'));
    expect(paye.map((l) => [l.authority, l.amountDue, l.dueDate])).toEqual([
      ['FCT Internal Revenue Service', 30_000, '2026-12-10'],
      ['Lagos State Internal Revenue Service', 74_000, '2026-12-10'],
    ]);
    expect(s.liabilities.find((l) => l.authority.startsWith('ARM'))?.dueDate).toBe('2026-12-08');
    expect(s.liabilities.find((l) => l.obligation.startsWith('NHF'))?.dueDate).toBe('2026-12-31');
    expect(s.liabilities.find((l) => l.obligation.startsWith('NSITF'))?.dueDate).toBeNull();
  });

  it('warns when the journal does not balance', () => {
    const bad = buildNgStatutorySchedules({ month: '2026-11', employees, stubs: [{ ...stubs[0], net_pay: 1 }] });
    expect(bad.warnings.some((w) => w.includes('does not balance'))).toBe(true);
  });

  it('names State IRSs', () => {
    expect(stateIrsName('LA')).toBe('Lagos State Internal Revenue Service');
    expect(stateIrsName('fc')).toBe('FCT Internal Revenue Service');
    expect(stateIrsName(null)).toBe('State not set');
  });
});

describe('statutory workbook', () => {
  const wb = buildNgStatutoryWorkbook(s, 'Demo Ltd');
  it('has one sheet per schedule', () => {
    expect(wb.SheetNames).toEqual(['Calendar', 'Payroll Register', 'PAYE by State', 'Pension by PFA', 'NHF', 'NSITF', 'Payroll Journal', 'Statutory Liabilities', 'Checks']);
  });
  it('keeps RSA PINs and IDs as text and totals PAYE by state', () => {
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets['PAYE by State'], { header: 1 });
    expect(rows.find((r) => r[0] === 'Total – Lagos State Internal Revenue Service')?.[6]).toBe(74_000);
    expect(rows.find((r) => r[0] === 'Grand total')?.[6]).toBe(104_000);
    const pen = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets['Pension by PFA'], { header: 1 });
    expect(pen.some((r) => r[2] === 'PEN100')).toBe(true);
  });
  it('journal sheet balances', () => {
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets['Payroll Journal'], { header: 1 });
    const total = rows.find((r) => r[0] === 'Total')!;
    expect(total[1]).toBe(total[2]);
  });
});
