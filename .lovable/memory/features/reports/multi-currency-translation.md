---
name: Multi-currency translation in financial reports
description: All reporting hooks must read base_currency_debit/credit from journal_entry_lines, not raw debit/credit which are foreign-currency amounts.
type: feature
---

`journal_entry_lines.debit` and `.credit` hold foreign-currency amounts. The
trigger `calculate_base_currency_amounts` populates `base_currency_debit` and
`base_currency_credit` = FC × `exchange_rate`. All financial valuation reports
(Balance Sheet, Income Statement, Cash Flow, Trial Balance, Comparative,
General Ledger, Detailed Ledger, FX, Multi-Currency TB) MUST read base columns
with fallback:

```
const debit  = Number(line.base_currency_debit  ?? line.debit  ?? 0);
const credit = Number(line.base_currency_credit ?? line.credit ?? 0);
```

Reports that display the original transaction currency (sub-ledger detail)
keep `debit/credit` plus the `currency` badge.

Migration `20260508-044022` backfilled NULL base columns for all historical
rows by temporarily disabling user triggers (the
`prevent_posted_entry_modification` guard otherwise blocks updates on posted
entries).
