// Period-end FX revaluation for open settlements held in foreign currency.
// Creates balanced JEs against unrealized FX gain/loss accounts and records each
// adjustment in settlement_fx_revaluations. Supports reverse mode.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface Body {
  organization_id: string;
  period_end_date: string; // YYYY-MM-DD
  processor_account_id?: string;
  reverse?: boolean; // creates reversing JEs for the same period
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return j({ error: 'Unauthorized' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const token = authHeader.replace('Bearer ', '');
  const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
  if (cErr || !claims?.claims?.sub) return j({ error: 'Unauthorized' }, 401);
  const userId = claims.claims.sub as string;

  let body: Body;
  try { body = await req.json(); } catch { return j({ error: 'Invalid JSON' }, 400); }
  if (!body.organization_id || !body.period_end_date) return j({ error: 'organization_id and period_end_date required' }, 400);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: isMember } = await admin.rpc('is_org_member' as any, { _user_id: userId, _org_id: body.organization_id } as any);
  if (!isMember) return j({ error: 'Forbidden' }, 403);

  const { data: org } = await admin.from('organizations').select('id, base_currency, default_currency, currency').eq('id', body.organization_id).single();
  const functionalCurrency: string = (org as any)?.base_currency || (org as any)?.default_currency || (org as any)?.currency || 'USD';

  if (body.reverse) {
    return await reverseAll(admin, body, userId);
  }

  // Eligible processors
  let procQuery = admin
    .from('processor_accounts')
    .select('id, currency, expected_bank_account_id, unrealized_fx_gain_account_id, unrealized_fx_loss_account_id, revaluation_enabled')
    .eq('organization_id', body.organization_id)
    .eq('revaluation_enabled', true);
  if (body.processor_account_id) procQuery = procQuery.eq('id', body.processor_account_id);
  const { data: procs, error: pErr } = await procQuery;
  if (pErr) return j({ error: pErr.message }, 500);

  let postedCount = 0, skippedCount = 0, errorCount = 0;
  const results: any[] = [];

  for (const proc of (procs ?? [])) {
    if (proc.currency === functionalCurrency) { skippedCount++; continue; }
    if (!proc.expected_bank_account_id || !proc.unrealized_fx_gain_account_id || !proc.unrealized_fx_loss_account_id) {
      skippedCount++;
      results.push({ processor_id: proc.id, skipped: 'missing accounts' });
      continue;
    }
    const { data: bank } = await admin.from('bank_accounts').select('gl_account_id').eq('id', proc.expected_bank_account_id).single();
    if (!bank?.gl_account_id) { skippedCount++; continue; }

    // Period-end rate from proc currency -> functional
    const { data: rateRow } = await admin.rpc('get_exchange_rate' as any, {
      _org: body.organization_id,
      _from: proc.currency,
      _to: functionalCurrency,
      _date: body.period_end_date,
    } as any);
    const periodEndRate = Number(rateRow ?? 1);

    // Pull open settlements for this processor
    const { data: settlements } = await admin
      .from('settlements')
      .select('id, currency, net_amount, settlement_date, functional_rate, last_revalued_at')
      .eq('organization_id', body.organization_id)
      .eq('processor_account_id', proc.id)
      .in('status', ['pending', 'partially_matched', 'exception'])
      .lte('settlement_date', body.period_end_date);

    for (const s of (settlements ?? [])) {
      const origRate = Number(s.functional_rate || 0) || await getRate(admin, body.organization_id, s.currency, functionalCurrency, s.settlement_date);
      const amount = Number(s.net_amount || 0);
      const revalAmount = Math.round(amount * (periodEndRate - origRate) * 100) / 100;
      if (Math.abs(revalAmount) < 0.01) { skippedCount++; continue; }

      // Check existing
      const { data: existing } = await admin.from('settlement_fx_revaluations')
        .select('id').eq('settlement_id', s.id).eq('period_end_date', body.period_end_date).maybeSingle();
      if (existing) { skippedCount++; continue; }

      // DR bank, CR gain OR DR loss, CR bank
      const isGain = revalAmount > 0;
      const lines = isGain
        ? [
            { account_id: bank.gl_account_id, debit: Math.abs(revalAmount), credit: 0, line_order: 1, currency: functionalCurrency, description: `FX gain ${s.id.slice(0,8)}` },
            { account_id: proc.unrealized_fx_gain_account_id, debit: 0, credit: Math.abs(revalAmount), line_order: 2, currency: functionalCurrency, description: `Unrealized FX gain` },
          ]
        : [
            { account_id: proc.unrealized_fx_loss_account_id, debit: Math.abs(revalAmount), credit: 0, line_order: 1, currency: functionalCurrency, description: `Unrealized FX loss` },
            { account_id: bank.gl_account_id, debit: 0, credit: Math.abs(revalAmount), line_order: 2, currency: functionalCurrency, description: `FX loss ${s.id.slice(0,8)}` },
          ];

      try {
        const { data: je, error: jeErr } = await admin.from('journal_entries').insert({
          organization_id: body.organization_id,
          reference: `FXREV-${s.id.slice(0, 8)}-${body.period_end_date}`.slice(0, 64),
          entry_date: body.period_end_date,
          description: `Settlement FX revaluation @ ${body.period_end_date}`,
          status: 'posted',
          created_by: userId, posted_by: userId, posted_at: new Date().toISOString(),
          journal_type: 'manual',
        } as any).select('id').single();
        if (jeErr || !je) { errorCount++; results.push({ settlement_id: s.id, error: jeErr?.message }); continue; }

        const { error: lErr } = await admin.from('journal_entry_lines').insert(
          lines.map((l) => ({ journal_entry_id: je.id, ...l })) as any
        );
        if (lErr) { await admin.from('journal_entries').delete().eq('id', je.id); errorCount++; continue; }

        await admin.from('settlement_fx_revaluations').insert({
          organization_id: body.organization_id,
          settlement_id: s.id,
          period_end_date: body.period_end_date,
          original_currency: s.currency,
          original_amount: amount,
          functional_currency: functionalCurrency,
          original_rate: origRate,
          period_end_rate: periodEndRate,
          revaluation_amount: revalAmount,
          journal_entry_id: je.id,
          created_by: userId,
        } as any);

        await admin.from('settlements').update({
          functional_rate: origRate,
          functional_amount: amount * origRate,
          last_revalued_at: new Date().toISOString(),
        }).eq('id', s.id);

        postedCount++;
      } catch (e) {
        errorCount++;
        results.push({ settlement_id: s.id, error: String((e as Error).message) });
      }
    }
  }

  return j({ ok: true, posted: postedCount, skipped: skippedCount, errors: errorCount, details: results });
});

async function getRate(admin: any, org: string, from: string, to: string, date: string): Promise<number> {
  if (from === to) return 1;
  const { data } = await admin.rpc('get_exchange_rate' as any, { _org: org, _from: from, _to: to, _date: date } as any);
  return Number(data ?? 1);
}

async function reverseAll(admin: any, body: Body, userId: string) {
  const { data: rows } = await admin.from('settlement_fx_revaluations')
    .select('*')
    .eq('organization_id', body.organization_id)
    .eq('period_end_date', body.period_end_date)
    .is('reversed_at', null);
  let count = 0;
  const nextDay = new Date(body.period_end_date);
  nextDay.setDate(nextDay.getDate() + 1);
  const reversalDate = nextDay.toISOString().slice(0, 10);

  for (const r of (rows ?? [])) {
    const { data: origLines } = await admin.from('journal_entry_lines')
      .select('account_id, debit, credit, currency, description')
      .eq('journal_entry_id', r.journal_entry_id)
      .order('line_order');
    const { data: revJe } = await admin.from('journal_entries').insert({
      organization_id: body.organization_id,
      reference: `FXREV-REV-${r.id.slice(0, 8)}`,
      entry_date: reversalDate,
      description: `Reversal of FX revaluation @ ${body.period_end_date}`,
      status: 'posted',
      created_by: userId, posted_by: userId, posted_at: new Date().toISOString(),
      journal_type: 'manual',
      reversal_of: r.journal_entry_id,
    } as any).select('id').single();
    if (!revJe) continue;
    await admin.from('journal_entry_lines').insert(
      (origLines ?? []).map((l: any, i: number) => ({
        journal_entry_id: revJe.id, account_id: l.account_id,
        debit: Number(l.credit ?? 0), credit: Number(l.debit ?? 0),
        currency: l.currency, line_order: i + 1,
        description: `Reverse ${l.description ?? ''}`.trim(),
      })) as any
    );
    await admin.from('settlement_fx_revaluations').update({
      reversed_at: new Date().toISOString(), reversal_journal_entry_id: revJe.id,
    }).eq('id', r.id);
    count++;
  }
  return j({ ok: true, reversed: count });
}

function j(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
