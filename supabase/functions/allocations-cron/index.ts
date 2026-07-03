// Allocations cron — runs due allocation schedules.
// Invoked by pg_cron (every hour). Iterates active schedules with next_run_at <= now(),
// calls the existing run-allocations function for each rule, then advances next_run_at.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function startOfMonth(d: Date) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); }
function endOfMonth(d: Date)   { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)); }
function startOfQuarter(d: Date) {
  const q = Math.floor(d.getUTCMonth() / 3);
  return new Date(Date.UTC(d.getUTCFullYear(), q * 3, 1));
}
function endOfQuarter(d: Date) {
  const q = Math.floor(d.getUTCMonth() / 3);
  return new Date(Date.UTC(d.getUTCFullYear(), q * 3 + 3, 0));
}

function advanceNextRun(freq: string, day: number, from: Date): Date {
  const base = new Date(from);
  if (freq === 'quarterly') {
    const next = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 3, 1));
    next.setUTCDate(Math.min(day, endOfMonth(next).getUTCDate()));
    return next;
  }
  // monthly
  const next = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1));
  next.setUTCDate(Math.min(day, endOfMonth(next).getUTCDate()));
  return next;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  const now = new Date();
  const { data: due, error } = await admin
    .from('allocation_schedules')
    .select('*')
    .eq('active', true)
    .lte('next_run_at', now.toISOString())
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  const results: Array<{ id: string; status: string; error?: string }> = [];

  for (const s of due ?? []) {
    const period = s.frequency === 'quarterly'
      ? { start: startOfQuarter(now), end: endOfQuarter(now) }
      : { start: startOfMonth(now), end: endOfMonth(now) };

    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/run-allocations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          organization_id: s.organization_id,
          rule_id: s.rule_id,
          period_start: period.start.toISOString().slice(0, 10),
          period_end: period.end.toISOString().slice(0, 10),
        }),
      });
      const body = await resp.json().catch(() => ({}));
      const ok = resp.ok && !body?.error;
      const status = ok ? 'success' : 'failed';
      const errMsg = ok ? null : (body?.error || `HTTP ${resp.status}`);

      await admin.from('allocation_schedules').update({
        last_run_at: now.toISOString(),
        last_run_status: status,
        last_run_error: errMsg,
        next_run_at: advanceNextRun(s.frequency, s.day_of_period, now).toISOString(),
      }).eq('id', s.id);

      results.push({ id: s.id, status, ...(errMsg ? { error: errMsg } : {}) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin.from('allocation_schedules').update({
        last_run_at: now.toISOString(),
        last_run_status: 'failed',
        last_run_error: msg,
        next_run_at: advanceNextRun(s.frequency, s.day_of_period, now).toISOString(),
      }).eq('id', s.id);
      results.push({ id: s.id, status: 'failed', error: msg });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
});
