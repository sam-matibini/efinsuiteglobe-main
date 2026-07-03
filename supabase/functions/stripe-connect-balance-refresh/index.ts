// Refreshes Stripe Balance for a connected account and upserts per-currency snapshots.
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

    const { connected_account_id, organization_id } = await req.json();
    if (!connected_account_id) return json({ error: 'connected_account_id required' }, 400);

    // If a single account is provided, refresh it; otherwise refresh all in the org.
    const query = admin.from('stripe_connected_accounts').select('*');
    const { data: accounts, error } = connected_account_id === 'all'
      ? await query.eq('organization_id', organization_id)
      : await query.eq('id', connected_account_id);
    if (error || !accounts?.length) return json({ error: 'No accounts found' }, 404);

    // Verify membership for any organization in the result
    const orgIds = [...new Set(accounts.map((a: any) => a.organization_id))];
    for (const oid of orgIds) {
      const { data: member } = await admin.rpc('is_org_member' as any, { _user_id: claims.claims.sub, _org_id: oid } as any);
      if (!member) return json({ error: 'Forbidden' }, 403);
    }

    const results: any[] = [];
    for (const acct of accounts as any[]) {
      const res = await fetch('https://api.stripe.com/v1/balance', {
        headers: { Authorization: `Bearer ${stripeKey}`, 'Stripe-Account': acct.stripe_account_id },
      });
      const bal = await res.json();
      if (!res.ok) {
        results.push({ id: acct.id, error: bal?.error?.message ?? 'Stripe balance fetch failed' });
        continue;
      }

      const byCurrency = new Map<string, { available: number; pending: number; reserved: number }>();
      const add = (arr: any[], key: 'available' | 'pending' | 'reserved') => {
        for (const b of arr ?? []) {
          const cur = (b.currency ?? '').toLowerCase();
          if (!cur) continue;
          const entry = byCurrency.get(cur) ?? { available: 0, pending: 0, reserved: 0 };
          entry[key] += (Number(b.amount) || 0) / 100;
          byCurrency.set(cur, entry);
        }
      };
      add(bal.available, 'available');
      add(bal.pending, 'pending');
      add(bal.connect_reserved ?? bal.instant_available, 'reserved');

      const asOf = new Date().toISOString();
      for (const [currency, amounts] of byCurrency) {
        await admin.from('stripe_connected_account_balances').upsert({
          organization_id: acct.organization_id,
          connected_account_id: acct.id,
          currency,
          available_amount: amounts.available,
          pending_amount: amounts.pending,
          reserved_amount: amounts.reserved,
          as_of: asOf,
          raw: bal,
        }, { onConflict: 'connected_account_id,currency' });
      }

      results.push({ id: acct.id, currencies: [...byCurrency.keys()] });
    }

    return json({ ok: true, results });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
