/**
 * Rules for the CRA My Payment workflow. Pure functions so the same rules drive the UI
 * and the tests. The database trigger enforce_cra_my_payment_workflow repeats the
 * rules that matter for control (transitions, separation of duties, evidence).
 */
import { allocationMatchesType, findAllocation, type CraPaymentType, type PayerKind } from './catalog';

export type WorkflowStatus =
  | 'draft'
  | 'awaiting_authorization'
  | 'awaiting_payment'
  | 'payment_initiated'
  | 'payment_completed'
  | 'payment_failed'
  | 'reconciliation_pending'
  | 'reconciled'
  | 'cancelled';

export const WORKFLOW_STATUSES: WorkflowStatus[] = [
  'draft',
  'awaiting_authorization',
  'awaiting_payment',
  'payment_initiated',
  'payment_completed',
  'payment_failed',
  'reconciliation_pending',
  'reconciled',
  'cancelled',
];

export const STATUS_LABEL: Record<WorkflowStatus, string> = {
  draft: 'Draft',
  awaiting_authorization: 'Awaiting Authorization',
  awaiting_payment: 'Awaiting Payment',
  payment_initiated: 'Payment Initiated',
  payment_completed: 'Payment Completed',
  payment_failed: 'Payment Failed',
  reconciliation_pending: 'Payment Reconciliation Pending',
  reconciled: 'Reconciled',
  cancelled: 'Cancelled',
};

export const STATUS_TONE: Record<WorkflowStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  awaiting_authorization: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
  awaiting_payment: 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100',
  payment_initiated: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100',
  payment_completed: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100',
  payment_failed: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100',
  reconciliation_pending: 'bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100',
  reconciled: 'bg-emerald-200 text-emerald-950 dark:bg-emerald-800/60 dark:text-emerald-50',
  cancelled: 'bg-muted text-muted-foreground line-through',
};

/** Initiated but not confirmed. */
export const PENDING_STATUSES: WorkflowStatus[] = ['awaiting_authorization', 'awaiting_payment', 'payment_initiated'];
/** CRA confirmation captured. */
export const COMPLETED_STATUSES: WorkflowStatus[] = ['payment_completed', 'reconciliation_pending', 'reconciled'];

export interface PaymentPolicy {
  approval_levels: 1 | 2;
  review_threshold: number | null;
  separate_duties: boolean;
  reviewer_roles: string[];
  approver_roles: string[];
  max_payment_amount: number | null;
  duplicate_window_days: number;
}

export const DEFAULT_POLICY: PaymentPolicy = {
  approval_levels: 1,
  review_threshold: null,
  separate_duties: true,
  reviewer_roles: ['owner', 'admin', 'finance_manager', 'accountant'],
  approver_roles: ['owner', 'admin', 'finance_manager'],
  max_payment_amount: null,
  duplicate_window_days: 45,
};

/** The subset of a tax_payments row the workflow reads. */
export interface MyPaymentRecord {
  id: string;
  reference: string;
  workflow_status: WorkflowStatus;
  payer_kind: PayerKind | null;
  cra_payment_type: string | null;
  cra_allocation: string | null;
  business_name: string | null;
  business_number: string | null;
  program_account: string | null;
  filing_period_label: string | null;
  period_start: string | null;
  period_end: string | null;
  amount: number;
  scheduled_for: string | null;
  bank_account_id: string | null;
  prepared_by: string | null;
  reviewed_by: string | null;
  approved_by: string | null;
  confirmation_number: string | null;
  paid_at: string | null;
  journal_entry_id: string | null;
  bank_transaction_id: string | null;
  receipt_path: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface PaymentDraft {
  payerKind: PayerKind | '';
  typeKey: string;
  allocationKey: string;
  businessName: string;
  businessNumber: string;
  programAccount: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  amount: string;
  paymentDate: string;
}

export interface ValidationResult {
  errors: Partial<Record<keyof PaymentDraft, string>>;
  warnings: string[];
  ok: boolean;
}

const BN_RE = /^[0-9]{9}$/;
const PROGRAM_ACCOUNT_RE = /^([0-9]{9})([A-Z]{2})([0-9]{4})$/;

/** Accepts "123456789 RT 0001", "123456789rt0001" and similar; returns the canonical form. */
export function normalizeProgramAccount(value: string): string {
  return value.replace(/[\s-]/g, '').toUpperCase();
}

export function normalizeBusinessNumber(value: string): string {
  return value.replace(/[\s-]/g, '').slice(0, 9);
}

export function parseProgramAccount(value: string): { bn: string; program: string; reference: string } | null {
  const match = PROGRAM_ACCOUNT_RE.exec(normalizeProgramAccount(value));
  if (!match) return null;
  return { bn: match[1], program: match[2], reference: match[3] };
}

/**
 * CRA business numbers carry a Luhn check digit in the ninth position.
 * Returns true for a well-formed number that passes the check.
 */
export function businessNumberChecksumOk(bn: string): boolean {
  if (!BN_RE.test(bn)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    let digit = Number(bn[i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

export function parseAmount(value: string | number): number {
  if (typeof value === 'number') return value;
  const cleaned = value.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}

function isoDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function validateDraft(
  draft: PaymentDraft,
  type: CraPaymentType | undefined,
  policy: PaymentPolicy = DEFAULT_POLICY,
  today: string = new Date().toISOString().slice(0, 10),
): ValidationResult {
  const errors: ValidationResult['errors'] = {};
  const warnings: string[] = [];

  if (!draft.payerKind) errors.payerKind = 'Choose individual or business.';
  if (!type) errors.typeKey = 'Choose the tax obligation you are paying.';
  if (!draft.allocationKey) errors.allocationKey = 'Choose how CRA should apply the payment.';
  else if (type && !allocationMatchesType(type, draft.allocationKey)) {
    errors.allocationKey = `That allocation does not belong to ${type.label}.`;
  }

  if (!draft.businessName.trim()) {
    errors.businessName = draft.payerKind === 'individual' ? 'Enter the taxpayer name.' : 'Enter the registered business name.';
  }

  if (draft.payerKind === 'business') {
    const bn = normalizeBusinessNumber(draft.businessNumber);
    if (!BN_RE.test(bn)) errors.businessNumber = 'Business number must be 9 digits.';
    else if (!businessNumberChecksumOk(bn)) warnings.push('The business number fails the check-digit test. Compare it to a CRA notice before paying.');

    const parsed = parseProgramAccount(draft.programAccount);
    if (!parsed) {
      errors.programAccount = 'Program account must look like 123456789RT0001.';
    } else {
      if (BN_RE.test(bn) && parsed.bn !== bn) errors.programAccount = 'Program account does not start with this business number.';
      else if (type && !['SIN', 'NONE'].includes(type.program) && parsed.program !== type.program) {
        errors.programAccount = `${type.label} is paid to an ${type.program} account, not ${parsed.program}.`;
      }
    }
  }

  const needsPeriod = !!type && type.registerType !== 'other';
  if (needsPeriod && !draft.periodLabel.trim()) errors.periodLabel = 'Enter the reporting period, for example October 2026.';
  if (draft.periodStart && !isoDay(draft.periodStart)) errors.periodStart = 'Use a valid date.';
  if (draft.periodEnd && !isoDay(draft.periodEnd)) errors.periodEnd = 'Use a valid date.';
  if (draft.periodStart && draft.periodEnd && isoDay(draft.periodStart) && isoDay(draft.periodEnd) && draft.periodStart > draft.periodEnd) {
    errors.periodEnd = 'Period end is before period start.';
  }
  const allocation = findAllocation(type, draft.allocationKey);
  if (draft.periodEnd && isoDay(draft.periodEnd) && draft.periodEnd > today && allocation?.kind !== 'instalment' && allocation?.kind !== 'interim') {
    warnings.push('The reporting period has not ended yet. Check that this is not meant to be an instalment.');
  }

  const amount = parseAmount(draft.amount);
  if (Number.isNaN(amount)) errors.amount = 'Enter an amount like 5000.00.';
  else if (amount <= 0) errors.amount = 'Amount must be greater than zero.';
  else if (policy.max_payment_amount !== null && amount > policy.max_payment_amount) {
    errors.amount = `Amount is above this organization's limit of ${formatCad(policy.max_payment_amount)}.`;
  } else if (amount >= 1_000_000) {
    warnings.push('Payments of $1,000,000 or more cannot be made by debit card. CRA asks for a wire or a payment at a financial institution.');
  }

  if (!draft.paymentDate) errors.paymentDate = 'Choose the intended payment date.';
  else if (!isoDay(draft.paymentDate)) errors.paymentDate = 'Use a valid date.';
  else if (draft.paymentDate < today) warnings.push('The payment date is in the past. CRA My Payment pays on the day you complete it.');

  return { errors, warnings, ok: Object.keys(errors).length === 0 };
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

export interface DuplicateCheck {
  /** Same account, allocation, period and amount. */
  exact: MyPaymentRecord[];
  /** Same account, allocation and period; different amount. */
  similar: MyPaymentRecord[];
}

const LIVE_FOR_DUPLICATES: WorkflowStatus[] = [
  'draft', 'awaiting_authorization', 'awaiting_payment', 'payment_initiated',
  'payment_completed', 'reconciliation_pending', 'reconciled',
];

function samePayee(a: { payer_kind: string | null; program_account: string | null; business_name: string | null }, b: typeof a) {
  if (a.payer_kind === 'business' || b.payer_kind === 'business') {
    return !!a.program_account && normalizeProgramAccount(a.program_account) === normalizeProgramAccount(b.program_account ?? '');
  }
  return (a.business_name ?? '').trim().toLowerCase() === (b.business_name ?? '').trim().toLowerCase();
}

export function findDuplicates(
  candidate: Pick<MyPaymentRecord, 'payer_kind' | 'cra_payment_type' | 'cra_allocation' | 'program_account' | 'business_name' | 'filing_period_label' | 'amount'> & { id?: string },
  existing: MyPaymentRecord[],
  windowDays: number,
  now: Date = new Date(),
): DuplicateCheck {
  const cutoff = now.getTime() - windowDays * 86_400_000;
  const period = (candidate.filing_period_label ?? '').trim().toLowerCase();
  const pool = existing.filter((row) =>
    row.id !== candidate.id
    && LIVE_FOR_DUPLICATES.includes(row.workflow_status)
    && Date.parse(row.created_at) >= cutoff
    && row.cra_payment_type === candidate.cra_payment_type
    && row.cra_allocation === candidate.cra_allocation
    && samePayee(row, candidate)
    && (row.filing_period_label ?? '').trim().toLowerCase() === period,
  );
  const cents = Math.round(candidate.amount * 100);
  return {
    exact: pool.filter((row) => Math.round(row.amount * 100) === cents),
    similar: pool.filter((row) => Math.round(row.amount * 100) !== cents),
  };
}

// ---------------------------------------------------------------------------
// Approvals
// ---------------------------------------------------------------------------

export function needsReview(policy: PaymentPolicy, amount: number): boolean {
  return policy.approval_levels === 2 || (policy.review_threshold !== null && amount >= policy.review_threshold);
}

export interface Actor {
  userId: string;
  role: string;
}

/** Why this person cannot review the payment, or null when they can. */
export function reviewBlock(payment: MyPaymentRecord, actor: Actor, policy: PaymentPolicy): string | null {
  if (payment.workflow_status !== 'awaiting_authorization') return 'Only a payment awaiting authorization can be reviewed.';
  if (!needsReview(policy, payment.amount)) return 'This payment does not need a separate review.';
  if (payment.reviewed_by) return 'This payment has already been reviewed.';
  if (!policy.reviewer_roles.includes(actor.role)) return 'Your role cannot review CRA payments.';
  if (policy.separate_duties && payment.prepared_by === actor.userId) return 'You prepared this payment, so someone else must review it.';
  return null;
}

/** Why this person cannot approve the payment, or null when they can. */
export function approveBlock(payment: MyPaymentRecord, actor: Actor, policy: PaymentPolicy): string | null {
  if (payment.workflow_status !== 'awaiting_authorization') return 'Only a payment awaiting authorization can be approved.';
  if (!policy.approver_roles.includes(actor.role)) return 'Your role cannot approve CRA payments.';
  if (policy.separate_duties && payment.prepared_by === actor.userId) return 'You prepared this payment, so someone else must approve it.';
  const review = needsReview(policy, payment.amount);
  if (review && !payment.reviewed_by) return 'This payment needs a review before approval.';
  if (review && policy.separate_duties && payment.reviewed_by === actor.userId) return 'You reviewed this payment, so a different person must approve it.';
  return null;
}

export function approvalSteps(policy: PaymentPolicy, amount: number): string[] {
  return needsReview(policy, amount) ? ['Prepare', 'Review', 'Approve', 'Pay on CRA', 'Record confirmation'] : ['Prepare', 'Approve', 'Pay on CRA', 'Record confirmation'];
}

// ---------------------------------------------------------------------------
// Accounting
// ---------------------------------------------------------------------------

export interface AccountOption {
  id: string;
  code: string | null;
  name: string;
  account_type: string | null;
  is_header?: boolean | null;
}

/** Best liability account for a payment type, from its name hints. Never guesses a random account. */
export function suggestLiabilityAccount(type: CraPaymentType | undefined, accounts: AccountOption[], preferredId?: string | null): string | null {
  const postable = accounts.filter((account) => !account.is_header);
  if (preferredId && postable.some((account) => account.id === preferredId)) return preferredId;
  if (!type) return null;
  const liabilities = postable.filter((account) => (account.account_type ?? '').toLowerCase().includes('liab'));
  for (const hint of type.liabilityHints) {
    const found = liabilities.find((account) => account.name.toLowerCase().includes(hint));
    if (found) return found.id;
  }
  return null;
}

export interface JournalLineDraft {
  account_id: string;
  debit: number;
  credit: number;
  memo: string;
}

/** Dr tax liability, Cr bank. Amounts in CAD. */
export function paymentJournalLines(input: {
  amount: number;
  liabilityAccountId: string;
  bankGlAccountId: string;
  memo: string;
}): JournalLineDraft[] {
  const amount = roundMoney(input.amount);
  if (!(amount > 0)) throw new Error('Amount must be greater than zero.');
  if (!input.liabilityAccountId) throw new Error('Choose the tax liability account.');
  if (!input.bankGlAccountId) throw new Error('Choose the bank account the payment came from.');
  if (input.liabilityAccountId === input.bankGlAccountId) throw new Error('The liability and bank accounts must be different.');
  return [
    { account_id: input.liabilityAccountId, debit: amount, credit: 0, memo: input.memo },
    { account_id: input.bankGlAccountId, debit: 0, credit: amount, memo: input.memo },
  ];
}

// ---------------------------------------------------------------------------
// Bank reconciliation
// ---------------------------------------------------------------------------

export interface BankLine {
  id: string;
  bank_account_id: string;
  amount: number;
  transaction_date: string;
  description: string;
  payee_payor: string | null;
  reference: string | null;
  transaction_type: string;
  journal_entry_id: string | null;
  status: string;
}

export interface BankCandidate {
  line: BankLine;
  score: number;
  daysApart: number;
  /** The bank line was already posted on its own; linking it would count the payment twice. */
  alreadyPosted: boolean;
}

const CRA_WORDS = ['receiver general', 'canada revenue', 'cra', 'my payment', 'mypayment', 'gov canada', 'govt canada', 'federal tax'];

function isOutflow(line: BankLine): boolean {
  if (line.amount < 0) return true;
  return ['debit', 'withdrawal', 'payment'].includes(line.transaction_type.toLowerCase());
}

/** Bank lines that could be this CRA payment, best first. */
export function bankCandidates(
  payment: Pick<MyPaymentRecord, 'amount' | 'paid_at' | 'bank_account_id' | 'reference' | 'confirmation_number' | 'journal_entry_id'>,
  lines: BankLine[],
  windowBefore = 3,
  windowAfter = 10,
): BankCandidate[] {
  if (!payment.paid_at) return [];
  const paid = Date.parse(payment.paid_at.slice(0, 10));
  const cents = Math.round(payment.amount * 100);
  return lines
    .filter((line) => isOutflow(line) && Math.round(Math.abs(line.amount) * 100) === cents)
    .filter((line) => !payment.bank_account_id || line.bank_account_id === payment.bank_account_id)
    .map((line) => {
      const daysApart = Math.round((Date.parse(line.transaction_date.slice(0, 10)) - paid) / 86_400_000);
      const text = `${line.description} ${line.payee_payor ?? ''} ${line.reference ?? ''}`.toLowerCase();
      let score = 50 - Math.abs(daysApart) * 3;
      if (CRA_WORDS.some((word) => text.includes(word))) score += 30;
      if (payment.confirmation_number && text.includes(payment.confirmation_number.toLowerCase())) score += 40;
      if (text.includes(payment.reference.toLowerCase())) score += 40;
      const alreadyPosted = !!line.journal_entry_id && line.journal_entry_id !== payment.journal_entry_id;
      return { line, score, daysApart, alreadyPosted };
    })
    .filter((candidate) => candidate.daysApart >= -windowBefore && candidate.daysApart <= windowAfter)
    .filter((candidate) => candidate.line.status !== 'reconciled' || candidate.line.journal_entry_id === payment.journal_entry_id)
    .sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardTotals {
  totalPaid: number;
  completedCount: number;
  pendingCount: number;
  pendingAmount: number;
  failedCount: number;
  draftCount: number;
  unreconciledCount: number;
}

export function dashboardTotals(rows: MyPaymentRecord[]): DashboardTotals {
  const totals: DashboardTotals = { totalPaid: 0, completedCount: 0, pendingCount: 0, pendingAmount: 0, failedCount: 0, draftCount: 0, unreconciledCount: 0 };
  for (const row of rows) {
    if (COMPLETED_STATUSES.includes(row.workflow_status)) {
      totals.totalPaid += row.amount;
      totals.completedCount += 1;
      if (row.workflow_status !== 'reconciled') totals.unreconciledCount += 1;
    } else if (PENDING_STATUSES.includes(row.workflow_status)) {
      totals.pendingCount += 1;
      totals.pendingAmount += row.amount;
    } else if (row.workflow_status === 'payment_failed') {
      totals.failedCount += 1;
    } else if (row.workflow_status === 'draft') {
      totals.draftCount += 1;
    }
  }
  totals.totalPaid = roundMoney(totals.totalPaid);
  totals.pendingAmount = roundMoney(totals.pendingAmount);
  return totals;
}

export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatCad(amount: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
}

/** Text to paste into CRA My Payment, in the order CRA asks for it. */
export function handoffChecklist(row: MyPaymentRecord, typeLabel: string, allocationLabel: string): { label: string; value: string }[] {
  const items = [
    { label: 'Payment type', value: typeLabel },
    { label: 'Payment allocation', value: allocationLabel },
  ];
  if (row.payer_kind === 'business') {
    items.push({ label: 'Program account', value: row.program_account ?? '' });
  } else {
    items.push({ label: 'Identifier', value: 'Enter the SIN on the CRA page. eFinsuite does not store it.' });
  }
  if (row.filing_period_label) items.push({ label: 'Tax period', value: row.filing_period_label });
  if (row.period_end) items.push({ label: 'Period end date', value: row.period_end });
  items.push({ label: 'Amount', value: row.amount.toFixed(2) });
  items.push({ label: 'eFinsuite reference', value: row.reference });
  return items;
}
