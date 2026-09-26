import { applyPeriodBalances, summarizePeriodAccounts } from './taxReportPeriod';

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

  it('ignores lines for accounts outside the report', () => {
    const period = applyPeriodBalances(accounts, [
      { accountId: 'bank', debit: 500, credit: 0 },
    ]);
    expect(summarizePeriodAccounts(period).netPayable).toBe(0);
  });
});
