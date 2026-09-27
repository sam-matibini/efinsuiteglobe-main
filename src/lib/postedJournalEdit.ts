export interface EditableJournalLine {
  id: string;
  account_id: string;
  debit: number;
  credit: number;
}

export function roundJournalMoney(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * Move the offset account and, when the amount changed, scale the existing
 * lines. The cash or card line stays on its account. A reversal is not created,
 * so the transaction can keep its matched status and the new GL account.
 */
export function applyGlEditToJournalLines(
  lines: EditableJournalLine[],
  cashAccountId: string,
  previousOffsetId: string | null | undefined,
  nextOffsetId: string | null | undefined,
  nextAmount: number | null | undefined,
): EditableJournalLine[] {
  let next = lines.map((line) => ({
    ...line,
    debit: Number(line.debit) || 0,
    credit: Number(line.credit) || 0,
  }));

  if (nextOffsetId && nextOffsetId !== cashAccountId) {
    const named = next.filter(
      (line) => line.account_id === previousOffsetId && line.account_id !== cashAccountId,
    );
    const offsets = next.filter((line) => line.account_id !== cashAccountId);
    const largest = [...offsets].sort(
      (a, b) => b.debit + b.credit - (a.debit + a.credit),
    )[0];
    const movable = named.length > 0
      ? named
      : offsets.filter((line) => largest && line.account_id === largest.account_id);
    const ids = new Set(movable.map((line) => line.id));
    next = next.map((line) => (ids.has(line.id) ? { ...line, account_id: nextOffsetId } : line));
  }

  if (nextAmount != null && nextAmount > 0) {
    const oldCash = next
      .filter((line) => line.account_id === cashAccountId)
      .reduce((sum, line) => sum + line.debit + line.credit, 0);
    if (oldCash > 0 && Math.abs(oldCash - nextAmount) >= 0.01) {
      const factor = nextAmount / oldCash;
      next = next.map((line) => ({
        ...line,
        debit: roundJournalMoney(line.debit * factor),
        credit: roundJournalMoney(line.credit * factor),
      }));
      const debit = roundJournalMoney(next.reduce((sum, line) => sum + line.debit, 0));
      const credit = roundJournalMoney(next.reduce((sum, line) => sum + line.credit, 0));
      const drift = roundJournalMoney(debit - credit);
      if (Math.abs(drift) >= 0.01 && next.length > 0) {
        const host = [...next].sort((a, b) => b.debit + b.credit - (a.debit + a.credit))[0];
        next = next.map((line) => {
          if (line.id !== host.id) return line;
          if (drift > 0) return { ...line, credit: roundJournalMoney(line.credit + drift) };
          return { ...line, debit: roundJournalMoney(line.debit + Math.abs(drift)) };
        });
      }
    }
  }

  return next;
}

export function isReversalJournal(entry: {
  status?: string | null;
  reference?: string | null;
  reversal_of?: string | null;
}): boolean {
  if (entry.status === 'reversed') return true;
  if (entry.reversal_of) return true;
  return (entry.reference || '').startsWith('REV-');
}

export function datesWithinDays(left: string, right: string, days: number): boolean {
  const a = Date.parse(`${left.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${right.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return Math.abs(a - b) <= days * 24 * 60 * 60 * 1000;
}

export interface CardPaymentCandidate {
  id: string;
  amount: number;
  date: string;
  transactionType: string;
  journalEntryId: string | null;
}

/** A bank or card payment already on the statement should not also appear as its journal line. */
export function matchingCardPayment(
  journal: { journalEntryId: string; amount: number; date: string },
  payments: CardPaymentCandidate[],
  usedIds: Set<string>,
  windowDays = 7,
): CardPaymentCandidate | null {
  return payments.find((payment) => {
    if (usedIds.has(payment.id)) return false;
    if (payment.transactionType !== 'payment' && payment.transactionType !== 'credit') return false;
    if (Math.abs(Math.abs(Number(payment.amount)) - Math.abs(journal.amount)) >= 0.01) return false;
    return datesWithinDays(payment.date, journal.date, windowDays);
  }) ?? null;
}
