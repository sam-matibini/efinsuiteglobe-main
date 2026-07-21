## Change

Replace the hardcoded `$` in the plan form's price/cost labels with the currency selected in the plan form (`planForm.currency`), defaulting to `USD` when empty.

In `src/pages/admin/AdminSubscriptions.tsx` update these four labels:
- `Monthly Price ($)` → `Monthly Price ({currency})`
- `Yearly Price ($)` → `Yearly Price ({currency})`
- `Monthly Cost ($)` → `Monthly Cost ({currency})`
- `Yearly Cost ($)` → `Yearly Cost ({currency})`

Where `{currency}` = `planForm.currency || 'USD'`. Labels update live when the Country/Currency selector changes.

No backend, schema, or logic changes — purely a label fix.