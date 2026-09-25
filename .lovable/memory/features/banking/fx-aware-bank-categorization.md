---
name: FX-aware bank categorization
description: When categorizing/posting bank transactions on foreign-currency accounts, the bank leg posts in FC at the resolved rate and offset/tax legs post in BASE currency. Client supplies explicit base_currency_debit/credit.
type: feature
---

`exchange_rate` on `journal_entry_lines` and `rate` on `exchange_rates` are
`numeric(20,10)` — required so low-value rates (NGN, IDR, VND) don't lose
precision and create JS↔DB base-amount drift. `createJournalEntry` always
inserts explicit `base_currency_debit/credit = round(amount × rate, 2)`. The
`calculate_base_currency_amounts` BEFORE trigger only fills these when NULL,
so client-supplied values are trusted by `validate_journal_entry_balance`.

`useBankingGL → usePostTransactionToGL` translates bank transactions on
foreign-currency bank accounts so the JE balances natively in base currency:

- Bank leg: `currency = bankAccount.currency`, `exchange_rate = rate(FC→base on or before transaction_date)`, raw `debit`/`credit` = FC amount.
- Offset/tax legs: `currency = org.currency`, `exchange_rate = 1`, raw amounts = `fcAmount × rate` (base).
- A realized FX gain/loss plug line absorbs sub-cent drift between legs (`organizations.realized_fx_account_id` required).

Rate is resolved from `exchange_rates` (nearest on/before `transaction_date`); a
missing rate throws a friendly error pointing to Banking → Exchange Rates.
