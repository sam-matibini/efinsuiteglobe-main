// Phase 6 — Dispute lifecycle accounting
// Posts/reverses provisional chargeback JEs for a settlement_disputes row.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface Body {
  dispute_id: string;
  organization_id: string;
  action: 'open' | 'won' | 'lost';
  chargeback_expense_account_id?: string;
  bank_clearing_account_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: authData, error: authErr } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
  if (authErr || !authData?.claims) return json({ error: 'Unauthorized' }, 401);
  const userId = authData.claims.sub;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!body.dispute_id || !body.organization_id || !body.action) {
    return json({ error: 'Missing dispute_id, organization_id, or action' }, 400);
  }

  // Membership check
  const { data: member } = await admin.rpc('is_org_member' as any, { _user: userId, _org: body.organization_id } as any);
  if (!member) return json({ error: 'Forbidden' }, 403);

  const { data: dispute, error: dErr } = await admin
    .from('settlement_disputes')
    .select('*')
    .eq('id', body.dispute_id)
    .eq('organization_id', body.organization_id)
    .single();
  if (dErr || !dispute) return json({ error: dErr?.message ?? 'Dispute not found' }, 404);

  const totalAmount = Number(dispute.disputed_amount ?? 0) + Number(dispute.fees ?? 0);
  if (totalAmount <= 0) return json({ error: 'Dispute has zero amount' }, 400);

  // Helper to post a balanced JE
  async function postJE(reference: string, description: string, lines: Array<{ account_id: string; debit: number; credit: number; memo?: string }>) {
    const { data: je, error: jeErr } = await admin
      .from('journal_entries')
      .insert({
        organization_id: body.organization_id,
        entry_date: new Date().toISOString().slice(0, 10),
        reference,
        description,
        status: 'posted',
        journal_type: 'settlement_dispute',
        created_by: userId,
        posted_by: userId,
        posted_at: new Date().toISOString(),
      } as any)
      .select()
      .single();
    if (jeErr) throw jeErr;

    const linesPayload = lines.map((l, i) => ({
      journal_entry_id: je.id,
      account_id: l.account_id,
      debit: l.debit,
      credit: l.credit,
      description: l.memo ?? description,
      line_order: i + 1,
      source_document_type: 'settlement_dispute',
      source_document_id: dispute.id,
      currency: dispute.currency,
    }));
    const { error: lErr } = await admin.from('journal_entry_lines').insert(linesPayload as any);
    if (lErr) throw lErr;
    return je.id as string;
  }

  try {
    if (body.action === 'open') {
      if (dispute.journal_entry_id) return json({ error: 'Provisional JE already posted' }, 409);
      if (!body.chargeback_expense_account_id || !body.bank_clearing_account_id) {
        return json({ error: 'chargeback_expense_account_id and bank_clearing_account_id required' }, 400);
      }
      const jeId = await postJE(
        `DISP-${dispute.processor_dispute_id}`,
        `Provisional chargeback ${dispute.processor_dispute_id}`,
        [
          { account_id: body.chargeback_expense_account_id, debit: totalAmount, credit: 0 },
          { account_id: body.bank_clearing_account_id, debit: 0, credit: totalAmount },
        ],
      );
      await admin.from('settlement_disputes')
        .update({ journal_entry_id: jeId, status: 'needs_response', responded_at: null })
        .eq('id', dispute.id);
      return json({ ok: true, journal_entry_id: jeId });
    }

    if (body.action === 'won') {
      if (!dispute.journal_entry_id) return json({ error: 'No provisional JE to reverse' }, 400);
      // Reverse: swap debit/credit
      const { data: origLines } = await admin
        .from('journal_entry_lines')
        .select('account_id, debit, credit')
        .eq('journal_entry_id', dispute.journal_entry_id);
      const reverseLines = (origLines ?? []).map((l: any) => ({
        account_id: l.account_id,
        debit: Number(l.credit),
        credit: Number(l.debit),
      }));
      const jeId = await postJE(
        `DISP-${dispute.processor_dispute_id}-REV`,
        `Reversal: dispute ${dispute.processor_dispute_id} won`,
        reverseLines,
      );
      // Mark original as reversed (reversal-netting rule)
      await admin.from('journal_entries').update({ status: 'reversed' } as any).eq('id', dispute.journal_entry_id);
      await admin.from('settlement_disputes').update({
        resolution_journal_entry_id: jeId,
        status: 'won',
        resolved_at: new Date().toISOString(),
        outcome_amount: 0,
      }).eq('id', dispute.id);
      return json({ ok: true, journal_entry_id: jeId });
    }

    if (body.action === 'lost') {
      // Provisional JE stays posted (becomes permanent). Just mark resolved.
      await admin.from('settlement_disputes').update({
        status: 'lost',
        resolved_at: new Date().toISOString(),
        outcome_amount: -totalAmount,
      }).eq('id', dispute.id);
      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
