import { describe, expect, it } from 'vitest';
import { mapPlaidBankRow, repairLegacyPlaidRow, signedBankAmount } from './plaidBankAmount';

describe('Plaid bank amount sign', () => {
  it('stores a gateway deposit as a positive amount', () => {
    const row = mapPlaidBankRow({
      id: 'in-1',
      date: '2026-09-23',
      description: '10045810 MB PAY',
      amount: 14842.8,
      type: 'deposit',
    }, 'acct');
    expect(row.transaction_type).toBe('deposit');
    expect(row.amount).toBe(14842.8);
    expect(row.reference).toBe('PLAID-in-1');
    expect(row.payee_payor).toBeNull();
    expect(row.imported_at).toBeTruthy();
  });

  it('stores the Plaid merchant as Payee_Payor', () => {
    const row = mapPlaidBankRow({
      id: 'out-2',
      date: '2026-09-21',
      description: 'Credit Memo eFinMoney',
      amount: 3,
      type: 'deposit',
      merchantName: 'Flovide Account',
    }, 'acct');
    expect(row.payee_payor).toBe('Flovide Account');
    expect(row.transaction_type).toBe('deposit');
  });

  it('stores a gateway withdrawal as a negative amount', () => {
    const row = mapPlaidBankRow({
      id: 'out-1',
      date: '2026-09-25',
      description: 'Amazon',
      amount: -183.63,
      type: 'withdrawal',
      category: 'Shops',
    }, 'acct');
    expect(row.transaction_type).toBe('withdrawal');
    expect(row.amount).toBe(-183.63);
  });

  it('uses the amount sign when the gateway type is missing', () => {
    expect(signedBankAmount(40, 'withdrawal')).toBe(-40);
    expect(mapPlaidBankRow({ id: 'x', date: '2026-09-25', description: 'Shell', amount: -40 }, 'acct').transaction_type).toBe('withdrawal');
    expect(mapPlaidBankRow({ id: 'y', date: '2026-09-25', description: 'Payroll', amount: 100 }, 'acct').amount).toBe(100);
  });

  it('turns already downloaded positive purchases into negative withdrawals', () => {
    expect(repairLegacyPlaidRow({
      reference: 'PLAID-amazon',
      imported_at: null,
      amount: 183.63,
      transaction_type: 'deposit',
    })).toEqual({ amount: -183.63, transaction_type: 'withdrawal' });
  });

  it('turns already downloaded positive deposits back to deposits', () => {
    expect(repairLegacyPlaidRow({
      reference: 'PLAID-mb-pay',
      imported_at: null,
      amount: 14842.8,
      transaction_type: 'withdrawal',
    })).toEqual({ amount: 14842.8, transaction_type: 'deposit' });
  });

  it('leaves a row alone once it has been signed', () => {
    expect(repairLegacyPlaidRow({
      reference: 'PLAID-amazon',
      imported_at: '2026-09-26T00:00:00.000Z',
      amount: 183.63,
      transaction_type: 'deposit',
    })).toBeNull();
    expect(repairLegacyPlaidRow({
      reference: 'PLAID-amazon',
      imported_at: null,
      amount: -183.63,
      transaction_type: 'withdrawal',
    })).toBeNull();
    expect(repairLegacyPlaidRow({
      reference: 'STMT-1',
      imported_at: null,
      amount: 10,
      transaction_type: 'deposit',
    })).toBeNull();
  });
});
