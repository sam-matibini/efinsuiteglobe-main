// Phase 6 — Public webhook receiver for processor events (Stripe, others scaffolded).
// HMAC-verified per provider. Enqueues a processor-sync after recording the raw event.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  const url = new URL(req.url);
  const processorAccountId = url.searchParams.get('processor_account_id');
  if (!processorAccountId) return json({ error: 'Missing processor_account_id query param' }, 400);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: cred, error: cErr } = await admin
    .from('processor_api_credentials')
    .select('*, processor_account:processor_account_id(organization_id)')
    .eq('processor_account_id', processorAccountId)
    .single();
  if (cErr || !cred) return json({ error: 'Credential not found' }, 404);

  const rawBody = await req.text();
  const provider = cred.provider;
  const webhookSecretName = cred.webhook_secret_name;
  const webhookSecret = webhookSecretName ? Deno.env.get(webhookSecretName) : null;

  // Provider-specific HMAC verification
  if (provider === 'stripe') {
    if (!webhookSecret) return json({ error: 'Webhook secret not configured' }, 400);
    const sig = req.headers.get('stripe-signature');
    if (!sig || !(await verifyStripeSignature(rawBody, sig, webhookSecret))) {
      return json({ error: 'Invalid signature' }, 401);
    }
  } else {
    return json({ error: `Provider ${provider} webhooks not yet supported`, coming_soon: true }, 501);
  }

  let event: any;
  try { event = JSON.parse(rawBody); } catch { return json({ error: 'Invalid JSON' }, 400); }

  // Persist raw event
  await admin.from('treasury_webhook_events').insert({
    provider,
    event_type: event.type ?? 'unknown',
    payload: event,
    received_at: new Date().toISOString(),
  } as any).then(() => {}, () => {});

  const interesting = typeof event.type === 'string' && (
    event.type.startsWith('charge.dispute.') ||
    event.type.startsWith('payout.') ||
    event.type.startsWith('charge.refund')
  );

  if (interesting) {
    // Fire-and-forget sync
    fetch(`${supabaseUrl}/functions/v1/processor-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': Deno.env.get('SETTLEMENT_CRON_SECRET') ?? '',
      },
      body: JSON.stringify({ processor_account_id: processorAccountId }),
    }).catch(() => {});
  }

  return json({ ok: true });
});

async function verifyStripeSignature(body: string, header: string, secret: string): Promise<boolean> {
  try {
    const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=')));
    const t = parts['t'];
    const v1 = parts['v1'];
    if (!t || !v1) return false;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${body}`));
    const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
    return timingSafeEqual(hex, v1);
  } catch {
    return false;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
