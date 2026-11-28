import { describe, expect, it } from 'vitest';
import { NIGERIA_COMPLIANCE_CALENDAR, NIGERIA_STATUTORY_REPORTS, getPayrollLocalization } from '@/data/payrollLocalization';
import { addWorkingDays, buildComplianceCalendar, dueStatus } from './complianceCalendar';

const byId = (rows: ReturnType<typeof buildComplianceCalendar>) => Object.fromEntries(rows.map((r) => [r.id, r]));

describe('working days', () => {
  it('skips weekends and holidays', () => {
    // Fri 27 Nov 2026 + 7 working days → Tue 8 Dec 2026
    expect(addWorkingDays('2026-11-27', 7)).toBe('2026-12-08');
    // with a holiday on Tue 1 Dec → Wed 9 Dec
    expect(addWorkingDays('2026-11-27', 7, ['2026-12-01'])).toBe('2026-12-09');
  });
});

describe('Nigeria compliance calendar', () => {
  it('works out the monthly deadlines for November 2026 payroll', () => {
    const cal = byId(buildComplianceCalendar(NIGERIA_COMPLIANCE_CALENDAR, { month: '2026-11', salaryPaymentDate: '2026-11-27' }));
    expect(cal.pension.dueDate).toBe('2026-12-08');      // 7 working days after salary
    expect(cal.paye.dueDate).toBe('2026-12-10');
    expect(cal.vat.dueDate).toBe('2026-12-21');
    expect(cal.wht_federal.dueDate).toBe('2026-12-21');
    expect(cal.wht_state.dueDate).toBe('2026-12-30');
    expect(cal.nhf.dueDate).toBe('2026-12-31');
    expect(cal.month_end.dueDate).toBe('2026-11-30');
    expect(cal.nsitf.dueDate).toBeNull();                // scheme-specific
    expect(cal.paye.confirmWithAuthority).toBe(true);
    expect(cal.itf_annual).toBeUndefined();              // not due in December
  });

  it('asks for the salary payment date before dating pension', () => {
    const cal = byId(buildComplianceCalendar(NIGERIA_COMPLIANCE_CALENDAR, { month: '2026-11' }));
    expect(cal.pension.dueDate).toBeNull();
    expect(cal.pension.missingInput).toMatch(/salary payment date/);
  });

  it('shows annual items in the month before they fall due', () => {
    const march = byId(buildComplianceCalendar(NIGERIA_COMPLIANCE_CALENDAR, { month: '2027-03' }));
    expect(march.itf_annual.dueDate).toBe('2027-04-01');
    const dec = byId(buildComplianceCalendar(NIGERIA_COMPLIANCE_CALENDAR, { month: '2026-12' }));
    expect(dec.paye_annual.dueDate).toBe('2027-01-31');   // crosses the year
    expect(dec.paye.dueDate).toBe('2027-01-10');
  });

  it('clamps the state WHT 30th to the end of February and flags weekend due dates', () => {
    const jan = byId(buildComplianceCalendar(NIGERIA_COMPLIANCE_CALENDAR, { month: '2027-01' }));
    expect(jan.wht_state.dueDate).toBe('2027-02-28');
    expect(jan.wht_state.onNonWorkingDay).toBe(true);    // 28 Feb 2027 is a Sunday
    expect(jan.paye.onNonWorkingDay).toBe(false);        // 10 Feb 2027 is a Wednesday
  });

  it('sorts dated items first', () => {
    const rows = buildComplianceCalendar(NIGERIA_COMPLIANCE_CALENDAR, { month: '2026-11', salaryPaymentDate: '2026-11-27' });
    const dated = rows.filter((r) => r.dueDate).map((r) => r.dueDate!);
    expect(dated).toEqual([...dated].sort());
    expect(rows[rows.length - 1].dueDate).toBeNull();
  });

  it('rejects a bad month', () => {
    expect(() => buildComplianceCalendar(NIGERIA_COMPLIANCE_CALENDAR, { month: 'Nov' })).toThrow();
  });
});

describe('due status', () => {
  it('classifies due dates', () => {
    expect(dueStatus('2026-12-01', '2026-12-05')).toBe('overdue');
    expect(dueStatus('2026-12-08', '2026-12-05')).toBe('due_soon');
    expect(dueStatus('2026-12-21', '2026-12-05')).toBe('upcoming');
    expect(dueStatus(null, '2026-12-05')).toBe('no_date');
  });
});

describe('Nigeria report schema', () => {
  it('is attached to the Nigeria variant and links every report to a known deadline', () => {
    const ng = getPayrollLocalization('NG');
    expect(ng.statutoryReports).toBe(NIGERIA_STATUTORY_REPORTS);
    expect(ng.complianceCalendar).toBe(NIGERIA_COMPLIANCE_CALENDAR);
    const ids = new Set(NIGERIA_COMPLIANCE_CALENDAR.map((d) => d.id));
    for (const r of NIGERIA_STATUTORY_REPORTS) if (r.deadlineId) expect(ids.has(r.deadlineId)).toBe(true);
    expect(new Set(NIGERIA_STATUTORY_REPORTS.map((r) => r.id)).size).toBe(NIGERIA_STATUTORY_REPORTS.length);
  });
  it('covers every monthly payroll statutory report from the spec', () => {
    const payroll = NIGERIA_STATUTORY_REPORTS.filter((r) => r.category === 'payroll').map((r) => r.name);
    expect(payroll).toEqual(['Payroll Register', 'PAYE Deduction Schedule', 'Pension Contribution Schedule', 'NHF Contribution Schedule', 'NSITF Contribution Schedule', 'NHIA / Health Insurance Schedule', 'Payroll Journal', 'Payroll Bank Reconciliation']);
  });
  it('does not list ITF as a monthly remittance', () => {
    expect(getPayrollLocalization('NG').remittances.description).not.toMatch(/\bITF\b/);
    expect(NIGERIA_COMPLIANCE_CALENDAR.find((d) => d.id === 'itf_annual')?.rule).toEqual({ kind: 'annual', month: 4, day: 1 });
  });
  it('other countries are unaffected', () => {
    expect(getPayrollLocalization('CA').statutoryReports).toBeUndefined();
  });
});
