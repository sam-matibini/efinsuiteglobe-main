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
    const eventName: string = (body?.event ?? body?.type ?? data?.event ?? data?.type ?? '')
      .toString()
      .toLowerCase();

    const userKey: string | null = data.user_key ?? body.user_key ?? null;
    const providerAccountId: string | null =
      data.id ?? data.reference ?? data.order_ref ?? body.reference ?? null;

    if (!userKey && !providerAccountId) {
      return new Response(JSON.stringify({ ok: true, note: 'no identifier' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Look up the virtual account row
    const baseSel = admin.from('virtual_accounts').select('id, organization_id, currency, balance').limit(1);
    const { data: row } = userKey
      ? await baseSel.eq('user_key', userKey).maybeSingle()
      : await baseSel.eq('provider_account_id', String(providerAccountId)).maybeSingle();

    if (!row) {
      return new Response(JSON.stringify({ ok: true, note: 'no matching account' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- Detect event type ----
    const amountRaw = data.amount ?? data.amount_settled ?? body.amount ?? null;
    const hasAmount = amountRaw !== null && amountRaw !== undefined && !isNaN(Number(amountRaw));
    const looksLikeTx =
      hasAmount ||
      /charge|transfer|credit|debit|deposit|payment|inflow|outflow/.test(eventName);
    const looksLikeAccount =
      !hasAmount && /account|virtual|created|provision/.test(eventName);

    // ---- Account provisioning branch (existing behavior) ----
    if (looksLikeAccount || (!looksLikeTx && !hasAmount)) {
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

      return new Response(JSON.stringify({ ok: true, kind: 'account_update' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- Transaction branch ----
    const amount = Number(amountRaw);
    const currency = (data.currency ?? row.currency ?? '').toString();
    const statusRaw = (data.status ?? body.status ?? 'successful').toString().toLowerCase();
    const status = statusRaw.includes('fail') ? 'failed'
      : statusRaw.includes('pend') ? 'pending'
      : 'successful';

    const isDebit = /debit|outflow|withdraw|payout/.test(eventName) ||
      /debit|outflow|withdraw/.test((data.type ?? '').toString().toLowerCase());
    const type: 'credit' | 'debit' = isDebit ? 'debit' : 'credit';

    const providerTxId: string | null =
      data.id ?? data.tx_ref ?? data.reference ?? data.flw_ref ?? body.reference ?? null;

    const senderName = data.customer?.name ?? data.meta?.originatorname ?? data.sender_name ?? null;
    const senderBank = data.meta?.bankname ?? data.sender_bank ?? null;
    const senderAccount = data.meta?.originatoraccountnumber ?? data.sender_account ?? null;
    const narration = data.narration ?? data.description ?? data.remark ?? null;
    const occurredAt = data.created_at ?? data.transaction_date ?? new Date().toISOString();

    // Idempotency: has this provider_tx_id already been recorded?
    let alreadyRecorded = false;
    if (providerTxId) {
      const { data: existing } = await admin
        .from('virtual_account_transactions')
        .select('id')
        .eq('virtual_account_id', row.id)
        .eq('provider_tx_id', String(providerTxId))
        .maybeSingle();
      alreadyRecorded = !!existing;
    }

    if (!alreadyRecorded) {
      const { error: insErr } = await admin.from('virtual_account_transactions').insert({
        virtual_account_id: row.id,
        organization_id: row.organization_id,
        provider_tx_id: providerTxId ? String(providerTxId) : null,
        type,
        amount: Math.abs(amount),
        currency,
        status,
        narration,
        sender_name: senderName,
        sender_bank: senderBank,
        sender_account: senderAccount,
        raw_payload: body,
        occurred_at: occurredAt,
      });
      if (insErr) {
        console.error('[efincash-webhook] insert tx error', insErr);
      } else if (status === 'successful') {
        // Atomic balance update via SQL
        const delta = type === 'credit' ? Math.abs(amount) : -Math.abs(amount);
        const newBalance = Number(row.balance ?? 0) + delta;
        const { error: balErr } = await admin
          .from('virtual_accounts')
          .update({ balance: newBalance })
          .eq('id', row.id);
        if (balErr) console.error('[efincash-webhook] balance update error', balErr);
      }
    }

    return new Response(JSON.stringify({ ok: true, kind: 'transaction', duplicate: alreadyRecorded }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[efincash-webhook] error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
