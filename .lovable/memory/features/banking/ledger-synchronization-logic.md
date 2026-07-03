# Memory: features/banking/ledger-synchronization-logic
Updated: 2026-02-09

## Ledger Synchronization and Balance Recalculation

The banking and credit card modules (`src/hooks/useBankingGL.ts` and `src/hooks/useCreditCardGL.ts`) utilize the General Ledger as the primary source of truth. While `accounts.current_balance` provides a cached view, the authoritative balance is the cumulative sum of posted `journal_entry_lines`.

### Balance Calculation Formula
- **Debit-normal accounts** (Assets, Expenses): `opening_balance + SUM(debits) - SUM(credits)`
- **Credit-normal accounts** (Liabilities, Equity, Income): `opening_balance + SUM(credits) - SUM(debits)`

### Common Causes of Balance Discrepancy
1. **Direct bank_account.current_balance updates** without corresponding journal entries
2. **Interrupted GL posting** where transaction marked matched but JE not created
3. **Balance trigger failures** during bulk imports or reversals
4. **Race conditions** in concurrent transaction processing

### Recalculation Query Pattern
When `current_balance` drifts from ledger totals, use this pattern to resync:

```sql
WITH calculated AS (
  SELECT 
    a.id,
    a.normal_balance,
    COALESCE(a.opening_balance, 0) as opening_balance,
    COALESCE(SUM(jel.debit), 0) as total_debits,
    COALESCE(SUM(jel.credit), 0) as total_credits,
    CASE 
      WHEN a.normal_balance = 'debit' THEN 
        COALESCE(a.opening_balance, 0) + COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)
      ELSE 
        COALESCE(a.opening_balance, 0) + COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit), 0)
    END as correct_balance
  FROM accounts a
  LEFT JOIN journal_entry_lines jel ON a.id = jel.account_id
  LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id AND je.status = 'posted'
  WHERE a.organization_id = :org_id
    AND a.is_header = false
  GROUP BY a.id
)
UPDATE accounts
SET current_balance = calculated.correct_balance, updated_at = now()
FROM calculated
WHERE accounts.id = calculated.id;
```

### Verification Checks
After recalculation, verify:
1. **Trial Balance**: `SUM(debit balances) = SUM(credit balances)`
2. **Balance Sheet**: `Assets = Liabilities + Equity + (Income - Expenses)`
3. **No orphaned entries**: All posted JEs have at least 2 lines

### Opening Balances
Opening balances are incorporated via initial journal entries rather than separate UI offsets. The `opening_balance` column on accounts is used for historical imports where a full ledger isn't available.
