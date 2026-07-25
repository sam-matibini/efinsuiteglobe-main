## Goal
When a document is sent via `efinsign-proxy` `send`, email each signer their signing link, because eFinSign does not send those emails for us.

## Where
`supabase/functions/efinsign-proxy/index.ts` — `send` handler (around lines 226-238).

## Behavior
After the existing eFinSign `/documents/{efId}/send` call succeeds and local statuses are updated:

1. Load document (title, organization_id) and all its signers (id, email, name, status) from Supabase.
2. Load the sending organization's email branding from `organizations` (`email_from_name`, `email_from_address`, plus display name for the greeting).
3. For each signer whose status is not `signed`/`declined`:
   - Build a signing URL that points to our own app page that already handles redirects:
     `${APP_URL}/docsign/sign?sign=${signer.id}` where `APP_URL` comes from a new env var `APP_PUBLIC_URL` (fallback to `SITE_URL`, then to request `origin` header).
   - Compose subject: `Action required: Please sign "${document.title}"`.
   - Compose text + branded HTML body (mirrors the copy in `useMessaging.sendDocumentSigningRequest`) with a Review & Sign button, plain link fallback, and organization signature.
4. Send each email by invoking the existing `resend-integration` edge function server-side:
   - `POST ${SUPABASE_URL}/functions/v1/resend-integration` with the service-role key in `Authorization`.
   - Body: `{ action: 'send-email', to, subject, message, html, branding: { email, displayName } }` where `branding` uses the org's `email_from_address` / `email_from_name` so Resend uses the configured sender.
5. Collect per-signer results. Do not fail the whole `send` if some emails fail — log an audit row and return them:
   - Insert a `document_audit_logs` entry `action: 'signer_emailed'` per signer (with `success`, `error`, `message_id`).
   - Return `{ success: true, emailed: [{ signer_id, email, success, error? }] }` so the client can toast partial failures.

## Client
No API change required — `useSendDocument` already handles `{ success: true }`. Optionally surface partial email failures: if any `emailed[i].success === false`, show a warning toast listing those recipients (small UI tweak in `useDocuments.ts` `useSendDocument.onSuccess`).

## Config
- New optional secret `APP_PUBLIC_URL` (e.g. `https://app.efinsuite.com`) so links point to production. If missing, fall back to `SITE_URL`, then to the `origin` request header.
- Uses existing `resend-integration` function + org-level `email_from_name` / `email_from_address` already configured in Settings → Email sender. No new Resend config required.

## Out of scope
- SMS/WhatsApp notifications (current request is email only).
- Reminder/void emails (`remind` already delegates to eFinSign; unchanged).
- Template edits beyond the copy shown above.
