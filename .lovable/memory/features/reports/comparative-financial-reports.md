# Memory: features/reports/comparative-financial-reports
Updated: 2026-01-19

## System Architecture

The comparative financial reports system enables multi-period financial statement comparisons following GAAP/IFRS/ASPE principles.

### Core Hooks
- `useFinancialReports.ts`: Primary hook for current period financial data
- `useComparativeFinancialReports.ts`: Fetches parallel period data for comparisons

### Key Calculations (GAAP/IFRS/ASPE Compliant)

**Account Type Classification:**
- **Permanent Accounts** (Asset, Liability, Equity): Cumulative balances from inception
- **Temporary Accounts** (Income, Expense): Period-specific, reset each fiscal year

**Balance Sheet Equation:**
```
Assets = Liabilities + Equity + Current Year Earnings (Net Income)
```

**Normal Balance Signs:**
- Assets: Debit-normal (positive = debit > credit)
- Liabilities: Credit-normal (positive = credit > debit), contra = debit-normal
- Equity: Credit-normal, contra (drawings) = debit-normal
- Income: Credit-normal
- Expense: Debit-normal

### Net Income Distinction (Critical Fix 2026-01-19)

1. **`netIncome`** (Period-specific): For Income Statement & Cash Flow
   - Calculation: `entryDate >= startDateStr && entryDate <= endDateStr`
   
2. **`ytdNetIncome`** (Fiscal Year): For Balance Sheet equation
   - Calculation: `entryDate >= startDateStr && entryDate <= endDateStr`
   - Uses startDate as fiscal year start for temporary accounts
   - Previously was `entryDate <= endDateStr` which included ALL historical years (bug)

### Data Fetching Pattern

Both hooks use:
```sql
.lte('entry_date', endDateStr)  -- ALL entries up to end date
```

This ensures permanent accounts get cumulative balances while temporary accounts are filtered by date range in code.

### Contra Account Handling

Section totals apply proper signs:
- Assets: Debit-normal ADD, Credit-normal (Accum Depreciation) SUBTRACT
- Liabilities: Credit-normal ADD, Debit-normal (GST Paid/Input Tax Credit) SUBTRACT  
- Equity: Credit-normal ADD, Debit-normal (Drawings) SUBTRACT

### Financial Statement Relationships (GAAP/IFRS/ASPE)

| From | To | Relationship |
|------|-----|-------------|
| Income Statement | Balance Sheet | Net Income → Current Year Earnings in Equity |
| Income Statement | Cash Flow | Net Income → Starting point for Operating Activities |
| Income Statement | Changes in Equity | Net Income → Additions/Deductions |
| Balance Sheet | Cash Flow | Beginning/Ending Cash must reconcile |
| Changes in Equity | Balance Sheet | Closing Equity = Total Equity |

### Cash Flow Statement Logic

The Cash Flow Statement uses `calculateCashFlowForPeriod()` helper:

**Operating Activities Formula:**
```
Net Operating = Net Income - AR Change + AP Change + Tax Liab Change
```

**Investing Activities:** Fixed asset changes (15xx-17xx) - increase = outflow
**Financing Activities:** Long-term debt changes (22xx-24xx) - increase = inflow

### Data Integrity Requirements

For accurate financial statements per GAAP/IFRS/ASPE:
1. All opening balances must be recorded for permanent accounts
2. Loan originations must be recorded before payments
3. Each journal entry must balance (debits = credits)
4. Contra accounts must have correct normal_balance setting
5. GST/HST Paid (Input Tax Credit) is correctly a debit-normal liability

### Current Database State
Years with posted journal entries: 2001, 2024, 2025, 2026
- 2024 has 7 journal entries (credit card transactions)
- 2025 has 581 journal entries (main activity year)
- Note: Bank Loan payments recorded without opening balance causes negative liability balances

## Balance Sheet Hierarchical Subtotals (2026-01-19)

The `buildHierarchicalRows` function now properly handles multi-level nested header accounts (e.g., Current Assets > Inventory > Finished Goods). Key improvements:

1. **Recursive subtotal calculation**: The `calculateSubtotal()` function recursively sums all descendant detail accounts for a given header.
2. **Nested header support**: Child headers are processed before detail accounts, maintaining proper indentation and structure.
3. **Proper "Total for" rows**: Each header with children now correctly displays a subtotal row showing the sum of its descendants.

This ensures that categories like "Inventory", "Intangible Assets", "Property, Plant & Equipment" all show their proper subtotals on the Balance Sheet.

## Closing Entry Exclusion for Income Statement (2026-01-19)

Both `useFinancialReports.ts` and `useComparativeFinancialReports.ts` now exclude fiscal year closing entries when calculating `calculated_balance` for temporary accounts (income/expense). This ensures:

1. **Income Statement accuracy**: Shows actual revenue/expense activity during the period, not the zeroed-out post-close balance
2. **Closed year comparatives work correctly**: When comparing 2025 vs 2024 (closed), the 2024 column shows the pre-close activity amounts
3. **Balance Sheet unaffected**: YTD balance still includes closing entries to maintain proper accounting equation

**Detection pattern**: Entries with description containing "closing entry" (case-insensitive) are identified and skipped for Income Statement calculations only.
