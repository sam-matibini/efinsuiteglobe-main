import { applyGlEditToJournalLines, isReversalJournal, matchingCardPayment } from './postedJournalEdit';

describe('posted journal edit', () => {
  const card = 'card';
  const bank = 'bank';
  const lines = [
    { id: 'cash', account_id: card, debit: 4541.74, credit: 0 },
    { id: 'offset', account_id: 'old-bank', debit: 0, credit: 4541.74 },
  ];

  it('keeps the card line and moves only the offset to the new GL account', () => {
    const next = applyGlEditToJournalLines(lines, card, 'old-bank', bank, null);
    expect(next.find((line) => line.id === 'cash')).toMatchObject({ account_id: card, debit: 4541.74 });
    expect(next.find((line) => line.id === 'offset')).toMatchObject({ account_id: bank, credit: 4541.74 });
  });

  it('changes the amount without leaving an unbalanced entry', () => {
    const next = applyGlEditToJournalLines(lines, card, 'old-bank', bank, 100);
    const debit = next.reduce((sum, line) => sum + line.debit, 0);
    const credit = next.reduce((sum, line) => sum + line.credit, 0);
    expect(debit).toBeCloseTo(100);
    expect(credit).toBeCloseTo(100);
    expect(next.find((line) => line.id === 'offset')?.account_id).toBe(bank);
  });

  it('hides reversal journals and a payment that is already on the card', () => {
    expect(isReversalJournal({ reference: 'REV-Posted 2026-08-28', status: 'posted' })).toBe(true);
    expect(isReversalJournal({ reference: 'BANK-1', status: 'posted', reversal_of: null })).toBe(false);
    const used = new Set<string>();
    const match = matchingCardPayment(
      { journalEntryId: 'je-1', amount: 4541.74, date: '2026-08-27' },
      [{ id: 'cc-1', amount: 4541.74, date: '2026-08-28', transactionType: 'payment', journalEntryId: null }],
      used,
    );
    expect(match?.id).toBe('cc-1');
  });
});
