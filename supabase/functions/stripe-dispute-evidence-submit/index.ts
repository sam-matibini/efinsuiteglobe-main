// Submit dispute evidence to Stripe Connect
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

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
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { dispute_id, evidence } = await req.json();
    if (!dispute_id || !evidence) return json({ error: 'Missing fields' }, 400);

    const { data: dispute } = await admin.from('settlement_disputes').select('*').eq('id', dispute_id).maybeSingle();
    if (!dispute) return json({ error: 'Dispute not found' }, 404);
    if (!dispute.stripe_dispute_id) return json({ error: 'Not a Stripe dispute' }, 400);

    const { data: member } = await admin.rpc('is_org_member', { _user_id: user.id, _org_id: dispute.org_id });
    if (!member) return json({ error: 'Forbidden' }, 403);

    const { data: acct } = await admin.from('stripe_connected_accounts')
      .select('stripe_account_id').eq('id', dispute.connected_account_id).maybeSingle();

    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(evidence)) params.append(`evidence[${k}]`, String(v));

    const stripeRes = await fetch(`https://api.stripe.com/v1/disputes/${dispute.stripe_dispute_id}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(acct ? { 'Stripe-Account': acct.stripe_account_id } : {}),
      },
      body: params,
    });
    const result = await stripeRes.json();
    if (!stripeRes.ok) return json({ error: result?.error?.message ?? 'Stripe error' }, 500);

    await admin.from('settlement_disputes').update({
      status: 'evidence_submitted',
    }).eq('id', dispute_id);

    return json({ ok: true, stripe: result });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
