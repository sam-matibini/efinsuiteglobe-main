// Create an outbound Wise payout (EFT / e-Transfer / card) for a bill, AP batch,
// payroll or tax remittance. Records the attempt in public.wise_transfers and,
// for bills, records the vendor payment so the bill balance is updated.
//
// If WISE_API_TOKEN / WISE_PROFILE_ID are not configured the transfer is stored
// with status `instructed` so the payment is still tracked and can be confirmed
// manually in Wise.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const WISE_API_BASE = Deno.env.get('WISE_API_BASE') ?? 'https://api.transferwise.com';
const METHODS = new Set(['eft', 'etransfer', 'card']);
const SOURCES = new Set(['bill', 'ap_batch', 'payroll', 'tax', 'payment_link', 'manual']);

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
    const method = String(body?.method ?? 'eft');
    const sourceType = String(body?.source_type ?? 'manual');
    const amount = Number(body?.amount ?? 0);
    const currency = String(body?.currency ?? 'CAD').toUpperCase();

    if (!orgId) return json({ error: 'organization_id is required' }, 400);
    if (!METHODS.has(method)) return json({ error: 'Invalid payout method' }, 400);
    if (!SOURCES.has(sourceType)) return json({ error: 'Invalid source type' }, 400);
    if (!(amount > 0)) return json({ error: 'Amount must be greater than zero' }, 400);

    const { data: member } = await admin.rpc('is_org_member', { _user_id: user.id, _org_id: orgId });
    if (!member) return json({ error: 'Forbidden' }, 403);

    // Resolve or create the recipient
    let recipientId = (body?.recipient_id as string) ?? null;
    let recipient: Record<string, unknown> | null = null;
    if (recipientId) {
      const { data } = await admin.from('wise_payout_recipients').select('*')
        .eq('id', recipientId).eq('organization_id', orgId).maybeSingle();
      recipient = data ?? null;
      if (!recipient) return json({ error: 'Recipient not found' }, 404);
    } else if (body?.recipient?.account_holder_name) {
      const r = body.recipient as Record<string, unknown>;
      const { data, error } = await admin.from('wise_payout_recipients').insert({
        organization_id: orgId,
        vendor_id: r.vendor_id ?? null,
        employee_id: r.employee_id ?? null,
        currency,
        account_holder_name: r.account_holder_name,
        bank_name: r.bank_name ?? null,
        account_number: r.account_number ?? null,
        routing_number: r.routing_number ?? null,
        iban: r.iban ?? null,
        bic_swift: r.bic_swift ?? null,
        sort_code: r.sort_code ?? null,
        etransfer_email: r.etransfer_email ?? null,
        country: r.country ?? null,
        created_by: user.id,
      }).select('*').single();
      if (error) return json({ error: error.message }, 500);
      recipient = data;
      recipientId = data.id;
    }

    const reference = (body?.reference as string) ?? `WISE-${Date.now().toString(36).toUpperCase()}`;
    const token = Deno.env.get('WISE_API_TOKEN');
    const profileId = Deno.env.get('WISE_PROFILE_ID');

    let status = 'instructed';
    let quoteId: string | null = null;
    let transferId: string | null = null;
    let errorMessage: string | null = null;

    if (token && profileId && recipient?.wise_recipient_id) {
      try {
        const quoteRes = await fetch(`${WISE_API_BASE}/v3/profiles/${profileId}/quotes`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceCurrency: currency,
            targetCurrency: recipient.currency ?? currency,
            sourceAmount: amount,
            payOut: method === 'card' ? 'BANK_TRANSFER' : 'BANK_TRANSFER',
            targetAccount: Number(recipient.wise_recipient_id),
          }),
        });
        const quote = await quoteRes.json().catch(() => ({}));
        if (!quoteRes.ok) throw new Error(quote?.errors?.[0]?.message ?? 'Wise quote failed');
        quoteId = String(quote.id);

        const transferRes = await fetch(`${WISE_API_BASE}/v1/transfers`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetAccount: Number(recipient.wise_recipient_id),
            quoteUuid: quoteId,
            customerTransactionId: crypto.randomUUID(),
            details: { reference: reference.slice(0, 35) },
          }),
        });
        const transfer = await transferRes.json().catch(() => ({}));
        if (!transferRes.ok) throw new Error(transfer?.errors?.[0]?.message ?? 'Wise transfer failed');
        transferId = String(transfer.id);

        const fundRes = await fetch(`${WISE_API_BASE}/v3/profiles/${profileId}/transfers/${transferId}/payments`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'BALANCE' }),
        });
        status = fundRes.ok ? 'processing' : 'funding_failed';
        if (!fundRes.ok) {
          const fp = await fundRes.json().catch(() => ({}));
          errorMessage = fp?.errors?.[0]?.message ?? 'Wise funding failed';
        }
      } catch (e) {
        status = 'failed';
        errorMessage = e instanceof Error ? e.message : String(e);
      }
    }

    const { data: row, error: insErr } = await admin.from('wise_transfers').insert({
      organization_id: orgId,
      source_type: sourceType,
      source_id: (body?.source_id as string) ?? null,
      recipient_id: recipientId,
      method,
      amount,
      currency,
      reference,
      wise_quote_id: quoteId,
      wise_transfer_id: transferId,
      status,
      error: errorMessage,
      created_by: user.id,
    }).select('*').single();
    if (insErr) return json({ error: insErr.message }, 500);

    // Record the vendor payment for bills so the balance and status stay correct.
    if (sourceType === 'bill' && body?.source_id && status !== 'failed') {
      const { data: bill } = await admin.from('bills')
        .select('id, vendor_id, total, amount_paid, balance_due')
        .eq('id', body.source_id).maybeSingle();
      if (bill) {
        await admin.from('vendor_payments').insert({
          organization_id: orgId,
          vendor_id: bill.vendor_id,
          bill_id: bill.id,
          amount,
          payment_date: new Date().toISOString().slice(0, 10),
          payment_method: `wise_${method}`,
          reference,
        });
        const newPaid = Number(bill.amount_paid ?? 0) + amount;
        const newBalance = Math.max(0, Number(bill.total ?? 0) - newPaid);
        await admin.from('bills').update({
          amount_paid: newPaid,
          balance_due: newBalance,
          status: newBalance <= 0.01 ? 'paid' : 'partial',
          paid_at: newBalance <= 0.01 ? new Date().toISOString() : null,
        }).eq('id', bill.id);
      }
    }

    if (errorMessage && status === 'failed') return json({ error: errorMessage, transfer: row }, 502);
    return json({ transfer: row, live: !!(token && profileId && recipient?.wise_recipient_id) });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
