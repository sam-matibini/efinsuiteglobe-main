## Problem

The Balance Sheet's Equity section shows both:
- **Retained Earnings** `(255,939.67)` — from Statement of RE closing balance (already net of dividends)
- **Dividends Paid** `(54,000.00)` — a separate equity line item

The Statement of Retained Earnings below the balance sheet clearly shows dividends of $54,000 are already deducted inside the RE closing balance (Opening 214,478.55 + Net income 12,538.88 − Dividends 54,000 = Closing 255,939.67).

So dividends are being counted twice, which is why the balance sheet is out of balance by exactly $54,000.

## Fix (frontend only, `src/pages/BalanceSheet.tsx`)

1. **Add helper** `isDividendAccount(account)` — matches by name (`dividends`, `dividends paid`, `dividends declared`, `owner's drawings`, `owner drawings`, `distributions to owners`) and code patterns commonly used for dividend/drawing accounts.

2. **Exclude dividend accounts from the equity total** in `equityAccountsExcludingREandCYE` (around lines 436–454): add a filter `!isDividendAccount(a)` alongside the existing CYE/RE exclusions. Dividend movement is already baked into `reClosingBalance`.

3. **Hide dividend accounts from the equity display tree** in `buildHierarchicalRows('equity')` (around lines 600–611): filter out dividend accounts the same way CYE is filtered. Comparative-period subtotals reuse the same account list, so comparatives will match automatically.

4. **Do NOT touch the Statement of Retained Earnings** (`useRetainedEarningsStatement` / RPC) — the RPC is already correct; it is the source of truth for the dividends line.

## Why this is the right fix

- ASPE/GAAP: dividends declared reduce Retained Earnings — they are not a separate equity component on the Balance Sheet. They belong in the Statement of Retained Earnings (which we already render) and inside the RE closing balance.
- Same pattern already used in this file for `Current Year Earnings` (3-00-202) and `Retained Earnings` (3-00-201), which are excluded from the raw equity aggregate for the same double-counting reason.

## Expected result

- Equity section shows Share Capital + Retained Earnings only (no Dividends Paid line).
- Total Equity decreases by $54,000 in the display, matching the RE closing balance already used.
- "Balance Sheet is out of balance" banner disappears; `Total Assets = Total Liabilities + Equity` holds.
- Statement of Retained Earnings block below the Balance Sheet is unchanged and continues to show the dividends line as a rollforward component.
