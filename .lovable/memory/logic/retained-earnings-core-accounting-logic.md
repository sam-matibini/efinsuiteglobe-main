# Memory: logic/retained-earnings-core-accounting-logic
Updated: 2026-01-23

## Retained Earnings Core Accounting Logic - GAAP/ASPE/IFRS Compliant

### Database Schema Enhancements

1. **`equity_type` ENUM on accounts table**
   - `share_capital` - Common Stock, Share Capital
   - `retained_earnings` - Retained Earnings (3-00-201)
   - `current_earnings` - Current Year Earnings (3-00-202)
   - `dividends` - Owner's Drawings, Dividends
   - `reserves` - Reserves
   - `other_equity` - Other equity accounts

2. **`closes_to_account_id` on accounts table**
   - Links Current Year Earnings → Retained Earnings account
   - Enables automated closing logic

3. **`retained_earnings_rollforward` table**
   - Tracks opening/closing balances per fiscal year
   - Records net income, dividends, prior period adjustments
   - Full audit trail with timestamps

### Core Formulas

**Retained Earnings Rollforward:**
```
RE(Closing) = RE(Opening) + Net Income - Dividends ± Prior Period Adjustments
```

**Year-over-Year Continuity:**
```
RE(Opening, Year N) = RE(Closing, Year N-1)
```

**Current Year Earnings:**
```
CYE = Sum(Revenue) - Sum(Expenses)
```

### Database Functions

1. **`calculate_retained_earnings_rollforward(org_id, year, start, end)`**
   - Returns opening, net_income, dividends, adjustments, closing

2. **`record_retained_earnings_rollforward(org_id, year, start, end)`**
   - Persists rollforward to audit table

3. **`get_retained_earnings_balance(org_id, as_of_date)`**
   - Returns RE balance at any point in time

4. **`validate_retained_earnings_continuity(org_id)`**
   - Validates year-over-year continuity

### Trigger Integration

When a fiscal year is closed (`fiscal_year_closes` INSERT), the `trigger_record_re_rollforward` automatically:
1. Calculates RE rollforward for the closed year
2. Records it in `retained_earnings_rollforward` table
3. Links to the closing entry for audit purposes

### Frontend Hook

`useRetainedEarningsRollforward` provides:
- `rollforwardHistory` - All recorded rollforwards
- `calculateRollforward()` - Calculate without saving
- `getREBalance()` - Get balance at any date
- `validateContinuity()` - Check year-over-year gaps
- `hasContinuityIssues` - Boolean flag for UI warnings
