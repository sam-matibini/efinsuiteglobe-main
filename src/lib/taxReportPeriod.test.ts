import { applyPeriodBalances, periodChange, summarizeLinesInRange, summarizePeriodAccounts } from './taxReportPeriod';

const accounts = [
  { accountId: 'payable', accountName: 'GST/HST Payable', type: 'collected' as const, balance: 909.5 },
  { accountId: 'itc', accountName: 'GST/HST Input Tax Credits (ITC)', type: 'paid' as const, balance: 45.85 },
];

describe('GST/HST period activity', () => {
  it('uses journal activity in the period instead of the lifetime balance', () => {
    const lastYear = applyPeriodBalances(accounts, [
      { accountId: 'payable', debit: 0, credit: 909.5 },
      { accountId: 'itc', debit: 45.85, credit: 0 },
    ]);
    expect(summarizePeriodAccounts(lastYear)).toEqual({
      collected: 909.5,
      paid: 45.85,
      pst: 0,
      netPayable: 863.65,
    });

    const currentYear = applyPeriodBalances(accounts, []);
    expect(summarizePeriodAccounts(currentYear)).toEqual({
      collected: 0,
      paid: 0,
      pst: 0,
      netPayable: 0,
    });
    expect(currentYear.map((account) => account.balance)).toEqual([0, 0]);
  });

  it('reduces tax collected when the payable account is debited', () => {
    const period = applyPeriodBalances(accounts, [
      { accountId: 'payable', debit: 0, credit: 100 },
      { accountId: 'payable', debit: 40, credit: 0 },
    ]);
    expect(summarizePeriodAccounts(period).collected).toBe(60);
  });

  it('fills earlier periods and the change against the previous one', () => {
    const lines = [
      { accountId: 'payable', debit: 0, credit: 100, entryDate: '2026-09-15' },
      { accountId: 'itc', debit: 9.13, credit: 0, entryDate: '2026-09-04' },
      { accountId: 'itc', debit: 20, credit: 0, entryDate: '2026-08-20' },
      { accountId: 'payable', debit: 0, credit: 40, entryDate: '2026-07-02' },
    ];
    const september = summarizeLinesInRange(accounts, lines, '2026-09-01', '2026-09-30');
    const august = summarizeLinesInRange(accounts, lines, '2026-08-01', '2026-08-31');
    const july = summarizeLinesInRange(accounts, lines, '2026-07-01', '2026-07-31');
    expect(september).toMatchObject({ collected: 100, paid: 9.13, netPayable: 90.87 });
    expect(august).toMatchObject({ collected: 0, paid: 20, netPayable: -20 });
    expect(july).toMatchObject({ collected: 40, paid: 0, netPayable: 40 });
    expect(periodChange(september.paid, august.paid)).toBe(-10.87);
    expect(periodChange(september.netPayable, august.netPayable)).toBe(110.87);
  });

  it('ignores lines for accounts outside the report', () => {
    const period = applyPeriodBalances(accounts, [
      { accountId: 'bank', debit: 500, credit: 0 },
    ]);
    expect(summarizePeriodAccounts(period).netPayable).toBe(0);
  });
});
