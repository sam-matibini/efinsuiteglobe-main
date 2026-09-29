import { classifyCreditCardType, normalizeCreditCardAmount, type CreditCardTxnType } from '@/lib/creditCardImportNormalizer';

/**
 * Credit-card rows from the Plaid gateway.
 *
 * ai-bank-connect inverts Plaid's sign before this mapper runs: a purchase
 * arrives negative and a payment or refund arrives positive. Classification
 * uses the original Plaid sign so a purchase stays a charge.
 */
export interface PlaidCreditCardGatewayTransaction {
  id: string;
  date: string;
  description?: string;
  amount: number;
  category?: string;
  merchantName?: string;
  pending?: boolean;
}

export interface PlaidCreditCardRow {
  credit_card_id: string;
  transaction_date: string;
  description: string;
  amount: number;
  transaction_type: CreditCardTxnType;
  status: string;
  reference: string;
  category: string | null;
  payee_payor: string | null;
  is_cleared: boolean;
  imported_at: string;
}

export function mapPlaidCreditCardRow(
  txn: PlaidCreditCardGatewayTransaction,
  creditCardId: string,
  importedAt = new Date().toISOString(),
): PlaidCreditCardRow {
  const description = txn.description || txn.merchantName || 'Unnamed transaction';
  const originalPlaidAmount = -Number(txn.amount || 0);
  return {
    credit_card_id: creditCardId,
    transaction_date: txn.date,
    description,
    amount: normalizeCreditCardAmount(txn.amount),
    transaction_type: classifyCreditCardType(originalPlaidAmount, undefined, description),
    status: 'pending',
    reference: `PLAID-${txn.id}`,
    category: txn.category || null,
    payee_payor: txn.merchantName || null,
    is_cleared: false,
    imported_at: importedAt,
  };
}
