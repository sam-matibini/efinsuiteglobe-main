# Memory: logic/balance-sheet-pure-formula-aspe-v1
Updated: 2026-01-22

## ASPE-Compliant Pure Formula Approach

The Balance Sheet now uses a **PURE FORMULA** approach with NO static value additions. All amounts derive from journal entries via the double-entry system.

### Key Principles

1. **No Static Value Additions**: The previous approach manually added the `3-00-202` (Current Year Earnings) static balance to calculations. This is REMOVED.

2. **Database Reflects Journal Entries**: All equity account balances (including `3-00-202` and `3-00-201`) reflect what was posted via journal entries. We do NOT manipulate these values.

3. **Dynamic Current Year Earnings Line**: The "Current Year Earnings" line in the equity section displays dynamically calculated Net Income (Revenue - Expenses) for the selected period. This is SEPARATE from the database balance.

### Accounting Equation

```
Assets = Liabilities + Total Equity (from DB) + Net Income (Dynamic P&L)
```

### Files Modified

- `src/hooks/useFinancialReports.ts` - Removed static CYE balance additions
- `src/hooks/useComparativeFinancialReports.ts` - Removed static CYE balance additions
- `src/pages/BalanceSheet.tsx` - Shows all equity accounts as-is from database

### Year-to-Year Continuity

Retained Earnings continuity is maintained via journal entries:
- **Opening RE (Year N)** = Closing RE (Year N-1) via opening entries
- **Closing RE (Year N)** = Opening RE (Year N) + Net Income (Year N) via closing entries

This matches Zoho Books behavior where:
- All equity accounts display their journal-entry balances
- "Current Year Earnings" shows dynamic Net Income from P&L
- Year-to-year continuity is maintained via proper closing entries (CLOSE-*)

### Balance Check

The accounting equation uses YTD Net Income for validation:
```typescript
Assets = Liabilities + Equity (all accounts from DB) + YTD Net Income (P&L)
```
