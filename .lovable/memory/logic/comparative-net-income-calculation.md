# Memory: logic/comparative-net-income-calculation
Updated: 2026-01-19

The 'useComparativeFinancialReports' and 'useFinancialReports' hooks distinguish between 'netIncome' (period-specific for Income Statement and Cash Flow) and 'ytdNetIncome' (cumulative for Balance Sheet equation validation). This ensures that the accounting equation balances correctly even when prior fiscal years remain unclosed.

## Critical Fix (2026-01-19): Cumulative YTD for Balance Sheet

**Bug**: The YTD balance calculation for temporary accounts (income/expense) was only including the CURRENT fiscal year's transactions. This caused the Balance Sheet equation to fail when prior years remained unclosed.

**Example**: 
- 2024 Net Loss: -$21,466.34 (unclosed)
- 2025 Net Income: +$51,282.15
- If YTD only included 2025, the Balance Sheet would be out of balance by $21,466.34

**Root Cause**: The condition `entryDate >= fiscalYearStartStr && entryDate <= endDateStr` excluded prior year earnings.

**Fix Applied** to both hooks:
- Changed YTD calculation for temporary accounts from fiscal-year-start filter to `entryDate <= endDateStr`
- This includes ALL unclosed years' earnings in the Balance Sheet equation
- Maintains the accounting equation: **Assets = Liabilities + Equity + Cumulative Unretained Earnings**

### Balance Sheet Equation (Cumulative):
For 2025 Balance Sheet (with 2024 unclosed):
- Assets: $185,980.72
- Liabilities: $153,745.02
- Equity: $2,419.89 (Retained Earnings from Opening Bank Balances)
- Cumulative Net Income: $29,815.81 (2024 loss + 2025 income = -$21,466.34 + $51,282.15)
- **Check**: $185,980.72 = $153,745.02 + $2,419.89 + $29,815.81 = $185,980.72 ✓ Balanced

For 2024 Balance Sheet:
- Assets: $160,583.55
- Liabilities: $182,049.89
- Equity: $0
- Net Income: -$21,466.34
- **Check**: $160,583.55 = $182,049.89 + $0 + (-$21,466.34) = $160,583.55 ✓ Balanced

## Income Statement vs Balance Sheet Net Income

1. **Income Statement** uses `calculated_balance` (period-specific): Shows only the selected period's activity
2. **Balance Sheet** uses `ytd_balance` (cumulative): Includes ALL unclosed years for equation balance

## Data Structure (2024-12-31 "2024 Income Statements" Entry)
The TB import entry correctly records:
- DEBIT A/R: $160,346 (revenue receivable)
- DEBIT Inventory: $142
- DEBIT Expenses: $180,947 (various expense accounts)
- CREDIT Sales Revenue: $160,346
- CREDIT Credit Card Payable: $181,089 (expenses on credit)

This ensures proper double-entry with offsetting A/R and A/P entries.
