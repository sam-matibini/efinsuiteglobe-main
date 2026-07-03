// Reimburse an approved expense claim via Stripe Connect transfer
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

    const { organization_id, expense_claim_id, connected_account_id } = await req.json();
    if (!organization_id || !expense_claim_id) return json({ error: 'Missing fields' }, 400);

    const { data: member } = await admin.rpc('is_org_member', { _user_id: user.id, _org_id: organization_id });
    if (!member) return json({ error: 'Forbidden' }, 403);

    const { data: claim } = await admin.from('expense_claims').select('*').eq('id', expense_claim_id).maybeSingle();
    if (!claim) return json({ error: 'Expense claim not found' }, 404);
    if (claim.status !== 'approved') return json({ error: 'Claim is not approved' }, 409);

    let connectedId = connected_account_id ?? claim.stripe_connected_account_id;
    if (!connectedId && claim.employee_id) {
      const { data: esc } = await admin.from('employee_stripe_connect')
        .select('connected_account_id').eq('employee_id', claim.employee_id).maybeSingle();
      connectedId = esc?.connected_account_id;
    }
    if (!connectedId) return json({ error: 'No Stripe connected account for employee' }, 400);

    const { data: acct } = await admin.from('stripe_connected_accounts').select('*').eq('id', connectedId).maybeSingle();
    if (!acct) return json({ error: 'Connected account not found' }, 404);

    const amount = Number(claim.total_amount ?? 0);
    if (amount <= 0) return json({ error: 'Nothing to reimburse' }, 400);
    const currency = (claim.currency ?? 'USD').toLowerCase();

    const params = new URLSearchParams({
      amount: String(Math.round(amount * 100)),
      currency,
      destination: acct.stripe_account_id,
      description: `Expense reimbursement ${claim.claim_number ?? claim.id}`,
    });
    const res = await fetch('https://api.stripe.com/v1/transfers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const tr = await res.json();
    if (!res.ok) return json({ error: tr?.error?.message ?? 'Transfer failed' }, 500);

    const { data: row } = await admin.from('stripe_payouts_to_vendor').insert({
      org_id: organization_id,
      source_type: 'expense_claim',
      source_id: claim.id,
      connected_account_id: acct.id,
      employee_id: claim.employee_id,
      stripe_transfer_id: tr.id,
      amount, currency: currency.toUpperCase(),
      status: 'pending', initiated_by: user.id, metadata: tr,
    }).select('*').single();

    await admin.from('expense_claims').update({ status: 'paid' }).eq('id', claim.id);

    return json({ ok: true, payout: row });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
