# Memory: logic/changes-in-equity-comparative-totals-fix
Updated: 2026-01-28

## Problem: Comparative Year Total Equity Showing Zeros

The Statement of Changes in Equity was not displaying Total Equity values for comparative periods (e.g., 2024, 2023). Only the current year closing equity total was displayed; comparative columns showed zeros.

## Root Cause

The `totals` calculation in `ChangesInEquity.tsx` only accumulated the current period values:
- `openingBalance`
- `additions`
- `deductions`
- `closingBalance`

It did not sum the `comparativeClosingBalances` arrays from each `EquityRow`.

Additionally, the Total Equity row in the JSX table only rendered 5 columns (Component, Opening, Additions, Deductions, Closing) but did not render the comparative closing balance cells.

## Fix Applied (2026-01-28)

### 1. Updated `totals` calculation to include comparative columns

```typescript
const totals = useMemo(() => {
  const numComparatives = comparisonPeriods.length;
  
  return equityRows.reduce(
    (acc, row) => ({
      openingBalance: acc.openingBalance + row.openingBalance,
      additions: acc.additions + row.additions,
      deductions: acc.deductions + row.deductions,
      closingBalance: acc.closingBalance + row.closingBalance,
      comparativeClosingBalances: acc.comparativeClosingBalances.map((val, idx) => 
        val + (row.comparativeClosingBalances?.[idx] ?? 0)
      ),
    }),
    { 
      openingBalance: 0, 
      additions: 0, 
      deductions: 0, 
      closingBalance: 0,
      comparativeClosingBalances: Array(numComparatives).fill(0),
    }
  );
}, [equityRows, comparisonPeriods.length]);
```

### 2. Updated Total Equity row to render comparative columns

```tsx
<tr className="font-bold bg-primary/5 border-t-2 border-border">
  <td>Total Equity</td>
  <td>{formatCurrency(totals.openingBalance)}</td>
  <td>{formatCurrency(totals.additions)}</td>
  <td>{formatDeduction(totals.deductions)}</td>
  <td>{formatCurrency(totals.closingBalance)}</td>
  {compareSettings && comparisonPeriods.length > 0 && totals.comparativeClosingBalances.map((val, idx) => (
    <td key={idx}>{formatCurrency(val)}</td>
  ))}
</tr>
```

### 3. Fixed colspan for spacer and empty state rows

Updated `colSpan` from hardcoded `5` to `5 + comparisonPeriods.length` to account for dynamic comparative columns.

## Result

The Total Equity row now correctly displays the sum of all equity closing balances for each comparative period, matching the individual row values.
