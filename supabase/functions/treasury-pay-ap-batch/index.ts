// Treasury - Process an AP payment batch
// Iterates pending items, posts a draft JE per item (DR AP / CR Bank),
// optionally initiates external rail, creates vendor_payments rows.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function nextJournalReference(supabase: any, orgId: string): Promise<string> {
  const { data } = await supabase
    .from('journal_entries').select('reference')
    .eq('organization_id', orgId).like('reference', 'JE-%');
  let maxNum = 0;
  for (const e of data ?? []) {
    const m = e.reference?.match(/JE-(\d+)$/);
    if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; }
  }
  return `JE-${String(maxNum + 1).padStart(4, '0')}`;
}

async function postJournalEntry(supabase: any, orgId: string, date: string, description: string,
  lines: Array<{ account_id: string; debit?: number; credit?: number; description?: string; vendor_id?: string }>) {
  const reference = await nextJournalReference(supabase, orgId);
  const { data: je, error } = await supabase
    .from('journal_entries')
    .insert([{ organization_id: orgId, entry_date: date, reference, description, journal_type: 'manual', status: 'draft' }])
    .select().single();
  if (error) throw error;
  const { error: linesErr } = await supabase.from('journal_entry_lines').insert(
    lines.map((l, i) => ({
      journal_entry_id: je.id,
      account_id: l.account_id,
      debit: l.debit ?? 0,
      credit: l.credit ?? 0,
      description: l.description ?? null,
      line_order: i,
      vendor_id: l.vendor_id ?? null,
    }))
  );
  if (linesErr) {
    await supabase.from('journal_entries').delete().eq('id', je.id);
    throw linesErr;
  }
  return je;
}

async function initiateStripeTransfer(
  amount: number, currency: string, description: string, idem: string,
  stripeBankAccountId: string | null
) {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  const body = new URLSearchParams({
    amount: String(Math.round(amount * 100)),
    currency: currency.toLowerCase(),
    description,
  });
  if (stripeBankAccountId) {
    body.append('payment_method_types[]', 'us_bank_account');
    body.append('payment_method_data[type]', 'us_bank_account');
    body.append('payment_method_data[us_bank_account][financial_connections_account]', stripeBankAccountId);
    body.append('confirm', 'true');
  } else {
    body.append('payment_method_types[]', 'card');
  }
  const res = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': idem },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe error: ${data?.error?.message ?? res.status}`);
  return data.id as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: cErr } = await supabase.auth.getClaims(token);
    if (cErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = claims.claims.sub;

    const { batch_id } = await req.json();
    if (!batch_id) {
      return new Response(JSON.stringify({ error: 'batch_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: batch, error: bErr } = await supabase
      .from('ap_payment_batches').select('*').eq('id', batch_id).single();
    if (bErr || !batch) {
      return new Response(JSON.stringify({ error: 'Batch not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!['draft', 'approved'].includes(batch.status)) {
      return new Response(JSON.stringify({ error: `Cannot process batch in status ${batch.status}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (batch.approval_state && batch.approval_state !== 'approved') {
      return new Response(JSON.stringify({ error: 'Batch is not approved yet. Complete the review/approval workflow first.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!batch.funding_bank_account_id) {
      return new Response(JSON.stringify({ error: 'Funding bank account required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: bank } = await supabase
      .from('bank_accounts')
      .select('id, name, gl_account_id, stripe_bank_account_id, plaid_access_token')
      .eq('id', batch.funding_bank_account_id).single();
    if (!bank?.gl_account_id) {
      return new Response(JSON.stringify({ error: 'Bank missing GL link' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (batch.provider === 'plaid' && !bank.stripe_bank_account_id) {
      return new Response(JSON.stringify({ error: 'Enable Stripe ACH on this bank account first (Treasury Settings → Funding Bank Accounts).' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: items } = await supabase
      .from('ap_payment_batch_items').select('*').eq('batch_id', batch_id).eq('status', 'pending');

    let successCount = 0;
    let failCount = 0;
    const results: any[] = [];

    // Flip batch to processing
    await supabase.from('ap_payment_batches').update({
      status: 'processing', submitted_at: new Date().toISOString(), submitted_by: userId,
    }).eq('id', batch_id);

    for (const item of items ?? []) {
      try {
        // Load bill to get AP account
        const { data: bill } = await supabase
          .from('bills').select('id, ap_account_id, bill_number, vendor_id, amount_paid, total').eq('id', item.bill_id).single();
        if (!bill?.ap_account_id) throw new Error('Bill missing AP account');

        // External rail
        let providerRef: string | null = null;
        if (batch.provider === 'stripe') {
          providerRef = await initiateStripeTransfer(
            Number(item.amount), item.currency, `AP payment ${batch.batch_number}`,
            `apb-${item.id}`, bank.stripe_bank_account_id ?? null
          );
        } else if (batch.provider === 'plaid') {
          providerRef = await initiateStripeTransfer(
            Number(item.amount), item.currency, `AP payment ${batch.batch_number} (Plaid ACH)`,
            `apb-${item.id}`, bank.stripe_bank_account_id
          );
        } else if (batch.provider === 'paysafe_card') {
          // Create a hosted payment link for the vendor; webhook (BP-) settles it
          const { data: vendor } = await supabase.from('vendors')
            .select('email, name').eq('id', bill.vendor_id).single();
          if (!vendor?.email) throw new Error('Vendor email required for Paysafe Card payout');
          const ref = `BP-${item.id}`;
          const { data: link, error: linkErr } = await supabase.from('payment_links').insert({
            organization_id: batch.organization_id,
            reference: ref,
            status: 'open',
            amount: Number(item.amount),
            currency: item.currency,
            description: `AP payment ${batch.batch_number} - bill ${bill.bill_number}`,
            payment_method: 'any_card',
            deposit_bank_account_id: batch.funding_bank_account_id,
            payer_name: vendor.name,
            payer_email: vendor.email,
            metadata: { ap_batch_id: batch_id, ap_item_id: item.id, bill_id: bill.id },
          }).select().single();
          if (linkErr) throw linkErr;
          providerRef = ref;
          // Fire-and-forget email
          await supabase.functions.invoke('send-payment-link-email', {
            body: { payment_link_id: (link as { id: string }).id },
          }).catch(() => {});
        } else if (batch.provider === 'paysafe_eft') {
          throw new Error('Paysafe EFT requires vendor banking on file; use Paysafe Card or upload vendor bank details first.');
        }


        // Post JE (draft until confirmation)
        const je = await postJournalEntry(supabase, batch.organization_id, batch.pay_date,
          `AP payment ${batch.batch_number} - bill ${bill.bill_number}`,
          [
            { account_id: bill.ap_account_id, debit: Number(item.amount), description: `Bill ${bill.bill_number}`, vendor_id: bill.vendor_id },
            { account_id: bank.gl_account_id, credit: Number(item.amount), description: `From ${bank.name}` },
          ]
        );

        // Create vendor_payment
        const { data: vp } = await supabase.from('vendor_payments').insert({
          organization_id: batch.organization_id,
          vendor_id: bill.vendor_id,
          bill_id: bill.id,
          payment_date: batch.pay_date,
          amount: Number(item.amount),
          payment_method: batch.provider,
          reference: batch.batch_number,
          bank_account_id: batch.funding_bank_account_id,
          journal_entry_id: je.id,
        }).select().single();

        await supabase.from('ap_payment_batch_items').update({
          status: 'processing',
          provider_transfer_id: providerRef,
          journal_entry_id: je.id,
          vendor_payment_id: vp?.id ?? null,
        }).eq('id', item.id);

        successCount++;
        results.push({ item_id: item.id, ok: true, je_id: je.id });
      } catch (e) {
        failCount++;
        const msg = e instanceof Error ? e.message : 'Unknown';
        await supabase.from('ap_payment_batch_items').update({
          status: 'failed', failure_reason: msg,
        }).eq('id', item.id);
        results.push({ item_id: item.id, ok: false, error: msg });
      }
    }

    // Batch rollup
    const batchStatus = failCount === 0 ? 'processing' : (successCount === 0 ? 'failed' : 'partial');
    await supabase.from('ap_payment_batches').update({ status: batchStatus }).eq('id', batch_id);

    await supabase.from('treasury_payment_audit').insert({
      organization_id: batch.organization_id,
      entity_type: 'ap_batch',
      entity_id: batch_id,
      action: 'initiate',
      actor_id: userId,
      ip_address: req.headers.get('x-forwarded-for') ?? null,
      before_state: { status: batch.status },
      after_state: { status: batchStatus, success: successCount, failed: failCount },
    });

    return new Response(JSON.stringify({ success: true, success_count: successCount, fail_count: failCount, results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('treasury-pay-ap-batch error:', msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
