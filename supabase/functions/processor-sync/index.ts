// Phase 6 — Pulls settlements, disputes, and reserves from a processor's live API.
// Stripe is wired end-to-end. Other providers are scaffolded but return "not implemented".
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface Body {
  processor_account_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Auth: either internal cron secret OR signed-in user
  const cronSecret = Deno.env.get('SETTLEMENT_CRON_SECRET');
  const providedSecret = req.headers.get('x-cron-secret');
  const isCron = cronSecret && providedSecret === cronSecret;

  let userId: string | null = null;
  if (!isCron) {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data, error } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (error || !data?.claims) return json({ error: 'Unauthorized' }, 401);
    userId = data.claims.sub;
  }

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!body.processor_account_id) return json({ error: 'Missing processor_account_id' }, 400);

  const { data: cred, error: cErr } = await admin
    .from('processor_api_credentials')
    .select('*, processor_account:processor_account_id(id,organization_id,display_name,processor,currency,expected_bank_account_id)')
    .eq('processor_account_id', body.processor_account_id)
    .single();
  if (cErr || !cred) return json({ error: 'Credential not configured' }, 404);

  const orgId = cred.processor_account.organization_id;
  const expectedBank = cred.processor_account.expected_bank_account_id ?? null;

  if (!isCron && userId) {
    const { data: member } = await admin.rpc('is_org_member' as any, { _user_id: userId, _org_id: orgId } as any);
    if (!member) return json({ error: 'Forbidden' }, 403);
  }

  if (cred.provider !== 'stripe') {
    await admin.from('processor_api_credentials')
      .update({ sync_status: 'error', last_error: `Provider ${cred.provider} not yet implemented` })
      .eq('id', cred.id);
    return json({ error: `Provider ${cred.provider} not yet implemented`, coming_soon: true }, 501);
  }

  const secretName = cred.credential_secret_name;
  if (!secretName) return json({ error: 'No credential secret configured' }, 400);
  const apiKey = Deno.env.get(secretName);
  if (!apiKey) return json({ error: `Secret ${secretName} not set` }, 400);

  let synced = { payouts: 0, disputes: 0, balance_transactions: 0 };

  try {
    // ----- Pull payouts (settlements) since cursor -----
    const cursorTs = cred.sync_cursor ? Number(cred.sync_cursor) : Math.floor(Date.now() / 1000) - 60 * 86400;
    const payoutsRes = await fetch(`https://api.stripe.com/v1/payouts?limit=100&created[gte]=${cursorTs}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const payoutsJson = await payoutsRes.json();
    if (!payoutsRes.ok) throw new Error(payoutsJson?.error?.message ?? 'Stripe payouts error');

    let latestTs = cursorTs;
    for (const payout of payoutsJson.data ?? []) {
      latestTs = Math.max(latestTs, payout.created);
      const settlementDate = new Date(payout.created * 1000).toISOString().slice(0, 10);
      const expectedDate = payout.arrival_date
        ? new Date(payout.arrival_date * 1000).toISOString().slice(0, 10)
        : null;
      const netAmt = (payout.amount ?? 0) / 100;
      const settlementRef = payout.id as string;
      const normalized = settlementRef.toUpperCase().replace(/[^A-Z0-9]/g, '');
      // Upsert settlement using settlements_processor_settlement_ref unique key
      await admin.from('settlements').upsert({
        organization_id: orgId,
        processor_account_id: cred.processor_account_id,
        settlement_ref: settlementRef,
        payout_ref: settlementRef,
        settlement_date: settlementDate,
        expected_deposit_date: expectedDate,
        gross_amount: netAmt,
        net_amount: netAmt,
        fees: 0,
        chargebacks: 0,
        refunds: 0,
        reserves: 0,
        currency: (payout.currency ?? 'usd').toUpperCase(),
        normalized_ref: normalized,
        source: 'stripe_api' as any,
        bank_account_id: expectedBank,
        raw_payload: payout as any,
      } as any, { onConflict: 'organization_id,processor_account_id,settlement_ref' });
      synced.payouts++;
    }

    // ----- Pull disputes -----
    const disputesRes = await fetch(`https://api.stripe.com/v1/disputes?limit=100&created[gte]=${cursorTs}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const disputesJson = await disputesRes.json();
    if (disputesRes.ok) {
      for (const d of disputesJson.data ?? []) {
        const status = mapStripeDisputeStatus(d.status);
        await admin.from('settlement_disputes').upsert({
          organization_id: orgId,
          processor_account_id: cred.processor_account_id,
          processor_dispute_id: d.id,
          original_transaction_id: d.charge,
          kind: d.status === 'warning_needs_response' ? 'inquiry' : 'chargeback',
          reason_code: d.reason,
          network_reason: d.network_reason_code ?? null,
          disputed_amount: (d.amount ?? 0) / 100,
          currency: (d.currency ?? 'usd').toUpperCase(),
          status,
          evidence_due_at: d.evidence_details?.due_by ? new Date(d.evidence_details.due_by * 1000).toISOString() : null,
        } as any, { onConflict: 'processor_account_id,processor_dispute_id' });
        synced.disputes++;
      }
    }

    await admin.from('processor_api_credentials').update({
      last_sync_at: new Date().toISOString(),
      sync_cursor: String(latestTs),
      sync_status: 'active',
      last_error: null,
    }).eq('id', cred.id);

    return json({ ok: true, synced });
  } catch (e: any) {
    await admin.from('processor_api_credentials').update({
      sync_status: 'error',
      last_error: e?.message ?? String(e),
    }).eq('id', cred.id);
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

function mapStripeDisputeStatus(s: string): string {
  switch (s) {
    case 'needs_response':
    case 'warning_needs_response':
      return 'needs_response';
    case 'under_review':
    case 'warning_under_review':
      return 'under_review';
    case 'won':
    case 'warning_closed':
      return 'won';
    case 'lost':
      return 'lost';
    case 'charge_refunded':
      return 'withdrawn';
    default:
      return 'under_review';
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
