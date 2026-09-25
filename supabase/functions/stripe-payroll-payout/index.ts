// Batch Stripe transfers for a pay run to employee connected accounts
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

    const { organization_id, pay_run_id } = await req.json();
    if (!organization_id || !pay_run_id) return json({ error: 'Missing fields' }, 400);

    const { data: member } = await admin.rpc('is_org_member', { _user_id: user.id, _org_id: organization_id });
    if (!member) return json({ error: 'Forbidden' }, 403);

    const { data: stubs } = await admin.from('pay_stubs')
      .select('id, employee_id, net_pay, currency').eq('pay_run_id', pay_run_id);
    if (!stubs?.length) return json({ error: 'No pay stubs' }, 404);

    const results: any[] = [];
    for (const s of stubs) {
      const amount = Number(s.net_pay ?? 0);
      if (amount <= 0) continue;

      const { data: esc } = await admin.from('employee_stripe_connect')
        .select('connected_account_id').eq('employee_id', s.employee_id).maybeSingle();
      if (!esc?.connected_account_id) { results.push({ stub_id: s.id, error: 'no connected account' }); continue; }

      const { data: acct } = await admin.from('stripe_connected_accounts')
        .select('*').eq('id', esc.connected_account_id).maybeSingle();
      if (!acct) { results.push({ stub_id: s.id, error: 'account not found' }); continue; }

      const currency = (s.currency ?? 'USD').toLowerCase();
      const params = new URLSearchParams({
        amount: String(Math.round(amount * 100)),
        currency,
        destination: acct.stripe_account_id,
        description: `Payroll ${pay_run_id}`,
      });
      const res = await fetch('https://api.stripe.com/v1/transfers', {
        method: 'POST',
        headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });
      const tr = await res.json();
      if (!res.ok) { results.push({ stub_id: s.id, error: tr?.error?.message }); continue; }

      await admin.from('stripe_payouts_to_vendor').insert({
        org_id: organization_id,
        source_type: 'pay_run',
        source_id: pay_run_id,
        connected_account_id: acct.id,
        employee_id: s.employee_id,
        stripe_transfer_id: tr.id,
        amount, currency: currency.toUpperCase(),
        status: 'pending', initiated_by: user.id, metadata: { transfer: tr, stub_id: s.id },
      });
      results.push({ stub_id: s.id, transfer_id: tr.id });
    }

    await admin.from('pay_runs').update({ status: 'paid' }).eq('id', pay_run_id);
    return json({ ok: true, results });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
