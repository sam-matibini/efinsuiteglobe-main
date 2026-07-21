## Goal

Have all DocSign operations (create document, add/remove signers, place/update/remove fields, send, remind, void, download, audit log) executed against the **eFinSign API** while continuing to persist a mirror in the current `documents` / `document_signers` / `document_fields` / `document_audit_logs` tables. Signers will sign on **eFinSign's hosted page** (no embedded widget). One platform-wide API key is used for all orgs.

## Approach

Introduce a single Supabase edge function `efinsign-proxy` that:
- Reads the `EFINSIGN_API_KEY` secret.
- Accepts an `{ action, payload }` body from the frontend.
- Calls the matching eFinSign REST endpoint.
- Writes the returned entity into our existing tables (so listings, detail dialogs and audit UI keep working unchanged).
- Returns the mirrored row(s) to the caller.

The frontend hooks in `src/hooks/useDocuments.ts` are switched from raw `supabase.from(...)` writes to `supabase.functions.invoke('efinsign-proxy', ...)`. Reads stay as direct table selects (fast, RLS-scoped). This satisfies "operations from eFinSign, DB stays as current DB".

## Secrets

- `EFINSIGN_API_KEY` — added via `add_secret` (user pastes the `efsk_live_...` or `efsk_test_...` key). Nothing else needed.

## Schema changes (single migration)

Add columns to link local rows to their eFinSign counterparts. No table renames, no destructive changes.

```
alter table public.documents        add column efinsign_document_id uuid;
alter table public.document_signers add column efinsign_signer_id   uuid;
alter table public.document_fields  add column efinsign_field_id    uuid;
```

Indexes on each new column. No RLS/GRANT changes — existing policies stay.

## Edge function: `supabase/functions/efinsign-proxy/index.ts`

One handler, dispatches on `action`. Each action calls eFinSign, then upserts locally.

Actions and mapping:

```text
create_document   POST /documents (multipart)              → insert into documents
list_documents    GET  /documents                          → (optional) reconcile
get_document      GET  /documents/{id}                     → refresh local row + signers + fields
update_document   PATCH /documents/{id}                    → update documents.title
delete_document   DELETE /documents/{id}                   → delete documents row
download          GET  /documents/{id}/download?type=...   → return signed URL / bytes
audit_log         GET  /documents/{id}/audit-log           → mirror into document_audit_logs
send              POST /documents/{id}/send                → update documents.status='pending'
void              POST /documents/{id}/void                → update documents.status='voided'
remind            POST /documents/{id}/remind              → no-op mirror
add_signer        POST /documents/{id}/signers             → insert document_signers
update_signer     PATCH .../signers/{signerId}             → update row
delete_signer     DELETE .../signers/{signerId}            → delete row
add_field         POST .../signers/{signerId}/fields       → insert document_fields
update_field      PATCH .../fields/{fieldId}               → update row
delete_field      DELETE .../fields/{fieldId}              → delete row
```

Status/field-type/auth-method values are translated between eFinSign's vocabulary and the existing local enums (e.g. eFinSign `initials` ↔ local `initial`, eFinSign `pending`/`viewed`/`signed`/`declined` map into our wider set). Translation lives in a `map.ts` helper next to the function.

CORS + zod validation on every action; provider errors surfaced with status + body per gateway guidance.

## Frontend changes

`src/hooks/useDocuments.ts`
- Replace direct table writes in the mutation hooks with `supabase.functions.invoke('efinsign-proxy', { body: { action, payload } })`. Affected hooks: `useCreateDocument`, `useUpdateDocument`, `useDeleteDocument`, `useAddSigner`, `useUpdateSigner`, `useRemoveSigner`, `useAddField`, `useUpdateField`, `useRemoveField`, `useSendDocument` (new/updated), `useVoidDocument`, `useRemindDocument`.
- Reads (`useDocuments`, `useDocument`, `useDocumentSigners`, `useDocumentFields`) continue to hit local tables.

`src/pages/DocSignSign.tsx`
- Signing happens on eFinSign's hosted page. Replace this route with a lightweight "opening signer page…" redirect that calls `efinsign-proxy` action `get_signing_url` (which hits `POST /embed/signing-url` and returns the hosted `signing_url`) and does `window.location.href = signing_url`. The in-app signing UI is no longer used for eFinSign-backed documents.

`src/components/docsign/*`
- Buttons that previously called local mutations continue to work unchanged — they use the same hooks.
- Add a "Sign on eFinSign" button in `DocumentDetailDialog.tsx` that resolves the current signer's hosted URL for testing.

## Completion / status sync

Because signing happens off-platform, add a "Refresh status" button in the document detail dialog that invokes `efinsign-proxy` action `get_document`, which pulls the latest document + signer statuses from eFinSign and updates the local rows. (A webhook-based sync can be added later if eFinSign exposes one — not in scope now.)

## Out of scope for this change

- Templates, clients, and organization endpoints from the eFinSign spec (no matching UI today).
- Embedded signing widget.
- Per-org API keys.
- Automatic background polling / webhook sync.

## Technical details

- File upload: `useCreateDocument` currently uploads to Supabase Storage. New flow: upload the PDF blob to `efinsign-proxy` as multipart (edge function forwards to `POST /documents`). We keep the Supabase Storage copy as a local cache so existing PDF viewers keep working; `efinsign_document_id` is stored on the row.
- All eFinSign calls go through `https://api.efinsign.ca/functions/v1/api` with `Authorization: Bearer ${EFINSIGN_API_KEY}`.
- Errors from eFinSign are returned to the client with the provider status and body so `toast.error` surfaces the real reason.
- No changes to RLS. The edge function uses the service role internally for mirror writes; user identity is verified via the JWT before every action.

## Files touched

- New: `supabase/functions/efinsign-proxy/index.ts`, `supabase/functions/efinsign-proxy/map.ts`
- New migration: add `efinsign_*_id` columns + indexes
- Edited: `src/hooks/useDocuments.ts`, `src/pages/DocSignSign.tsx`, `src/components/docsign/DocumentDetailDialog.tsx`
- Secret: `EFINSIGN_API_KEY` (via `add_secret`)
