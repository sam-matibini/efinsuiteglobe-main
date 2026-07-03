// Creates a Stripe Transfer from platform to a connected account, used for Bill / Payroll payouts.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface Body {
  organization_id: string;
  connected_account_id: string;       // efinsuite uuid
  amount: number;                     // major units
  currency: string;
  purpose: 'bill_payment' | 'payroll' | 'manual' | 'invoice_settlement';
  description?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  source_transaction?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) return json({ error: 'STRIPE_SECRET_KEY not set' }, 400);

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (!claims?.claims) return json({ error: 'Unauthorized' }, 401);

    const body = (await req.json()) as Body;
    if (!body.organization_id || !body.connected_account_id || !body.amount || !body.currency) {
      return json({ error: 'Missing required fields' }, 400);
    }

    const { data: member } = await admin.rpc('is_org_member' as any, { _user_id: claims.claims.sub, _org_id: body.organization_id } as any);
    if (!member) return json({ error: 'Forbidden' }, 403);

    const { data: acct, error: aErr } = await admin
      .from('stripe_connected_accounts').select('*')
      .eq('id', body.connected_account_id).maybeSingle();
    if (aErr || !acct) return json({ error: 'Connected account not found' }, 404);

    const caps = (acct.capabilities ?? {}) as Record<string, string>;
    if (caps.transfers !== 'active') {
      return json({ error: 'Transfers capability not active on this connected account' }, 412);
    }

    const params = new URLSearchParams({
      amount: String(Math.round(body.amount * 100)),
      currency: body.currency.toLowerCase(),
      destination: acct.stripe_account_id,
      ...(body.description ? { description: body.description } : {}),
      ...(body.source_transaction ? { source_transaction: body.source_transaction } : {}),
    });
    const res = await fetch('https://api.stripe.com/v1/transfers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const tr = await res.json();
    if (!res.ok) return json({ error: tr?.error?.message ?? 'Transfer failed' }, 500);

    const { data: row } = await admin.from('stripe_connect_transfers').insert({
      organization_id: body.organization_id,
      stripe_transfer_id: tr.id,
      destination_account_id: tr.destination,
      connected_account_id: acct.id,
      amount: (tr.amount ?? 0) / 100,
      currency: (tr.currency ?? body.currency).toUpperCase(),
      source_transaction: tr.source_transaction ?? null,
      description: tr.description ?? null,
      status: 'pending',
      purpose: body.purpose,
      related_entity_type: body.related_entity_type ?? null,
      related_entity_id: body.related_entity_id ?? null,
      metadata: tr,
    }).select('*').single();

    return json({ ok: true, transfer: row });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
