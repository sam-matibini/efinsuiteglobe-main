# Fix: Deletes not propagating to eFinSign

## Root cause (confirmed from logs)

`edge-function-logs-efinsign-proxy` shows:

```
eFinSign delete failed (continuing): [400] Only draft documents can be deleted
```

eFinSign's API only permits `DELETE /documents/{id}` on documents in **draft** status. Once a document is sent/completed/voided it can no longer be deleted via the API — only voided. The current `delete_document` handler in `supabase/functions/efinsign-proxy/index.ts` catches this 400, logs a warning, and still returns `{ success: true }` after deleting the local row. From the UI it looks like a success but the eFinSign record is orphaned.

## Fix

Update `delete_document` in `supabase/functions/efinsign-proxy/index.ts`:

1. Fetch `efinsign_document_id` and local `status` (already partially done).
2. If `efinsign_document_id` exists:
   - Try `DELETE /documents/{efId}` first.
   - If it fails with a 400 whose body indicates "Only draft documents can be deleted", fall back to `POST /documents/{efId}/void` (eFinSign's void endpoint) so the remote record is at least closed out rather than orphaned.
   - Track the remote outcome: `deleted` | `voided` | `failed` (+ error message).
3. Delete the local row as today.
4. Return `{ success: true, remote: <outcome>, remote_error?: string }` instead of a blanket success, so the client can show an accurate toast.

## Client-side surface

In `src/hooks/useDocuments.ts` (`useDeleteDocument`), read `remote` from the response and adjust the success toast:

- `deleted` → "Document deleted"
- `voided` → "Document deleted locally; remote copy voided (eFinSign doesn't allow deleting non-draft documents)"
- `failed` → warning toast with `remote_error`

No schema changes. No UI component changes beyond the toast text.

## Verification

- Delete a draft document → eFinSign record removed, toast says "deleted".
- Delete a sent/completed document → eFinSign record voided, toast explains the fallback.
- Check `edge-function-logs-efinsign-proxy` no longer shows the swallowed 400 for the non-draft path.
