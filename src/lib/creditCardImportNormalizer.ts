/**
 * Credit card import classification (description-first, sign-fallback).
 *
 * Rule order:
 *   1. Explicit Type column from source — always wins.
 *   2. Description keyword scan:
 *        - payment keywords  -> 'payment'  (inflow into CC, reduces liability)
 *        - refund  keywords  -> 'credit'
 *        - interest keywords -> 'interest'
 *        - fee     keywords  -> 'fee'
 *   3. Sign fallback only when description is ambiguous:
 *        - amount < 0 -> 'payment'
 *        - amount > 0 -> 'charge'
 *        - amount == 0 -> 'charge'
 *
 * Amounts are stored as positive magnitudes; `transaction_type` drives GL polarity
 * (see useCreditCardGL.ts).
 *
 * This helper is credit-card ONLY. Bank/chequing imports use the opposite sign
 * convention and must not call into this file.
 */
export type CreditCardTxnType = 'charge' | 'payment' | 'credit' | 'fee' | 'interest';

const PAYMENT_PATTERNS = [
  'payment received',
  'pre-auth pmt',
  'pre auth pmt',
  'autopay',
  'auto pay',
  'auto-pay',
  'bill payment',
  'online payment',
  'mobile payment',
  'e-transfer to card',
  'transfer to card',
  'payment - thank',
  'paiement',
  'thank you',
  'thankyou',
  ' pmt ',
  'pmt-',
];

const REFUND_PATTERNS = [
  'refund',
  'return ',
  'returned',
  'credit memo',
  'reversal',
  'chargeback',
  'merchant credit',
];

const INTEREST_PATTERNS = ['interest charge', 'interest', 'finance charge'];
const FEE_PATTERNS = ['annual fee', ' fee', 'service charge', 'late fee', 'overlimit'];

function matches(haystack: string, patterns: string[]): boolean {
  for (const p of patterns) {
    if (haystack.includes(p)) return true;
  }
  return false;
}

export function classifyCreditCardType(
  rawAmount: number,
  explicitType?: string | null,
  description?: string | null,
): CreditCardTxnType {
  // 1. Explicit type column wins
  const t = (explicitType || '').toString().toLowerCase().trim();
  if (t) {
    if (t === 'charge' || t === 'purchase' || t === 'debit' || t === 'withdrawal') return 'charge';
    if (t === 'payment' || t === 'pmt' || t.includes('payment')) return 'payment';
    if (t === 'credit' || t === 'refund' || t.includes('refund')) return 'credit';
    if (t === 'interest' || t.includes('interest')) return 'interest';
    if (t === 'fee' || t.includes('fee')) return 'fee';
    if (t === 'deposit') return 'payment';
  }

  // 2. Description-first keyword scan
  const d = ` ${(description || '').toString().toLowerCase()} `;
  if (matches(d, PAYMENT_PATTERNS)) return 'payment';
  if (matches(d, REFUND_PATTERNS)) return 'credit';
  if (matches(d, INTEREST_PATTERNS)) return 'interest';
  if (matches(d, FEE_PATTERNS)) return 'fee';

  // 3. Sign fallback only when description is ambiguous
  const n = Number(rawAmount) || 0;
  if (n < 0) return 'payment';
  return 'charge';
}

export function normalizeCreditCardAmount(rawAmount: number): number {
  return Math.abs(Number(rawAmount) || 0);
}
