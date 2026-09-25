// Daily KYC monitor: snapshot Stripe Connect requirements and raise alerts
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

    const { data: accts } = await admin.from('stripe_connected_accounts')
      .select('id, organization_id, stripe_account_id');

    let processed = 0;
    for (const a of accts ?? []) {
      const res = await fetch(`https://api.stripe.com/v1/accounts/${a.stripe_account_id}`, {
        headers: { Authorization: `Bearer ${stripeKey}` },
      });
      if (!res.ok) continue;
      const acct = await res.json();
      const req = acct.requirements ?? {};

      await admin.from('stripe_kyc_requirements_log').insert({
        org_id: a.organization_id,
        connected_account_id: a.id,
        currently_due: req.currently_due ?? [],
        past_due: req.past_due ?? [],
        eventually_due: req.eventually_due ?? [],
        disabled_reason: req.disabled_reason ?? null,
        raw: req,
      });

      if ((req.past_due ?? []).length > 0 || req.disabled_reason) {
        await admin.from('treasury_alerts').insert({
          organization_id: a.organization_id,
          severity: req.disabled_reason ? 'critical' : 'warning',
          category: 'stripe_kyc',
          title: req.disabled_reason ? 'Stripe account disabled' : 'Stripe KYC items past due',
          message: `Connected account ${a.stripe_account_id}: ${(req.past_due ?? []).join(', ') || req.disabled_reason}`,
        }).select();
      }
      processed++;
    }
    return json({ ok: true, processed });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
