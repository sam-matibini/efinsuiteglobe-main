// Create (or upsert) a Wise payout recipient for an organization.
// When WISE_API_TOKEN / WISE_PROFILE_ID are configured the recipient is also
// created at Wise; otherwise the row is stored locally so payouts can still be
// prepared and confirmed manually in Wise.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const WISE_API_BASE = Deno.env.get('WISE_API_BASE') ?? 'https://api.transferwise.com';

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

    const body = await req.json();
    const orgId = body?.organization_id as string | undefined;
    const r = body?.recipient as Record<string, unknown> | undefined;
    if (!orgId || !r?.account_holder_name) return json({ error: 'Missing organization_id or account holder' }, 400);

    const { data: member } = await admin.rpc('is_org_member', { _user_id: user.id, _org_id: orgId });
    if (!member) return json({ error: 'Forbidden' }, 403);

    const token = Deno.env.get('WISE_API_TOKEN');
    const profileId = Deno.env.get('WISE_PROFILE_ID');
    let wiseRecipientId: string | null = (r.wise_recipient_id as string) ?? null;

    if (token && profileId && !wiseRecipientId) {
      const currency = String(r.currency ?? 'CAD').toUpperCase();
      const details: Record<string, unknown> = { legalType: 'PRIVATE' };
      if (r.iban) details.IBAN = r.iban;
      if (r.account_number) details.accountNumber = r.account_number;
      if (r.routing_number) details.abartn = r.routing_number;
      if (r.sort_code) details.sortCode = r.sort_code;
      if (r.bic_swift) details.BIC = r.bic_swift;
      if (r.email ?? r.etransfer_email) details.email = r.etransfer_email;

      const res = await fetch(`${WISE_API_BASE}/v1/accounts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: Number(profileId),
          accountHolderName: r.account_holder_name,
          currency,
          type: r.iban ? 'iban' : r.sort_code ? 'sort_code' : r.routing_number ? 'aba' : 'email',
          details,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (res.ok && payload?.id) wiseRecipientId = String(payload.id);
      else console.warn('[wise-create-recipient] Wise API rejected recipient', payload);
    }

    const row = {
      organization_id: orgId,
      vendor_id: (r.vendor_id as string) ?? null,
      employee_id: (r.employee_id as string) ?? null,
      nickname: (r.nickname as string) ?? null,
      currency: String(r.currency ?? 'CAD').toUpperCase(),
      account_holder_name: r.account_holder_name,
      bank_name: (r.bank_name as string) ?? null,
      account_number: (r.account_number as string) ?? null,
      routing_number: (r.routing_number as string) ?? null,
      iban: (r.iban as string) ?? null,
      bic_swift: (r.bic_swift as string) ?? null,
      sort_code: (r.sort_code as string) ?? null,
      etransfer_email: (r.etransfer_email as string) ?? null,
      country: (r.country as string) ?? null,
      wise_recipient_id: wiseRecipientId,
      status: 'active',
      created_by: user.id,
    };

    const { data: saved, error } = r.id
      ? await admin.from('wise_payout_recipients').update(row).eq('id', r.id).select('*').single()
      : await admin.from('wise_payout_recipients').insert(row).select('*').single();
    if (error) return json({ error: error.message }, 500);

    return json({ recipient: saved, live: !!(token && profileId) });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
