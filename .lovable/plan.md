## Problem

On the AI Compilation Report PDF, **Total Liabilities and Equity ≠ Total Assets**. The on-screen Balance Sheet balances correctly because it derives Total Equity from the Statement of Retained Earnings closing balance. The compilation PDF/Excel/Word exports use a different, legacy formula (`balanceSheet.totalEquity + netIncome`) that double-counts or omits pieces depending on where direct RE postings and CYE land in the raw GL sum.

## Fix

Make the compilation exports use the **same canonical equity formula** already documented in `AICompilationDialog.tsx` (lines 234–258) and used by `BalanceSheet.tsx`:

```
equityExcludingREandCYE = Σ equity accounts, excluding
    3-00-201 / "Retained Earnings" / "Accumulated Deficit" /
    "Unrestricted Net Assets" / "Accumulated Surplus" /
    "Unrestricted Funds" / "Accumulated Funds"
  and excluding
    3-00-202 / "Current Year Earnings" / "Current Year Excess" /
    "Current Year Surplus" / "Excess (Deficiency)"
  (contra equity signed by normal_balance)

totalEquity          = equityExcludingREandCYE + reClosingBalance
totalLiabAndEquity   = totalLiabilities + totalEquity
```

`reClosingBalance` for both current and prior year comes from the already-fixed `calculate_retained_earnings_statement` RPC (via `useRetainedEarningsStatement`), which now correctly folds direct RE postings into opening and returns `opening + net_income − dividends`.

## Changes

### 1. `src/pages/AccountantDashboard.tsx` — pass RE closing balances into the export

- Read current-year and prior-year RE closing balances from `useRetainedEarningsStatement` (already in scope via `reCurrentStatement`; add prior-period statement fetch matching the comparative period end).
- Extend `ComparativeFinancialData.currentYear.balanceSheet` and `.priorYear.balanceSheet` with a new field `reClosingBalance: number`.
- Populate that field for both years before calling `generateEnhancedCompilationPDF`, `downloadCompilationExcel`, and `downloadCompilationWord`.

### 2. `src/lib/generateCompilationPdfEnhanced.ts`

- Add `reClosingBalance: number` to the `balanceSheet` shape inside `ComparativeFinancialData` (both `currentYear` and `priorYear`).
- Replace the equity total block (currently lines 1073–1091) with the canonical formula:
  - Filter `currentBS.equity` / `priorBS.equity` to exclude RE and CYE accounts (same code+name predicates as the dialog).
  - Render remaining equity accounts as line items (contra-signed by `normal_balance`).
  - Render a **Retained Earnings** line using `reClosingBalance` (do NOT also render a separate "Current Year Earnings" line — CYE is already inside `reClosingBalance`).
  - Compute `totalEquity = equityExcludingREandCYE + reClosingBalance` for each period.
  - Compute `totalLiabAndEquity = totalLiabilities + totalEquity`.
- Remove the `+ currentBS.netIncome` addition when computing totals (the closing RE already contains net income).
- Keep the Statement of Changes in Equity section unchanged; it already uses the RE opening/closing rollforward directly.

### 3. `src/lib/generateCompilationExcel.ts` and `src/lib/generateCompilationWord.ts`

- Apply the same equity-total substitution so Excel and Word exports match the PDF and the on-screen Balance Sheet.

### 4. Regression guard

- After changes, verify on the demo org that:
  - PDF Total Liabilities + Total Equity == Total Assets (within $0.01) for both current and prior periods.
  - The single "Retained Earnings" line in the PDF equals the Statement of RE closing balance shown later in the same report.
  - No "Current Year Earnings" line is duplicated in the equity section.

## Out of scope

- No changes to `useFinancialReports`, `calculate_retained_earnings_statement`, or the on-screen Balance Sheet page — those are already correct.
- No changes to notes, income statement, or cash flow sections.
