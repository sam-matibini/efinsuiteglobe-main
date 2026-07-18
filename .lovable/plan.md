## Goal

Extend the Management Report page (`/reports/management`) with interim/YTD financial statements alongside the existing ratios and charts. Management reports are internal and unaudited, so statements will be rendered in a condensed, printable format for the selected period.

## What to add

A new **"Financial Statements"** tab (added to the existing `Tabs` component) containing four condensed statements for the current filter period:

1. **Income Statement (YTD/Interim)** — Revenue, COGS, Gross Profit, Operating Expenses, Operating Income, Other Income/Expense, Net Income.
2. **Balance Sheet (As-of end date)** — Assets, Liabilities, Equity with Current Year Earnings.
3. **Cash Flow Statement (Indirect)** — Operating/Investing/Financing sections for the period.
4. **Statement of Changes in Equity** — Opening balances, movements, closing balances.

Each statement is a condensed/summary view (section subtotals + top-level accounts, not full drill-down), suitable for management review. A period label reading "For the period ended {endDate}" or "Fiscal Year to Date" auto-derives from the filter.

## Implementation

**File edited:** `src/pages/ManagementReport.tsx`

1. Extend the hook usage to also pull cash flow and equity data:
   - `useFinancialReports` already exposes `getBalanceSheetData` and `getIncomeStatementData`. Reuse `getCashFlowData` and `getEquityStatementData` if they exist; otherwise import from the existing hooks used by `CashFlow.tsx` and `ChangesInEquity.tsx` (`useFinancialReports` variants already power those pages).
2. Add a new `<TabsTrigger value="statements">Financial Statements</TabsTrigger>` and matching `<TabsContent>`.
3. Build a small reusable `<StatementSection>` component inside the file that renders a titled table with rows and a bolded subtotal — used by all four statements.
4. Extend the Export to Excel and Export to PDF handlers to include each statement as a new sheet / new PDF page when the statements tab has data.
5. Header label switches to include "Interim/YTD Financial Statements" when the statements tab is active.

## Out of scope

- No new database work, no schema changes.
- No changes to the underlying report calculation hooks — reuse them as-is.
- No comparative period columns (the dedicated report pages already provide those); management view stays single-period for brevity.
