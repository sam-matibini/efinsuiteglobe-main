# Memory: logic/balance-sheet-re-statement-integration
Updated: 2026-01-23

## Change: Statement of RE Integration into Balance Sheet

The Balance Sheet now uses the **Statement of Retained Earnings** as the single source of truth for the Retained Earnings balance in Shareholders' Equity.

### Key Formula (GIFI/ASPE/IFRS Compliant)

```
Total Shareholders' Equity = Other Equity Accounts (e.g., Share Capital) + RE Closing Balance
Total Liabilities & Equity = Total Liabilities + Total Shareholders' Equity
```

Where:
- **RE Closing Balance** = Opening RE + Net Income - Dividends (from Statement of RE)
- **Other Equity Accounts** = All equity accounts EXCEPT `3-00-201` (RE) and `3-00-202` (CYE)

### Implementation

1. **Retained Earnings Row**: The `3-00-201` (Retained Earnings) account balance is replaced with `reCurrentStatement.data.closingBalance` from the Statement of RE hook.

2. **Total for Equities**: Calculated as the sum of equity accounts (excluding RE and CYE) plus the RE closing balance from the Statement of RE.

3. **Total for Liabilities & Equities**: Total Liabilities + Total Shareholders' Equity.

4. **No Double-Counting**: The RE closing balance already includes Net Income, so `netIncome` is NOT added separately to equity totals.

5. **CYE Account (3-00-202)**: Excluded from display entirely since Net Income is shown in the Statement of RE section.

### Visual Result

```
Shareholder Equity
  Common shares                       $100
  Retained earnings (deficit)       $26,508   ← Closing RE from Statement
Total shareholder equity            $26,608
Total liabilities and shareholder equity  $63,829

Retained Earnings (Deficit)
  Opening balance                    $2,516
  Net income (loss)                 $23,992
Closing balance                     $26,508   ← Links to RE line above
```

### Data Flow

```
useRetainedEarningsStatement hook
  → reCurrentStatement.data.closingBalance
  → Replaces Retained Earnings row amount
  → totalEquity = equityAccountsExcludingREandCYE + reClosingBalance
  → totalLiabilitiesAndEquity = totalLiabilities + totalEquity
```
