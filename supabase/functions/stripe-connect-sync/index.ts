// Refreshes a connected account from Stripe (capabilities, requirements, persons).
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
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (!claims?.claims) return json({ error: 'Unauthorized' }, 401);

    const { connected_account_id } = await req.json();
    if (!connected_account_id) return json({ error: 'connected_account_id required' }, 400);

    const { data: row, error } = await admin.from('stripe_connected_accounts').select('*').eq('id', connected_account_id).maybeSingle();
    if (error || !row) return json({ error: 'Not found' }, 404);

    const { data: member } = await admin.rpc('is_org_member' as any, { _user_id: claims.claims.sub, _org_id: row.organization_id } as any);
    if (!member) return json({ error: 'Forbidden' }, 403);

    const acctRes = await fetch(`https://api.stripe.com/v1/accounts/${row.stripe_account_id}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    });
    const acct = await acctRes.json();
    if (!acctRes.ok) return json({ error: acct?.error?.message ?? 'Stripe fetch failed' }, 500);

    await admin.from('stripe_connected_accounts').update({
      country: acct.country,
      default_currency: acct.default_currency,
      email: acct.email,
      business_profile: acct.business_profile ?? {},
      capabilities: acct.capabilities ?? {},
      requirements: acct.requirements ?? {},
      charges_enabled: !!acct.charges_enabled,
      payouts_enabled: !!acct.payouts_enabled,
      details_submitted: !!acct.details_submitted,
      disabled_reason: acct.requirements?.disabled_reason ?? null,
      last_synced_at: new Date().toISOString(),
    }).eq('id', row.id);

    const personsRes = await fetch(`https://api.stripe.com/v1/accounts/${row.stripe_account_id}/persons?limit=100`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    });
    const personsJson = await personsRes.json();
    if (personsRes.ok) {
      for (const p of personsJson.data ?? []) {
        await admin.from('stripe_connected_account_persons').upsert({
          connected_account_id: row.id,
          stripe_person_id: p.id,
          relationship: p.relationship ?? {},
          verification: p.verification ?? {},
          requirements: p.requirements ?? {},
        }, { onConflict: 'connected_account_id,stripe_person_id' });
      }
    }

    return json({ ok: true, account_id: row.id });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
