# Memory: features/reports/financial-statements-formula-audit
Updated: 2026-01-20

## Financial Statement Formula Verification (GAAP/ASPE Compliant)

All four primary financial statements have been audited for formula accuracy and GAAP/ASPE compliance.
Verified against Zoho Books reference implementation for mathematical consistency.

### Balance Sheet (`BalanceSheet.tsx`)
- **Equation**: Assets = Liabilities + Equity + Current Year Earnings (Net Income)
- **Net Income Source**: `ytd_balance` from temporary accounts (income/expense) - period-specific for Current Year Earnings
- **Precision**: Integer cents arithmetic (`toCents`/`fromCents`) prevents floating-point drift
- **Contra Accounts**: Properly handled - credit-normal assets (Accum Depreciation) and debit-normal equity (Drawings) subtract from totals
- **Comparative Data**: Pre-calculated amounts stored in `row.comparativeAmounts[]` for all sections
- **Fiscal Year Closing Exclusion**: CLOSE-* entries excluded from temporary account calculations to show actual period P&L

### Shareholders' Equity Section Logic (Zoho Books Verified)
**Formula for Retained Earnings rollforward:**
- **Opening RE (Year N)** = Opening RE (Year N-1) + Net Income (Year N-1)
- **Current Year Earnings** = Period-specific Net Income (from Income Statement)

**DAPRO Trading Verified Values:**
| Year | Common Stock | Retained Earnings (Opening) | Current Year Earnings | Total Equity |
|------|-------------|----------------------------|----------------------|--------------|
| 2024 | $100 | ($283,813) | ($20,743) | ($304,456) |
| 2025 | $100 | ($304,556) | $51,282.15 | ($253,173.85) |

**Rollforward Verification:**
- 2025 Opening RE = 2024 Opening RE + 2024 Net Income
- ($304,556) = ($283,813) + ($20,743) ✓

### Income Statement (`IncomeStatement.tsx`)  
- **Formulas**:
  - Gross Profit = Total Revenue - COGS
  - Operating Profit = Gross Profit - Operating Expenses
  - Net Income = Operating Profit + Other Income - Other Expenses
- **Account Classification**: By code prefix (4xxx=Revenue, 5xxx=COGS, 6xxx=OpEx, 7xxx=Other Income, 8xxx-9xxx=Other Expenses)
- **Merged Account Lists**: Accounts from ALL comparison periods are merged to ensure line items sum to section totals
- **Fiscal Year Closing Exclusion**: CLOSE-* entries excluded to show actual period activity

### Cash Flow Statement (`CashFlow.tsx`)
- **Method**: Indirect method per GAAP
- **Formulas**:
  - Net Operating = Net Income + Depreciation - AR Change - Inventory Change - Prepaid Change + AP Change + Tax Liab Change
  - Net Investing = -(Fixed Asset Changes) - Investment Changes
  - Net Financing = Loan Changes + Equity Changes (contributions - distributions)
  - Ending Cash = Beginning Cash + Net Change
- **Reconciliation**: `isReconciled` flag validates Net Change matches actual GL cash movement

### Changes in Equity (`ChangesInEquity.tsx`)
- **Formulas**:
  - Period Change = Closing Balance - Opening Balance
  - Additions = Period Change (if positive)
  - Deductions = |Period Change| (if negative)
  - Closing Balance = Opening Balance + Additions - Deductions
- **Current Year Earnings**: Net Income from Income Statement added as separate line
- **Validation**: `tiesToBalanceSheet` flag confirms Closing Equity matches Balance Sheet Total Equity

### Key Data Flows (GAAP Compliance)
1. Income Statement Net Income → Balance Sheet "Current Year Earnings"
2. Income Statement Net Income → Cash Flow Statement starting point
3. Income Statement Net Income → Changes in Equity "Additions"
4. Changes in Equity Closing Balance = Balance Sheet Total Equity
5. Cash Flow Ending Cash = Balance Sheet Cash/Bank Account Totals

### Fiscal Year Closing Entry Handling (CLOSE-* Entries)
Both `useFinancialReports.ts` and `useComparativeFinancialReports.ts` exclude CLOSE-* entries:
1. **Retained Earnings Account**: Excludes CLOSE-* entries → shows Opening RE only (prior period accumulation)
2. **Temporary Accounts (Income/Expense)**: Excludes CLOSE-* entries → shows actual period P&L

This prevents double-counting where:
- Current Year Earnings would show actual period net income AND
- Retained Earnings would also include the closed net income via CLOSE-* entry

### Static Values Eliminated
- Balance Sheet export now uses `row.comparativeAmounts` for all sections instead of hardcoded zeros
- All account balances calculated dynamically from journal entry lines
- Opening balances properly filtered based on period
