// Allocation engine — reallocates a source division's account balances across
// target divisions per a configured rule, posting a single balanced JE per run.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface Body {
  rule_id: string;
  period_start: string;
  period_end: string;
  preview?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body: Body = await req.json();
    if (!body?.rule_id || !body?.period_start || !body?.period_end) {
      return new Response(JSON.stringify({ error: 'rule_id, period_start, period_end required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Load rule + targets
    const { data: rule, error: rErr } = await supabase
      .from('allocation_rules')
      .select('*, allocation_rule_targets(*)')
      .eq('id', body.rule_id)
      .single();
    if (rErr || !rule) throw new Error('Rule not found');

    const orgId = rule.organization_id as string;
    const targets = (rule.allocation_rule_targets || []) as Array<{ target_department_id: string; weight: number }>;
    if (targets.length === 0) throw new Error('Rule has no targets');

    // Build source line filter: JE lines in source dept (and optional account) for the period
    let q = supabase
      .from('journal_entry_lines')
      .select('account_id, debit, credit, journal_entry:journal_entries!inner(entry_date, status, organization_id)')
      .eq('journal_entry.organization_id', orgId)
      .gte('journal_entry.entry_date', body.period_start)
      .lte('journal_entry.entry_date', body.period_end)
      .eq('journal_entry.status', 'posted');
    if (rule.source_department_id) q = q.eq('department_id', rule.source_department_id);
    if (rule.source_account_id) q = q.eq('account_id', rule.source_account_id);
    const { data: srcLines, error: lErr } = await q;
    if (lErr) throw lErr;

    // Aggregate net per account in source
    const perAccount = new Map<string, number>();
    for (const l of srcLines || []) {
      const net = Number(l.debit || 0) - Number(l.credit || 0);
      perAccount.set(l.account_id as string, (perAccount.get(l.account_id as string) || 0) + net);
    }

    // Determine target weights
    let weights = targets.map((t) => ({ dept: t.target_department_id, w: Number(t.weight || 0) }));
    const totalW = weights.reduce((s, w) => s + w.w, 0);
    if (rule.method === 'equal' || totalW <= 0) {
      const each = 1 / weights.length;
      weights = weights.map((w) => ({ ...w, w: each }));
    } else if (rule.method === 'headcount') {
      const { data: emps } = await supabase
        .from('employees')
        .select('department_id')
        .eq('organization_id', orgId)
        .eq('is_active', true);
      const counts = new Map<string, number>();
      for (const e of emps || []) counts.set(e.department_id || '', (counts.get(e.department_id || '') || 0) + 1);
      const t = weights.reduce((s, w) => s + (counts.get(w.dept) || 0), 0);
      if (t > 0) weights = weights.map((w) => ({ ...w, w: (counts.get(w.dept) || 0) / t }));
    } else {
      weights = weights.map((w) => ({ ...w, w: w.w / totalW }));
    }

    // Build JE lines: CR source / DR each target per account (or DR source / CR target if net was credit)
    const jeLines: Array<{ account_id: string; debit: number; credit: number; department_id: string; description: string }> = [];
    let totalAllocated = 0;
    const runLines: Array<{ account_id: string; target_department_id: string; source_amount: number; allocated_amount: number }> = [];

    for (const [accountId, net] of perAccount) {
      if (Math.abs(net) < 0.005) continue;
      // Reverse out of source
      if (net >= 0) {
        jeLines.push({ account_id: accountId, debit: 0, credit: round2(net), department_id: rule.source_department_id, description: `Allocation OUT: ${rule.name}` });
      } else {
        jeLines.push({ account_id: accountId, debit: round2(-net), credit: 0, department_id: rule.source_department_id, description: `Allocation OUT: ${rule.name}` });
      }
      // Distribute into targets
      let allocatedSoFar = 0;
      for (let i = 0; i < weights.length; i++) {
        const w = weights[i];
        const portion = i === weights.length - 1
          ? round2(net - allocatedSoFar)            // absorb rounding remainder
          : round2(net * w.w);
        allocatedSoFar = round2(allocatedSoFar + portion);
        if (portion >= 0) {
          jeLines.push({ account_id: accountId, debit: round2(portion), credit: 0, department_id: w.dept, description: `Allocation IN: ${rule.name}` });
        } else {
          jeLines.push({ account_id: accountId, debit: 0, credit: round2(-portion), department_id: w.dept, description: `Allocation IN: ${rule.name}` });
        }
        totalAllocated += Math.abs(portion);
        runLines.push({ account_id: accountId, target_department_id: w.dept, source_amount: net, allocated_amount: portion });
      }
    }

    if (body.preview) {
      return new Response(JSON.stringify({ preview: true, lines: jeLines, totalAllocated }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create allocation_run record
    const { data: run, error: runErr } = await supabase
      .from('allocation_runs')
      .insert({
        organization_id: orgId, rule_id: rule.id,
        period_start: body.period_start, period_end: body.period_end,
        status: 'draft', total_allocated: totalAllocated, created_by: user.id,
      })
      .select()
      .single();
    if (runErr) throw runErr;

    if (jeLines.length === 0) {
      await supabase.from('allocation_runs').update({ status: 'posted', notes: 'No source activity to allocate.' }).eq('id', run.id);
      return new Response(JSON.stringify({ run_id: run.id, allocated: 0, note: 'No activity' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Post JE as draft then promote
    const ref = `ALLOC-${run.id.slice(0, 8).toUpperCase()}`;
    const { data: je, error: jeErr } = await supabase
      .from('journal_entries')
      .insert({
        organization_id: orgId, entry_date: body.period_end, reference: ref,
        description: `Cost allocation: ${rule.name}`, journal_type: 'adjustment', status: 'draft',
        department_id: rule.source_department_id,
      })
      .select()
      .single();
    if (jeErr) throw jeErr;

    const { error: linesErr } = await supabase
      .from('journal_entry_lines')
      .insert(jeLines.map((l, idx) => ({ ...l, journal_entry_id: je.id, line_order: idx })));
    if (linesErr) {
      await supabase.from('journal_entries').delete().eq('id', je.id);
      await supabase.from('allocation_runs').update({ status: 'failed', error_message: linesErr.message }).eq('id', run.id);
      throw linesErr;
    }

    const { error: postErr } = await supabase.from('journal_entries').update({ status: 'posted' }).eq('id', je.id);
    if (postErr) {
      await supabase.from('journal_entry_lines').delete().eq('journal_entry_id', je.id);
      await supabase.from('journal_entries').delete().eq('id', je.id);
      await supabase.from('allocation_runs').update({ status: 'failed', error_message: postErr.message }).eq('id', run.id);
      throw postErr;
    }

    await supabase.from('allocation_runs').update({ status: 'posted', journal_entry_id: je.id }).eq('id', run.id);
    if (runLines.length) {
      await supabase.from('allocation_run_lines').insert(runLines.map((rl) => ({ ...rl, run_id: run.id, source_department_id: rule.source_department_id })));
    }

    return new Response(JSON.stringify({ run_id: run.id, journal_entry_id: je.id, allocated: totalAllocated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function round2(n: number) { return Math.round(n * 100) / 100; }
