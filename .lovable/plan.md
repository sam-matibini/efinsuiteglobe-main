## Problem

The PDF preview shows `Unexpected server response (400) while retrieving PDF ...docsign-documents/documents/...`. The network log confirms Supabase Storage returns `404 Bucket not found` for `docsign-documents`. The upload path in the app writes to this bucket, but the bucket was never provisioned in this project.

## Fix

1. Create the `docsign-documents` storage bucket (public, so signed PDFs can be fetched by pdf.js and by the eFinSign hosted signing page without signed-URL churn) using `supabase--storage_create_bucket`.
2. Add RLS policies on `storage.objects` for the bucket:
   - `SELECT`: public read (bucket is public).
   - `INSERT` / `UPDATE` / `DELETE`: restricted to authenticated users, scoped to objects under paths owned by their organization (`documents/`, `ai-sheets/` prefixes). Matches existing usage in `useAliceSheetsWorkbooks` and the DocSign upload flow.
3. If the workspace policy blocks public buckets, fall back to private + rely on signed URLs; surface that to the user.

No frontend code changes needed — the upload path already targets `docsign-documents`.

## Verification

- Re-open the E-Sign Prepare Document screen; the previously failing PDF URL should now return 200 and render via `PdfPageRenderer`.
