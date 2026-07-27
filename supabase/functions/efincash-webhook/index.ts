import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    console.log('[efincash-webhook] event:', JSON.stringify(body));

    const data = body?.data ?? body ?? {};
    const userKey: string | null = data.user_key ?? body.user_key ?? null;
    const providerAccountId: string | null =
      data.id ?? data.reference ?? data.order_ref ?? body.reference ?? null;

    if (!userKey && !providerAccountId) {
      return new Response(JSON.stringify({ ok: true, note: 'no identifier' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const query = admin.from('virtual_accounts').select('id').limit(1);
    const { data: row } = userKey
      ? await query.eq('user_key', userKey).maybeSingle()
      : await query.eq('provider_account_id', String(providerAccountId)).maybeSingle();

    if (!row) {
      return new Response(JSON.stringify({ ok: true, note: 'no matching account' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accountNumber = data.account_number ?? data.accountNumber ?? data.virtual_account_number ?? null;
    const bankName = data.bank_name ?? data.bankName ?? null;
    const accountName = data.account_name ?? data.accountName ?? null;
    const statusRaw = (data.status ?? body.status ?? '').toString().toLowerCase();
    const status = statusRaw.includes('fail') ? 'failed'
      : statusRaw.includes('active') || accountNumber ? 'active'
      : 'pending';

    await admin.from('virtual_accounts').update({
      account_number: accountNumber ?? undefined,
      bank_name: bankName ?? undefined,
      account_name: accountName ?? undefined,
      provider_account_id: providerAccountId ? String(providerAccountId) : undefined,
      status,
      raw_response: body,
    }).eq('id', row.id);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[efincash-webhook] error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
