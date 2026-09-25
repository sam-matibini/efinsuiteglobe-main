// CRA Bank-Feed Reconciler — cron-callable.
// Auto-matches outstanding CRA tax_payments to bank_transactions (debits) within ±5 days and 1¢.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CRA_KEYWORDS = ['CRA', 'RECEIVER GENERAL', 'REVENUE CANADA', 'ARC', 'CANADA REVENUE'];

function looksLikeCra(text: string | null | undefined): boolean {
  if (!text) return false;
  const u = text.toUpperCase();
  return CRA_KEYWORDS.some((k) => u.includes(k));
}

function daysBetween(a: string, b: string): number {
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const summary = { scanned: 0, matched: 0, queued: 0, errors: 0 };

  try {
    const since = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);

    const { data: payments, error: payErr } = await supabase
      .from('tax_payments')
      .select('id, organization_id, amount, currency, bank_account_id, status, scheduled_for, created_at, reference, payment_method, payment_rail')
      .in('status', ['processing', 'submitted', 'authorized', 'pending'])
      .gte('created_at', since);
    if (payErr) throw payErr;

    summary.scanned = payments?.length ?? 0;

    for (const p of payments ?? []) {
      // Pull candidate bank debits in window
      const windowStart = new Date(new Date(p.created_at).getTime() - 5 * 86_400_000).toISOString().slice(0, 10);
      const windowEnd = new Date(new Date(p.created_at).getTime() + 10 * 86_400_000).toISOString().slice(0, 10);

      let query = supabase
        .from('bank_transactions')
        .select('id, bank_account_id, transaction_date, amount, description, memo, reference, status')
        .eq('transaction_type', 'debit')
        .gte('transaction_date', windowStart)
        .lte('transaction_date', windowEnd)
        .in('status', ['unmatched', 'pending']);

      if (p.bank_account_id) query = query.eq('bank_account_id', p.bank_account_id);

      const { data: candidates } = await query;

      const exact = (candidates ?? []).filter((c) => {
        const amtMatch = Math.abs(Math.abs(Number(c.amount)) - Math.abs(Number(p.amount))) < 0.01;
        const dateMatch = daysBetween(c.transaction_date, p.created_at) <= 5;
        const craMatch = looksLikeCra(`${c.description ?? ''} ${c.memo ?? ''} ${c.reference ?? ''}`);
        return amtMatch && dateMatch && craMatch;
      });

      if (exact.length === 1) {
        const m = exact[0];
        const confirmation = (m.reference || m.memo || `BANK-${m.id.slice(0, 8)}`).toString().slice(0, 64);

        const { error: upErr } = await supabase
          .from('tax_payments')
          .update({
            status: 'completed',
            confirmation_number: confirmation,
            paid_at: new Date(m.transaction_date).toISOString(),
            reconciliation_source: 'bank_feed',
          })
          .eq('id', p.id);

        if (!upErr) {
          await supabase.from('bank_transactions').update({ status: 'matched', is_cleared: true, cleared_at: new Date().toISOString() }).eq('id', m.id);
          await supabase.from('cra_audit_log').insert({
            organization_id: p.organization_id,
            tax_payment_id: p.id,
            action: 'auto_reconciled',
            payload: { bank_transaction_id: m.id, confirmation, source: 'bank_feed' },
          });
          summary.matched += 1;
        } else {
          summary.errors += 1;
        }
      } else if (exact.length > 1) {
        // ambiguous → queue
        await supabase.from('reconciliation_review_queue').insert({
          organization_id: p.organization_id,
          tax_payment_id: p.id,
          reason: `Ambiguous: ${exact.length} bank transactions match`,
          candidates: exact.map((c) => ({
            id: c.id,
            date: c.transaction_date,
            amount: c.amount,
            description: c.description,
            reference: c.reference,
          })),
          status: 'open',
        });
        summary.queued += 1;
      }
    }

    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('reconciler error', e);
    return new Response(JSON.stringify({ error: (e as Error).message, ...summary }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
