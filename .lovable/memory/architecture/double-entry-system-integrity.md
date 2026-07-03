# Memory: architecture/double-entry-system-integrity
Updated: 2026-01-19

## Database Trigger Architecture

The following triggers are now attached and actively enforcing double-entry integrity at the schema level:

### Journal Entry Lines (journal_entry_lines)
1. `trigger_enforce_balanced_journal_entry` - AFTER INSERT/UPDATE/DELETE - Rejects unbalanced entries
2. `trigger_prevent_posted_line_modification` - BEFORE UPDATE/DELETE - Blocks changes to posted lines
3. `trigger_validate_journal_line_account` - BEFORE INSERT/UPDATE - Validates target account allows posting
4. `trigger_validate_journal_line_organization` - BEFORE INSERT/UPDATE - Ensures account org matches entry org
5. `trigger_auto_update_account_balance` - AFTER INSERT/UPDATE/DELETE - Recalculates account balances

### Journal Entries (journal_entries)
6. `trigger_on_journal_entry_posted` - AFTER UPDATE - Recalculates balances when entry posted/reversed
7. `trigger_validate_journal_entry_completeness` - BEFORE UPDATE - Validates min 2 lines and balance before posting
8. `trigger_update_journal_entries_updated_at` - BEFORE UPDATE - Maintains updated_at timestamp

### Accounts (accounts)
9. `trigger_validate_organization_opening_balance` - AFTER INSERT/UPDATE opening_balance - Validates opening balances are balanced
10. `trigger_update_accounts_updated_at` - BEFORE UPDATE - Maintains updated_at timestamp

### Bank/Credit Card Transactions
11. `trigger_prevent_reconciled_bank_transaction` - BEFORE UPDATE/DELETE - Protects reconciled bank transactions
12. `trigger_prevent_reconciled_cc_transaction` - BEFORE UPDATE/DELETE - Protects reconciled CC transactions

### Timesheet Entries
13. `trigger_recalculate_timesheet_totals` - AFTER INSERT/UPDATE/DELETE - Recalculates timesheet totals

## Validation Functions
- `validate_trial_balance(org_id)` - Returns is_balanced, total_debits, total_credits, difference
- `verify_trial_balance_integrity(org_id, as_of_date)` - Full integrity check with account count
- `recalculate_all_account_balances(org_id)` - Recalculates all account balances from journal lines

## Trial Balance UI Logic
The Trial Balance page (TrialBalance.tsx) uses an "as-of" calculation matching the backend validator:
- Shows ALL account balances up to the end date
- Opening Balance = account.opening_balance + all transactions BEFORE period start
- Period Activity = debits/credits WITHIN the period
- Closing Balance = Opening + Period Activity
- Total Debits must equal Total Credits for balance
Updated: 2026-01-19

## System-Level Double-Entry Enforcement (GAAP/IFRS/ASPE Compliant)

The General Ledger enforces double-entry integrity at the **database schema level** through multiple triggers and functions, ensuring Trial Balance and Balance Sheet are **always balanced** regardless of country/jurisdiction:

### Core Database Functions
1. **`recalculate_account_balance(account_id)`** - Calculates correct balance from opening_balance + posted journal entries
2. **`recalculate_all_account_balances(organization_id)`** - Batch recalculates all account balances for an organization
3. **`validate_trial_balance(organization_id)`** - Returns balance status (is_balanced, total_debits, total_credits, difference)
4. **`verify_trial_balance_integrity(org_id, as_of_date)`** - Comprehensive trial balance verification as of any date

### Enforcement Triggers
1. **`enforce_balanced_journal_entry`** - Rejects any posted journal entry where debits ≠ credits (0.001 tolerance)
2. **`validate_journal_line_account_trigger`** - **NEW** Prevents posting to header accounts or non-posting accounts
3. **`validate_org_opening_balance_trigger`** - **NEW** Ensures opening balances are balanced per organization (debits = credits)
4. **`auto_update_account_balance`** - Automatically recalculates account balance when journal lines change
5. **`on_journal_entry_posted`** - Recalculates affected account balances when entry status changes to 'posted' or 'reversed'
6. **`prevent_posted_entry_modification`** - Prevents modification of posted journal entry lines (audit trail)
7. **`verify_balanced_after_post_trigger`** - **NEW** Warns if trial balance is out of balance after posting (audit logging)

### Chart of Accounts Integrity
- Header accounts (`is_header = true`) cannot receive postings - they are grouping/subtotal accounts only
- Non-posting accounts (`posting_allowed = false`) cannot receive postings - for system/calculated accounts
- These validations happen at the database level, preventing any application or API from violating them

### Opening Balance Integrity
- When opening balances are set on accounts, the system validates that:
  - Sum of debit-normal accounts' opening balances = Sum of credit-normal accounts' opening balances
  - This ensures the accounting equation is satisfied from day one
  - Uses 0.01 tolerance for floating-point precision

### Key Principles
- Balancing is enforced at the **database schema level**, not application level
- All countries/jurisdictions inherit the same double-entry enforcement
- Uses 0.001 (0.1 cent) tolerance for entry-level floating-point precision
- Uses 0.01 (1 cent) tolerance for organization-level opening balance validation
- Account balances are derived from `opening_balance + journal entries`, ensuring consistency
- Trial Balance: Sum(Debit Balances) = Sum(Credit Balances)
- Balance Sheet: Assets = Liabilities + Equity (with Net Income)

### Compliance
This architecture ensures compliance with:
- **GAAP** (Generally Accepted Accounting Principles)
- **IFRS** (International Financial Reporting Standards)
- **ASPE** (Accounting Standards for Private Enterprises)
- All localized country-specific accounting standards (inherits core principles)

### Audit Trail
- Warnings are logged when trial balance discrepancies are detected post-posting
- All posted entries are immutable - reversals create new entries
- Complete traceability from any account balance back to source entries
