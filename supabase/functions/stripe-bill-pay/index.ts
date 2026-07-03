// Pay a bill via Stripe Connect transfer to a vendor's connected account
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface Body {
  organization_id: string;
  bill_id: string;
  connected_account_id?: string; // override; otherwise resolved from vendor
  amount?: number;               // partial pay; otherwise full balance
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
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = (await req.json()) as Body;
    if (!body.organization_id || !body.bill_id) return json({ error: 'Missing fields' }, 400);

    const { data: member } = await admin.rpc('is_org_member', { _user_id: user.id, _org_id: body.organization_id });
    if (!member) return json({ error: 'Forbidden' }, 403);

    const { data: bill, error: bErr } = await admin.from('bills').select('*').eq('id', body.bill_id).maybeSingle();
    if (bErr || !bill) return json({ error: 'Bill not found' }, 404);
    if (bill.status === 'paid') return json({ error: 'Bill already paid' }, 409);

    // Resolve connected account
    let connectedId = body.connected_account_id ?? bill.stripe_connected_account_id;
    if (!connectedId && bill.vendor_id) {
      const { data: vsc } = await admin.from('vendor_stripe_connect')
        .select('connected_account_id').eq('vendor_id', bill.vendor_id).maybeSingle();
      connectedId = vsc?.connected_account_id ?? null;
    }
    if (!connectedId) return json({ error: 'No Stripe connected account resolved for vendor' }, 400);

    const { data: acct } = await admin.from('stripe_connected_accounts').select('*').eq('id', connectedId).maybeSingle();
    if (!acct) return json({ error: 'Connected account not found' }, 404);

    const amount = body.amount ?? Number(bill.balance_due ?? bill.total ?? 0);
    if (amount <= 0) return json({ error: 'Nothing to pay' }, 400);
    const currency = (bill.currency ?? 'USD').toLowerCase();

    // Create Stripe transfer
    const params = new URLSearchParams({
      amount: String(Math.round(amount * 100)),
      currency,
      destination: acct.stripe_account_id,
      description: `Bill ${bill.bill_number ?? bill.id}`,
    });
    const res = await fetch('https://api.stripe.com/v1/transfers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const tr = await res.json();
    if (!res.ok) return json({ error: tr?.error?.message ?? 'Transfer failed' }, 500);

    const { data: payoutRow } = await admin.from('stripe_payouts_to_vendor').insert({
      org_id: body.organization_id,
      source_type: 'bill',
      source_id: bill.id,
      connected_account_id: acct.id,
      vendor_id: bill.vendor_id,
      stripe_transfer_id: tr.id,
      amount,
      currency: currency.toUpperCase(),
      status: 'pending',
      initiated_by: user.id,
      metadata: tr,
    }).select('*').single();

    // Mark bill paid (or partially paid)
    const newBalance = Math.max(0, Number(bill.balance_due ?? bill.total ?? 0) - amount);
    await admin.from('bills').update({
      status: newBalance <= 0.01 ? 'paid' : 'partially_paid',
      balance_due: newBalance,
      amount_paid: Number(bill.amount_paid ?? 0) + amount,
    }).eq('id', bill.id);

    return json({ ok: true, payout: payoutRow, transfer_id: tr.id });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
