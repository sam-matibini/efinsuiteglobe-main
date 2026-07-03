// Treasury - Process a payroll payment batch
// Debits Wages Payable, credits funding bank per item, optionally initiates a Stripe ACH transfer.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Sb = ReturnType<typeof createClient>;

async function nextJournalReference(sb: Sb, orgId: string): Promise<string> {
  const { data } = await sb
    .from('journal_entries').select('reference')
    .eq('organization_id', orgId).like('reference', 'JE-%');
  let maxNum = 0;
  for (const e of (data ?? []) as Array<{ reference: string | null }>) {
    const m = e.reference?.match(/JE-(\d+)$/);
    if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; }
  }
  return `JE-${String(maxNum + 1).padStart(4, '0')}`;
}

async function resolveWagesPayable(sb: Sb, orgId: string): Promise<string> {
  const { data } = await sb
    .from('accounts').select('id, name, code')
    .eq('organization_id', orgId).eq('account_type', 'liability');
  const rows = (data ?? []) as Array<{ id: string; name: string; code: string | null }>;
  const wage = rows.find((r) => /wages? payable/i.test(r.name));
  if (wage) return wage.id;
  const generic = rows.find((r) => /payroll liabilit/i.test(r.name));
  if (generic) return generic.id;
  throw new Error('No Wages Payable / Payroll Liabilities account found. Create one in the chart of accounts.');
}

async function postJE(
  sb: Sb, orgId: string, date: string, description: string,
  lines: Array<{ account_id: string; debit?: number; credit?: number; description?: string }>
) {
  const reference = await nextJournalReference(sb, orgId);
  const { data: je, error } = await sb
    .from('journal_entries')
    .insert([{ organization_id: orgId, entry_date: date, reference, description, journal_type: 'manual', status: 'draft' }])
    .select().single();
  if (error) throw error;
  const jeRow = je as { id: string };
  const { error: linesErr } = await sb.from('journal_entry_lines').insert(
    lines.map((l, i) => ({
      journal_entry_id: jeRow.id,
      account_id: l.account_id,
      debit: l.debit ?? 0,
      credit: l.credit ?? 0,
      description: l.description ?? null,
      line_order: i,
    }))
  );
  if (linesErr) {
    await sb.from('journal_entries').delete().eq('id', jeRow.id);
    throw linesErr;
  }
  return jeRow;
}

async function initiateStripeACH(
  amount: number, currency: string, description: string, idem: string,
  stripeBankAccountId: string
): Promise<string> {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  const body = new URLSearchParams({
    amount: String(Math.round(amount * 100)),
    currency: currency.toLowerCase(),
    description,
  });
  body.append('payment_method_types[]', 'us_bank_account');
  body.append('payment_method_data[type]', 'us_bank_account');
  body.append('payment_method_data[us_bank_account][financial_connections_account]', stripeBankAccountId);
  body.append('confirm', 'true');
  const res = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': idem },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe error: ${data?.error?.message ?? res.status}`);
  return data.id as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json(401, { error: 'Unauthorized' });

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claims, error: cErr } = await sb.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (cErr || !claims?.claims) return json(401, { error: 'Unauthorized' });
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const batch_id = (body?.batch_id ?? '') as string;
    if (!batch_id) return json(400, { error: 'batch_id required' });

    const { data: batch, error: bErr } = await sb
      .from('payroll_payment_batches').select('*').eq('id', batch_id).single();
    if (bErr || !batch) return json(404, { error: 'Batch not found' });
    const b = batch as Record<string, unknown>;

    if (b.approval_state !== 'approved') {
      return json(403, { error: 'Batch is not approved yet. Complete the review/approval workflow first.' });
    }
    if (!['draft', 'approved'].includes(b.status as string)) {
      return json(400, { error: `Cannot process batch in status ${b.status}` });
    }
    if (!b.funding_bank_account_id) return json(400, { error: 'Funding bank account required' });

    const { data: bankRow } = await sb
      .from('bank_accounts')
      .select('id, name, gl_account_id, stripe_bank_account_id')
      .eq('id', b.funding_bank_account_id as string).single();
    const bank = bankRow as { id: string; name: string; gl_account_id: string | null; stripe_bank_account_id: string | null } | null;
    if (!bank?.gl_account_id) return json(400, { error: 'Bank missing GL link' });

    const wagesAccountId = await resolveWagesPayable(sb, b.organization_id as string);

    const { data: itemsRaw } = await sb
      .from('payroll_payment_items').select('*').eq('batch_id', batch_id).eq('status', 'pending');
    const items = (itemsRaw ?? []) as Array<Record<string, unknown>>;

    await sb.from('payroll_payment_batches').update({
      status: 'processing', submitted_at: new Date().toISOString(), submitted_by: userId,
    }).eq('id', batch_id);

    let ok = 0, fail = 0;
    const results: Array<Record<string, unknown>> = [];

    for (const item of items) {
      try {
        let providerRef: string | null = null;
        const rail = (item.rail as string) ?? 'ach';

        if ((b.provider === 'stripe' || b.provider === 'plaid') &&
            (rail === 'ach' || rail === 'instant') && bank.stripe_bank_account_id) {
          providerRef = await initiateStripeACH(
            Number(item.amount), item.currency as string,
            `Payroll ${b.batch_number} - employee ${item.employee_id}`,
            `payb-${item.id}`,
            bank.stripe_bank_account_id
          );
        } else if (b.provider === 'paysafe_eft' || rail === 'eft') {
          // Direct EFT to employee bank via Paysafe
          const { data: emp } = await sb.from('employees')
            .select('first_name, last_name, email, bank_institution, bank_transit, bank_account')
            .eq('id', item.employee_id as string).single();
          const e = emp as { first_name?: string; last_name?: string; email?: string; bank_institution?: string; bank_transit?: string; bank_account?: string } | null;
          if (!e?.bank_institution || !e?.bank_transit || !e?.bank_account) {
            throw new Error('Employee missing bank details for EFT payout');
          }
          providerRef = `BP-${item.id}`;
          const { error: padErr } = await sb.functions.invoke('paysafe-eft-debit', {
            body: {
              organization_id: b.organization_id,
              amount: Number(item.amount),
              currency: item.currency,
              merchant_ref: providerRef,
              account: {
                accountHolderName: `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim(),
                institution: e.bank_institution,
                transit: e.bank_transit,
                account: e.bank_account,
                accountType: 'CHECKING',
                street: 'N/A', city: 'N/A', zip: '',
              },
              direction: 'credit',
              description: `Payroll ${b.batch_number}`,
            },
          });
          if (padErr) throw new Error(padErr.message);
        } else if (b.provider === 'paysafe_card' || rail === 'card') {
          throw new Error('Paysafe Card payout for payroll requires an employee card profile; not yet supported.');
        } else if (rail === 'cheque' || rail === 'manual' || rail === 'wire') {
          providerRef = `${rail}-${item.id}`;
        } else if (b.provider === 'wallet') {
          providerRef = `wallet-${item.id}`;
        } else {
          throw new Error(`Rail ${rail} not yet wired for provider ${b.provider}. Enable Stripe ACH on the funding bank or pick a manual rail.`);
        }


        const je = await postJE(sb, b.organization_id as string, b.pay_date as string,
          `Payroll ${b.batch_number} - employee ${item.employee_id}`,
          [
            { account_id: wagesAccountId, debit: Number(item.amount), description: `Net pay` },
            { account_id: bank.gl_account_id, credit: Number(item.amount), description: `From ${bank.name}` },
          ]
        );

        await sb.from('payroll_payment_items').update({
          status: 'processing',
          provider_transfer_id: providerRef,
          journal_entry_id: je.id,
        }).eq('id', item.id as string);

        ok++;
        results.push({ item_id: item.id, ok: true, je_id: je.id, provider_ref: providerRef });
      } catch (e) {
        fail++;
        const msg = e instanceof Error ? e.message : 'Unknown';
        await sb.from('payroll_payment_items').update({
          status: 'failed', failure_reason: msg,
        }).eq('id', item.id as string);
        results.push({ item_id: item.id, ok: false, error: msg });
      }
    }

    const newStatus = fail === 0 ? 'processing' : (ok === 0 ? 'failed' : 'partial');
    await sb.from('payroll_payment_batches').update({ status: newStatus }).eq('id', batch_id);

    await sb.from('treasury_payment_audit').insert({
      organization_id: b.organization_id,
      entity_type: 'ap_batch',  // re-use enum; payroll runs are audited under same bucket
      entity_id: batch_id,
      action: 'initiate_payroll',
      actor_id: userId,
      ip_address: req.headers.get('x-forwarded-for') ?? null,
      before_state: { status: b.status },
      after_state: { status: newStatus, success: ok, failed: fail },
    });

    return json(200, { success: true, success_count: ok, fail_count: fail, results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('treasury-pay-payroll-batch error:', msg);
    return json(500, { error: msg });
  }
});
