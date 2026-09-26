export type TaxAccountKind = 'collected' | 'paid' | 'pst';

export interface PeriodTaxAccount {
  accountId: string;
  type: TaxAccountKind;
  balance: number;
}

export interface PeriodTaxLine {
  accountId: string;
  debit: number;
  credit: number;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Liability tax increases with a credit. An ITC increases with a debit. */
export function periodMovement(kind: TaxAccountKind, debit: number, credit: number): number {
  const movement = kind === 'paid' ? Number(debit || 0) - Number(credit || 0) : Number(credit || 0) - Number(debit || 0);
  return roundMoney(movement);
}

export function applyPeriodBalances<T extends PeriodTaxAccount>(accounts: T[], lines: PeriodTaxLine[]): T[] {
  const kinds = new Map(accounts.map((account) => [account.accountId, account.type]));
  const totals = new Map<string, number>();
  for (const line of lines) {
    const kind = kinds.get(line.accountId);
    if (!kind) continue;
    totals.set(line.accountId, roundMoney((totals.get(line.accountId) ?? 0) + periodMovement(kind, line.debit, line.credit)));
  }
  return accounts.map((account) => ({
    ...account,
    balance: totals.get(account.accountId) ?? 0,
  }));
}

export function summarizePeriodAccounts(accounts: PeriodTaxAccount[]) {
  const collected = roundMoney(accounts.filter((account) => account.type === 'collected').reduce((sum, account) => sum + account.balance, 0));
  const paid = roundMoney(accounts.filter((account) => account.type === 'paid').reduce((sum, account) => sum + account.balance, 0));
  const pst = roundMoney(accounts.filter((account) => account.type === 'pst').reduce((sum, account) => sum + account.balance, 0));
  return {
    collected,
    paid,
    pst,
    netPayable: roundMoney(collected - paid + pst),
  };
}
