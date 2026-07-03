# Memory: features/payroll/gl-integration-logic
Updated: 2026-02-15

## Payroll GL Account Matching

The payroll journal entry engine (src/lib/payrollJournalPosting.ts) utilizes a 4-tier priority matching strategy (Code + Preferred Name → Code + Pattern → Name → Code) to identify GL accounts. It supports multiple Chart of Accounts coding schemes across organizations:

### Account Code Mappings (multi-org support)
- **Salaries & Wages Expense**: `6-01-101`, `6-01-100-0001`
- **Employer CPP Expense**: `6-01-103`, `6-01-100-0002`
- **Employer EI Expense**: `6-01-104`, `6-01-100-0002`
- **Wages Payable**: `2-01-103-0001`
- **CPP Payable**: `2-01-103-0002`, `2-01-130-0001`
- **EI Payable**: `2-01-103-0003`, `2-01-130-0002`
- **Income Tax Payable**: `2-01-103-0004`, `2-01-130-0003`
- **Operating Bank**: `1-01-101-0001`, `1-01-100-0001`

## Journal Entry Creation Safety

The `createJournalEntry` function (src/hooks/useJournalEntryCreation.ts) uses a **draft-first** pattern:
1. Creates JE header as `draft`
2. Inserts all lines
3. Updates status to `posted` only after lines succeed
4. If lines fail, cleans up the draft header (prevents orphaned 0-line posted entries)

This prevents the historical issue where JE headers were created as 'posted' but lines failed, leaving orphaned entries that didn't affect the TB/GL.

## Guard System
- Checks for existing `PAY-` references or linked `journal_entry_id` before creation
- Automatically links any orphaned entries
- Pay Runs interface enables manual 'Post to GL' for records marked as 'paid' that lack an associated journal entry

## Payroll Account Number
The `organizations.payroll_account_number` field stores CRA RP numbers (or equivalent localized identifiers) used on T4/T4A slips. T4 generation prioritizes this field over `business_number`.
