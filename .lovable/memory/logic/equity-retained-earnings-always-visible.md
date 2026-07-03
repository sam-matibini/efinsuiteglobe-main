# Memory: logic/equity-retained-earnings-always-visible
Updated: 2026-01-23

## ASPE/IFRS Presentation Requirement: Retained Earnings Always Visible

The Balance Sheet now enforces the ASPE/IFRS requirement that **Retained Earnings MUST always appear** in the Shareholders' Equity section, regardless of its balance.

### Rationale (GAAP/ASPE/IFRS Compliance)

Per professional accounting standards:
- **ASPE Section 3251** - Equity must show accumulated comprehensive income (Retained Earnings)
- **IAS 1** - Statement of Financial Position must present contributed capital and retained earnings separately
- **GAAP** - Double-entry requires full equity disclosure

### Implementation

1. **Helper Function Added**: `isRetainedEarningsAccount(account)` identifies Retained Earnings accounts by:
   - Code: `3-00-201`
   - Name patterns: "retained earnings", "retained profits", "accumulated deficit", "accumulated earnings"

2. **Filter Logic Updated**: The `buildHierarchicalRows` function for equity now bypasses the zero-balance filter for Retained Earnings:
   ```typescript
   const isRetainedEarnings = isRetainedEarningsAccount(child);
   const shouldShow = showZeroBalances || displayAmount !== 0 || isRetainedEarnings;
   ```

3. **Orphan Accounts**: Same logic applied to orphan equity accounts without parents.

### Shareholders' Equity Section Display Order

1. **Share Capital (Common Stock)** - Always visible
2. **Additional Paid-In Capital** - Shown if non-zero or showZeroBalances
3. **Retained Earnings** - ALWAYS visible (per ASPE/IFRS)
4. **Current Year Earnings** - Dynamic P&L calculation (only if non-zero)
5. **Owner's Drawings** - Contra-equity, shown if applicable
6. **Total for Shareholders' Equity** - Sum of all above

### Files Modified

- `src/pages/BalanceSheet.tsx` - Added `isRetainedEarningsAccount` helper and updated filter logic

### Mathematical Formula

```
Total Shareholders' Equity = 
  Share Capital 
  + Additional Paid-In Capital 
  + Retained Earnings (always shown)
  + Current Year Earnings (dynamic Net Income)
  - Owner's Drawings
  + Other Equity Reserves
```

### Retained Earnings Rollforward

```
Retained Earnings (Ending) = 
  Retained Earnings (Opening)
  + Net Income (from Income Statement)
  - Dividends Declared
  ± Prior Period Adjustments
```

This rollforward is maintained via journal entries, particularly the fiscal year closing entries (`CLOSE-YYYY`).
