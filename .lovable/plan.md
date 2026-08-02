## Goal

Expand the `wise-webhook` edge function so it handles Wise **Account Deposit** (balance) events and **Transfer Issue** events, in addition to the transfer state-change events it already logs. Deposits are log-only (no balance or ledger changes). Transfer issues are logged and flagged for attention.

## Events to support

Transfers (existing + added):
- `transfers#state-change` — already handled
- `transfers#active-cases` — Transfer Issue (compliance/verification cases)
- `transfers#payout-failure` — Transfer Issue (delivery failed)
- `transfers#refund` — refunded transfer, treated as an issue

Balances (Account Deposit):
- `balances#credit` — money received into a Wise balance
- `balances#update` — balance amount changed

Unknown/other `event_type` values still get logged with raw payload so nothing is lost.

## Database change

One migration adding nullable columns to `public.wise_webhook_events`:

- `resource_type` text — `transfer`, `balance`, `profile`
- `balance_id` text
- `amount` numeric, `currency` text
- `post_balance_amount` numeric — balance after a deposit
- `transaction_type` text — `credit` / `debit`
- `needs_attention` boolean default false — set true for issue events
- `issue_summary` text — short human-readable reason (e.g. "payout failure", "active case: refund_requested")
- `active_cases` jsonb — raw active-cases array when present

Plus indexes on `balance_id` and a partial index on `needs_attention where needs_attention`. Existing grants/RLS (admin-only read via `has_role`) stay unchanged.

## Edge function changes (`supabase/functions/wise-webhook/index.ts`)

1. Keep signature verification, test-ping short-circuit, and delivery-ID idempotency exactly as they are.
2. Replace the single `mapEvent` with a dispatcher on `event_type` prefix:
   - `transfers#*` → existing transfer mapping, plus:
     - `active-cases`: capture `data.active_cases`, set `needs_attention = true`, build `issue_summary` from the case types.
     - `payout-failure`: capture failure details, `needs_attention = true`.
     - `refund`: capture amount/currency, `needs_attention = true`.
     - `state-change`: unchanged, `needs_attention = true` only when `current_state` is one of `cancelled`, `funds_refunded`, `bounced_back`, `charged_back`.
   - `balances#*` → map `resource.id` → `balance_id`, `profile_id`, `amount`, `currency`, `post_transaction_balance_amount` → `post_balance_amount`, `transaction_type`, `occurred_at`. `needs_attention` stays false.
   - fallback → generic mapping (event type, subscription, profile, occurred_at, raw payload only).
3. Tolerate both snake_case and camelCase field spellings, as the current code does.
4. Log a single structured console line per event including resource type and, for issues, the issue summary.
5. Response body extended with `resource_type` and `needs_attention` so Wise-side debugging is easier.
6. Keep the existing TODO note that payment-record updates are a later phase.

## Out of scope

- No changes to bank account or virtual account balances, and no journal entries or transaction rows from deposits.
- No changes to AP/tax payment records from transfer issues (only the `needs_attention` flag on the event log).
- No admin UI for viewing these events (can be added later if wanted).

## Deployment

Migration first, then update and deploy `wise-webhook`. In the Wise dashboard, subscribe the same endpoint to the balance and transfer-issue event types.
