import type {
  AccessCeiling,
  CraCapability,
  CraLedger,
  CraPayment,
  JournalLine,
  PaymentStatus,
  TaxType,
} from './types';
import { TAX_LABEL } from './representative';

export const OPEN_CEILING: AccessCeiling = {
  view: true,
  level2: true,
  taxFiling: true,
  remittance: true,
  administration: true,
};

const ROLE_CAPABILITIES: Record<string, CraCapability[]> = {
  owner: [
    'view', 'prepare_gst', 'prepare_payroll', 'prepare_corporate',
    'prepare_payment', 'approve_payment', 'file_return', 'manage_authorization',
  ],
  admin: [
    'view', 'prepare_gst', 'prepare_payroll', 'prepare_corporate',
    'prepare_payment', 'approve_payment', 'file_return', 'manage_authorization',
  ],
  finance_manager: [
    'view', 'prepare_gst', 'prepare_payroll', 'prepare_corporate',
    'prepare_payment', 'approve_payment', 'file_return', 'manage_authorization',
  ],
  accountant: ['view', 'prepare_gst', 'prepare_payroll', 'prepare_corporate', 'prepare_payment'],
  payroll_officer: ['view', 'prepare_payroll', 'prepare_payment'],
  auditor: ['view'],
  member: [],
};

const PREPARE_CAPS: CraCapability[] = ['prepare_gst', 'prepare_payroll', 'prepare_corporate', 'file_return'];

export function effectiveCapabilities(role: string, ceiling: AccessCeiling): CraCapability[] {
  const base = new Set(ROLE_CAPABILITIES[role] ?? []);
  if (!ceiling.view) {
    return role === 'owner' && base.has('view') ? ['view'] : [];
  }
  if (!ceiling.level2) {
    PREPARE_CAPS.forEach((cap) => base.delete(cap));
  }
  if (!ceiling.taxFiling) base.delete('file_return');
  if (!ceiling.remittance) {
    base.delete('prepare_payment');
    base.delete('approve_payment');
  }
  if (!ceiling.administration && role !== 'owner') base.delete('manage_authorization');
  return [...base];
}

export function validateBn(bn: string): string | null {
  if (!/^[0-9]{9}$/.test(bn)) return 'Business number must be exactly 9 digits.';
  return null;
}

export function validateProgramAccount(account: string): string | null {
  if (!/^(RT|RP|RC|RZ)[0-9]{4}$/.test(account)) {
    return 'CRA program account must look like RT0001, RP0001, RC0001, or RZ0001.';
  }
  return null;
}

export function payableAccount(taxType: TaxType): string {
  switch (taxType) {
    case 'gst_hst':
      return 'GST/HST Payable';
    case 'payroll':
      return 'Payroll source deductions payable';
    case 'corporate_tax':
      return 'Corporate tax payable';
    default:
      return 'CRA information-return payable';
  }
}

export function accrualEntry(payment: Pick<CraPayment, 'taxType' | 'amount' | 'account'>): JournalLine[] {
  return [
    {
      account: payableAccount(payment.taxType),
      debit: payment.amount,
      credit: 0,
      memo: `Accrue CRA remittance ${payment.account}`,
    },
    {
      account: 'CRA Clearing',
      debit: 0,
      credit: payment.amount,
      memo: `CRA clearing ${payment.account}`,
    },
  ];
}

export function settlementEntry(payment: Pick<CraPayment, 'amount' | 'account' | 'fundingAccount'>): JournalLine[] {
  return [
    {
      account: 'CRA Clearing',
      debit: payment.amount,
      credit: 0,
      memo: `Clear CRA settlement ${payment.account}`,
    },
    {
      account: payment.fundingAccount,
      debit: 0,
      credit: payment.amount,
      memo: `Fund CRA payment ${payment.account}`,
    },
  ];
}

const HAPPY_NEXT: Partial<Record<PaymentStatus, PaymentStatus>> = {
  submitted: 'processing',
  processing: 'accepted',
  accepted: 'settled',
};

export function nextRailStatus(status: PaymentStatus): PaymentStatus | null {
  return HAPPY_NEXT[status] ?? null;
}

export function canException(status: PaymentStatus, next: PaymentStatus): boolean {
  const allowed: Partial<Record<PaymentStatus, PaymentStatus[]>> = {
    draft: ['cancelled'],
    authorized: ['cancelled'],
    submitted: ['failed', 'rejected', 'cancelled'],
    processing: ['failed', 'rejected'],
    accepted: ['failed'],
    settled: ['refunded'],
  };
  return (allowed[status] ?? []).includes(next);
}

export function isReconciled(payment: CraPayment): boolean {
  return (
    payment.status === 'confirmed' &&
    Boolean(payment.craConfirmation) &&
    payment.walletDeduction === payment.amount &&
    payment.bankSettlement === payment.amount &&
    payment.glAccrual.length === 2 &&
    payment.glSettlement.length === 2
  );
}

export const NOT_RETURNED_BY_CRA = 'Not returned by CRA';

export function craAmount(amount: number | null | undefined): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return NOT_RETURNED_BY_CRA;
  return formatCad(amount);
}

export function craCount(amount: number | null | undefined): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return NOT_RETURNED_BY_CRA;
  return String(amount);
}

export function bookAmount(amount: number, calculated: boolean): string {
  if (!calculated) return 'Not calculated';
  return formatCad(amount);
}

function addReturned(total: number, amount: number | null, seen: { any: boolean }): number {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return total;
  seen.any = true;
  return total + amount;
}

export function outstandingBalance(ledger: CraLedger): number | null {
  const enrolled = new Set(ledger.profile.programs);
  const seen = { any: false };
  let total = 0;
  if (enrolled.has('RT')) total = addReturned(total, ledger.balances.gst_hst, seen);
  if (enrolled.has('RP')) total = addReturned(total, ledger.balances.payroll, seen);
  if (enrolled.has('RC')) total = addReturned(total, ledger.balances.corporate_tax, seen);
  return seen.any ? roundMoney(total) : null;
}

/** Assessed amounts with a near-term due date (payroll + corporate account balances). */
export function upcomingAssessed(ledger: CraLedger): number | null {
  const enrolled = new Set(ledger.profile.programs);
  const seen = { any: false };
  let total = 0;
  if (enrolled.has('RP')) total = addReturned(total, ledger.balances.payroll, seen);
  if (enrolled.has('RC')) total = addReturned(total, ledger.balances.corporate_tax, seen);
  return seen.any ? roundMoney(total) : null;
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatCad(amount: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
}

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Toronto',
  }).format(date);
}

export function formatDay(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export interface PaymentInput {
  taxType: TaxType;
  account: string;
  amount: number;
  paymentDate: string;
  dueDate: string;
  fundingAccount: string;
}

export function validatePaymentInput(
  ledger: CraLedger,
  input: PaymentInput,
  caps: CraCapability[],
): string | null {
  if (!caps.includes('prepare_payment')) return 'Your role can view CRA information but cannot prepare a payment.';
  if (ledger.authorization.status !== 'connected') {
    return 'CRA authorization is not connected. The client must confirm eFinsuite in My Business Account first.';
  }
  const bnError = validateBn(ledger.profile.businessNumber);
  if (bnError) return bnError;
  const accountError = validateProgramAccount(input.account);
  if (accountError) return accountError;
  const program = input.account.slice(0, 2);
  if (!ledger.profile.programs.includes(program as CraLedger['profile']['programs'][number])) {
    return `${program} is not an enrolled CRA program account for this organization.`;
  }
  if (!ledger.accounts.some((account) => `${account.program}${account.reference}` === input.account)) {
    return `Program account ${input.account} is not on this organization's CRA profile.`;
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) return 'Enter a payment amount greater than zero.';
  if (input.amount > 10_000_000) return 'Amount exceeds the CRA payment limit configured for this workspace.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paymentDate)) return 'Payment date is required.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) return 'A CRA due date is required before a remittance can be prepared.';
  const fee = 0;
  if (ledger.walletBalance < roundMoney(input.amount + fee)) {
    return `Available balance ${formatCad(ledger.walletBalance)} does not cover ${formatCad(input.amount)}.`;
  }
  return null;
}

export function complianceFailures(ledger: CraLedger, payment: CraPayment): string[] {
  const failures: string[] = [];
  if (validateBn(ledger.profile.businessNumber)) failures.push('Business number is not valid.');
  if (validateProgramAccount(payment.account)) failures.push('Program account is not valid.');
  if (!(payment.amount > 0)) failures.push('Amount is not valid.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payment.dueDate)) failures.push('Due date is missing.');
  if (ledger.authorization.status !== 'connected') failures.push('Representative authorization is not connected.');
  if (ledger.walletBalance < payment.amount + payment.fee) failures.push('Funding account cannot cover the payment.');
  return failures;
}

export function approveBlockReason(payment: CraPayment, actorEmail: string, caps: CraCapability[]): string | null {
  if (!caps.includes('approve_payment')) return 'Your role cannot approve CRA payments.';
  if (payment.status !== 'draft') return 'Only a draft payment can be approved.';
  if (payment.preparedBy.toLowerCase() === actorEmail.toLowerCase()) {
    return 'Four-eyes control: the preparer cannot approve the same CRA payment.';
  }
  return null;
}

export function obligationPayments(ledger: CraLedger, obligationId: string): CraPayment[] {
  return ledger.payments.filter(
    (payment) =>
      payment.obligationId === obligationId &&
      !['cancelled', 'failed', 'rejected', 'refunded'].includes(payment.status),
  );
}

export function filingLabel(status: string): string {
  switch (status) {
    case 'not_filed':
      return 'Not filed';
    case 'calculated':
      return 'Calculated';
    case 'reviewed':
      return 'Reviewed';
    case 'prepared':
      return 'Prepared';
    case 'submitted':
      return 'Submitted';
    case 'filed':
      return 'Filed';
    default:
      return status;
  }
}

export function paymentLabel(status: PaymentStatus): string {
  return status.replaceAll('_', ' ').toUpperCase();
}

export function statusTone(status: string): string {
  if (['confirmed', 'accepted', 'filed', 'connected', 'reconciled'].includes(status)) {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
  }
  if (['failed', 'rejected', 'revoked', 'error', 'action'].includes(status)) return 'bg-destructive/15 text-destructive';
  if (['processing', 'pending_client_confirmation', 'review', 'authorized'].includes(status)) {
    return 'bg-amber-500/15 text-amber-800 dark:text-amber-200';
  }
  return 'bg-muted text-muted-foreground';
}

export function taxLabel(taxType: string): string {
  return TAX_LABEL[taxType] ?? taxType;
}

export interface ReconciliationReport {
  initiated: CraPayment[];
  submitted: CraPayment[];
  settled: CraPayment[];
  confirmed: CraPayment[];
  failed: CraPayment[];
  unreconciled: CraPayment[];
  fees: number;
  walletDeductions: number;
  outstanding: number | null;
}

const SUBMITTED_OR_LATER: PaymentStatus[] = ['submitted', 'processing', 'accepted', 'settled', 'confirmed'];

export function reconciliationReport(ledger: CraLedger): ReconciliationReport {
  const initiated = ledger.payments;
  const submitted = initiated.filter((payment) => SUBMITTED_OR_LATER.includes(payment.status));
  const settled = initiated.filter((payment) => payment.status === 'settled' || payment.status === 'confirmed');
  const confirmed = initiated.filter((payment) => payment.status === 'confirmed');
  const failed = initiated.filter((payment) => ['failed', 'rejected', 'cancelled', 'refunded'].includes(payment.status));
  const unreconciled = initiated.filter(
    (payment) => SUBMITTED_OR_LATER.includes(payment.status) && !isReconciled(payment),
  );
  return {
    initiated,
    submitted,
    settled,
    confirmed,
    failed,
    unreconciled,
    fees: roundMoney(initiated.reduce((sum, payment) => sum + payment.fee, 0)),
    walletDeductions: roundMoney(
      initiated.reduce((sum, payment) => sum + (payment.walletDeduction ?? 0), 0),
    ),
    outstanding: outstandingBalance(ledger),
  };
}

export const ROLE_MATRIX: { role: string; label: string }[] = [
  { role: 'accountant', label: 'Accountant (Controller)' },
  { role: 'finance_manager', label: 'Finance manager (CFO)' },
  { role: 'payroll_officer', label: 'Payroll officer' },
  { role: 'auditor', label: 'Auditor' },
  { role: 'owner', label: 'Owner' },
];

export const CAPABILITY_COLUMNS: { cap: CraCapability; label: string }[] = [
  { cap: 'view', label: 'View' },
  { cap: 'prepare_gst', label: 'Prepare GST/HST' },
  { cap: 'prepare_payroll', label: 'Prepare payroll' },
  { cap: 'prepare_payment', label: 'Prepare payment' },
  { cap: 'approve_payment', label: 'Approve / pay' },
  { cap: 'file_return', label: 'File return' },
  { cap: 'manage_authorization', label: 'Manage authorization' },
];
