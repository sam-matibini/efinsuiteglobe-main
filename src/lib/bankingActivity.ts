/**
 * Quantity and volume for the bank register.
 * Counts follow the transaction type, because stored amounts are often positive for both directions.
 */

export interface BankingActivityRow {
  amount?: number | string | null;
  transaction_type?: string | null;
}

export interface BankingActivity {
  total: number;
  inflowCount: number;
  outflowCount: number;
  volume: number;
}

export function bankingActivity(
  transactions: BankingActivityRow[],
  accountType: 'bank' | 'credit-card',
): BankingActivity {
  let inflowCount = 0;
  let outflowCount = 0;
  let volume = 0;

  for (const transaction of transactions) {
    const amount = Number(transaction.amount);
    volume += Math.abs(Number.isFinite(amount) ? amount : 0);
    const type = transaction.transaction_type || '';
    if (accountType === 'bank') {
      if (type === 'deposit') inflowCount += 1;
      else if (type === 'withdrawal') outflowCount += 1;
    } else if (type === 'payment' || type === 'credit') {
      inflowCount += 1;
    } else if (type === 'charge' || type === 'fee' || type === 'interest') {
      outflowCount += 1;
    }
  }

  return {
    total: transactions.length,
    inflowCount,
    outflowCount,
    volume,
  };
}
