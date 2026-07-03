// Generate 1099-K filing drafts per connected account for a tax year
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { organization_id, tax_year } = await req.json();
    if (!organization_id || !tax_year) return json({ error: 'Missing fields' }, 400);
    const { data: member } = await admin.rpc('is_org_member', { _user_id: user.id, _org_id: organization_id });
    if (!member) return json({ error: 'Forbidden' }, 403);

    const start = `${tax_year}-01-01`;
    const end = `${tax_year}-12-31`;

    const { data: accts } = await admin.from('stripe_connected_accounts')
      .select('id').eq('organization_id', organization_id);
    const results: any[] = [];
    for (const a of accts ?? []) {
      const { data: payouts } = await admin.from('stripe_payout_ledger')
        .select('gross_amount, fees, net_amount')
        .eq('connected_account_id', a.id)
        .gte('arrival_date', start).lte('arrival_date', end);
      const gross = (payouts ?? []).reduce((s, p) => s + Number(p.gross_amount ?? 0), 0);
      const count = (payouts ?? []).length;
      const threshold = 600; // CY 2024+ federal threshold
      const status = gross >= threshold ? 'ready' : 'below_threshold';
      const { data: row } = await admin.from('stripe_1099k_filings').upsert({
        org_id: organization_id,
        connected_account_id: a.id,
        tax_year,
        gross_amount: gross,
        transaction_count: count,
        filing_status: status,
      }, { onConflict: 'connected_account_id,tax_year' }).select('*').single();
      results.push(row);
    }
    return json({ ok: true, filings: results });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
