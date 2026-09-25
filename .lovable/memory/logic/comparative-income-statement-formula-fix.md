# Memory: logic/comparative-income-statement-formula-fix
Updated: 2026-01-19

## GAAP/IFRS/ASPE Compliance: Comparative Account Display

The Income Statement now properly merges account lists from ALL comparison periods to ensure:

1. **Line items sum to section totals** - Previously, accounts with activity only in historical periods (e.g., 2024) but not in the current period (e.g., 2025) were hidden from the line item display but included in the comparative totals. This created a mathematical discrepancy where visible line items didn't add up to the displayed totals.

2. **Complete comparative view** - All accounts with activity in ANY displayed period now show as line items, with proper zero balances shown for periods without activity.

3. **Audit trail integrity** - Financial statements must show all relevant accounts across comparison periods for proper audit review per ASPE Section 1400 (Comparative Information).

## Implementation Details

The `mergedAccountLists` memoized object in `IncomeStatement.tsx`:
- Collects accounts from the current period AND all comparison periods
- Uses account ID as unique key to prevent duplicates
- Sets `calculated_balance = 0` for accounts that exist in comparison periods but not current
- Sorts by account code for consistent display

## Example Fix

Before: 2024 COGS showed only Freight & Shipping ($4,479.02) as a line item, but Total was $20,541.02 (included hidden Direct Labour, Purchases, Inventory Adjustments from JE-0010).

After: All COGS accounts with 2024 activity now display as line items, and their sum equals the Total.
