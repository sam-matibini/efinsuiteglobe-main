// get-signing-pdf
// -----------------------------------------------------------------------------
// Anonymous signer-facing PDF fetch. Given a signing token and a document id,
// validates the token belongs to a signer on that document, then returns a
// short-lived (1-hour) signed URL from the private docsign-documents bucket.
//
// The signer never touches Supabase auth. They present the token in the
// `x-signer-token` header (or in JSON body for POST), and this function
// bypasses RLS via the service-role admin client to mint the signed URL.
//
// Response shape:
//   { url: string, expires_in: 3600, document: { id, title, status } }
//
// Errors are returned as { error: string } with 4xx/5xx status.

import { createClient } from 'npm:@supabase/supabase-js@2';

// Custom CORS headers — must include x-signer-token so the browser
// allows it in preflight for unauthenticated signer requests.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signer-token',
};

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const DOCSIGN_BUCKET = 'docsign-documents';
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour per spec

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function extractStoragePath(fileUrl: string): string | null {
  const markers = [
    `/storage/v1/object/public/${DOCSIGN_BUCKET}/`,
    `/storage/v1/object/sign/${DOCSIGN_BUCKET}/`,
    `/storage/v1/object/authenticated/${DOCSIGN_BUCKET}/`,
  ];
  for (const m of markers) {
    const idx = fileUrl.indexOf(m);
    if (idx !== -1) return decodeURIComponent(fileUrl.slice(idx + m.length).split('?')[0]);
  }
  if (!/^https?:\/\//i.test(fileUrl) && !fileUrl.startsWith('/')) {
    return fileUrl.split('?')[0];
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Token can arrive in the header or in the JSON body (POST from the
    // signing page's supabase client sends it as a header via global headers).
    let token = req.headers.get('x-signer-token') ?? '';
    let documentId: string | null = null;

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({} as Record<string, unknown>));
      token = token || String((body as { token?: string }).token ?? '');
      documentId = String((body as { document_id?: string }).document_id ?? '') || null;
    } else {
      const url = new URL(req.url);
      token = token || (url.searchParams.get('token') ?? '');
      documentId = url.searchParams.get('document_id');
    }

    if (!token) return json({ error: 'Missing signer token' }, 401);
    if (!documentId) return json({ error: 'Missing document_id' }, 400);

    // Verify: the token belongs to a signer on the requested document.
    const { data: signer, error: sErr } = await admin
      .from('document_signers')
      .select('id, document_id, status, signer_expires_at')
      .eq('signing_token', token)
      .eq('document_id', documentId)
      .maybeSingle();

    if (sErr) {
      console.error('get-signing-pdf signer lookup failed:', sErr);
      return json({ error: 'Signer lookup failed' }, 500);
    }
    if (!signer) return json({ error: 'Invalid signing link' }, 403);
    if (signer.status === 'declined') return json({ error: 'This signing link was declined' }, 410);
    if (signer.signer_expires_at && new Date(signer.signer_expires_at) < new Date()) {
      return json({ error: 'Signing link expired' }, 410);
    }

    // Load document + its storage path.
    const { data: doc, error: dErr } = await admin
      .from('documents')
      .select('id, title, status, file_url')
      .eq('id', documentId)
      .single();
    if (dErr || !doc) return json({ error: 'Document not found' }, 404);
    if (!doc.file_url) return json({ error: 'Document has no file to sign' }, 404);

    const storagePath = extractStoragePath(doc.file_url);
    if (!storagePath) {
      // file_url points off-bucket (e.g. eFinSign remote) — return it as-is.
      // Callers are expected to iframe it directly. This is the transition
      // case for legacy documents; new uploads always live in the bucket.
      return json({
        url: doc.file_url,
        expires_in: SIGNED_URL_TTL_SECONDS,
        document: { id: doc.id, title: doc.title, status: doc.status },
      });
    }

    const { data: signed, error: signErr } = await admin
      .storage
      .from(DOCSIGN_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

    if (signErr || !signed?.signedUrl) {
      console.error('get-signing-pdf createSignedUrl failed:', signErr);
      return json({ error: `Could not sign document URL: ${signErr?.message ?? 'unknown'}` }, 500);
    }

    // Best-effort audit: mark the signer as viewed if this is the first fetch.
    if (signer.status === 'pending' || signer.status === 'sent') {
      admin.from('document_signers')
        .update({ status: 'viewed', viewed_at: new Date().toISOString() })
        .eq('id', signer.id)
        .then(() => {}, () => {}); // fire-and-forget
    }

    return json({
      url: signed.signedUrl,
      expires_in: SIGNED_URL_TTL_SECONDS,
      document: { id: doc.id, title: doc.title, status: doc.status },
    });

  } catch (e) {
    const err = e as { message?: string };
    console.error('get-signing-pdf error:', e);
    return json({ error: err.message || 'Internal error' }, 500);
  }
});
