## Problem

On `/reports/changes-in-equity` the badge shows `Difference: ($23,976.29)` (Y2026 net loss). The mismatch is a source-of-truth divergence, not a real accounting imbalance:

- **Balance Sheet** derives Retained Earnings from `useRetainedEarningsStatement` → RPC `calculate_retained_earnings_statement` (per memory `balance-sheet-re-statement-integration.md`). Its closing RE already includes current-year net income.
- **Statement of Changes in Equity** derives closing RE from `useZohoEquityData` → RPC `get_retained_earnings_rollforward_series`. In this org that series is not including the current (unclosed) year's net income in `closing_re`, so SOCE closing equity = Share Capital + Opening RE only (matches the $2,631.71 shown on the card, and misses the $23,976.29 loss).

The tie-out compares these two different sources and will always alert whenever the current fiscal year is still open.

## Fix

Make the SOCE agree with the Balance Sheet by re-using `useRetainedEarningsStatement` as the authoritative closing-RE for the current period, exactly like the Balance Sheet does.

### Changes (frontend only, presentation logic)

1. **`src/pages/ChangesInEquity.tsx`**
   - Call `useRetainedEarningsStatement({ startDate, endDate }, [])` alongside the existing hooks.
   - Compute `authoritativeClosingRE = reCurrentStatement.data.closingBalance` for the current year.
   - Use `authoritativeClosingEquity = totals.shareCapital + authoritativeClosingRE` for:
     - the "Retained Earnings" summary card,
     - the "Total Equity" summary card,
     - the `tiesToBalanceSheet` comparison and the "Difference" badge.
   - Keep the existing rollforward-based `rows` unchanged for the table body, but override the final-year closing row's RE and Total columns with the authoritative values so the table foot ties to the badge and to the Balance Sheet.

2. **`src/hooks/useZohoEquityData.ts`** — no signature changes. Only add an optional override consumed by the page (or handle the override entirely in the page without touching the hook). Prefer no hook changes.

### Verification

- Load `/reports/changes-in-equity` for a period where the current fiscal year is still open and confirm:
  - Total Equity card = Balance Sheet's Total Equity.
  - Badge switches to green "Ties to Balance Sheet".
  - Closing row in the table equals the card.
- Load a prior closed year and confirm no regression (closing RE from the RE statement equals rollforward closing).

### Out of scope

- No DB / RPC changes. The underlying rollforward RPC discrepancy for open fiscal years can be addressed separately if desired.
- No changes to Balance Sheet, Income Statement, or Cash Flow.
