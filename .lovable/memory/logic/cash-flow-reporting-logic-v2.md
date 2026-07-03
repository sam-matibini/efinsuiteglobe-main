# Memory: logic/cash-flow-reporting-logic-v2
Updated: 2026-02-04

The Cash Flow Statement (src/hooks/useFinancialReports.ts and src/pages/CashFlow.tsx) follows the indirect method, adjusting Net Income for non-cash items and working capital changes.

## Schema Improvements (2026-02-04)

### New Column: `accounts.cash_flow_category`
- Type: VARCHAR(50), nullable
- Values: 'operating', 'investing', 'financing', or NULL (automatic detection)
- Purpose: Allows explicit override of automatic cash flow classification for edge cases

### New Trigger: `enforce_contra_account_normal_balance`
Automatically corrects `normal_balance` on INSERT/UPDATE for:
- **Contra-Assets** (credit): Accumulated depreciation, allowance for doubtful accounts
- **Contra-Revenue** (debit): Sales returns, discounts, allowances
- **Contra-Equity** (debit): Drawings, distributions, dividends, treasury stock

## Key Detection Patterns

### 1. Operating Activities (Working Capital Changes)
- **Accounts Receivable**: Code prefixes '11', '110', '111', '112' or name contains 'receivable', 'a/r'
- **Inventory**: Code prefixes '12', '120', '121' or name contains 'inventory', 'stock'
- **Prepaid Expenses**: Code prefixes '13', '130' or name contains 'prepaid', 'prepayment'
- **Accounts Payable**: Code prefixes '20', '200', '21', '210', '23' or name contains 'payable', 'a/p', 'accrued', 'wages'
- **Tax Liabilities**: Code prefixes '22', '220', '221', '23' or name contains tax-related terms

### 2. Investing Activities (CAPEX)
Detection logic supports both legacy and modern structured CoA prefixes:
- Legacy prefixes: '15', '16', '17'
- Modern structured: '1-02-xxx'
- Also identifies by keywords: 'equipment', 'property', 'vehicle', 'furniture', 'computer', 'machinery', 'building', 'land', 'fixture', 'software', 'franchise', 'license', 'patent', 'goodwill'

**CRITICAL**: Accumulated depreciation accounts are EXCLUDED from investing activities (non-cash, handled in operating activities as add-back)

### 3. Financing Activities (Debt & Equity)
Detection logic supports modern CoA structures:
- **Legacy prefixes**: '25', '250', '26', '260', '27', '270'
- **Modern structured**: 
  - '2-02-xxx' for long-term liabilities
  - '2-01-108' for shareholder loans
  - '2-01-106' for related party loans
- **Keywords**: 'loan', 'note', 'mortgage', 'debt', 'credit line', 'line of credit', 'shareholder', 'related party', 'due to'
- **Exclusion**: Credit card accounts (contain 'credit card') are excluded as they're operational, not financing

### 4. Cash Account Detection
- Legacy prefix: '10xx' (3-5 digit codes starting with '10')
- Modern structured: '1-01-101' prefix
- Keywords: 'cash', 'bank', 'chequing', 'checking', 'savings', 'petty cash', 'operating bank'

## Reconciliation Logic

The system tracks:
- `actualCashChange`: Ending Cash - Beginning Cash (from GL)
- `calculatedChange`: Operating + Investing + Financing
- `isReconciled`: |actualCashChange - calculatedChange| < 0.01

For GAAP compliance, the statement uses `actualCashChange` to ensure ending cash matches the Balance Sheet.

## Data Fixes Applied (2026-02-04)

### Accumulated Depreciation normal_balance Fix
Fixed 12 accounts across 6 organizations that had incorrect `normal_balance: debit` instead of `credit`:
- 85911 INC. (4 accounts)
- C.C. OKA LOGISTICS INC. (2 accounts)
- OSEA - Draft (1 account)
- OSEA INTEGER SERVICES INC.1 (4 accounts)
- VIP Dutts Spice Circle East Indian Restaurant Inc. (3 accounts)

This was causing incorrect Balance Sheet asset totals and incorrect Cash Flow investing activity classifications.
