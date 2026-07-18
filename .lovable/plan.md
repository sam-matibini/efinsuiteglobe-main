## Problem

The Balance Sheet inside Management Report > Financial Statements tab does not balance (Assets $669,648 vs Liabilities + Equity $663,442, diff $6,206), while the standalone `/reports/balance-sheet` page for the same period ties.

## Root Cause (verified)

- `src/components/reports/StatementsPanel.tsx` computes Total Equity as `balanceSheet.totalEquity + balanceSheet.netIncome` from `useFinancialReports.getBalanceSheetData()`.
- That hook returns `totalEquity` as the raw sum of every equity account's `calculated_balance` (including the Retained Earnings account and any Current Year Earnings account) and `netIncome` as YTD net income from temporary accounts.
- The canonical `src/pages/BalanceSheet.tsx` does NOT use that pair. It computes:
  `totalEquity = equityAccountsExcludingRE_and_CYE + reClosingBalance`
  where `reClosingBalance` comes from `useRetainedEarningsStatement` (RPC `calculate_retained_earnings_statement`), which already includes period net income and reconciles with Assets − Liabilities.
- Using `hook.totalEquity + hook.netIncome` double-counts / mis-counts whenever the RE account holds a value that isn't equal to opening RE (e.g. partial closes, prior-year unclosed NI already rolled into RE), producing the observed $6,206 gap.

## Fix

Update the Management Report's condensed Balance Sheet to reuse the same equity math as the main Balance Sheet page so the equation ties.

### Changes

1. `src/pages/ManagementReport.tsx`
   - Call `useRetainedEarningsStatement({ startDate, endDate })` alongside existing hooks.
   - Pass `reClosingBalance` (from `currentStatement.data.closingBalance`) and the raw equity account list to `StatementsPanel`.

2. `src/components/reports/StatementsPanel.tsx`
   - Accept a new prop `reClosingBalance: number`.
   - Replace the current Balance Sheet rows with the same formula used by `BalanceSheet.tsx`:
     - `otherEquity` = sum of equity accounts excluding Retained Earnings and Current Year Earnings accounts (credit-normal add, debit-normal contra subtract).
     - `totalEquity = otherEquity + reClosingBalance`.
     - `totalLiabilitiesAndEquity = totalLiabilities + totalEquity`.
   - Display rows:
     - Total Assets
     - Total Liabilities
     - Other Equity (opening + movements, RE excluded)
     - Retained Earnings (closing, incl. current year earnings)
     - Total Equity
     - Total Liabilities + Equity
   - Add a small "Balanced / Out of balance by $X" indicator that mirrors the main report's tolerance (< 2 cents).

3. Statement of Changes in Equity card in the same panel
   - Keep as-is, but source "Net Income for the Period" from `reCurrentStatement.data.netIncomeLoss` so all four condensed statements draw from one reconciled source.

### Technical notes

- No changes to `useFinancialReports`, RPCs, or the Income Statement / Cash Flow cards.
- Helper `isExcludedFromEquityTotal` used by `BalanceSheet.tsx` can be imported (or a minimal local equivalent that filters by `equity_category IN ('RETAINED_EARNINGS','CURRENT_YEAR_EARNINGS')` plus name-pattern fallback) so both pages stay consistent.
- Verification: after the change, for the current org/period Assets should equal Total Liabilities + Equity to within rounding; will confirm by loading `/reports/management` and comparing to `/reports/balance-sheet` for the same date range.

## Summary

Management Report's condensed Balance Sheet uses a different equity formula than the main Balance Sheet page. Switch it to the same `otherEquity + reClosingBalance` formula (driven by the Retained Earnings Statement RPC) so it balances.