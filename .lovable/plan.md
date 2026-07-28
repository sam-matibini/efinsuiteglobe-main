## Problem

The real eFinCash response is double-nested and uses different field names than our current parser assumes, so proxied creations end up with `account_number`, `bank_name`, and `provider_account_id` all null, and status defaults to `pending` even on a successful `active` account.

Actual shape:

```text
{ status, message: { status, message, data: { id, account_number, account_bank_name, reference, status, currency, customer_id, ... } } }
```

Current code reads `providerJson.data` (which is the outer `message` object) and looks for `bank_name` / `accountNumber` — none of which exist.

## Refactor `efincash-proxy`

1. Extract a single normalizer used for both the create response and future webhook payloads:
  ```ts
   function unwrap(payload: any) {
     // Peel `{ status, message: { ..., data } }` or `{ data }` or bare object
     const inner = payload?.message?.data ?? payload?.data ?? payload ?? {};
     const outerOk = (payload?.status ?? payload?.message?.status ?? '').toString().toLowerCase() === 'success';
     return { d: inner, outerOk };
   }
  ```
2. Map fields to our schema:
  - `provider_account_id` ← `d.id` (e.g. `van_aB7ZzKCEfa`) — **this is what the webhook will echo back**, so it must be stored.
  - `account_number` ← `d.account_number`
  - `bank_name` ← `d.account_bank_name ?? d.bank_name`
  - `account_name` ← ``${first_name} ${last_name}``
    `currency` ← `d.currency ?? input.currency`
  - `status` ← `d.status === 'active' ? 'active' : (outerOk ? 'pending' : 'failed')`
3. Success = HTTP 2xx **and** `outerOk` **and** an `account_number` present. Otherwise mark row `failed` and return 502 with the raw provider body.
4. Keep storing the entire `providerJson` in `raw_response` for debugging.
5. Minor: drop the dead `providerStatus` reassignment from the auth-token call, and surface a clearer error when the auth-token response has no `key`.

## Refactor `efincash-webhook`

1. Reuse the same `unwrap()` helper (move it to `supabase/functions/_shared/efincash.ts` and import from both functions).
2. Account-lookup order becomes:
  - `provider_account_id` = `d.id ?? d.reference` (matches what we stored on create)
  - fallback: `account_number` = `d.account_number`
3. Event classification stays as-is (amount presence → transaction branch; otherwise account-update branch), but reads normalized fields:
  - `amount` ← `d.amount ?? d.amount_settled`
  - `currency` ← `d.currency`
  - `provider_tx_id` ← `d.id ?? d.reference ?? d.tx_ref ?? d.flw_ref`
  - `status` ← `d.status` mapped to `successful | pending | failed`
  - sender fields from `d.meta.*` fallbacks preserved
4. Account-update branch: on webhook re-notification of the VAN itself, refresh `account_number`, `bank_name` (`account_bank_name`), `provider_account_id`, and set `status = 'active'` when `d.status === 'active'`.
5. Continue returning HTTP 200 for all recognized events (no retry storms).

## Shared file

New `supabase/functions/_shared/efincash.ts` exporting `unwrap(payload)` and small helpers `mapAccountFields(d)` / `mapTxFields(d, body)`. Both functions import from it.

## Out of scope

- Signature/shared-secret verification on the webhook.
- Mirroring VAN credits into `bank_accounts` or the GL.
- UI changes (`VirtualAccountsList` already renders whatever comes back).

## Verification

After deploy, re-create a GHS virtual account and confirm the DB row has non-null `account_number`, `bank_name = "First Bank Ghana"`, `provider_account_id = "van_..."`, and `status = 'active'`.