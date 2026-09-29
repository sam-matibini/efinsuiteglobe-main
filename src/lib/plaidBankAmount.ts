/**
 * Bank amounts from the Plaid gateway.
 *
 * ai-bank-connect already converts Plaid's own sign (Plaid uses a positive
 * amount when money leaves the account). After that conversion a deposit is
 * positive and a withdrawal is negative. These helpers keep that convention
 * in bank_transactions and in downloaded files.
 */

export type BankFlow = 'deposit' | 'withdrawal';

export interface PlaidGatewayTransaction {
  id: string;
  date: string;
  description?: string;
  amount: number;
  type?: string | null;
  category?: string;
  merchantName?: string;
  pending?: boolean;
}

export interface PlaidBankRow {
  bank_account_id: string;
  transaction_date: string;
  description: string;
  amount: number;
  transaction_type: BankFlow;
  status: string;
  reference: string;
  category: string | null;
  payee_payor: string | null;
  memo: string | null;
  is_cleared: boolean;
  imported_at: string;
}

export function signedBankAmount(amount: number, transactionType: string | null | undefined): number {
  const value = Number(amount);
  const magnitude = Math.abs(Number.isFinite(value) ? value : 0);
  if (transactionType === 'withdrawal') return -magnitude;
  if (transactionType === 'deposit') return magnitude;
  return Number.isFinite(value) ? value : 0;
}

export function signedAmountFromGateway(amount: number, type?: string | null): { amount: number; transaction_type: BankFlow } {
  const value = Number(amount);
  const transaction_type: BankFlow =
    type === 'deposit' || type === 'withdrawal' ? type : value < 0 ? 'withdrawal' : 'deposit';
  return {
    transaction_type,
    amount: signedBankAmount(value, transaction_type),
  };
}

export function mapPlaidBankRow(txn: PlaidGatewayTransaction, bankAccountId: string, importedAt = new Date().toISOString()): PlaidBankRow {
  const signed = signedAmountFromGateway(txn.amount, txn.type);
  return {
    bank_account_id: bankAccountId,
    transaction_date: txn.date,
    description: txn.description || txn.merchantName || 'Unnamed transaction',
    amount: signed.amount,
    transaction_type: signed.transaction_type,
    status: txn.pending ? 'pending' : 'unmatched',
    reference: `PLAID-${txn.id}`,
    category: txn.category || null,
    payee_payor: txn.merchantName || null,
    memo: txn.merchantName || null,
    // A posted download is not reconciled. Stay editable until it is categorized.
    is_cleared: false,
    imported_at: importedAt,
  };
}

/**
 * Older imports stored Math.abs(amount) and treated a negative gateway amount
 * as a deposit. Purchases were saved as positive deposits, and money in was
 * saved as a positive withdrawal. Those rows have a PLAID- reference, a
 * positive amount, and no imported_at. New imports set imported_at, so this
 * repair does not run twice.
 */
export function repairLegacyPlaidRow(row: {
  reference: string | null;
  imported_at: string | null;
  amount: number;
  transaction_type: string;
}): { amount: number; transaction_type: BankFlow } | null {
  if (!row.reference?.startsWith('PLAID-')) return null;
  if (row.imported_at) return null;
  const amount = Number(row.amount);
  if (!(amount > 0)) return null;
  if (row.transaction_type === 'deposit') {
    return { amount: -amount, transaction_type: 'withdrawal' };
  }
  if (row.transaction_type === 'withdrawal') {
    return { amount, transaction_type: 'deposit' };
  }
  return null;
}
