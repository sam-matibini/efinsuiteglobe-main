## Problem

On the Balance Sheet, the Equity section is showing a separate **"Dividends Paid"** line (Sunview Homes: 194,000 cumulative debit). That same dividend activity is *also* rolled into the **Statement of Retained Earnings (Deficit)** shown right below the Balance Sheet (Dividends declared 54,000 in 2025 + 140,000 in 2024, ending with Closing balance -59,269.33).

Because the RE closing balance already nets dividends, listing "Dividends Paid" as its own equity line double-counts the reduction and pushes Total Equity off by the dividend amount — which is why the balance sheet reports "out of balance".

`src/pages/BalanceSheet.tsx` does have an `isDividendAccount(...)` name filter, but the Sunview account slipped through: the visible row on-screen proves the exclusion is not being applied to this account in the rendered rows (likely because the row is being emitted from the RE / contra-equity path before the filter runs, or the filter runs against a different account list than the one shown).

## Fix

Enforce a single, authoritative "contra-equity dividend" exclusion on the Balance Sheet equity section only. The RE Statement below is unchanged and remains the single source of truth for dividends.

### Changes — `src/pages/BalanceSheet.tsx`

1. Broaden `isDividendAccount(...)` so it catches every reasonable naming convention *and* known GIFI-style codes, not just names containing "dividend":
   - names matching: `dividend`, `dividends paid`, `dividends declared`, `owner draw(s)`, `owner's draw(s)`, `shareholder draw(s)`, `distribution(s) to owners/shareholders`, `capital distributions`, `drawings`
   - account codes ending in the known contra-equity slots (e.g. `-0003` under the `3-01-100` shareholder-equity header used by Sunview, plus any account whose `normal_balance = 'debit'` while `account_type = 'equity'` — a contra-equity account by definition)
2. Apply that same predicate in **all three** places that build the equity section so nothing leaks through:
   - `equityAccountsExcludingREandCYE` (Total Equity math, ~line 436)
   - `buildHierarchicalRows('equity')` (rendered rows, ~line 624)
   - the `equityRows` `useMemo` / section-subtotal recalculation (~line 896) — recompute subtotals *after* the exclusion so `Total for EQUITY` matches the visible rows
3. Recompute the on-screen "Balanced / Out of balance" indicator against the new (post-exclusion) `totalEquity`. Expected result for Sunview 2025:
   - Common Shares: 100.00
   - Retained Earnings (from RE Statement closing): (59,269.33)
   - **Dividends Paid line: removed**
   - Total Equity: (59,169.33)
   - Assets − Liabilities should now equal Total Equity → **Balanced: 0.00**

### Deliberately out of scope

- No changes to the **Statement of Retained Earnings (Deficit)** — dividends stay listed there.
- No changes to the underlying `Dividends Paid` GL account or its journal entries. Its balance still exists in the ledger; we simply do not present it as a separate line in the Balance Sheet's Equity section.
- No changes to the Income Statement, Cash Flow, or Statement of Changes in Equity (those already treat dividends correctly).
- No database migration required.

### Verification steps

1. Open `/reports/balance-sheet` for Sunview Homes & Construction Inc.
2. Confirm the Equity section shows only `Common Shares` and `Retained Earnings`, with no `Dividends Paid` row.
3. Confirm `Total for Equity` = Common Shares + RE closing balance from the RE Statement below.
4. Confirm `Total for Liabilities & Equity` = `Total Assets` and the "Balanced" indicator reads 0.00 for both 2025 and 2024 columns.
5. Spot-check a non-Sunview org that has no dividend account to make sure Equity rendering is unchanged.
