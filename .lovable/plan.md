## Goal
Replace the current PDF fetching logic in `efinsign-proxy` with a signed-URL + `fetch` approach as the user specified.

## Change
In `supabase/functions/efinsign-proxy/index.ts`, rewrite `fetchPdfBlob` (lines 68–80) so that whenever the file lives in the `docsign-documents` bucket, we mint a 1-hour signed URL via `supabase.storage.from('docsign-documents').createSignedUrl(path, 60*60)` and fetch the blob from that URL, instead of using `admin.storage.download(path)`.

```ts
async function fetchPdfBlob(fileUrl: string): Promise<Blob> {
  const path = extractStoragePath(fileUrl);
  if (path) {
    const { data, error } = await admin
      .storage
      .from('docsign-documents')
      .createSignedUrl(path, 60 * 60); // 1 hour
    if (error || !data?.signedUrl) {
      throw new Error(`Failed to sign document URL: ${error?.message || 'unknown error'} (path: ${path})`);
    }
    const r = await fetch(data.signedUrl);
    if (!r.ok) throw new Error(`Failed to fetch signed document (${r.status})`);
    return await r.blob();
  }
  const r = await fetch(fileUrl);
  if (!r.ok) throw new Error(`Failed to fetch document file (${r.status})`);
  return await r.blob();
}
```

No other call sites change — `ensureEfinsignDocument` and `create_document` continue to call `fetchPdfBlob(file_url)` as before.

## Out of scope
- `flatten-pdf` and client-side `resolveFileUrl` already use signed URLs; unchanged.
