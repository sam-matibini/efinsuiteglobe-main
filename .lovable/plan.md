## Problem

Retained Earnings continuity is broken between fiscal years for Sunview Construction:

- 2024 RE Statement: Opening 135,156.61 + Net Income 21,200.17 − Dividends 140,000.00 = **Closing 16,356.78**
- 2025 RE Statement: **Opening 142,191.79** (should be 16,356.78)

The 2025 opening ignores prior-year dividends (140,000), so RE is overstated. This overstatement of equity is what drives the Balance Sheet "out of balance by 140,000.00" warning.

## Root Cause

`public.calculate_opening_retained_earnings(org, fiscal_year)` rolls forward prior *unclosed* years by summing only income + expense activity (`unclosed_prior_pnl`). It never subtracts dividends/owner-drawings posted to equity accounts in those prior unclosed years. So for orgs that haven't run a fiscal-year close, dividends stay in the current-period equity view but are dropped when computing next year's opening RE.

`calculate_retained_earnings_statement` correctly subtracts period dividends for the closing formula, which is why the intra-year statement is right but year-over-year continuity breaks.

## Fix

Update `public.calculate_opening_retained_earnings` so the prior-year rollforward mirrors the RE statement formula:

```
opening = seed_opening_balance
        + direct RE postings before FY start (excluding CLOSE-*)
        + Σ prior unclosed years' Net Income
        − Σ prior unclosed years' Dividends/Drawings
```

Add a `unclosed_prior_dividends` CTE that aggregates, per fiscal year, activity on equity accounts where `equity_type = 'dividends'` OR name matches `%dividend%`/`%drawing%` (same match rule already used in `calculate_retained_earnings_statement`), filtered to `status IN ('posted','reversed')`, `entry_date < v_current_fy_start`, `reference NOT LIKE 'CLOSE-%'`, and `fiscal_year NOT IN closed_years AND fiscal_year < p_fiscal_year`. Subtract that sum from the returned value.

No changes to closed-year handling (CLOSE-* entries already move dividends into RE via the closing journal, so those years must not be double-counted — the existing `closed_years` exclusion already covers this).

## Expected Result After Fix

- 2025 Opening RE = 16,356.78 (matches 2024 Closing)
- Balance Sheet equity totals reconcile; the 140,000 out-of-balance warning clears.
- Other RPCs relying on this function (Balance Sheet RE line, comparative reports, rollforward audit) automatically benefit — no frontend changes needed.

## Technical Details

- File: single migration replacing `public.calculate_opening_retained_earnings` (SECURITY DEFINER, `search_path=public` preserved).
- Continues to honor reversal-netting rule (`status IN ('posted','reversed')`).
- No schema changes, no data mutations — pure function replacement.
- Verified against `.lovable/memory/logic/financial-reporting-rollforward-logic-v4.md` continuity rule: `Opening RE(N) = Opening RE(N-1) + Net Income(N-1) − Dividends(N-1)`.
