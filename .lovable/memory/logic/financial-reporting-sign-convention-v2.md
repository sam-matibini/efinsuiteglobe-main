# Memory: logic/financial-reporting-sign-convention-v2
Updated: 2026-01-25

## CONTRA-ACCOUNT HANDLING (GAAP/ASPE/IFRS/CRA Compliant)

### Problem Solved
Contra-revenue accounts (Sales Discounts, Sales Returns & Allowances) and Contra-expense accounts (Purchase Discounts) were being added to totals instead of subtracted, causing Net Income discrepancies between:
- Income Statement: $17,788.26 (correct)
- Statement of Retained Earnings: $45,835.74 (incorrect before fix)

### Sign Convention Rules

**Income Accounts (account_type = 'income'):**
- **Credit-normal** (Sales Revenue, Service Revenue): ADD to total revenue
- **Debit-normal** (Sales Discounts, Sales Returns, Allowances): SUBTRACT from total revenue

**Expense Accounts (account_type = 'expense'):**
- **Debit-normal** (most expenses): ADD to total expenses
- **Credit-normal** (Purchase Discounts, Rebates Received): SUBTRACT from total expenses

### Implementation Locations

1. **Database Function: `calculate_period_net_income()`**
   - Updated to use proper sign convention for contra-accounts
   - Formula: Net Income = (Revenue - Contra-Revenue) - (Expenses - Contra-Expenses)

2. **Frontend Hooks:**
   - `src/hooks/useFinancialReports.ts` - Income Statement calculations
   - `src/hooks/useComparativeFinancialReports.ts` - Comparative reports

### Code Pattern
```typescript
// Income totals: credit-normal adds, debit-normal subtracts
const totalRevenueCents = income.reduce((sum, a) => {
  const sign = a.normal_balance === 'credit' ? 1 : -1;
  return sum + toCents(a.calculated_balance) * sign;
}, 0);

// Expense totals: debit-normal adds, credit-normal subtracts
const totalExpensesCents = expenses.reduce((sum, a) => {
  const sign = a.normal_balance === 'debit' ? 1 : -1;
  return sum + toCents(a.calculated_balance) * sign;
}, 0);
```

### SQL Pattern
```sql
CASE 
  WHEN a.account_type = 'income' THEN 
    CASE WHEN a.normal_balance = 'credit' 
         THEN jel.credit - jel.debit  -- Normal income
         ELSE -(jel.debit - jel.credit) -- Contra-revenue
    END
  WHEN a.account_type = 'expense' THEN 
    CASE WHEN a.normal_balance = 'debit' 
         THEN -(jel.debit - jel.credit)  -- Normal expense
         ELSE jel.credit - jel.debit     -- Contra-expense
    END
END
```

### Dynamic Link Integrity
The Statement of Retained Earnings and Cash Flow Statement now dynamically link to the Income Statement via:
1. `calculate_retained_earnings_statement()` RPC calls `calculate_period_net_income()`
2. `useComparativeFinancialReports.ts` → `calculateTotals()` uses proper sign convention
3. `CashFlow.tsx` → `calculateCashFlowForPeriod()` receives correct `netIncome` from comparative hook
4. Both frontend and database use the same contra-account logic
5. Net Income flows correctly: Income Statement → RE Statement → Balance Sheet (Total Equity)
6. Net Income flows correctly: Income Statement → Cash Flow (Operating Activities)

### Verification Query
```sql
-- Should return identical net_income values
SELECT calculate_period_net_income(org_id, start, end) as income_stmt_ni;
SELECT net_income_loss FROM calculate_retained_earnings_statement(org_id, start, end);
```

### Cash Flow Statement Integration
The Cash Flow comparative calculations in `CashFlow.tsx` use `periodData.netIncome` which now correctly:
- Accounts for contra-revenue (Sales Discounts subtracted from revenue)
- Accounts for contra-expense (Purchase Discounts subtracted from expenses)
- Matches the Income Statement Net Income exactly
