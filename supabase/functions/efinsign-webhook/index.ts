// Public eFinSign webhook receiver.
// Verifies HMAC-SHA256 signatures and updates local documents/document_signers rows.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-efinsign-signature, x-efinsign-event, x-efinsign-delivery-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const enc = new TextEncoder();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function parseSigHeader(h: string | null): { t: number; v1: string } | null {
  if (!h) return null;
  const parts: Record<string, string> = {};
  for (const p of h.split(',')) {
    const [k, v] = p.split('=');
    if (k && v) parts[k.trim()] = v.trim();
  }
  const t = parseInt(parts.t ?? '', 10);
  if (!t || !parts.v1) return null;
  return { t, v1: parts.v1 };
}

function toHex(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0');
  return s;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function verifyHmac(rawBody: string, sig: { t: number; v1: string }, secret: string, toleranceSec = 300): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - sig.t) > toleranceSec) return false;
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${sig.t}.${rawBody}`));
  return timingSafeEqualHex(toHex(mac), sig.v1.toLowerCase());
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const secret = Deno.env.get('EFINSIGN_WEBHOOK_SECRET');
  if (!secret) return json({ error: 'Webhook secret not configured' }, 500);

  const rawBody = await req.text();
  const sig = parseSigHeader(req.headers.get('x-efinsign-signature'));
  if (!sig) return json({ error: 'Missing or malformed signature' }, 401);

  const ok = await verifyHmac(rawBody, sig, secret);
  if (!ok) return json({ error: 'Invalid signature' }, 401);

  let payload: Record<string, unknown>;
  try { payload = JSON.parse(rawBody); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const event = (req.headers.get('x-efinsign-event') || payload.event || '') as string;
  if (!event) return json({ error: 'Missing event type' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Idempotency
  const deliveryId = req.headers.get('x-efinsign-delivery-id')
    || `${event}:${payload.document_id ?? ''}:${payload.signer_id ?? ''}:${sig.t}`;
  const dedup = await admin.from('efinsign_webhook_events')
    .insert({ id: deliveryId, event })
    .select('id')
    .maybeSingle();
  if (dedup.error && (dedup.error as { code?: string }).code === '23505') {
    return json({ received: true, duplicate: true });
  }

  const efDocId = payload.document_id as string | undefined;
  const efSignerId = payload.signer_id as string | undefined;

  // Resolve local document id from efinsign_document_id.
  let localDocId: string | null = null;
  if (efDocId) {
    const { data } = await admin.from('documents')
      .select('id').eq('efinsign_document_id', efDocId).maybeSingle();
    localDocId = (data as { id: string } | null)?.id ?? null;
  }

  const auditEntry = async (action: string, details: Record<string, unknown>) => {
    if (!localDocId) return;
    await admin.from('document_audit_logs').insert({
      document_id: localDocId,
      action: `efinsign.${action}`,
      details,
    });
  };

  try {
    switch (event) {
      case 'document.sent': {
        if (localDocId) {
          await admin.from('documents').update({ status: 'sent' }).eq('id', localDocId);
          await auditEntry('document.sent', payload);
        }
        break;
      }
      case 'document.completed': {
        if (localDocId) {
          await admin.from('documents').update({
            status: 'completed',
            completed_at: (payload.completed_at as string) ?? new Date().toISOString(),
          }).eq('id', localDocId);
          await auditEntry('document.completed', payload);
        }
        break;
      }
      case 'document.voided': {
        if (localDocId) {
          await admin.from('documents').update({ status: 'voided' }).eq('id', localDocId);
          await auditEntry('document.voided', payload);
        }
        break;
      }
      case 'document.signer_signed': {
        if (efSignerId) {
          const signedAt = (payload.signed_at as string) ?? new Date().toISOString();
          const upd = await admin.from('document_signers').update({
            status: 'signed',
            signed_at: signedAt,
          }).eq('efinsign_signer_id', efSignerId).select('document_id').maybeSingle();
          const docId = (upd.data as { document_id: string } | null)?.document_id ?? localDocId;
          if (docId) {
            const { data: pending } = await admin.from('document_signers')
              .select('id', { count: 'exact', head: true })
              .eq('document_id', docId).neq('status', 'signed');
            const pendingCount = (pending as unknown as { count?: number } | null)?.count ?? 0;
            // head:true returns count on the response — fetch via count param
            const { count } = await admin.from('document_signers')
              .select('id', { count: 'exact', head: true })
              .eq('document_id', docId).neq('status', 'signed');
            if ((count ?? pendingCount) === 0) {
              await admin.from('documents').update({
                status: 'completed',
                completed_at: signedAt,
              }).eq('id', docId);
            }
          }
          await auditEntry('signer.signed', payload);
        }
        break;
      }
      case 'document.signer_declined': {
        if (efSignerId) {
          const declinedAt = (payload.declined_at as string) ?? new Date().toISOString();
          await admin.from('document_signers').update({
            status: 'declined',
            declined_at: declinedAt,
            decline_reason: (payload.reason as string) ?? null,
          }).eq('efinsign_signer_id', efSignerId);
        }
        if (localDocId) {
          await admin.from('documents').update({ status: 'voided' }).eq('id', localDocId);
        }
        await auditEntry('signer.declined', payload);
        break;
      }
      default: {
        await auditEntry('unhandled', { event, payload });
      }
    }
  } catch (e) {
    console.error('efinsign-webhook processing error', e);
    // Still return 200 to avoid retries on our internal bugs; the row is logged in efinsign_webhook_events.
  }

  return json({ received: true });
});
