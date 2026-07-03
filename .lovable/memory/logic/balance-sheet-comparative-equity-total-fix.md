# Memory: logic/balance-sheet-comparative-equity-total-fix
Updated: 2026-01-21

## Problem: Equity Section Totals Incorrect in Comparative Columns

The Balance Sheet's "Total for Equities" and nested equity subtotals (e.g., "Total for Shareholders' Equity") were displaying incorrect values for comparative periods. The values did not match the expected Zoho Books formula.

## Root Cause

The previous implementation in `buildHierarchicalRows` was adding `ytdNetIncome` (Current Year Earnings) to **EVERY** equity section subtotal row. This caused:

1. **Double/triple counting** when there were nested equity headers
2. **Incorrect intermediate totals** - e.g., "Total for Shareholders' Equity" was including CYE when it shouldn't
3. **Cross-organization instability** - different CoA hierarchies produced different incorrect results

## Correct Formula (Matching Zoho Books)

Per Zoho Books and GAAP/ASPE:

```
Equity Section:
  Common Shares             100.00        100.00
  Retained Earnings     -113,442.26    -50,846.46
  Current Year Earnings   -2,145.20    -62,595.80
  ──────────────────────────────────────────────
  Total for Equities    -115,487.46   -113,342.26
```

**Key principle**: Current Year Earnings is shown as a separate line item under Equities, and ONLY the final "Total for Equities" row includes it. Intermediate subtotals (if any nested headers exist) should NOT include CYE.

## Fix Applied (v3 - 2026-01-21)

### 1. Removed blanket ytdNetIncome addition from `buildHierarchicalRows`

Previously (WRONG):
```typescript
// Added ytdNetIncome to EVERY equity section total
if (accountType === 'equity') {
  subtotalValue += compTotal?.ytdNetIncome ?? 0;
}
```

Now (CORRECT):
```typescript
// Section totals are pure account sums - no ytdNetIncome here
const subtotalValue = calculateCompSubtotal(header.id, compBalances);
```

### 2. Added ytdNetIncome ONLY to the final equity total in `equityRows` useMemo

```typescript
// Find the LAST section total row (the top-level "Total for Equities")
let lastTotalIdx = -1;
for (let i = result.length - 1; i >= 0; i--) {
  if (result[i].isSectionTotal) {
    lastTotalIdx = i;
    break;
  }
}

// After inserting "Current Year Earnings" line, update ONLY the final total
if (totalRow?.isSectionTotal) {
  totalRow.amount = (totalRow.amount ?? 0) + netIncome;
  totalRow.comparativeAmounts = (totalRow.comparativeAmounts ?? []).map((amt, i) => 
    (amt ?? 0) + (compNetIncomes[i] ?? 0)
  );
}
```

## GAAP/ASPE Compliance

The Balance Sheet equation MUST balance:
```
Assets = Liabilities + Equity Accounts + Current Year Earnings
```

With this fix:
- **Equity account subtotals** = Sum of child equity accounts only
- **Current Year Earnings** = Displayed as a separate line item
- **Total for Equities** = Sum of all equity accounts + Current Year Earnings
- **Total for Liabilities & Equities** = Liabilities + Total for Equities

## Cross-Organization Reliability

This fix works regardless of Chart of Accounts hierarchy:
- Organizations with a single "Equities" header work correctly
- Organizations with nested headers (e.g., "Shareholders' Equity" > "Capital Stock") work correctly
- The ytdNetIncome is added ONLY to the final/top-level equity total
