import { describe, expect, it } from 'vitest';
import { mapPlaidCreditCardRow } from './plaidCreditCard';

describe('Plaid credit card download row', () => {
  const cardId = 'card-1';

  it('stores a purchase as a charge with the merchant as Payee_Payor', () => {
    const row = mapPlaidCreditCardRow({
      id: 'p1',
      date: '2026-01-30',
      description: 'AMAZON.COM',
      amount: -125.99,
      merchantName: 'Amazon',
      category: 'Shopping',
    }, cardId, '2026-09-29T00:00:00.000Z');

    expect(row.transaction_type).toBe('charge');
    expect(row.amount).toBe(125.99);
    expect(row.payee_payor).toBe('Amazon');
    expect(row.reference).toBe('PLAID-p1');
  });

  it('stores a card payment, refund, and fee as those types', () => {
    expect(mapPlaidCreditCardRow({
      id: 'p2',
      date: '2026-01-29',
      description: 'PAYMENT RECEIVED - THANK YOU',
      amount: 500,
      merchantName: 'Bank Transfer',
    }, cardId).transaction_type).toBe('payment');

    expect(mapPlaidCreditCardRow({
      id: 'p3',
      date: '2026-01-28',
      description: 'REFUND - RETURN',
      amount: 35,
      merchantName: 'Target',
    }, cardId).transaction_type).toBe('credit');

    expect(mapPlaidCreditCardRow({
      id: 'p4',
      date: '2026-01-27',
      description: 'ANNUAL FEE',
      amount: -120,
      merchantName: 'Card Issuer',
    }, cardId).transaction_type).toBe('fee');
  });
});
