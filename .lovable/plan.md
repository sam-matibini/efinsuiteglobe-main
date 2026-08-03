## 1. Automatic virtual account on organization creation

**Currency choice**: use the selected country's `default_currency` if eFinCash supports it (`NGN, USD, GBP, EUR, GHS, KES`), otherwise fall back to `USD`.

**Create Organization dialog** (`src/components/accounts/CreateOrganizationDialog.tsx`)
- Show a **BVN or NIN** field only when the resolved currency is NGN (i.e. the chosen country's default currency is NGN). Required in that case, per eFinCash rules.
- After the org is created (alongside the existing AI jurisdiction setup, non-blocking), call the virtual-account creation path with:
  - currency = resolved currency
  - email = the signed-in user's email
  - first/last name from the user's profile (fallback: split org name)
  - bvn_or_nin when supplied
- Surface a soft toast on failure ("Organization created — virtual account setup pending") so org creation never fails because of the provider.

**Shared currency list**
- Move the supported-currency list out of the dialog into a small shared constant (`src/lib/efincash.ts`) with a `resolveVirtualAccountCurrency(countryCurrency)` helper, used by both the manual dialog and the auto-creation path.

**Edge function** (`supabase/functions/efincash-proxy/index.ts`)
- Keep the existing admin check (the creator is the owner, so it passes).
- Keep the duplicate guard: if an account for that (org, currency) already exists, it returns 409 and the UI stays silent.
- No signature change needed; the existing `create` payload covers it.

Manual creation in Banking → Accounts stays available for extra currencies.

## 2. Paid invoices update balances

Manual payments (`useCustomerPayments`) already post a journal entry. The gap is provider-matched payments: `wise-webhook` inserts into `customer_payments` with no journal entry and no cash-side effect, and eFinCash deposits matched to invoices don't post to the books either.

**Shared helper** — new `supabase/functions/_shared/invoice_payment.ts` used by both webhooks. Given `(organization_id, invoice, amount, currency, date, reference, method)` it:
1. Inserts the `customer_payments` row (as today).
2. Updates the invoice `amount_paid` / `balance_due` / `status` / `paid_at`.
3. **Credits the virtual account**: finds the org's active `virtual_accounts` row for that currency and increments `balance` atomically (reuse the existing balance RPC used by `efincash-webhook`); also logs a row in `virtual_account_transactions` for eFinCash-sourced deposits.
4. **Posts the journal entry**: debit the cash/bank GL account, credit Accounts Receivable, for the payment amount — mirroring the logic in `useCustomerPayments`, resolved server-side (bank account's `gl_account_id` when the virtual account has one linked, otherwise the org's default cash account). Writes `journal_entry_id` back onto the payment row.
5. Is idempotent: skips if a payment with the same provider reference already exists.

**Wire it up**
- `supabase/functions/wise-webhook/index.ts` — replace the inline payment/invoice block with the shared helper.
- `supabase/functions/efincash-webhook/index.ts` — when a deposit narration/reference matches an open invoice, route it through the same helper instead of only touching the virtual account balance.

**Frontend** — invalidate `virtual-accounts`, `bank-accounts`, and invoice queries so the Banking and Invoice screens reflect the new balances without a reload.

## Technical notes
- Journal entry creation currently lives in frontend code (`useJournalEntryCreation.ts`); the webhook version will be a server-side port in `_shared`, using the same account-resolution rules (`getDefaultAccounts` equivalent: AR + cash by account code/name).
- If no cash or AR account is found, the payment and balance still record and the JE is skipped with a logged warning — same tolerant behaviour as the client path.
- No schema changes are expected; `virtual_accounts.balance` and `virtual_account_transactions` already exist. If the atomic increment RPC only accepts eFinCash tx shapes, a small migration adding a generic `increment_virtual_account_balance(p_account_id, p_amount)` function may be needed — I'll confirm during implementation and raise a migration then.
