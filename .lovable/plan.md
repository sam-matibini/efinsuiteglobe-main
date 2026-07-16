
## Problems

### 1. Balance Sheet 2024 comparative is out of balance
Expected: Total Liabilities & Equity 2024 = **$128,883.40** (Liab 112,426.62 + Equity 16,456.78).
Displayed: **($11,116.60)** because "Total for Equity" comparative shows **(123,543.22)** — the outer per-period equity total still subtracts Dividends Paid (140,000), even though the inner rows correctly show Common Shares 100 + RE Closing 16,356.78 = 16,456.78.

Cause: the inner Balance Sheet equity rows were switched to use the Statement of Retained Earnings closing balance (and to exclude dividend/drawings accounts), but `comparativeTotals[i].totalEquity` is still taken straight from `getComparativeTotals()`, which sums every equity account (including Dividends Paid) and does not use the RE Statement closing balance. Current period works because its `totalEquity` is recomputed locally; comparatives are not.

### 2. Retained Earnings does not roll forward
2024 Closing RE = **$16,356.78** but 2025 Opening RE = **$2,191.79** (should equal 16,356.78). Diff = 14,164.99, which is a debit posted directly to the Retained Earnings GL account on 2025-12-13 (reference `CC-OB-0001`, "Opening Balance – RBC Avion Visa").

Cause: `public.calculate_retained_earnings_statement` folds any direct (non-CLOSE-*) postings to the RE account **inside the reporting period** into `opening_balance` (`v_opening := v_opening + v_direct_adjustment`). This breaks the ASPE rollforward rule:

> `RE(Opening, Year N) = RE(Closing, Year N-1)`

The underlying `calculate_opening_retained_earnings` already returns the correct prior-year rollforward (verified: 16,356.78 for 2025). The statement RPC is corrupting it.

## Fix

### A. Database — `calculate_retained_earnings_statement` (migration)
- Stop folding in-period direct RE postings into `opening_balance`.
- Surface them instead as `other_additions` (net credit) or `other_deductions` (net debit) so the statement remains transparent and ASPE-compliant.
- Closing formula becomes:
  `closing = opening + net_income + other_additions - dividends - other_deductions`
- Effect: 2025 opening becomes 16,356.78 (matches 2024 closing). The 14,164.99 debit is displayed on its own line as "Other deductions / prior period adjustments".

No schema changes; function body only. This is the ASPE-correct behaviour, so it applies to all organizations, not just Sunview.

### B. Frontend — `src/pages/BalanceSheet.tsx`
Recompute each comparative period's `totalEquity` the same way the current period does, so the outer "Total for Equity" ties to the visible rows:

```
totalEquity[i] = (raw comparative equity excluding RE, CYE, and dividend/drawings accounts)
                + reComparativeStatements[i].data.closingBalance
```

Update the `comparativeTotals` `useMemo` to derive per-period `totalEquity` from the RE Statement closing balance and non-RE equity accounts (mirroring the current-period logic already in place around lines 434–460). Also refresh `totalLiabilities + totalEquity` used for the "Total for Liabilities & Equity" comparative column so it renders 128,883.40 for 2024.

No changes to the Income Statement, Cash Flow, or SOCE. No changes to underlying GL data.

## Verification
1. Reload Balance Sheet for Sunview:
   - 2024: Common Shares 100.00 + Retained Earnings 16,356.78 → Total Equity 16,456.78; Total L+E **128,883.40**; Balanced ✓
   - 2025: Common Shares 100.00 + Retained Earnings (59,269.33) → Total Equity (59,169.33); Total L+E 290,499.88; Balanced ✓
2. Statement of Retained Earnings (Deficit):
   - 2024 Closing 16,356.78 → 2025 Opening **16,356.78** (rollover restored)
   - 2025 shows a separate `Other deductions` line of 14,164.99 for the direct RE posting; Closing (59,269.33) unchanged.
3. Confirm continuity for other orgs via a spot check of `calculate_retained_earnings_statement` for two consecutive years.
