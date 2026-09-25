# Memory: logic/equity-current-year-earnings-exclusion
Updated: 2026-01-22

## Problem: Double-Counting of Current Year Earnings

The database contains a "Current Year Earnings" equity account (code 3-00-202) which is populated by the year-end closing process. However, the Balance Sheet also dynamically calculates "Current Year Earnings" from P&L accounts (Revenue - Expenses) and displays it as a separate line item.

This caused **double-counting** in the Shareholders' Equity section:
1. The 3-00-202 account balance was included in equity totals
2. The calculated net income was ALSO added to equity totals

## Solution: Exclude Current Year Earnings Account

The "Current Year Earnings" account must be **excluded** from equity account totals because:
- Net Income is calculated dynamically from temporary accounts (Income - Expenses)
- The stored account balance is only relevant AFTER fiscal year close (when it gets transferred to Retained Earnings)
- Including both causes incorrect Total Shareholders' Equity and Total Equities values

## Implementation

### Files Modified:
1. **src/hooks/useFinancialReports.ts**
   - Added `isCurrentYearEarningsAccount()` helper function
   - Filters out CYE account from equity totals in `getBalanceSheetData()`

2. **src/hooks/useComparativeFinancialReports.ts**
   - Added same `isCurrentYearEarningsAccount()` helper
   - Filters out CYE account from equity totals in `calculateTotals()`

3. **src/pages/BalanceSheet.tsx**
   - Added helper to identify CYE accounts
   - Filters out CYE from display rows in `buildHierarchicalRows()` for equity

### Detection Logic:
```typescript
const isCurrentYearEarningsAccount = (account): boolean => {
  const nameLower = account.name?.toLowerCase() || '';
  return (
    account.code === '3-00-202' ||
    nameLower.includes('current year earnings') ||
    nameLower.includes('current year earning') ||
    nameLower.includes('current earnings') ||
    nameLower === 'current year net income' ||
    nameLower === 'current year income'
  );
};
```

## GAAP Compliance

This follows proper GAAP/ASPE/IFRS treatment:
- **Total Equity = Equity Accounts + Current Year Earnings (calculated from P&L)**
- Current Year Earnings is NOT a stored balance - it's derived from temporary accounts
- After fiscal year close, net income transfers to Retained Earnings via closing entry
- The Retained Earnings balance then reflects cumulative historical earnings
