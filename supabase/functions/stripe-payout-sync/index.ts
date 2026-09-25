// Sync Stripe payouts for all connected accounts in an org. Idempotent via cache.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) return json({ error: 'STRIPE_SECRET_KEY not set' }, 400);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({}));
    const orgId = body?.organization_id as string | undefined;

    let q = admin.from('stripe_connected_accounts').select('id, organization_id, stripe_account_id');
    if (orgId) q = q.eq('organization_id', orgId);
    const { data: accounts } = await q;
    if (!accounts?.length) return json({ ok: true, processed: 0 });

    let totalPayouts = 0;
    for (const acct of accounts) {
      const res = await fetch('https://api.stripe.com/v1/payouts?limit=100', {
        headers: { Authorization: `Bearer ${stripeKey}`, 'Stripe-Account': acct.stripe_account_id },
      });
      const data = await res.json();
      if (!res.ok) continue;
      for (const p of data.data ?? []) {
        const gross = (p.amount ?? 0) / 100;
        // Lookup fees via balance transactions linked to payout
        let fees = 0;
        if (p.balance_transaction) {
          const btRes = await fetch(`https://api.stripe.com/v1/balance_transactions/${p.balance_transaction}`, {
            headers: { Authorization: `Bearer ${stripeKey}`, 'Stripe-Account': acct.stripe_account_id },
          });
          if (btRes.ok) { const bt = await btRes.json(); fees = (bt.fee ?? 0) / 100; }
        }
        await admin.from('stripe_payout_ledger').upsert({
          org_id: acct.organization_id,
          connected_account_id: acct.id,
          stripe_payout_id: p.id,
          arrival_date: p.arrival_date ? new Date(p.arrival_date * 1000).toISOString().slice(0, 10) : null,
          gross_amount: gross,
          fees,
          net_amount: gross - fees,
          currency: (p.currency ?? 'usd').toUpperCase(),
          status: p.status ?? 'pending',
          raw: p,
        }, { onConflict: 'connected_account_id,stripe_payout_id' });
        totalPayouts++;
      }
    }
    return json({ ok: true, processed: totalPayouts });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
