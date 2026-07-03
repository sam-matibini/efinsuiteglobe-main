// Treasury anomaly scanner
// Detects period swings, missed periods, duplicate payments, and low match scores
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface Payload { organization_id?: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Optional auth check when called from UI
    const authHeader = req.headers.get('Authorization') ?? '';
    let userId: string | null = null;
    let orgFilter: string | null = null;
    const body = (await req.json().catch(() => ({}))) as Payload;
    if (authHeader) {
      const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id ?? null;
      if (body.organization_id) {
        const { data: ok } = await admin.rpc('is_org_member', { _user_id: userId, _org_id: body.organization_id });
        if (!ok) return json({ error: 'Forbidden' }, 403);
        orgFilter = body.organization_id;
      }
    }

    // Pull recent payments scoped to org if provided
    let payQ = admin.from('tax_payments').select('id, organization_id, payment_type, amount, period_end, status, payee, created_at')
      .gte('created_at', new Date(Date.now() - 400 * 86400000).toISOString());
    if (orgFilter) payQ = payQ.eq('organization_id', orgFilter);
    const { data: payments } = await payQ;
    const rows = payments ?? [];

    const anomalies: any[] = [];

    // 1. Period-over-period swing > 25%
    const byOrgProgram = new Map<string, { period: string; amount: number }[]>();
    for (const p of rows) {
      if (!['completed', 'paid'].includes(p.status)) continue;
      const k = `${p.organization_id}|${p.payment_type}`;
      if (!byOrgProgram.has(k)) byOrgProgram.set(k, []);
      byOrgProgram.get(k)!.push({ period: (p.period_end ?? '').slice(0, 7), amount: Number(p.amount ?? 0) });
    }
    for (const [k, arr] of byOrgProgram.entries()) {
      arr.sort((a, b) => a.period.localeCompare(b.period));
      for (let i = 1; i < arr.length; i++) {
        const prev = arr[i - 1].amount;
        const cur = arr[i].amount;
        if (prev === 0) continue;
        const swing = Math.abs(cur - prev) / prev;
        if (swing > 0.25) {
          const [org, prog] = k.split('|');
          anomalies.push({
            organization_id: org,
            severity: swing > 0.5 ? 'high' : 'medium',
            category: 'period_swing',
            authority: prog.includes('provincial') ? 'Provincial' : 'CRA',
            program_code: prog,
            fingerprint: `swing:${k}:${arr[i].period}`,
            payload: { previous: prev, current: cur, swing_pct: Math.round(swing * 100) },
          });
        }
      }
    }

    // 2. Duplicate payments — same org+payee+amount within 7 days
    const sorted = [...rows].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i], b = sorted[j];
        if (a.organization_id !== b.organization_id) continue;
        if (a.payee !== b.payee) continue;
        if (Math.abs(Number(a.amount) - Number(b.amount)) > 0.01) continue;
        const dt = (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) / 86400000;
        if (dt > 7) break;
        anomalies.push({
          organization_id: a.organization_id,
          severity: 'high',
          category: 'duplicate_payment',
          authority: null,
          program_code: a.payment_type,
          related_tax_payment_id: b.id,
          fingerprint: `dup:${a.id}:${b.id}`,
          payload: { first_id: a.id, second_id: b.id, amount: a.amount, payee: a.payee },
        });
      }
    }

    // 3. Missed period — gap >45 days from last completed for the program
    for (const [k, arr] of byOrgProgram.entries()) {
      if (arr.length === 0) continue;
      const lastPeriod = arr[arr.length - 1].period + '-01';
      const last = new Date(lastPeriod + 'T00:00:00').getTime();
      const days = (Date.now() - last) / 86400000;
      if (days > 45) {
        const [org, prog] = k.split('|');
        anomalies.push({
          organization_id: org,
          severity: days > 90 ? 'critical' : 'high',
          category: 'missed_period',
          authority: prog.includes('provincial') ? 'Provincial' : 'CRA',
          program_code: prog,
          fingerprint: `missed:${k}:${lastPeriod}`,
          payload: { last_period: lastPeriod, days_since: Math.round(days) },
        });
      }
    }

    // Upsert (ignore conflicts on fingerprint)
    let inserted = 0;
    for (const a of anomalies) {
      const { error } = await admin.from('treasury_anomalies')
        .upsert(a, { onConflict: 'organization_id,fingerprint', ignoreDuplicates: true });
      if (!error) inserted++;
    }

    return json({ scanned: rows.length, anomalies_found: anomalies.length, upserted: inserted });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
