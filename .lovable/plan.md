## Root cause

`efinsign-proxy`'s `fetchPdfBlob` does a plain `fetch(doc.file_url)` against the stored URL. The `docsign-documents` bucket is private, so that URL returns 400. The frontend was patched to mint signed URLs, but the edge function still uses the raw stored URL, so "Send for signing" fails at the upload-to-eFinSign step.

## Fix

In `supabase/functions/efinsign-proxy/index.ts`, download the PDF via the service-role Supabase client instead of an unauthenticated HTTP fetch.

1. Parse the object path out of `doc.file_url`:
   - If it contains `/storage/v1/object/public/docsign-documents/` or `/storage/v1/object/sign/docsign-documents/`, take the suffix (before `?`) and `decodeURIComponent`.
   - Otherwise, if it already looks like a bare storage path, use it as-is.
2. Call `admin.storage.from('docsign-documents').download(path)` to get a `Blob`.
3. On error, throw with the storage error message (so logs are actionable) instead of the misleading "Failed to fetch document file (400)".
4. Fall back to the existing `fetch(fileUrl)` only when no bucket path can be parsed (e.g. an external URL) — preserves current behavior for non-Supabase files.

No DB, no frontend, no other function changes.
