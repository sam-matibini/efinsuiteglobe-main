/**
 * Monthly source-deduction (PD7A) periods.
 *
 * A pay run belongs to the remittance month in which its pay period ENDS. A pay period
 * of Sep 22 – Oct 5, 2026 is reported on the October 2026 PD7A, even though it started
 * in September. Dates are handled as plain YYYY-MM-DD strings so the result never shifts
 * with the browser's time zone.
 */

const pad = (n: number) => String(n).padStart(2, '0');

function lastDayOfMonth(year: number, month: number) {
  // Day 0 of the next month is the last day of this month; read it in UTC.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Parse "YYYY-MM" or "YYYY-MM-DD" into a year and month. */
function parseMonth(period: string) {
  const match = /^(\d{4})-(\d{1,2})/.exec(period.trim());
  if (!match) throw new Error(`Invalid remittance period: ${period}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error(`Invalid remittance period: ${period}`);
  return { year, month };
}

/** The remittance month ("YYYY-MM") a pay period ending on `payPeriodEnd` belongs to. */
export function remittanceMonthFor(payPeriodEnd: string): string {
  const { year, month } = parseMonth(payPeriodEnd);
  return `${year}-${pad(month)}`;
}

/**
 * Date range used to select pay runs for a remittance month (by pay period end date),
 * and the regular-remitter due date: the 15th of the following month.
 */
export function remittanceMonthRange(period: string) {
  const { year, month } = parseMonth(period);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    period: `${year}-${pad(month)}`,
    startDate: `${year}-${pad(month)}-01`,
    endDate: `${year}-${pad(month)}-${pad(lastDayOfMonth(year, month))}`,
    dueDate: `${nextYear}-${pad(nextMonth)}-15`,
  };
}

/** True when a pay period ending on `payPeriodEnd` is reported in `period` ("YYYY-MM"). */
export function belongsToRemittanceMonth(payPeriodEnd: string, period: string): boolean {
  return remittanceMonthFor(payPeriodEnd) === remittanceMonthRange(period).period;
}

/**
 * CRA identifiers for the PD7A header. The business number is the 9-digit BN. The payroll
 * account is an RP program account (BN + "RP" + 4 digits). Other program accounts, such as
 * RR (registered charity) or RT (GST/HST), are never shown as the payroll account.
 */
export function craRemittanceAccounts(org: { business_number?: string | null; payroll_account_number?: string | null }) {
  const clean = (value?: string | null) => (value ?? '').toUpperCase().replace(/[\s-]/g, '');
  const bnSource = clean(org.business_number) || clean(org.payroll_account_number);
  const bnMatch = /^(\d{9})/.exec(bnSource);
  const businessNumber = bnMatch ? bnMatch[1] : undefined;
  const isPayrollAccount = (value: string) => /^\d{9}RP\d{4}$/.test(value);
  const payroll = [clean(org.payroll_account_number), clean(org.business_number)].find(isPayrollAccount);
  return { businessNumber, payrollAccountNumber: payroll };
}
