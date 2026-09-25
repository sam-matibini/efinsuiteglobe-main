# Memory: architecture/reversal-netting-rpc-requirement
Updated: 2026-02-28

## Reversal Netting Architecture — Critical RPC Requirement

All database RPC functions that query journal entries for financial reporting MUST include both `posted` AND `reversed` statuses in their filters:

```sql
AND je.status IN ('posted', 'reversed')
```

### Why

When a journal entry is reversed:
1. The original entry gets `status = 'reversed'`
2. A new reversing entry is created with `status = 'posted'` (debits/credits swapped)
3. Both entries MUST be included in queries so they net to zero

If only `status = 'posted'` is used, the reversing entry is counted but the original is excluded, causing a one-sided balance inflation.

### Affected RPCs (Fixed 2026-02-28)

- `calculate_opening_retained_earnings` — all 3 query points
- `calculate_period_net_income` — main query
- `calculate_retained_earnings_statement` — dividends and direct adjustments queries

### Other RPCs / Hooks Already Correct

- `useFinancialReports` and `useComparativeFinancialReports` hooks already filter `status IN ('posted', 'reversed')`
- `validate_trial_balance` and `recalculate_all_account_balances` already handle both statuses
- `auto_update_account_balance` trigger handles both statuses

### Rule for Future Development

Any NEW RPC or query that reads from `journal_entries` for financial calculations MUST use `IN ('posted', 'reversed')`, never just `= 'posted'`.
