import { describe, expect, it } from 'vitest';
import { buildTransactionDownloadCsv, downloadPayee, TRANSACTION_DOWNLOAD_HEADERS } from './transactionDownload';

describe('transaction download format', () => {
  it('uses Date, Description, Amount, Type, Payee_Payor, Reference for a bank account', () => {
    const csv = buildTransactionDownloadCsv('bank', [
      {
        date: '2026-09-21',
        description: 'Credit Memo FREE INTERAC E-TRANSFER',
        amount: 100,
        type: 'deposit',
        payee_payor: 'Client',
        reference: 'PLAID-abc',
      },
      {
        date: '2026-09-21',
        description: 'Office supplies, "rush"',
        amount: 40,
        type: 'withdrawal',
        payee_payor: 'Staples',
        reference: 'PLAID-def',
      },
    ]);

    expect(csv.split('\n')[0]).toBe(TRANSACTION_DOWNLOAD_HEADERS.join(','));
    expect(csv).toBe(
      [
        'Date,Description,Amount,Type,Payee_Payor,Reference',
        '2026-09-21,Credit Memo FREE INTERAC E-TRANSFER,100.00,deposit,Client,PLAID-abc',
        '2026-09-21,"Office supplies, ""rush""",-40.00,withdrawal,Staples,PLAID-def',
      ].join('\n'),
    );
  });

  it('uses charge, payment, credit, and fee types for a credit card', () => {
    const csv = buildTransactionDownloadCsv('credit-card', [
      { date: '2026-01-30', description: 'AMAZON', amount: 125.99, type: 'charge', payee_payor: 'Amazon', reference: 'ORD-1' },
      { date: '2026-01-29', description: 'PAYMENT RECEIVED', amount: 500, type: 'payment', payee_payor: 'Bank', reference: 'PMT-1' },
      { date: '2026-01-28', description: 'REFUND - RETURN', amount: 35, type: 'credit', payee_payor: 'Target', reference: 'RET-1' },
      { date: '2026-01-27', description: 'ANNUAL FEE', amount: 120, type: 'fee', payee_payor: 'Issuer', reference: '' },
      { date: '2026-01-26', description: 'INTEREST CHARGE', amount: 8.5, type: 'interest', payee_payor: 'Issuer', reference: 'INT-1' },
    ]);

    const lines = csv.split('\n');
    expect(lines[0]).toBe('Date,Description,Amount,Type,Payee_Payor,Reference');
    expect(lines[1]).toBe('2026-01-30,AMAZON,125.99,charge,Amazon,ORD-1');
    expect(lines[2]).toBe('2026-01-29,PAYMENT RECEIVED,-500.00,payment,Bank,PMT-1');
    expect(lines[3]).toBe('2026-01-28,REFUND - RETURN,-35.00,credit,Target,RET-1');
    expect(lines[4]).toBe('2026-01-27,ANNUAL FEE,120.00,fee,Issuer,');
    expect(lines[5]).toBe('2026-01-26,INTEREST CHARGE,8.50,interest,Issuer,INT-1');
  });

  it('uses the Plaid merchant memo when payee_payor was not stored', () => {
    expect(downloadPayee({
      payee_payor: null,
      memo: 'Flovide Account',
      reference: 'PLAID-abc',
    })).toBe('Flovide Account');
    expect(downloadPayee({
      payee_payor: 'Saved Payee',
      memo: 'Other',
      reference: 'PLAID-abc',
    })).toBe('Saved Payee');
    expect(downloadPayee({
      payee_payor: null,
      memo: 'Manual note',
      reference: 'INV-1',
    })).toBe('');
  });
});
