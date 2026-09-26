/**
 * Non-EDI CRA payments, client-entered balances, payroll remittances, and
 * GST/HST filing choices. CRA does not publish a developer API for these.
 * Nothing here is marked paid or CRA-verified unless a person records a
 * bank reference or a CRA confirmation they actually received.
 */

export type CraPayeeType = 'taxowing' | 'instalment' | 'payroll' | 'gst_hst';
export type TaxpayerKind = 'individual' | 'business';
export type ProgramSuffix = 'RC' | 'RP' | 'RT';
export type RemitterType = 'regular' | 'quarterly' | 'threshold_1' | 'threshold_2';
export type BillPayStatus =
  | 'draft'
  | 'funding_received'
  | 'submitted_to_bank'
  | 'noted_on_cra_account'
  | 'unresolved'
  | 'cancelled';

export type GstFilePath = 'rac' | 'netfile' | 'edi';
export type RacAuthStatus = 'pending' | 'active' | 'revoked';

export const PAYEE_TYPE_LABEL: Record<CraPayeeType, string> = {
  taxowing: 'Tax owing',
  instalment: 'Corporation tax instalment',
  payroll: 'Payroll source deductions',
  gst_hst: 'GST/HST',
};

/** Examples from CRA payment descriptions. Confirm the exact name on the bank's bill-pay list. */
export const PAYEE_EXAMPLES: Record<CraPayeeType, string> = {
  taxowing: 'CRA (revenue) – tax owing',
  instalment: 'Federal – Corporation Tax Payments – TXINS',
  payroll: 'Federal Payroll Deductions – EMPTX – (PD7A)',
  gst_hst: 'Federal – GST/HST Payment – GST-P',
};

export const PROGRAM_FOR_PAYEE: Record<CraPayeeType, ProgramSuffix> = {
  taxowing: 'RC',
  instalment: 'RC',
  payroll: 'RP',
  gst_hst: 'RT',
};

const BANKS = ['RBC', 'TD', 'Scotiabank', 'BMO', 'CIBC', 'National Bank', 'Other'] as const;
export type BankName = (typeof BANKS)[number];
export const BANK_NAMES: BankName[] = [...BANKS];

export interface PaymentInstructionInput {
  clientId: string;
  taxpayerKind: TaxpayerKind;
  sin?: string;
  programAccount?: string;
  payeeType: CraPayeeType | '';
  bankName: BankName | '';
  payeeName: string;
  payeeNameConfirmed: boolean;
  taxYear: string;
  period: string;
  amount: number;
  valueDate: string;
  dueDate: string;
  safeguardedAccount: string;
  kycCleared: boolean;
  now?: Date;
}

export interface PaymentInstruction {
  id: string;
  clientId: string;
  taxpayerKind: TaxpayerKind;
  sinMasked: string | null;
  /** Stored so the remittance can be traced. Not a CRA password. */
  sin?: string;
  programAccount: string | null;
  payeeType: CraPayeeType;
  bankName: string;
  payeeName: string;
  taxYear: string;
  period: string;
  amount: number;
  valueDate: string;
  dueDate: string;
  safeguardedAccount: string;
  kycCleared: boolean;
  status: BillPayStatus;
  fundingReference?: string;
  bankConfirmation?: string;
  craObservation?: string;
  createdAt: string;
  retainUntil: string;
  submittedAt?: string;
  events: { at: string; action: string }[];
}

export interface ClientBalance {
  id: string;
  clientId: string;
  program: ProgramSuffix;
  amount: number;
  asOf: string;
  source: 'client_provided';
  verifiedByCra: false;
}

export interface RacAuthorization {
  id: string;
  clientId: string;
  status: RacAuthStatus;
  level: 1 | 2 | 3;
  method: 'represent_a_client';
  updatedAt: string;
  verifiedByCra: false;
}

const CUTOFF_HOUR = 15;
const LEAD_BUSINESS_DAYS = 3;
const UNRESOLVED_BUSINESS_DAYS = 5;
const BALANCE_STALE_DAYS = 30;
const KYC_AMOUNT = 1000;

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function luhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let doubleDigit = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = digits.charCodeAt(i) - 48;
    if (doubleDigit) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

export function validateSin(sin: string): string | null {
  const digits = digitsOnly(sin);
  if (digits.length !== 9) return 'A SIN must be 9 digits.';
  if (digits === '000000000') return 'That SIN is not valid.';
  if (!luhnValid(digits)) return 'The SIN check digit does not match. One wrong digit misapplies the payment.';
  return null;
}

export function validateBusinessNumber(bn: string): string | null {
  const digits = digitsOnly(bn);
  if (digits.length !== 9) return 'A business number must be 9 digits.';
  return null;
}

export function parseProgramAccount(value: string): { bn: string; program: ProgramSuffix; reference: string } | null {
  const compact = value.replace(/[\s-]/g, '').toUpperCase();
  const match = /^(\d{9})(RC|RP|RT)(\d{4})$/.exec(compact);
  if (!match) return null;
  return { bn: match[1], program: match[2] as ProgramSuffix, reference: match[3] };
}

export function parseTransmitterAccount(value: string): { bn: string; program: string; reference: string } | null {
  const compact = value.replace(/[\s-]/g, '').toUpperCase();
  const match = /^(\d{9})(RC|RP|RT|RZ)(\d{4})$/.exec(compact);
  if (!match) return null;
  return { bn: match[1], program: match[2], reference: match[3] };
}

export function maskSin(sin: string): string {
  const digits = digitsOnly(sin);
  return `***-***-${digits.slice(-3)}`;
}

function torontoParts(date: Date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
  };
}

function utcDate(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const date = utcDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return isoDate(new Date(Date.UTC(year, month - 1, day)));
}

function nthWeekday(year: number, monthIndex: number, weekday: number, n: number): string {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return isoDate(new Date(Date.UTC(year, monthIndex, 1 + offset + (n - 1) * 7)));
}

function observed(iso: string): string {
  const day = utcDate(iso).getUTCDay();
  if (day === 6) return addDays(iso, 2);
  if (day === 0) return addDays(iso, 1);
  return iso;
}

export function federalHolidays(year: number): Set<string> {
  const easter = easterSunday(year);
  const may24 = utcDate(`${year}-05-24`);
  const victoriaDay = addDays(`${year}-05-24`, -((may24.getUTCDay() + 6) % 7));
  return new Set([
    observed(`${year}-01-01`),
    addDays(easter, -2),
    victoriaDay,
    observed(`${year}-07-01`),
    nthWeekday(year, 8, 1, 1),
    observed(`${year}-09-30`),
    nthWeekday(year, 9, 1, 2),
    observed(`${year}-11-11`),
    observed(`${year}-12-25`),
    observed(`${year}-12-26`),
  ]);
}

export function isBusinessDay(iso: string): boolean {
  const date = utcDate(iso.slice(0, 10));
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return false;
  return !federalHolidays(date.getUTCFullYear()).has(iso.slice(0, 10));
}

export function nextBusinessDay(iso: string): string {
  let cursor = addDays(iso.slice(0, 10), 1);
  while (!isBusinessDay(cursor)) cursor = addDays(cursor, 1);
  return cursor;
}

export function previousBusinessDay(iso: string): string {
  let cursor = addDays(iso.slice(0, 10), -1);
  while (!isBusinessDay(cursor)) cursor = addDays(cursor, -1);
  return cursor;
}

export function addBusinessDays(iso: string, count: number): string {
  let cursor = iso.slice(0, 10);
  let left = count;
  while (left > 0) {
    cursor = nextBusinessDay(cursor);
    left -= 1;
  }
  return cursor;
}

export function businessDaysBetween(start: string, end: string): number {
  let count = 0;
  let cursor = start.slice(0, 10);
  const stop = end.slice(0, 10);
  while (cursor < stop) {
    cursor = addDays(cursor, 1);
    if (isBusinessDay(cursor)) count += 1;
  }
  return count;
}

export function onOrNextBusinessDay(iso: string): string {
  return isBusinessDay(iso) ? iso.slice(0, 10) : nextBusinessDay(iso);
}

export function earliestValueDate(now = new Date()): string {
  const parts = torontoParts(now);
  if (isBusinessDay(parts.date) && parts.hour < CUTOFF_HOUR) return parts.date;
  return nextBusinessDay(parts.date);
}

export function validateValueDate(valueDate: string, dueDate: string, now = new Date()): string | null {
  const requested = valueDate.slice(0, 10);
  if (!isBusinessDay(requested)) return 'The value date must be a business day.';
  const earliest = earliestValueDate(now);
  if (requested < earliest) {
    return `Same-day bill pay is closed after ${CUTOFF_HOUR}:00 Eastern. The earliest value date is ${earliest}.`;
  }
  const lead = businessDaysBetween(requested, dueDate.slice(0, 10));
  if (lead < LEAD_BUSINESS_DAYS) {
    return `Schedule the value date at least ${LEAD_BUSINESS_DAYS} business days before the CRA due date. The taxpayer is liable if CRA receives it late.`;
  }
  return null;
}

export function payrollDueDate(remitter: RemitterType, periodEnd: string, payDate?: string): string {
  const end = periodEnd.slice(0, 10);
  const [year, month, day] = end.split('-').map(Number);
  if (remitter === 'threshold_2') {
    const anchor = (payDate || end).slice(0, 10);
    return addBusinessDays(anchor, 3);
  }
  if (remitter === 'quarterly') {
    const quarterEndMonth = Math.ceil(month / 3) * 3;
    const quarterEnd = isoDate(new Date(Date.UTC(year, quarterEndMonth, 0)));
    const nextMonth = utcDate(quarterEnd);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    return onOrNextBusinessDay(isoDate(new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), 15))));
  }
  if (remitter === 'threshold_1') {
    const paid = (payDate || end).slice(0, 10);
    const paidDay = Number(paid.slice(8, 10));
    const paidDate = utcDate(paid);
    if (paidDay <= 15) {
      return onOrNextBusinessDay(isoDate(new Date(Date.UTC(paidDate.getUTCFullYear(), paidDate.getUTCMonth(), 25))));
    }
    return onOrNextBusinessDay(isoDate(new Date(Date.UTC(paidDate.getUTCFullYear(), paidDate.getUTCMonth() + 1, 10))));
  }
  const following = new Date(Date.UTC(year, month - 1 + 1, 15));
  return onOrNextBusinessDay(isoDate(following));
}

export function validatePaymentInstruction(input: PaymentInstructionInput): string[] {
  const errors: string[] = [];
  if (!input.clientId.trim()) errors.push('Choose the client.');
  if (!input.payeeType) errors.push('Choose the CRA payee type. It is not selected for you.');
  if (!input.bankName) errors.push('Choose the bank.');
  if (!input.payeeName.trim()) errors.push('Enter the CRA payee name exactly as it appears on that bank\'s bill-pay list.');
  if (!input.payeeNameConfirmed) errors.push('Confirm the payee name against the bank list before the instruction is saved.');
  if (!input.taxYear.trim() || !input.period.trim()) errors.push('Enter the tax year and period.');
  if (!(input.amount > 0)) errors.push('Enter an amount greater than zero.');
  if (!input.valueDate || !input.dueDate) errors.push('Enter the value date and the CRA due date.');
  if (/operating/i.test(input.safeguardedAccount)) {
    errors.push('Client funds must land in the RPAA trust account, not the operating account.');
  } else if (!/trust|safeguard|rpaa/i.test(input.safeguardedAccount)) {
    errors.push('Name the safeguarded RPAA trust account that will hold the client funds.');
  }
  if (input.amount >= KYC_AMOUNT && !input.kycCleared) {
    errors.push('FINTRAC identity verification is required before sending $1,000 or more.');
  }

  if (input.payeeType === 'payroll' || input.payeeType === 'gst_hst' || input.taxpayerKind === 'business') {
    const parsed = parseProgramAccount(input.programAccount || '');
    if (!parsed) {
      errors.push('A business program account looks like 123456789RP0001: 9-digit BN, RC, RP, or RT, and a 4-digit reference.');
    } else if (input.payeeType && parsed.program !== PROGRAM_FOR_PAYEE[input.payeeType]) {
      errors.push(`${PAYEE_TYPE_LABEL[input.payeeType]} must use a ${PROGRAM_FOR_PAYEE[input.payeeType]} account. ${parsed.program} would misapply the payment.`);
    }
  }
  if (input.taxpayerKind === 'individual') {
    if (input.payeeType === 'payroll' || input.payeeType === 'gst_hst') {
      errors.push('Payroll and GST/HST bill payments use a business program account.');
    }
    const sinError = validateSin(input.sin || '');
    if (sinError) errors.push(sinError);
  }
  if (input.valueDate && input.dueDate) {
    const dateError = validateValueDate(input.valueDate, input.dueDate, input.now);
    if (dateError) errors.push(dateError);
  }
  return errors;
}

export function createPaymentInstruction(input: PaymentInstructionInput, now = new Date()): { ok: true; instruction: PaymentInstruction } | { ok: false; errors: string[] } {
  const clock = input.now ?? now;
  const errors = validatePaymentInstruction({ ...input, now: clock });
  if (errors.length) return { ok: false, errors };
  const payeeType = input.payeeType as CraPayeeType;
  const createdAt = clock.toISOString();
  const retain = new Date(clock);
  retain.setUTCFullYear(retain.getUTCFullYear() + 5);
  const program = input.taxpayerKind === 'business' || payeeType === 'payroll' || payeeType === 'gst_hst'
    ? parseProgramAccount(input.programAccount || '')
    : null;
  return {
    ok: true,
    instruction: {
      id: `bp_${clock.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      clientId: input.clientId.trim(),
      taxpayerKind: input.taxpayerKind,
      sin: input.taxpayerKind === 'individual' ? digitsOnly(input.sin || '') : undefined,
      sinMasked: input.taxpayerKind === 'individual' ? maskSin(input.sin || '') : null,
      programAccount: program ? `${program.bn}${program.program}${program.reference}` : null,
      payeeType,
      bankName: input.bankName,
      payeeName: input.payeeName.trim(),
      taxYear: input.taxYear.trim(),
      period: input.period.trim(),
      amount: Math.round(input.amount * 100) / 100,
      valueDate: input.valueDate.slice(0, 10),
      dueDate: input.dueDate.slice(0, 10),
      safeguardedAccount: input.safeguardedAccount.trim(),
      kycCleared: input.kycCleared,
      status: 'draft',
      createdAt,
      retainUntil: retain.toISOString(),
      events: [{ at: createdAt, action: 'Instruction prepared. No money has moved.' }],
    },
  };
}

function locked(instruction: PaymentInstruction): boolean {
  return instruction.status === 'submitted_to_bank' || instruction.status === 'noted_on_cra_account' || instruction.status === 'unresolved';
}

export function recordFunding(instruction: PaymentInstruction, fundingReference: string, now = new Date()): { ok: true; instruction: PaymentInstruction } | { ok: false; error: string } {
  if (instruction.status !== 'draft') return { ok: false, error: 'Funding can be recorded only on a draft instruction.' };
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{5,}$/.test(fundingReference.trim())) {
    return { ok: false, error: 'Enter the reference from the deposit into the safeguarded account.' };
  }
  const at = now.toISOString();
  return {
    ok: true,
    instruction: {
      ...instruction,
      status: 'funding_received',
      fundingReference: fundingReference.trim(),
      events: [...instruction.events, { at, action: 'Client funds recorded in the safeguarded account. The CRA bill payment is not sent yet.' }],
    },
  };
}

export function recordBankBillPay(instruction: PaymentInstruction, bankConfirmation: string, now = new Date()): { ok: true; instruction: PaymentInstruction } | { ok: false; error: string } {
  if (instruction.status !== 'funding_received') {
    return { ok: false, error: 'Record the client funds in the safeguarded account before the CRA bill payment.' };
  }
  if (instruction.amount >= KYC_AMOUNT && !instruction.kycCleared) {
    return { ok: false, error: 'FINTRAC identity verification is required before sending $1,000 or more.' };
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{5,}$/.test(bankConfirmation.trim())) {
    return { ok: false, error: 'Enter the confirmation reference from the bank. eFinsuite does not invent one.' };
  }
  const at = now.toISOString();
  return {
    ok: true,
    instruction: {
      ...instruction,
      status: 'submitted_to_bank',
      bankConfirmation: bankConfirmation.trim(),
      submittedAt: at,
      events: [...instruction.events, { at, action: `Bill payment sent at the bank. Reference ${bankConfirmation.trim()}. CRA has not confirmed it.` }],
    },
  };
}

export function noteSeenOnCraAccount(instruction: PaymentInstruction, observation: string, now = new Date()): { ok: true; instruction: PaymentInstruction } | { ok: false; error: string } {
  if (instruction.status !== 'submitted_to_bank' && instruction.status !== 'unresolved') {
    return { ok: false, error: 'Note the CRA account only after the bank bill payment has a confirmation.' };
  }
  if (observation.trim().length < 6) return { ok: false, error: 'Describe what was seen on the CRA account.' };
  const at = now.toISOString();
  return {
    ok: true,
    instruction: {
      ...instruction,
      status: 'noted_on_cra_account',
      craObservation: observation.trim(),
      events: [...instruction.events, { at, action: 'Noted on the CRA account by a person. This is not a CRA API confirmation.' }],
    },
  };
}

export function refreshUnresolved(instruction: PaymentInstruction, now = new Date()): PaymentInstruction {
  if (instruction.status !== 'submitted_to_bank' || !instruction.submittedAt) return instruction;
  const start = torontoParts(new Date(instruction.submittedAt)).date;
  const today = torontoParts(now).date;
  if (businessDaysBetween(start, today) < UNRESOLVED_BUSINESS_DAYS) return instruction;
  return {
    ...instruction,
    status: 'unresolved',
    events: [...instruction.events, { at: now.toISOString(), action: 'Unresolved after 5 business days. CRA corrections are done in the CRA account, not by editing this record.' }],
  };
}

export function cancelInstruction(instruction: PaymentInstruction, now = new Date()): { ok: true; instruction: PaymentInstruction } | { ok: false; error: string } {
  if (locked(instruction)) return { ok: false, error: 'A sent bill payment is kept for 5 years. Add a correction note instead of deleting it.' };
  return {
    ok: true,
    instruction: {
      ...instruction,
      status: 'cancelled',
      events: [...instruction.events, { at: now.toISOString(), action: 'Instruction cancelled before it was sent to the bank.' }],
    },
  };
}

export function balanceIsStale(balance: ClientBalance, now = new Date()): boolean {
  const age = (now.getTime() - utcDate(balance.asOf).getTime()) / 86_400_000;
  return age > BALANCE_STALE_DAYS;
}

export function recordClientBalance(input: { clientId: string; program: ProgramSuffix; amount: number; asOf: string }, now = new Date()): { ok: true; balance: ClientBalance } | { ok: false; error: string } {
  if (!input.clientId.trim()) return { ok: false, error: 'Choose the client.' };
  if (!Number.isFinite(input.amount)) return { ok: false, error: 'Enter the balance from the client\'s notice or CRA account.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.asOf)) return { ok: false, error: 'Enter the date on the notice or account screen.' };
  return {
    ok: true,
    balance: {
      id: `bal_${now.getTime().toString(36)}`,
      clientId: input.clientId.trim(),
      program: input.program,
      amount: Math.round(input.amount * 100) / 100,
      asOf: input.asOf,
      source: 'client_provided',
      verifiedByCra: false,
    },
  };
}

export function setRacAuthorization(input: {
  clientId: string;
  status: RacAuthStatus;
  level: 1 | 2 | 3;
  method: string;
}, now = new Date()): { ok: true; authorization: RacAuthorization } | { ok: false; error: string } {
  if (/aut-01/i.test(input.method)) {
    return { ok: false, error: 'Form AUT-01 is not used. It is offline only and can cancel the client\'s online access.' };
  }
  if (input.method !== 'represent_a_client') {
    return { ok: false, error: 'Record Represent a Client authorization. The client confirms it in My Account or My Business Account.' };
  }
  if (!input.clientId.trim()) return { ok: false, error: 'Choose the client.' };
  return {
    ok: true,
    authorization: {
      id: `rac_${now.getTime().toString(36)}`,
      clientId: input.clientId.trim(),
      status: input.status,
      level: input.level,
      method: 'represent_a_client',
      updatedAt: now.toISOString(),
      verifiedByCra: false,
    },
  };
}

export interface GstFilingAttempt {
  id: string;
  clientId: string;
  path: GstFilePath;
  period: string;
  status: 'prepared' | 'blocked';
  accessCodeStored: false;
  message: string;
  confirmedByCra: false;
}

export function prepareGstFiling(input: {
  clientId: string;
  path: GstFilePath;
  period: string;
  authorizationActive: boolean;
  accessCode?: string;
}, now = new Date()): { ok: true; filing: GstFilingAttempt } | { ok: false; error: string; filing?: GstFilingAttempt } {
  if (!input.clientId.trim() || !input.period.trim()) return { ok: false, error: 'Enter the client and the reporting period.' };
  if (input.path === 'edi') {
    return {
      ok: false,
      error: 'GST/HST EDI is not available. It needs CRA approval of the provider, and this firm is not approved.',
      filing: {
        id: `gst_${now.getTime().toString(36)}`,
        clientId: input.clientId.trim(),
        path: 'edi',
        period: input.period.trim(),
        status: 'blocked',
        accessCodeStored: false,
        message: 'EDI was not sent.',
        confirmedByCra: false,
      },
    };
  }
  if (input.path === 'rac' && !input.authorizationActive) {
    return { ok: false, error: 'File a return in Represent a Client only after the client authorization is active. No access code is used.' };
  }
  if (input.path === 'netfile') {
    if (!/^\d{4}$/.test(input.accessCode || '')) {
      return { ok: false, error: 'NETFILE needs the 4-digit access code from the business owner. Representatives cannot see it in Represent a Client.' };
    }
  }
  const message = input.path === 'rac'
    ? 'Prepared for Represent a Client → File a return. No access code is required. The return is not filed until someone files it there.'
    : 'The access code was checked and was not saved. Enter it on GST/HST NETFILE. eFinsuite does not keep it.';
  return {
    ok: true,
    filing: {
      id: `gst_${now.getTime().toString(36)}`,
      clientId: input.clientId.trim(),
      path: input.path,
      period: input.period.trim(),
      status: 'prepared',
      accessCodeStored: false,
      message,
      confirmedByCra: false,
    },
  };
}

export function informationReturnDueDate(taxYear: number): string {
  const leap = new Date(Date.UTC(taxYear + 1, 1, 29)).getUTCMonth() === 1;
  return onOrNextBusinessDay(`${taxYear + 1}-02-${leap ? 29 : 28}`);
}

export function prepareInformationReturnBatch(input: {
  returnType: 'T4' | 'T4A';
  transmitterNumber: string;
  repId: string;
  taxYear: number;
  slips: { clientId: string; returnType: 'T4' | 'T4A'; amount: number }[];
}): { ok: true; xml: string; dueDate: string; slipCount: number } | { ok: false; error: string } {
  if (!input.slips.length) return { ok: false, error: 'Add at least one slip.' };
  if (input.slips.some((slip) => slip.returnType !== input.returnType)) {
    return { ok: false, error: 'One Internet File Transfer file can contain only one return type.' };
  }
  const transmitter = parseTransmitterAccount(input.transmitterNumber);
  if (!transmitter) return { ok: false, error: 'The T619 transmitter number is the firm\'s program account, not the client\'s.' };
  if (!input.repId.trim()) return { ok: false, error: 'Enter the firm representative ID. It is not a client CRA password.' };
  const total = input.slips.reduce((sum, slip) => sum + (Number(slip.amount) || 0), 0);
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Return>',
    '<T619>',
    `<TransmitterNumber>${transmitter.bn}${transmitter.program}${transmitter.reference}</TransmitterNumber>`,
    `<RepID>${input.repId.trim()}</RepID>`,
    `<SummaryType>${input.returnType}</SummaryType>`,
    `<TaxYear>${input.taxYear}</TaxYear>`,
    `<SlipCount>${input.slips.length}</SlipCount>`,
    `<TotalAmount>${total.toFixed(2)}</TotalAmount>`,
    '</T619>',
    ...input.slips.map((slip) => `<Slip><ClientId>${slip.clientId}</ClientId><Amount>${Number(slip.amount).toFixed(2)}</Amount></Slip>`),
    '<EmptyOptional></EmptyOptional>',
    '</Return>',
  ].join('');
  const stripped = xml.replace(/<([A-Za-z_][\w.:-]*)\s*><\/\1>/g, '');
  return { ok: true, xml: stripped, dueDate: informationReturnDueDate(input.taxYear), slipCount: input.slips.length };
}
