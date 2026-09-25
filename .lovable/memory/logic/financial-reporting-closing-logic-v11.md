# Memory: logic/financial-reporting-closing-logic-v11
Updated: 2026-01-20

The Balance Sheet and Income Statement components (src/hooks/useFinancialReports.ts, src/hooks/useComparativeFinancialReports.ts) use period-specific calculations:

## Key Exclusion Rules for CLOSE-* Entries

1. **Retained Earnings Account**: Exclude CLOSE-* entries when calculating balance. This prevents the closing entry (which transfers Current Year Earnings to Retained Earnings) from being double-counted, since Current Year Earnings is displayed as a separate line item.

2. **Temporary Accounts (Income/Expense)**: Exclude CLOSE-* entries when calculating balances. This shows actual period activity rather than zeroed-out amounts after closing.

3. **Period-specific ytd_balance**: The `ytd_balance` field for temporary accounts is calculated using ONLY entries within the selected period (startDate to endDate), NOT cumulative from all historical years.

## Mathematical Logic for Shareholders' Equity

For 2024 Balance Sheet:
- Common Stock: $100
- Retained Earnings: ($283,813) = Opening balance from JE-0010 (excluding CLOSE-2024)
- Current Year Earnings: ($20,743) = 2024 P&L
- Total Shareholders' Equity: ($304,456) = $100 + ($283,813) + ($20,743)

For 2025 Balance Sheet:
- Common Stock: $100
- Retained Earnings: ($304,556) = 2024 Opening RE ($283,813) + 2024 Net Loss ($20,743)
- Current Year Earnings: $51,282.15 = 2025 P&L
- Total Shareholders' Equity: ($253,173.85) = $100 + ($304,556) + $51,282.15