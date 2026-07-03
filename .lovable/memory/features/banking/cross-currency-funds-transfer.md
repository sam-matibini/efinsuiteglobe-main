---
name: Cross-currency funds transfer
description: Bank/credit-card transfers between different currencies must post a 3-leg JE with a Realized FX Gain/Loss balancing line in base currency.
type: feature
---

`useFundsTransfer` detects when `fromAccount.currency !== toAccount.currency`
and creates a 3-line journal entry:

1. `Dr toAccount.gl`, `debit = toAmount`, `currency = toCur`, `exchange_rate = toRate`
2. `Cr fromAccount.gl`, `credit = fromAmount`, `currency = fromCur`, `exchange_rate = fromRate`
3. `Realized FX Gain/Loss` to `organizations.realized_fx_account_id` for the
   base-currency spread (`baseFrom - baseTo`). Positive spread → credit (gain),
   negative → debit (loss).

Rates default to nearest `exchange_rates` row on/before `transferDate`
(`from_currency = X, to_currency = base`). Both `toAmount` and `fxRate` are
required from the dialog UI for cross-currency transfers.

Existing broken transfers (where both legs were posted with the same nominal
amount and `currency = NULL`) were repaired by migration `20260508-04561X` for
Oluspe Auto Sales. A second repair on `2026-05-08` inserted Realized FX
Gain/Loss balancing lines into 4 legacy `BANK-*` JEs whose offset legs were
posted before `usePostTransactionToGL` added the FX rounding plug, fixing a
CAD 7,272.88 base-currency drift on the Balance Sheet.

The repair derives line currency from the matching
`bank_accounts.currency`, looks up `exchange_rates`, recomputes
`base_currency_debit/credit`, and inserts the FX gain/loss line so the JE
balances in the base currency.

`bank_transactions` does not have a `currency` column — the row's currency is
derived from the linked `bank_account.currency`.
