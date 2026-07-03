// Post a journal entry for a Stripe application fee (platform revenue)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    const { application_fee_id } = await req.json();
    if (!application_fee_id) return json({ error: 'application_fee_id required' }, 400);
    const { data: fee } = await admin.from('stripe_application_fees').select('*').eq('id', application_fee_id).maybeSingle();
    if (!fee) return json({ error: 'Application fee not found' }, 404);
    if (fee.journal_entry_id) return json({ ok: true, already_posted: true, journal_entry_id: fee.journal_entry_id });

    // Resolve GL accounts
    const { data: clearing } = await admin.from('accounts')
      .select('id').eq('organization_id', fee.organization_id).ilike('name', '%stripe clearing%').maybeSingle();
    const { data: revenue } = await admin.from('accounts')
      .select('id').eq('organization_id', fee.organization_id).ilike('name', '%platform fee revenue%').maybeSingle();
    if (!clearing || !revenue) return json({ error: 'GL accounts not configured (Stripe Clearing / Platform Fee Revenue)' }, 400);

    const amount = Number(fee.amount ?? 0);
    const { data: je } = await admin.from('journal_entries').insert({
      organization_id: fee.organization_id,
      entry_date: fee.created_at ?? new Date().toISOString().slice(0, 10),
      description: `Stripe application fee ${fee.stripe_application_fee_id ?? fee.id}`,
      source_type: 'stripe_application_fee',
      source_id: fee.id,
      status: 'posted',
    }).select('id').single();

    await admin.from('journal_entry_lines').insert([
      { journal_entry_id: je!.id, account_id: clearing.id, debit: amount, credit: 0 },
      { journal_entry_id: je!.id, account_id: revenue.id, debit: 0, credit: amount },
    ]);

    await admin.from('stripe_application_fees').update({ journal_entry_id: je!.id }).eq('id', fee.id);
    return json({ ok: true, journal_entry_id: je!.id });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
