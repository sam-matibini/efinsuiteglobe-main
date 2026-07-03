# Memory: logic/financial-reporting-period-specific-logic-v3
Updated: 2026-01-20

The financial reporting system (src/hooks/useFinancialReports.ts, src/hooks/useComparativeFinancialReports.ts) enforces GAAP/ASPE compliance by: 

1. **Retained Earnings CLOSE-* Entry Handling (Critical Fix)**:
   - Prior year closing entries ARE included in RE for subsequent years
   - Same year closing entries ARE EXCLUDED to prevent double-counting with Current Year Earnings
   - Example: `CLOSE-2024` entry on 2024-12-31:
     - **2024 Balance Sheet**: EXCLUDED (CYE shows 2024 P&L separately)
     - **2025 Balance Sheet**: INCLUDED (it's part of 2025 opening RE)
   - This ensures RE rollforward: Opening RE(2025) = Opening RE(2024) + Net Income(2024)

2. **Temporary Account Handling**:
   - Excludes ALL CLOSE-* entries when calculating Income Statement balances
   - Calculates 'Current Year Earnings' using period-specific date range

3. **Balance Sheet Equation**:
   - Assets = Liabilities + Equity + Current Year Earnings
   - Retained Earnings reflects cumulative prior closed years
   - Current Year Earnings reflects only selected period's P&L

**DAPRO Verified Values:**
- 2024: RE ($283,813) + CYE ($20,743) + Stock $100 = Total Equity ($304,456)
- 2025: RE ($304,556) + CYE $51,282.15 + Stock $100 = Total Equity ($253,173.85)
