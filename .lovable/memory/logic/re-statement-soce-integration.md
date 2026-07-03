# Memory: logic/re-statement-soce-integration
Updated: 2026-01-28

## Statement of Retained Earnings and Statement of Changes in Equity Integration

The **Balance Sheet** and **Statement of Changes in Equity** now use the same rollforward logic for Retained Earnings, ensuring consistency and balance.

### Key Integration Point

Both reports derive Retained Earnings from the same calculation logic:
- `calculate_retained_earnings_statement` RPC (used by Balance Sheet)
- `get_retained_earnings_rollforward_series` RPC (used by SOCE)

Both now use identical year-over-year rollforward:
```
Opening RE (Year N) = Closing RE (Year N-1)
Closing RE = Opening RE + Net Income - Dividends
```

### Balance Sheet isBalanced Calculation

The Balance Sheet now calculates `isBalanced` using the corrected formula:
```typescript
// Total Equity uses RE closing balance from Statement of RE (already includes Net Income)
const totalEquity = equityAccountsExcludingREandCYE + reClosingBalance;
const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

// isBalanced: Assets = Liabilities + Equity (no separate Net Income needed)
const balanceDifference = Math.abs(totalAssets - totalLiabilitiesAndEquity);
const isBalanced = balanceDifference < 0.01;
```

This fixes the false "Out of Balance" warning that previously appeared when the difference was 0.00.

### Data Flow

```
Journal Entries (posted)
    ↓
calculate_period_net_income() → Net Income per period
    ↓
Year-over-year accumulation loop:
  For each year from first_data_year to current_year:
    Opening RE = Prior year's Closing RE (0 for first year)
    Closing RE = Opening RE + Net Income - Dividends
    ↓
Both RPCs return identical values
    ↓
Balance Sheet: useRetainedEarningsStatement → closingBalance
SOCE: useZohoEquityData → closing_re from rollforward series
```

### Component Integration

| Component | Hook | RPC | Data Used |
|-----------|------|-----|-----------|
| Balance Sheet | `useRetainedEarningsStatement` | `calculate_retained_earnings_statement` | `closingBalance` |
| Statement of Changes in Equity | `useZohoEquityData` | `get_retained_earnings_rollforward_series` | `opening_re`, `net_income`, `dividends`, `closing_re` |

### Tie-Out Validation

Both reports now show "Balanced" when `|Assets - (Liabilities + Equity)| < 0.01`, where Equity includes the RE closing balance from the Statement of RE.
