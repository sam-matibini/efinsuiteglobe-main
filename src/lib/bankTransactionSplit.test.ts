import { readStoredSplits, splitRemainder, splitsFromJournalLines, validateBankSplits, writeStoredSplits, type BankGlSplit } from './bankTransactionSplit';

const lines: BankGlSplit[] = [
  { id: '1', accountId: 'draw', amount: 197.5, memo: "Owner's withdrawal" },
  { id: '2', accountId: 'fee', amount: 2.5, memo: 'Bank charges' },
];

describe('bank transaction splits', () => {
  it('accepts an ATM withdrawal split between the owner and the bank fee', () => {
    expect(validateBankSplits(200, lines)).toBeNull();
    expect(splitRemainder(200, [{ amount: 197.5 }])).toBe(2.5);
  });

  it('rejects a split that does not use the whole withdrawal', () => {
    expect(validateBankSplits(200, [{ ...lines[0], amount: 190 }, lines[1]])).toMatch(/unallocated/);
    expect(validateBankSplits(200, [{ ...lines[0], amount: 199 }, lines[1]])).toMatch(/more than/);
  });

  it('reads the expense lines back from the posted journal', () => {
    const parsed = splitsFromJournalLines([
      { account_id: 'bank', debit: 0, credit: 200, description: 'Payment: NON-TD ATM W/D' },
      { account_id: 'draw', debit: 197.5, credit: 0, description: "Owner's withdrawal" },
      { account_id: 'fee', debit: 2.5, credit: 0, description: 'Bank charges' },
      { account_id: 'gst', debit: 0.13, credit: 0, description: 'GST (5%) paid on bank fee' },
    ], 'withdrawal');
    expect(parsed.map((line) => line.accountId)).toEqual(['draw', 'fee']);
    expect(parsed.map((line) => line.amount)).toEqual([197.5, 2.5]);
  });

  it('keeps an unfinished split on this device, including a line with no account yet', () => {
    const draft: BankGlSplit[] = [
      { id: '1', accountId: 'draw', amount: 200, memo: '' },
      { id: '2', accountId: '', amount: 0, memo: 'Bank charges' },
    ];
    writeStoredSplits('tx-1', draft);
    expect(readStoredSplits('tx-1')).toEqual(draft);
    writeStoredSplits('tx-1', []);
    expect(readStoredSplits('tx-1')).toEqual([]);
  });
});
