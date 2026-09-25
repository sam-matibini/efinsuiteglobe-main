// Treasury payment webhook (public). Receives Stripe/Plaid notifications and flips
// tax_payments / ap_payment_batch_items to paid/failed, posting JE accordingly.
// Idempotent on provider_transfer_id.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

async function verifyStripeSignature(body: string, signature: string | null, secret: string) {
  if (!signature) return false;
  // Stripe signature scheme: t=timestamp,v1=hex
  const parts = Object.fromEntries(signature.split(',').map(p => p.split('=')));
  const t = parts['t']; const v1 = parts['v1'];
  if (!t || !v1) return false;
  const payload = `${t}.${body}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hex === v1;
}

async function postReversalJE(supabase: any, originalJeId: string, orgId: string) {
  const { data: original } = await supabase
    .from('journal_entries').select('*').eq('id', originalJeId).single();
  if (!original) return null;
  const { data: lines } = await supabase
    .from('journal_entry_lines').select('*').eq('journal_entry_id', originalJeId);

  const { data: all } = await supabase
    .from('journal_entries').select('reference').eq('organization_id', orgId).like('reference', 'JE-%');
  let maxNum = 0;
  for (const e of all ?? []) {
    const m = e.reference?.match(/JE-(\d+)$/);
    if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; }
  }
  const ref = `JE-${String(maxNum + 1).padStart(4, '0')}`;

  const { data: rev } = await supabase.from('journal_entries').insert([{
    organization_id: orgId,
    entry_date: new Date().toISOString().slice(0, 10),
    reference: ref,
    description: `Reversal of ${original.reference} (payment failed)`,
    journal_type: 'manual',
    status: 'draft',
    reversal_of: originalJeId,
  }]).select().single();

  await supabase.from('journal_entry_lines').insert(
    (lines ?? []).map((l: any, i: number) => ({
      journal_entry_id: rev.id,
      account_id: l.account_id,
      debit: Number(l.credit) || 0,
      credit: Number(l.debit) || 0,
      description: `Reversal: ${l.description ?? ''}`,
      line_order: i,
      vendor_id: l.vendor_id,
    }))
  );
  await supabase.from('journal_entries').update({ status: 'posted' }).eq('id', rev.id);
  await supabase.from('journal_entries').update({ status: 'reversed', reversed_at: new Date().toISOString() }).eq('id', originalJeId);
  return rev.id;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');
    const provider = req.headers.get('x-treasury-provider') ?? (signature ? 'stripe' : 'manual');

    let event: any;
    if (provider === 'stripe') {
      const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
      if (secret) {
        const valid = await verifyStripeSignature(body, signature, secret);
        if (!valid) {
          return new Response(JSON.stringify({ error: 'Invalid signature' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      event = JSON.parse(body);
    } else {
      // Plaid / manual confirmation - body is { provider_ref, outcome }
      event = JSON.parse(body);
    }

    // Extract provider reference & outcome
    let providerRef: string | null = null;
    let outcome: 'success' | 'failed' | 'unknown' = 'unknown';
    let failureMsg: string | null = null;

    if (provider === 'stripe') {
      const obj = event?.data?.object ?? {};
      providerRef = obj.id;
      if (event.type === 'payment_intent.succeeded') outcome = 'success';
      else if (event.type === 'payment_intent.payment_failed') {
        outcome = 'failed';
        failureMsg = obj.last_payment_error?.message ?? 'Payment failed';
      } else {
        return new Response(JSON.stringify({ received: true, ignored: event.type }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else {
      providerRef = event.provider_ref;
      outcome = event.outcome === 'success' ? 'success' : 'failed';
      failureMsg = event.failure_message ?? null;
    }

    if (!providerRef) {
      return new Response(JSON.stringify({ error: 'No provider_ref' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Try to find a tax_payment
    const { data: tax } = await supabase
      .from('tax_payments').select('*').eq('provider_transfer_id', providerRef).maybeSingle();

    if (tax) {
      // Idempotency
      if (['paid', 'failed', 'reversed'].includes(tax.status)) {
        return new Response(JSON.stringify({ received: true, idempotent: true }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (outcome === 'success') {
        if (tax.journal_entry_id) {
          await supabase.from('journal_entries').update({ status: 'posted', posted_at: new Date().toISOString() }).eq('id', tax.journal_entry_id);
        }
        await supabase.from('tax_payments').update({
          status: 'paid', paid_at: new Date().toISOString(), confirmation_number: providerRef
        }).eq('id', tax.id);
      } else {
        if (tax.journal_entry_id) await postReversalJE(supabase, tax.journal_entry_id, tax.organization_id);
        await supabase.from('tax_payments').update({
          status: 'failed', notes: `${tax.notes ?? ''}\nFailure: ${failureMsg}`.trim()
        }).eq('id', tax.id);
      }
      await supabase.from('treasury_payment_audit').insert({
        organization_id: tax.organization_id, entity_type: 'tax_payment', entity_id: tax.id,
        action: outcome === 'success' ? 'webhook_paid' : 'webhook_failed',
        ip_address: req.headers.get('x-forwarded-for') ?? null,
        after_state: { provider_ref: providerRef, failure: failureMsg },
      });
      return new Response(JSON.stringify({ received: true, kind: 'tax_payment', outcome }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Or an AP batch item
    const { data: item } = await supabase
      .from('ap_payment_batch_items').select('*').eq('provider_transfer_id', providerRef).maybeSingle();
    if (item) {
      if (['completed', 'failed', 'reversed'].includes(item.status)) {
        return new Response(JSON.stringify({ received: true, idempotent: true }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (outcome === 'success') {
        if (item.journal_entry_id) {
          await supabase.from('journal_entries').update({ status: 'posted', posted_at: new Date().toISOString() }).eq('id', item.journal_entry_id);
        }
        await supabase.from('ap_payment_batch_items').update({ status: 'completed' }).eq('id', item.id);
        // Update bill
        if (item.bill_id) {
          const { data: bill } = await supabase.from('bills').select('total, amount_paid').eq('id', item.bill_id).single();
          if (bill) {
            const newPaid = Number(bill.amount_paid ?? 0) + Number(item.amount);
            const newStatus = newPaid >= Number(bill.total) ? 'paid' : 'partial';
            await supabase.from('bills').update({ amount_paid: newPaid, balance_due: Number(bill.total) - newPaid, status: newStatus, paid_at: newStatus === 'paid' ? new Date().toISOString() : null }).eq('id', item.bill_id);
          }
        }
      } else {
        if (item.journal_entry_id) {
          const { data: itemRow } = await supabase.from('ap_payment_batch_items').select('batch_id').eq('id', item.id).single();
          const { data: b } = await supabase.from('ap_payment_batches').select('organization_id').eq('id', itemRow?.batch_id).single();
          if (b) await postReversalJE(supabase, item.journal_entry_id, b.organization_id);
        }
        await supabase.from('ap_payment_batch_items').update({ status: 'failed', failure_reason: failureMsg }).eq('id', item.id);
      }
      // Rollup batch status
      const { data: siblings } = await supabase.from('ap_payment_batch_items').select('status').eq('batch_id', item.batch_id);
      const allDone = (siblings ?? []).every((s: any) => ['completed', 'failed', 'cancelled', 'reversed'].includes(s.status));
      if (allDone) {
        const anyFailed = (siblings ?? []).some((s: any) => s.status === 'failed');
        const allFailed = (siblings ?? []).every((s: any) => s.status === 'failed');
        const status = allFailed ? 'failed' : (anyFailed ? 'partial' : 'completed');
        await supabase.from('ap_payment_batches').update({ status, completed_at: new Date().toISOString() }).eq('id', item.batch_id);
      }
      return new Response(JSON.stringify({ received: true, kind: 'ap_item', outcome }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ received: true, unmatched: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('treasury-payment-webhook error:', msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
