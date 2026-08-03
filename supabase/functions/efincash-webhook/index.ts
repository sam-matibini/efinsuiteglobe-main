import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { unwrap, mapAccountFields, mapTxFields } from '../_shared/efincash.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({} as any));
    console.log('[efincash-webhook] event:', JSON.stringify(body));

    const eventName: string = (body?.event ?? body?.type ?? '')
      .toString()
      .toLowerCase();

    const { d } = unwrap(body);

    const providerAccountId: string | null =
      d.id ?? d.reference ?? d.order_ref ?? body.reference ?? null;
    const accountNumberLookup: string | null =
      d.account_number ?? d.accountNumber ?? d.virtual_account_number ?? null;

    if (!providerAccountId && !accountNumberLookup) {
      return new Response(JSON.stringify({ ok: true, note: 'no identifier' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Look up the virtual account row by provider_account_id then account_number
    let row: any = null;
    if (providerAccountId) {
      const { data } = await admin
        .from('virtual_accounts')
        .select('id, organization_id, currency, balance')
        .eq('provider_account_id', String(providerAccountId))
        .maybeSingle();
      row = data;
    }
    if (!row && accountNumberLookup) {
      const { data } = await admin
        .from('virtual_accounts')
        .select('id, organization_id, currency, balance')
        .eq('account_number', String(accountNumberLookup))
        .maybeSingle();
      row = data;
    }

    if (!row) {
      return new Response(JSON.stringify({ ok: true, note: 'no matching account' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- Detect event type ----
    const rawAmount = d.amount ?? d.amount_settled ?? null;
    const hasAmount =
      rawAmount !== null && rawAmount !== undefined && !isNaN(Number(rawAmount)) && Number(rawAmount) !== 0;
    const looksLikeTx =
      hasAmount || /charge|transfer|credit|debit|deposit|payment|inflow|outflow/.test(eventName);
    const looksLikeAccount =
      !hasAmount && /account|virtual|created|provision/.test(eventName);

    // ---- Account provisioning / update branch ----
    if (looksLikeAccount || !looksLikeTx) {
      const fields = mapAccountFields(d);
      const status = fields.status_raw.includes('fail')
        ? 'failed'
        : fields.status_raw === 'active' || fields.account_number
        ? 'active'
        : 'pending';

      await admin.from('virtual_accounts').update({
        account_number: fields.account_number ?? undefined,
        bank_name: fields.bank_name ?? undefined,
        account_name: fields.account_name ?? undefined,
        provider_account_id: fields.provider_account_id ?? undefined,
        currency: fields.currency ?? undefined,
        status,
        raw_response: body,
      }).eq('id', row.id);

      return new Response(JSON.stringify({ ok: true, kind: 'account_update' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- Transaction branch ----
    const tx = mapTxFields(d, eventName);
    const amount = tx.amount ?? 0;
    const currency = tx.currency ?? row.currency ?? '';

    // Idempotency: has this provider_tx_id already been recorded?
    let alreadyRecorded = false;
    if (tx.provider_tx_id) {
      const { data: existing } = await admin
        .from('virtual_account_transactions')
        .select('id')
        .eq('virtual_account_id', row.id)
        .eq('provider_tx_id', tx.provider_tx_id)
        .maybeSingle();
      alreadyRecorded = !!existing;
    }

    if (!alreadyRecorded) {
      const { error: insErr } = await admin.from('virtual_account_transactions').insert({
        virtual_account_id: row.id,
        organization_id: row.organization_id,
        provider_tx_id: tx.provider_tx_id,
        type: tx.type,
        amount: Math.abs(amount),
        currency,
        status: tx.status,
        narration: tx.narration,
        sender_name: tx.sender_name,
        sender_bank: tx.sender_bank,
        sender_account: tx.sender_account,
        raw_payload: body,
        occurred_at: tx.occurred_at,
      });
      if (insErr) {
        console.error('[efincash-webhook] insert tx error', insErr);
      } else if (tx.status === 'successful') {
        const delta = tx.type === 'credit' ? Math.abs(amount) : -Math.abs(amount);
        const newBalance = Number(row.balance ?? 0) + delta;
        const { error: balErr } = await admin
          .from('virtual_accounts')
          .update({ balance: newBalance })
          .eq('id', row.id);
        if (balErr) console.error('[efincash-webhook] balance update error', balErr);

        // Try to reconcile an incoming deposit against an open invoice using the
        // narration. When it matches we record the payment + journal entry
        // (balance was already moved above, so skip the credit).
        if (tx.type === 'credit') {
          try {
            const invoice = await matchInvoiceFromNarration(
              admin, row.organization_id, tx.narration, currency,
            );
            if (invoice) {
              const recorded = await recordInvoicePayment(admin, {
                invoice,
                amount: Math.abs(amount),
                currency,
                paymentDate: (tx.occurred_at ?? new Date().toISOString()).slice(0, 10),
                reference: tx.provider_tx_id ?? `EFC-${Date.now()}`,
                paymentMethod: 'efincash_bank_transfer',
                notes: `Auto-matched eFinCash deposit${tx.narration ? `: ${tx.narration}` : ''}`,
                skipVirtualAccountCredit: true,
              });
              console.log('[efincash-webhook] invoice match', invoice.id, recorded.status);
            }
          } catch (e) {
            console.error('[efincash-webhook] invoice reconcile error', (e as Error).message);
          }
        }
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
