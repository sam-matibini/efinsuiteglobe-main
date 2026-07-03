// Phase 11 — CRA payment-batch executor. Walks every item in a
// `cra_payment_batches` row, submits each via the existing
// `paysafe-create-payment` function (which enforces PAD for EFT),
// and rolls the parent batch status to submitted / partial / completed.
//
// Cron- or user-callable. Service-role only.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { batch_id, rail } = await req.json().catch(() => ({})) as {
      batch_id?: string;
      rail?: 'eft' | 'card';
    };
    if (!batch_id) {
      return new Response(JSON.stringify({ error: 'batch_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: batch, error: bErr } = await supabase
      .from('cra_payment_batches')
      .select('*')
      .eq('id', batch_id)
      .single();
    if (bErr || !batch) {
      return new Response(JSON.stringify({ error: 'Batch not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: items } = await supabase
      .from('cra_payment_batch_items')
      .select('*')
      .eq('batch_id', batch_id);

    const chosenRail = rail ?? 'eft';
    const results: Array<{ item_id: string; ok: boolean; error?: string }> = [];

    for (const item of items ?? []) {
      // Each batch item must have an associated tax_payment to submit.
      if (!item.tax_payment_id) {
        results.push({ item_id: item.id, ok: false, error: 'No tax_payment linked' });
        await supabase.from('cra_payment_batch_items').update({
          status: 'failed', failure_reason: 'No tax_payment linked',
        }).eq('id', item.id);
        continue;
      }

      const resp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/paysafe-create-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_type: 'tax_payment',
          source_id: item.tax_payment_id,
          rail: chosenRail,
        }),
      });
      const body = await resp.json().catch(() => ({}));
      const ok = resp.ok && (body as { ok?: boolean }).ok !== false;
      results.push({ item_id: item.id, ok, error: ok ? undefined : (body as { error?: string }).error });

      await supabase.from('cra_payment_batch_items').update({
        status: ok ? 'submitted' : 'failed',
        failure_reason: ok ? null : ((body as { error?: string }).error ?? 'Paysafe submission failed'),
      }).eq('id', item.id);
    }

    const okCount = results.filter((r) => r.ok).length;
    const total = results.length;
    const newStatus = total === 0 ? 'cancelled'
      : okCount === total ? 'submitted'
      : okCount === 0 ? 'failed' : 'partial';

    await supabase.from('cra_payment_batches').update({
      status: newStatus,
      submitted_at: new Date().toISOString(),
    }).eq('id', batch_id);

    return new Response(JSON.stringify({ ok: true, batch_id, status: newStatus, results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('cra-batch-paysafe-submit error', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
