// Treasury cash-flow forecast engine
// Aggregates trailing 24 months of remittance liability and produces 13-week + 12-month projections
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface Payload {
  organization_id: string;
  payrollGrowth?: number;
  revenueGrowth?: number;
  horizonWeeks?: number;
  horizonMonths?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthenticated' }, 401);

    const body = (await req.json()) as Payload;
    if (!body.organization_id) return json({ error: 'organization_id required' }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: member } = await admin.rpc('is_org_member', { _user_id: user.id, _org_id: body.organization_id });
    if (!member) return json({ error: 'Forbidden' }, 403);

    const horizonWeeks = body.horizonWeeks ?? 13;
    const horizonMonths = body.horizonMonths ?? 12;
    const payrollGrowth = 1 + (body.payrollGrowth ?? 0) / 100;
    const revenueGrowth = 1 + (body.revenueGrowth ?? 0) / 100;

    // Pull 24 months of historic tax_payments
    const since = new Date();
    since.setMonth(since.getMonth() - 24);
    const { data: payments } = await admin
      .from('tax_payments')
      .select('payment_type, amount, period_end, status')
      .eq('organization_id', body.organization_id)
      .gte('period_end', since.toISOString().slice(0, 10))
      .in('status', ['completed', 'paid', 'submitted', 'processing']);

    const history = payments ?? [];

    // Group by program → monthly average (last 12 months)
    const programs = new Map<string, number[]>();
    for (const p of history) {
      const key = p.payment_type ?? 'unknown';
      const monthKey = (p.period_end ?? '').slice(0, 7);
      if (!monthKey) continue;
      if (!programs.has(key)) programs.set(key, []);
      programs.get(key)!.push(Number(p.amount ?? 0));
    }
    const monthlyAvg = new Map<string, number>();
    for (const [k, arr] of programs.entries()) {
      const recent = arr.slice(-12);
      monthlyAvg.set(k, recent.length ? recent.reduce((s, n) => s + n, 0) / recent.length : 0);
    }

    function growthFor(program: string): number {
      if (program.includes('payroll') || program === 'source_deductions') return payrollGrowth;
      if (program.includes('gst') || program.includes('hst') || program.includes('sales')) return revenueGrowth;
      return 1;
    }

    // Create run
    const { data: run, error: runErr } = await admin
      .from('treasury_forecast_runs')
      .insert({
        organization_id: body.organization_id,
        created_by: user.id,
        horizon_weeks: horizonWeeks,
        horizon_months: horizonMonths,
        inputs: { payrollGrowth, revenueGrowth },
        summary: {
          programs: Array.from(monthlyAvg.entries()).map(([k, v]) => ({ program: k, monthlyAvg: v })),
        },
      })
      .select()
      .single();
    if (runErr) throw runErr;

    // Available funding heuristic: 75% of monthly inflow average (approx, using sum of program averages)
    const monthlyOutflow = Array.from(monthlyAvg.values()).reduce((s, n) => s + n, 0);

    const lines: any[] = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);

    // Weekly buckets
    for (let i = 0; i < horizonWeeks; i++) {
      const start = new Date(today); start.setDate(start.getDate() + i * 7);
      const end = new Date(start); end.setDate(end.getDate() + 6);
      for (const [program, avg] of monthlyAvg.entries()) {
        const liability = (avg / 4.33) * growthFor(program);
        const funding = (monthlyOutflow / 4.33) * 0.95;
        lines.push({
          run_id: run.id,
          organization_id: body.organization_id,
          bucket_type: 'week',
          bucket_start: start.toISOString().slice(0, 10),
          bucket_end: end.toISOString().slice(0, 10),
          authority: program.includes('provincial') ? 'Provincial' : 'CRA',
          program_code: program,
          projected_liability: Math.round(liability * 100) / 100,
          projected_funding: Math.round(funding * 100) / 100,
          funding_gap: Math.round(Math.max(0, liability - funding) * 100) / 100,
          confidence: 0.7,
        });
      }
    }

    // Monthly buckets
    for (let i = 0; i < horizonMonths; i++) {
      const start = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const end = new Date(today.getFullYear(), today.getMonth() + i + 1, 0);
      for (const [program, avg] of monthlyAvg.entries()) {
        const liability = avg * growthFor(program);
        const funding = monthlyOutflow * 0.95;
        lines.push({
          run_id: run.id,
          organization_id: body.organization_id,
          bucket_type: 'month',
          bucket_start: start.toISOString().slice(0, 10),
          bucket_end: end.toISOString().slice(0, 10),
          authority: program.includes('provincial') ? 'Provincial' : 'CRA',
          program_code: program,
          projected_liability: Math.round(liability * 100) / 100,
          projected_funding: Math.round(funding * 100) / 100,
          funding_gap: Math.round(Math.max(0, liability - funding) * 100) / 100,
          confidence: 0.6,
        });
      }
    }

    if (lines.length > 0) {
      const { error: linesErr } = await admin.from('treasury_forecast_lines').insert(lines);
      if (linesErr) throw linesErr;
    }

    return json({ run_id: run.id, lines_count: lines.length });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
