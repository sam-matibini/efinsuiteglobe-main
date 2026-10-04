/**
 * Bank deposits posted to an expense account are refunds and reversals.
 * Cash is debited, the expense is credited, and the sales tax that was paid
 * on the original purchase is reversed. Tax lines never use a header account.
 */

import { roundMoney } from '@/lib/bankTransactionSplit';
import {
  postableTaxAccount,
  taxAccountKind,
  type NamedAccount,
} from '@/lib/taxGlAccounts';

const EXPENSE_TYPES = new Set(['expense', 'cogs', 'other_expense', 'cost_of_goods_sold']);

export interface TaxComponentAccounts {
  code: string;
  glCollectedAccountId?: string | null;
  glPaidAccountId?: string | null;
}

export interface TaxAccountSource {
  code?: string | null;
  rate?: number | null;
  gl_collected_account_id?: string | null;
  gl_paid_account_id?: string | null;
  component_taxes?: TaxComponentAccounts[] | null;
}

export interface TaxPostingLine {
  code: string;
  rate: number;
  amount: number;
  glAccountId: string | null;
}

export type TaxMemoKind = 'collected' | 'paid' | 'reversed';

export interface PlannedTaxLine extends TaxPostingLine {
  memoKind: TaxMemoKind;
}

export function isExpenseLikeAccount(
  account: { account_type?: string | null } | null | undefined,
): boolean {
  return EXPENSE_TYPES.has((account?.account_type || '').toLowerCase());
}

export function isExpenseRefund(
  accounts: Array<{ account_type?: string | null } | null | undefined>,
): boolean {
  const present = accounts.filter((account): account is { account_type?: string | null } => !!account);
  return present.length > 0 && present.every(isExpenseLikeAccount);
}

function componentFor(
  code: string,
  components: TaxComponentAccounts[] | null | undefined,
): TaxComponentAccounts | undefined {
  const kind = taxAccountKind(code);
  return components?.find((component) => taxAccountKind(component.code) === kind);
}

function firstId(...ids: Array<string | null | undefined>): string | null {
  return ids.find((id) => !!id) ?? null;
}

function preferredAccountId(
  item: TaxPostingLine,
  taxCode: TaxAccountSource | null | undefined,
  side: 'paid' | 'collected',
): string | null {
  const component = componentFor(item.code, taxCode?.component_taxes);
  if (side === 'paid') {
    return firstId(
      component?.glPaidAccountId,
      taxCode?.gl_paid_account_id,
      item.glAccountId,
      component?.glCollectedAccountId,
      taxCode?.gl_collected_account_id,
    );
  }
  return firstId(
    component?.glCollectedAccountId,
    taxCode?.gl_collected_account_id,
    item.glAccountId,
    component?.glPaidAccountId,
    taxCode?.gl_paid_account_id,
  );
}

export function planBankTaxLines(input: {
  transactionType: 'deposit' | 'withdrawal' | 'transfer';
  offsetAccounts: Array<{ account_type?: string | null } | null | undefined>;
  taxBreakdown?: TaxPostingLine[] | null;
  taxCode?: TaxAccountSource | null;
  accounts: NamedAccount[];
}): { lines: PlannedTaxLine[]; error: string | null; expenseRefund: boolean } {
  const expenseRefund = input.transactionType === 'deposit' && isExpenseRefund(input.offsetAccounts);
  const side: 'paid' | 'collected' = expenseRefund || input.transactionType !== 'deposit' ? 'paid' : 'collected';
  const memoKind: TaxMemoKind = expenseRefund ? 'reversed' : side === 'paid' ? 'paid' : 'collected';
  const lines: PlannedTaxLine[] = [];
  const errors: string[] = [];

  for (const item of input.taxBreakdown || []) {
    const amount = roundMoney(Math.abs(Number(item.amount) || 0));
    if (amount <= 0) continue;
    const preferred = preferredAccountId(item, input.taxCode, side);
    const glAccountId = postableTaxAccount(input.accounts, preferred, item.code, side);
    if (!glAccountId) {
      const named = preferred ? input.accounts.find((account) => account.id === preferred) : undefined;
      if (named?.is_header || named?.posting_allowed === false) {
        errors.push(
          `Cannot post ${item.code} to header account "${named.name}". Header accounts are for grouping only. Assign a posting account for this tax in Sales Tax settings.`,
        );
      }
    }
    lines.push({
      code: item.code,
      rate: item.rate,
      amount,
      glAccountId,
      memoKind,
    });
  }

  const gst = lines.find((line) => taxAccountKind(line.code) === 'gst' && line.glAccountId);
  const pst = lines.find((line) => taxAccountKind(line.code) === 'pst' && line.glAccountId);
  if (side === 'paid' && gst?.glAccountId && pst?.glAccountId && gst.glAccountId === pst.glAccountId) {
    errors.unshift(
      'PST Paid account is not configured. Open Sales Tax Settings and assign a PST Paid (Non-Recoverable) expense account before posting.',
    );
  }

  return {
    lines,
    error: errors[0] ?? null,
    expenseRefund,
  };
}

export function taxLineMemo(line: PlannedTaxLine, description: string): string {
  if (line.memoKind === 'reversed') return `${line.code} (${line.rate}%) reversed on ${description}`;
  if (line.memoKind === 'paid') return `${line.code} (${line.rate}%) paid on ${description}`;
  return `${line.code} (${line.rate}%) collected on ${description}`;
}

export interface JournalPostingLine {
  account_id: string;
  debit: number;
  credit: number;
  memo: string;
}

/** Deposit journal: debit the bank, credit the expense, and reverse the tax paid. */
export function expenseRefundJournal(input: {
  bankAccountId: string;
  offsetLines: Array<{ accountId: string; amount: number; memo?: string }>;
  taxLines: PlannedTaxLine[];
  description: string;
  payee?: string;
}): JournalPostingLine[] {
  const payeeInfo = input.payee ? ` - ${input.payee}` : '';
  const taxLines = input.taxLines.filter((line) => line.glAccountId && line.amount > 0);
  const taxTotal = roundMoney(taxLines.reduce((sum, line) => sum + line.amount, 0));
  const offsetTotal = roundMoney(input.offsetLines.reduce((sum, line) => sum + Number(line.amount), 0));
  const lines: JournalPostingLine[] = [{
    account_id: input.bankAccountId,
    debit: roundMoney(offsetTotal + taxTotal),
    credit: 0,
    memo: `Deposit${payeeInfo}: ${input.description}`,
  }];
  for (const offset of input.offsetLines) {
    lines.push({
      account_id: offset.accountId,
      debit: 0,
      credit: roundMoney(offset.amount),
      memo: offset.memo?.trim() || input.description,
    });
  }
  for (const taxLine of taxLines) {
    lines.push({
      account_id: taxLine.glAccountId as string,
      debit: 0,
      credit: taxLine.amount,
      memo: taxLineMemo(taxLine, input.description),
    });
  }
  return lines;
}

/** Card refund: debit the card liability, credit the expense, and reverse the tax paid. */
export function creditCardRefundJournal(input: {
  liabilityAccountId: string;
  offsetAccountId: string;
  grossAmount: number;
  taxLines: PlannedTaxLine[];
  description: string;
  payee?: string;
}): JournalPostingLine[] {
  const payeeInfo = input.payee ? ` - ${input.payee}` : '';
  const gross = roundMoney(Math.abs(input.grossAmount));
  const taxLines = input.taxLines.filter((line) => line.glAccountId && line.amount > 0);
  const taxTotal = roundMoney(taxLines.reduce((sum, line) => sum + line.amount, 0));
  if (taxTotal - gross >= 0.01) {
    throw new Error('Sales tax is larger than the card refund.');
  }
  const net = roundMoney(gross - taxTotal);
  const lines: JournalPostingLine[] = [{
    account_id: input.liabilityAccountId,
    debit: gross,
    credit: 0,
    memo: `CC Credit${payeeInfo}: ${input.description}`,
  }];
  if (net > 0) {
    lines.push({
      account_id: input.offsetAccountId,
      debit: 0,
      credit: net,
      memo: `Refund - ${input.description}`,
    });
  }
  for (const taxLine of taxLines) {
    lines.push({
      account_id: taxLine.glAccountId as string,
      debit: 0,
      credit: taxLine.amount,
      memo: taxLineMemo(taxLine, input.description),
    });
  }
  return lines;
}
