import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'docsign-documents';
const PUBLIC_MARKER = `/storage/v1/object/public/${BUCKET}/`;
const SIGNED_MARKER = `/storage/v1/object/sign/${BUCKET}/`;

/**
 * The `docsign-documents` bucket is private (workspace policy blocks public
 * buckets), so public URLs stored historically in `documents.file_url` return
 * 404 "Bucket not found". This helper detects such URLs, extracts the object
 * path, and mints a fresh signed URL. Non-bucket URLs pass through unchanged.
 */
export async function resolveDocSignFileUrl(
  url: string | null | undefined,
  expiresIn = 3600,
): Promise<string | null> {
  if (!url) return null;

  let path: string | null = null;
  const publicIdx = url.indexOf(PUBLIC_MARKER);
  if (publicIdx !== -1) {
    path = decodeURIComponent(url.slice(publicIdx + PUBLIC_MARKER.length).split('?')[0]);
  } else {
    const signedIdx = url.indexOf(SIGNED_MARKER);
    if (signedIdx !== -1) {
      path = decodeURIComponent(url.slice(signedIdx + SIGNED_MARKER.length).split('?')[0]);
    }
  }

  if (!path) return url;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    console.warn('[docsign] Failed to sign URL for', path, error);
    return url;
  }
  return data.signedUrl;
}
