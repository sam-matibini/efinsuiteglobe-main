import { describe, expect, it } from 'vitest';
import { reminderMessage, upcomingFilingReminders } from './filingReminders';

const today = '2026-10-04';

describe('tax filing reminders', () => {
  it('lists the next GST/HST, corporation, payroll, and T4 dates for a December year-end', () => {
    const reminders = upcomingFilingReminders({
      today,
      fiscalYearEndMonth: 12,
      gstFrequency: 'quarterly',
      corporationKind: 'ccpc',
    });
    const byKind = Object.fromEntries(reminders.map((item) => [item.kind === 'gst_hst' ? `${item.kind}-${item.dueDate}` : item.kind, item.dueDate]));

    expect(byKind['payroll_remittance']).toBe('2026-10-15');
    expect(byKind['gst_hst-2026-10-31']).toBe('2026-10-31');
    expect(byKind['gst_hst-2027-01-31']).toBe('2027-01-31');
    expect(byKind.t4_slip).toBe('2027-02-28');
    expect(byKind.corporate_balance).toBe('2027-03-31');
    expect(byKind.corporate_return).toBe('2027-06-30');
    expect(reminders.find((item) => item.dueDate === '2026-10-31')?.detail).toMatch(/September 30, 2026/);
    expect(reminders.every((item) => item.overdue === false)).toBe(true);
  });

  it('uses a two-month corporate balance for corporations that are not CCPCs', () => {
    const reminders = upcomingFilingReminders({
      today,
      fiscalYearEndMonth: 12,
      corporationKind: 'other',
    });
    expect(reminders.find((item) => item.kind === 'corporate_balance')?.dueDate).toBe('2027-02-28');
  });

  it('uses February 29 when the corporate balance lands in a leap year', () => {
    const reminders = upcomingFilingReminders({
      today: '2027-10-01',
      fiscalYearEndMonth: 12,
      corporationKind: 'other',
    });
    expect(reminders.find((item) => item.kind === 'corporate_balance')?.dueDate).toBe('2028-02-29');
  });

  it('marks a recent GST period overdue and keeps the next monthly date', () => {
    const reminders = upcomingFilingReminders({
      today,
      gstFrequency: 'monthly',
    });
    const gst = reminders.filter((item) => item.kind === 'gst_hst');
    expect(gst.map((item) => item.dueDate)).toContain('2026-09-30');
    expect(gst.find((item) => item.dueDate === '2026-09-30')?.overdue).toBe(true);
    expect(gst.map((item) => item.dueDate)).toContain('2026-10-31');
  });

  it('prefers a saved compliance deadline and skips filings that are already filed', () => {
    const reminders = upcomingFilingReminders({
      today,
      fiscalYearEndMonth: 12,
      gstFrequency: 'quarterly',
      deadlines: [
        { id: 'filed', filingType: 'GST/HST return', dueDate: '2026-10-31', status: 'filed' },
        { id: 'open', filingType: 'GST/HST return', dueDate: '2026-10-31', extendedDueDate: '2026-11-05', status: 'pending' },
      ],
      periods: [
        { id: 'done', dueDate: '2026-10-15', periodStart: '2026-07-01', periodEnd: '2026-09-30', status: 'paid' },
      ],
    });
    expect(reminders.some((item) => item.id === 'compliance-filed')).toBe(false);
    expect(reminders.find((item) => item.id === 'compliance-open')?.dueDate).toBe('2026-11-05');
    expect(reminders.some((item) => item.id === 'gst-quarterly-2026-10-31')).toBe(false);
    expect(reminders.some((item) => item.kind === 'gst_hst' && item.dueDate === '2027-01-31')).toBe(true);
  });

  it('writes a reminder the contact can receive by email, SMS, or WhatsApp', () => {
    const [first] = upcomingFilingReminders({ today, fiscalYearEndMonth: 12 });
    const message = reminderMessage('eFintax Advisors Ltd', first);
    expect(message.subject).toMatch(/due /);
    expect(message.body).toMatch(/^eFintax Advisors Ltd: /);
    expect(message.body).toContain(first.detail);
  });
});
