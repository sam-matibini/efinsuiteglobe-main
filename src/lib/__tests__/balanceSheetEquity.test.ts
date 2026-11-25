import { describe, expect, it } from 'vitest';
import { buildRetainedEarningsRollforward, computeLedgerBuckets, isExcludedFromEquityTotal } from '../balanceSheetEquity';

type Acc = { id: string; code: string; name: string; account_type: string; normal_balance: 'debit' | 'credit'; opening: number };
const ACCOUNTS: Acc[] = [
  { id: 'cash', code: '1000', name: 'Cash', account_type: 'asset', normal_balance: 'debit', opening: 1000 },
  { id: 'ad', code: '1500', name: 'Accumulated Depreciation', account_type: 'asset', normal_balance: 'credit', opening: 0 },
  { id: 'ap', code: '2000', name: 'Accounts Payable', account_type: 'liability', normal_balance: 'credit', opening: 0 },
  { id: 'cap', code: '3000', name: 'Share Capital', account_type: 'equity', normal_balance: 'credit', opening: 1000 },
  { id: 're', code: '3-00-201', name: 'Retained Earnings', account_type: 'equity', normal_balance: 'credit', opening: 0 },
  { id: 'cye', code: '3-00-202', name: 'Current Year Earnings', account_type: 'equity', normal_balance: 'credit', opening: 0 },
  { id: 'div', code: '3100', name: 'Dividends', account_type: 'equity', normal_balance: 'debit', opening: 0 },
  { id: 'rev', code: '4000', name: 'Sales', account_type: 'income', normal_balance: 'credit', opening: 0 },
  { id: 'exp', code: '6000', name: 'Rent', account_type: 'expense', normal_balance: 'debit', opening: 0 },
  { id: 'dep', code: '6100', name: 'Depreciation', account_type: 'expense', normal_balance: 'debit', opening: 0 },
];

// Entries: [id, date, reference, lines[account, debit, credit]]
type Entry = [string, string, string, [string, number, number][]];
const ENTRIES: Entry[] = [
  // FY2024 (Oct 2023 – Sep 2024): earned 5,000, rent 1,200 — then CLOSED.
  ['e1', '2024-01-15', 'INV-1', [['cash', 5000, 0], ['rev', 0, 5000]]],
  ['e2', '2024-02-01', 'BILL-1', [['exp', 1200, 0], ['ap', 0, 1200]]],
  ['c24', '2024-09-30', 'CLOSE-2024', [['rev', 5000, 0], ['exp', 0, 1200], ['re', 0, 3800]]],
  // FY2025 (Oct 2024 – Sep 2025): earned 9,000, rent 2,400 — NOT closed (the unclosed year on screen).
  ['e3', '2025-03-10', 'INV-2', [['cash', 9000, 0], ['rev', 0, 9000]]],
  ['e4', '2025-04-01', 'BILL-2', [['exp', 2400, 0], ['cash', 0, 2400]]],
  // FY2026 (Oct 2025 – Sep 2026): sales, depreciation, a dividend and a prior-period adjustment straight to RE.
  ['e5', '2025-11-05', 'INV-3', [['cash', 7000, 0], ['rev', 0, 7000]]],
  ['e6', '2026-06-30', 'DEP', [['dep', 500, 0], ['ad', 0, 500]]],
  ['e7', '2026-07-15', 'DIV', [['div', 1500, 0], ['cash', 0, 1500]]],
  ['e8', '2026-08-01', 'ADJ', [['re', 300, 0], ['ap', 0, 300]]],
  // A stray posting to the CYE bucket must still flow through equity.
  ['e9', '2026-08-02', 'CYE-FIX', [['cash', 100, 0], ['cye', 0, 100]]],
];

function balancesAt(endDate: string, fiscalYearStart: string) {
  const entryDate = new Map(ENTRIES.map(([id, d]) => [id, d]));
  const closing = new Set(ENTRIES.filter(([, , ref]) => ref.startsWith('CLOSE-')).map(([id]) => id));
  return ACCOUNTS.map((a) => {
    const lines = ENTRIES.flatMap(([id, , , ls]) =>
      ls.filter(([acc]) => acc === a.id).map(([, dr, cr]) => ({ journal_entry_id: id, debitCents: dr * 100, creditCents: cr * 100 })));
    return {
      ...a,
      is_header: false,
      ...computeLedgerBuckets({
        normalBalance: a.normal_balance, accountType: a.account_type, openingBalanceCents: a.opening * 100,
        lines, entryDate, closingEntryIds: closing, fiscalYearStart, endDate,
      }),
    };
  });
}

/** What the Balance Sheet page does: assets, liabilities, other equity + RE closing. */
function balanceSheet(endDate: string, fiscalYearStart: string) {
  const accts = balancesAt(endDate, fiscalYearStart);
  const sum = (type: string, normal: 'debit' | 'credit', filter = (_: (typeof accts)[number]) => true) =>
    accts.filter((a) => a.account_type === type && filter(a))
      .reduce((s, a) => s + (a.normal_balance === normal ? 1 : -1) * Math.round(a.bs_cumulative * 100), 0) / 100;
  const re = buildRetainedEarningsRollforward(accts);
  const assets = sum('asset', 'debit');
  const liabilities = sum('liability', 'credit');
  const equity = sum('equity', 'credit', (a) => !isExcludedFromEquityTotal(a)) + re.closingBalance;
  return { assets, liabilities, equity, re };
}

describe('Balance Sheet equity from the ledger', () => {
  it('balances with an unclosed prior year, a closed year, dividends and RE adjustments', () => {
    const bs = balanceSheet('2026-11-25', '2026-10-01');
    expect(bs.assets).toBe(1000 + 5000 + 9000 - 2400 + 7000 - 1500 + 100 - 500);
    expect(Math.round((bs.assets - bs.liabilities - bs.equity) * 100)).toBe(0);
  });

  it('rolls Retained Earnings forward without double counting the unclosed year', () => {
    // Report inside FY2026 (Oct 1 2025 – Sep 30 2026).
    const { re } = balanceSheet('2026-09-30', '2025-10-01');
    expect(re.openingBalance).toBe(3800 + 9000 - 2400);   // closed FY2024 + unclosed FY2025
    expect(re.netIncomeLoss).toBe(7000 - 500);
    expect(re.dividendsDeclared).toBe(1500);
    expect(re.otherDeductions).toBe(300 - 100);            // RE adjustment net of the CYE posting
    expect(re.closingBalance).toBe(re.openingBalance + re.netIncomeLoss - re.dividendsDeclared + re.otherAdditions - re.otherDeductions);
  });

  it('balances at every month end', () => {
    for (const end of ['2024-01-31', '2024-09-30', '2024-10-31', '2025-06-30', '2025-12-31', '2026-07-31', '2026-09-30']) {
      const fyStart = end >= '2025-10-01' ? '2025-10-01' : end >= '2024-10-01' ? '2024-10-01' : '2023-10-01';
      const bs = balanceSheet(end, fyStart);
      expect(Math.round((bs.assets - bs.liabilities - bs.equity) * 100), end).toBe(0);
    }
  });

  it('shows the year’s profit as net income even after the year is closed', () => {
    const { re } = balanceSheet('2024-09-30', '2023-10-01');
    expect(re.netIncomeLoss).toBe(5000 - 1200);
    expect(re.closingBalance).toBe(3800);
  });
});
