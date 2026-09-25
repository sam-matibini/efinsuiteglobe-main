// CRA Scheduled Executor — cron-callable. Auto-creates draft tax_payments for due CRA schedules.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Service role client — cron context
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const today = new Date().toISOString().slice(0, 10);

    const { data: schedules, error } = await supabase
      .from('scheduled_payments')
      .select('*')
      .eq('payment_kind', 'cra')
      .eq('is_active', true)
      .lte('next_run_date', today);
    if (error) throw error;

    const created: string[] = [];
    for (const s of schedules ?? []) {
      const meta = (s as any).metadata ?? {};
      const taxType = meta.tax_type ?? 'gst_hst';
      const paymentType = taxType === 'payroll' ? 'source_deductions' : taxType;

      const { data: refData } = await supabase.rpc('next_tax_payment_reference', { p_org: s.organization_id });
      const reference = refData as unknown as string;

      const { data: tp, error: insErr } = await supabase
        .from('tax_payments')
        .insert({
          organization_id: s.organization_id,
          reference,
          status: 'draft',
          currency: 'CAD',
          amount: s.amount,
          payment_type: paymentType,
          payment_method: meta.payment_method ?? 'manual',
          payment_rail: meta.payment_rail ?? 'manual',
          cra_account_id: meta.cra_account_id ?? null,
          bank_account_id: s.bank_account_id ?? null,
          scheduled_payment_id: s.id,
          scheduled_for: today,
          notes: `Auto-created from schedule ${s.id}`,
        })
        .select('id')
        .single();
      if (insErr) {
        console.error('Insert failed for schedule', s.id, insErr);
        continue;
      }
      created.push(tp.id);

      await supabase.from('cra_audit_log').insert({
        organization_id: s.organization_id,
        tax_payment_id: tp.id,
        action: 'schedule.auto_created',
        payload: { schedule_id: s.id, next_run_date: s.next_run_date },
      });

      // advance schedule next_run_date by frequency
      const advance = (d: string, freq: string) => {
        const dt = new Date(d + 'T00:00:00Z');
        switch (freq) {
          case 'weekly':       dt.setUTCDate(dt.getUTCDate() + 7); break;
          case 'biweekly':     dt.setUTCDate(dt.getUTCDate() + 14); break;
          case 'monthly':      dt.setUTCMonth(dt.getUTCMonth() + 1); break;
          case 'quarterly':    dt.setUTCMonth(dt.getUTCMonth() + 3); break;
          case 'semi_annually':dt.setUTCMonth(dt.getUTCMonth() + 6); break;
          case 'annually':     dt.setUTCFullYear(dt.getUTCFullYear() + 1); break;
          default: dt.setUTCMonth(dt.getUTCMonth() + 1);
        }
        return dt.toISOString().slice(0, 10);
      };
      await supabase.from('scheduled_payments').update({
        next_run_date: advance(s.next_run_date, s.frequency),
        last_run_date: today,
      }).eq('id', s.id);
    }

    return new Response(JSON.stringify({ success: true, created_count: created.length, created }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('cra-scheduled-executor error:', msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
