export interface BankGlSplit {
  id: string;
  accountId: string;
  amount: number;
  memo: string;
}

export interface JournalSplitSource {
  id?: string;
  account_id: string;
  debit: number;
  credit: number;
  description?: string | null;
}

export function roundMoney(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function splitRemainder(total: number, lines: { amount: number }[]): number {
  const used = roundMoney(lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0));
  return roundMoney(total - used);
}

export function validateBankSplits(total: number, lines: BankGlSplit[]): string | null {
  if (lines.length < 2) return 'Add at least two GL accounts to split this transaction.';
  if (lines.some((line) => !line.accountId)) return 'Choose a GL account on every split line.';
  if (lines.some((line) => !(Number(line.amount) > 0))) return 'Each split amount must be greater than zero.';
  const remainder = splitRemainder(total, lines);
  if (remainder >= 0.01) return `${remainder.toFixed(2)} is still unallocated.`;
  if (remainder <= -0.01) return `${Math.abs(remainder).toFixed(2)} is more than the transaction.`;
  return null;
}

export function splitsFromJournalLines(
  lines: JournalSplitSource[],
  transactionType: 'deposit' | 'withdrawal' | 'transfer',
): BankGlSplit[] {
  const allocations = lines.filter((line) => {
    const memo = line.description || '';
    if (/collected on |paid on /i.test(memo)) return false;
    if (transactionType === 'deposit') return Number(line.credit) > 0 && Number(line.debit) === 0;
    return Number(line.debit) > 0 && Number(line.credit) === 0;
  });
  if (allocations.length < 2) return [];
  return allocations.map((line, index) => ({
    id: line.id || `split-${index}`,
    accountId: line.account_id,
    amount: roundMoney(transactionType === 'deposit' ? Number(line.credit) : Number(line.debit)),
    memo: line.description || '',
  }));
}

const storageKey = (transactionId: string) => `efinsuite.bank-gl-splits.v1:${transactionId}`;

export function readStoredSplits(transactionId: string): BankGlSplit[] {
  if (!transactionId || typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(transactionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BankGlSplit[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((line) => line && typeof line.amount === 'number')
      .map((line) => ({
        id: line.id || `split-${line.accountId || 'draft'}`,
        accountId: line.accountId || '',
        amount: Number(line.amount) || 0,
        memo: line.memo || '',
      }));
  } catch {
    return [];
  }
}

export function writeStoredSplits(transactionId: string, lines: BankGlSplit[]) {
  if (!transactionId || typeof localStorage === 'undefined') return;
  if (lines.length < 2) {
    localStorage.removeItem(storageKey(transactionId));
    return;
  }
  localStorage.setItem(storageKey(transactionId), JSON.stringify(lines));
}
