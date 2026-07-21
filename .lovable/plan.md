## Goal

Replace the manual **Refresh status from eFinSign** button flow with a push-based sync: eFinSign posts events to a public edge function, we verify the HMAC signature, and update the local `documents` / `document_signers` rows.

## 1. Secret

Add a new secret `EFINSIGN_WEBHOOK_SECRET`. This is the value eFinSign returns once when a webhook is registered — the user pastes it into the secure form. It's separate from `EFINSIGN_API_KEY`.

## 2. New edge function `efinsign-webhook` (public, `verify_jwt = false`)

Path: `supabase/functions/efinsign-webhook/index.ts`, wired in `supabase/config.toml` with `verify_jwt = false`.

Responsibilities:

- Read raw request body as text (needed for HMAC).
- Parse `X-Efinsign-Signature` header (`t=…,v1=…`).
- Verify HMAC-SHA256 of `${t}.${rawBody}` against `EFINSIGN_WEBHOOK_SECRET` using `crypto.subtle` and constant-time comparison; reject > 300s skew or bad signature with 401.
- Parse JSON body → `{ event, document_id, signer_id?, completed_at?, signed_at?, declined_at?, reason? }`.
- Idempotency: use header `X-Efinsign-Delivery-Id` if present, else hash of `(event + document_id + (signer_id||'') + timestamp)`; insert into a small `efinsign_webhook_events(id text primary key, event text, received_at timestamptz default now())` table; on unique-violation return 200 immediately.
- Dispatch on `event`:
  - `document.sent` → `documents.status = 'sent'`, set `sent_at` if column exists.
  - `document.completed` → `documents.status = 'completed'`, `completed_at = payload.completed_at ?? now()`.
  - `document.voided` → `documents.status = 'voided'`.
  - `document.signer_signed` → `document_signers` row matched by `efinsign_signer_id` (fallback `id`) → `status='signed'`, `signed_at = payload.signed_at ?? now()`. After update, if all signers for that document are `signed`, also mark the document `completed`.
  - `document.signer_declined` → signer `status='declined'`, `declined_at`, `decline_reason`; document `status='voided'`.
- All DB writes use service-role client (`SUPABASE_SERVICE_ROLE_KEY`) so RLS doesn't block.
- Append an entry to `document_audit_logs` for each processed event.
- Always return 200 after successful processing; 4xx only for signature/parse errors so eFinSign doesn't retry those.
- Standard CORS headers on responses.

## 3. Migration

Single migration:

- `create table public.efinsign_webhook_events (id text primary key, event text not null, received_at timestamptz not null default now());`
- GRANTs (`service_role` all; no anon/authenticated — this table is internal).
- Enable RLS with no policies (service role bypasses RLS).

No schema changes to `documents` / `document_signers` — the existing columns (`status`, `completed_at`, `signed_at`, `efinsign_signer_id`, etc. added in the prior turn) cover it.

## 4. Registration helper (one-off)

Add an action `register_webhook` to the existing `efinsign-proxy` edge function:

- Admin-only (checks caller is platform admin via `has_role`).
- Calls `POST https://cavdivfhszrnhliyafze.supabase.co/functions/v1/api/webhooks` on eFinSign with the project's public webhook URL (`${SUPABASE_URL}/functions/v1/efinsign-webhook`) and the five event names.
- Returns the `secret` from the response to the admin UI **once**, with copy button + instructions to save it as `EFINSIGN_WEBHOOK_SECRET`.

Small UI hook in `AdminSubscriptions` isn't needed — add a compact "Register eFinSign webhook" button in an existing DocSign settings surface. If there isn't a clean spot, expose it via a minimal admin page section (open question below).

## 5. Frontend

- Keep the existing **Refresh status** button as a manual fallback for stale rows.
- Rely on existing React Query invalidation via realtime — no code change needed since `documents` list already re-queries on focus / after mutations. Optionally add a `postgres_changes` subscription in `useDocuments` for the current org to live-refresh; leaving that for a follow-up unless you want it now.

## Technical details

- HMAC verification with Web Crypto (no Node `crypto`):
  ```ts
  const key = await crypto.subtle.importKey("raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${rawBody}`)));
  ```
  Compare hex output with `v1` via constant-time loop.
- Match signers by `efinsign_signer_id` first (populated when the proxy created them); fall back to `document_signers.id` because eFinSign may send our local ID depending on registration.
- Auto-complete rule: after a `signer_signed` update, `select count(*) filter (where status <> 'signed') from document_signers where document_id = $1` — if zero, flip the document.

## Open question

Where should the "Register eFinSign webhook" admin button live? Options:

1. New card on the existing **Admin → Integrations / Subscriptions** area.
2. A DocSign-specific admin settings page (doesn't exist yet — would need a small new route).
3. Skip the UI and register the webhook once via a manual `curl` from you; only ship the receiver + secret.

Default if you don't answer: option 3 (ship receiver + secret, you register once with curl).  
  
Pick Option 3 and provide for me the url and events needed in the curl to create the secret