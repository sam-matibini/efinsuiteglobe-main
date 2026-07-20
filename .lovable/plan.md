## Problem

The **Statement of Changes in Equity** shows `Balance at January 1, 2024` Retained Earnings = "-" (0), but the Balance Sheet's Statement of Retained Earnings correctly shows the same opening as **$(8,428.00)**.

## Root cause (verified via DB)

Both reports pull opening RE for the earliest fiscal year (2024) from `public.calculate_opening_retained_earnings`, which — by design — returns `0` for the first data year. In this organization there is a direct journal entry posted to the Retained Earnings account inside FY2024 that represents the accumulated deficit brought forward (-$8,428.00).

The two RPCs treat that direct RE posting **differently**:

- `calculate_retained_earnings_statement` (used by the Balance Sheet) folds the direct RE adjustment into `opening_balance`, so it correctly shows opening = $(8,428.00).
- `get_retained_earnings_rollforward_series` (used by the Statement of Changes in Equity) folds the direct RE adjustment only into `closing_re`, leaving `opening_re` at 0.

Result: SOCE reports opening 2024 = 0, closing 2024 = $(14,633.96), so the $8,428.00 "disappears" from the opening line even though the closing balance ties. This is a data-source inconsistency, not a UI bug — and it affects every organization/country whose earliest fiscal year contains a direct RE opening adjustment (all localizations share this RPC).

## Fix (single migration, global to all orgs / countries)

Update `public.get_retained_earnings_rollforward_series` so the direct RE adjustment (non‑`CLOSE-*` postings hitting the RE account within the period) is added to `opening_re` instead of `closing_re`. This matches `calculate_retained_earnings_statement` and preserves the roll-forward identity:

```
closing_re = opening_re + net_income − dividends
```

Closing values remain unchanged; only the opening line moves from `0` to `(8,428.00)` for FY2024 on this org, and analogously for any org whose earliest year contains a brought-forward RE adjustment.

### SQL sketch (technical)

```sql
CREATE OR REPLACE FUNCTION public.get_retained_earnings_rollforward_series(...)
...
-- inside the FOR v_loop_year loop:
v_opening_re := COALESCE(calculate_opening_retained_earnings(p_organization_id, v_loop_year), 0)
              + COALESCE(v_direct_adj, 0);           -- NEW: fold brought-forward RE adj into opening
v_closing_re := v_opening_re + v_ni - COALESCE(v_div, 0);   -- direct_adj no longer added again
```

All other logic (fiscal-year-end month handling, dividend detection, SECURITY DEFINER, grants) is preserved.

## Verification steps after migration

1. Re-run `SELECT * FROM get_retained_earnings_rollforward_series('909a7954-…', 2024, 2025)` — expect `opening_re = -8428.00, closing_re = -14633.96` for 2024 and `opening_re = -14633.96, closing_re = 143206.98` for 2025.
2. Confirm the SOCE page shows `Balance at January 1, 2024` RE = `(8,428.00)` and the "Difference" badge stays green.
3. Confirm the Balance Sheet Statement of RE section still shows the same numbers (no regression) since it uses a separate function.
4. Confirm NPO orgs (Unrestricted Net Assets), and non‑CAD locales (US, ZM, KE, BI) render identically — the RPC is org-agnostic.

## Scope

- One SQL migration touching only `get_retained_earnings_rollforward_series`.
- No frontend changes required — `useZohoEquityData` already binds `opening_re` to the opening rows.
- No changes to Balance Sheet, Income Statement, TB, or GL.
