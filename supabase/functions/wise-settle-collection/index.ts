// Settle a captured invoice card payment to the organization's Wise destination.
//
// Normally invoked internally right after capture (see paysafe-charge-handle /
// stripe-webhook). Also callable by an org member to retry a failed settlement.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { settleCollectionToWise } from '../_shared/wise-settlement.ts';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const orgId = body?.organization_id as string | undefined;
    const paymentLinkId = (body?.payment_link_id as string) ?? null;
    const invoiceId = (body?.invoice_id as string) ?? null;
    const amount = Number(body?.amount ?? 0);
    const currency = String(body?.currency ?? 'CAD').toUpperCase();
    const reference = String(body?.reference ?? `SETTLE-${Date.now().toString(36).toUpperCase()}`);

    if (!orgId) return json({ error: 'organization_id is required' }, 400);
    if (!paymentLinkId && !invoiceId) return json({ error: 'payment_link_id or invoice_id is required' }, 400);
    if (!(amount > 0)) return json({ error: 'Amount must be greater than zero' }, 400);

    const { data: member } = await admin.rpc('is_org_member', { _user_id: user.id, _org_id: orgId });
    if (!member) return json({ error: 'Forbidden' }, 403);

    const result = await settleCollectionToWise(admin, {
      organizationId: orgId,
      amount,
      currency,
      reference,
      invoiceId,
      paymentLinkId,
      sourceLabel: 'manual_retry',
    });

    return json(result, result.error && !result.settled ? 502 : 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('wise-settle-collection error', msg);
    return json({ error: msg }, 500);
  }
});
