## Goal
Make `efincash-webhook` update the virtual account balance whenever eFinCash notifies us of an incoming deposit (or other balance-affecting event), and keep an auditable transaction log.

## Schema changes (migration)
1. Add to `public.virtual_accounts`:
   - `balance numeric(18,2) not null default 0`
2. New table `public.virtual_account_transactions`:
   - `id uuid pk`
   - `virtual_account_id uuid → virtual_accounts(id) on delete cascade`
   - `organization_id uuid` (denormalized for RLS)
   - `provider_tx_id text` — external reference (idempotency)
   - `type text` — `credit` | `debit`
   - `amount numeric(18,2)`
   - `currency text`
   - `status text` — `successful` | `pending` | `failed`
   - `narration text`, `sender_name text`, `sender_bank text`, `sender_account text`
   - `raw_payload jsonb`
   - `occurred_at timestamptz`, `created_at`, `updated_at`
   - Unique index on `(virtual_account_id, provider_tx_id)` for idempotency
   - GRANTs + RLS: `authenticated` can `SELECT` where they're a member of `organization_id`; only `service_role` can write.

## Edge function: `efincash-webhook`
Extend the existing handler:

1. After matching the `virtual_accounts` row (by `user_key` or `provider_account_id`), inspect the payload for a transaction event. Detect via common eFinCash / Flutterwave fields: `event`/`type` containing `charge`/`transfer`/`credit`/`deposit`, or presence of an `amount` + transaction reference.
2. Extract normalized fields with fallbacks:
   - `provider_tx_id`: `data.id | data.tx_ref | data.reference | data.flw_ref`
   - `amount`: `data.amount | data.amount_settled`
   - `currency`: `data.currency`
   - `status`: `data.status` → map `successful`/`success` → `successful`
   - `narration`, `sender_name` (`data.customer.name` or `data.meta.originatorname`), `sender_bank`, `sender_account`
   - `occurred_at`: `data.created_at` or now
3. Upsert into `virtual_account_transactions` on `(virtual_account_id, provider_tx_id)` — makes retries idempotent.
4. Only on **insert** of a `successful` `credit`, increment `virtual_accounts.balance` by `amount` (single atomic SQL: `UPDATE ... SET balance = balance + $1`). Debits subtract. Pending/failed events are logged but don't move balance.
5. Preserve existing account-provisioning behavior (setting `account_number`, `bank_name`, `status`) — only run that branch when the payload looks like an account event (no `amount`, or event name mentions `account`/`virtual`).
6. Always return 200 for known/ignored events so eFinCash doesn't retry storm.

## Frontend
- `useVirtualAccounts` type: add `balance: number`.
- `VirtualAccountsList`: show a **Balance** column (formatted with the account currency).
- No new page; transactions table can be surfaced later.

## Out of scope (ask before adding)
- Mirroring credits into `bank_accounts` / posting a GL journal entry.
- A dedicated transactions drill-down UI.
- Outbound payments/debits from the VAN.

## Technical notes
- Webhook remains `verify_jwt = false`; add a lightweight shared-secret header check later if eFinCash supports one (not part of this change unless you confirm the header name).
- All balance math done in Postgres to avoid race conditions on concurrent webhooks.
