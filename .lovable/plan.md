
## Goal

Let organization admins generate virtual accounts (multiple, one per currency) via the eFinMoney API. Entry points:
- **Settings → Organization → Virtual Account** tab
- **Banking → Virtual Accounts** page

Only the creation menu + list for now — no money-out wiring yet.

## Backend

**Secret**
- Add `EFINCASH_API_KEY` via `add_secret`.

**Table: `virtual_accounts`**
Columns:
- `organization_id` (fk), `created_by` (uuid)
- `user_key` (text, unique per org+currency) — we generate as `org_<id>_<currency>`
- `currency` (text)
- `email`, `first_name`, `last_name`, `bvn_or_nin` (nullable)
- `provider` (text, default `efincash`)
- `provider_account_id`, `account_number`, `bank_name`, `account_name` (nullable — filled from API/webhook)
- `status` (text: `pending` | `active` | `failed`)
- `raw_response` (jsonb)
- standard timestamps

GRANTs + RLS: org members can `SELECT`; only org admins can `INSERT`; `service_role` full access. Unique index on `(organization_id, currency)`.

**Edge function: `efincash-proxy`** (verify_jwt=false, CORS)
- Action `create_virtual_account`: validates auth + org admin role, inserts row `status=pending`, POSTs to `https://efincash.lenhub.net/v1/flutterwave/flutter/permant/virtual/` with `Authorization: Bearer $EFINCASH_API_KEY`, updates row with account details or `status=failed`, returns result.
- Zod validation on body.

**Edge function: `efincash-webhook`** (verify_jwt=false, CORS)
- Accepts POST from eFinCash, looks up row by `user_key` or `provider_account_id`, updates `account_number/bank_name/account_name/status/raw_response`. Logs event.

## Frontend

**Hook `useVirtualAccounts.ts`**
- `list()` by org, `create(payload)` calls `efincash-proxy`, react-query invalidation.

**Component `CreateVirtualAccountDialog.tsx`**
- Fields: currency (select: NGN default, plus USD/GBP/EUR), email, first_name, last_name, bvn_or_nin.
- Prefill from `useAuth` user profile + org owner; all editable.
- Zod validation; loading state; success toast shows generated account number when returned synchronously.

**Component `VirtualAccountsList.tsx`**
- Table: currency, account number, bank, status, created date, copy button.
- "Create Virtual Account" button opens dialog.

**Integration points**
1. `src/pages/Settings.tsx` (or org settings tabs) → add "Virtual Account" tab rendering `VirtualAccountsList`.
2. New route `/banking/virtual-accounts` → new page `src/pages/banking/VirtualAccounts.tsx` rendering the same list; add nav entry under Banking; add mapping in `routeModuleMap.ts` (module: `banking`).

## Out of scope (later)
- Using virtual account balance for payouts / money-out flows
- Balance sync / transaction feed from eFinCash
- KYC verification UI beyond passing BVN/NIN
