// Treasury - Process a tax payment (CRA / IRS / other authority)
// Posts a draft JE (DR Liability / CR Bank), optionally initiates external rail (Stripe/Plaid),
// and writes an audit row. Webhook later flips to 'paid' or 'failed'.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LIABILITY_PREFIX: Record<string, string[]> = {
  source_deductions: ['2-2', '2-20', '2-21'],
  gst_hst: ['2-3', '2-30'],
  corporate_tax: ['2-4', '2-40'],
  provision: ['2-4', '2-40'],
  withholding: ['2-2', '2-3'],
  other: ['2-'],
};

const NAME_KEYWORDS: Record<string, string[]> = {
  source_deductions: ['source deduction', 'payroll', 'cpp', 'ei payable', 'income tax payable', 'pd7a'],
  gst_hst: ['gst', 'hst', 'sales tax'],
  corporate_tax: ['corporate tax', 'income tax payable', 'tax payable'],
  provision: ['tax provision', 'income tax'],
  withholding: ['withholding'],
  other: ['tax'],
};

async function resolveLiabilityAccount(supabase: any, orgId: string, paymentType: string, metaOverride?: string) {
  if (metaOverride) return metaOverride;
  const prefixes = LIABILITY_PREFIX[paymentType] ?? ['2-'];
  for (const prefix of prefixes) {
    const { data } = await supabase
      .from('accounts')
      .select('id, code')
      .eq('organization_id', orgId)
      .eq('account_type', 'liability')
      .eq('is_active', true)
      .eq('posting_allowed', true)
      .ilike('code', `${prefix}%`)
      .limit(1);
    if (data && data.length > 0) return data[0].id;
  }
  // Fallback 1: match by account name keyword
  const keywords = NAME_KEYWORDS[paymentType] ?? ['tax'];
  for (const kw of keywords) {
    const { data } = await supabase
      .from('accounts')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('account_type', 'liability')
      .eq('is_active', true)
      .eq('posting_allowed', true)
      .ilike('name', `%${kw}%`)
      .limit(1);
    if (data && data.length > 0) return data[0].id;
  }
  // Fallback 2: any active liability account
  const { data: anyLiab } = await supabase
    .from('accounts')
    .select('id')
    .eq('organization_id', orgId)
    .eq('account_type', 'liability')
    .eq('is_active', true)
    .eq('posting_allowed', true)
    .order('code', { ascending: true })
    .limit(1);
  if (anyLiab && anyLiab.length > 0) return anyLiab[0].id;
  return null;
}

async function nextJournalReference(supabase: any, orgId: string): Promise<string> {
  const { data } = await supabase
    .from('journal_entries')
    .select('reference')
    .eq('organization_id', orgId)
    .like('reference', 'JE-%');
  let maxNum = 0;
  for (const e of data ?? []) {
    const m = e.reference?.match(/JE-(\d+)$/);
    if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; }
  }
  return `JE-${String(maxNum + 1).padStart(4, '0')}`;
}

async function postJournalEntry(supabase: any, params: {
  orgId: string;
  date: string;
  reference?: string;
  description: string;
  status: 'draft' | 'posted';
  lines: Array<{ account_id: string; debit?: number; credit?: number; description?: string }>;
}) {
  const reference = params.reference ?? await nextJournalReference(supabase, params.orgId);
  const { data: je, error: jeErr } = await supabase
    .from('journal_entries')
    .insert([{
      organization_id: params.orgId,
      entry_date: params.date,
      reference,
      description: params.description,
      journal_type: 'manual',
      status: 'draft',
    }])
    .select()
    .single();
  if (jeErr) throw jeErr;

  const { error: linesErr } = await supabase
    .from('journal_entry_lines')
    .insert(params.lines.map((l, i) => ({
      journal_entry_id: je.id,
      account_id: l.account_id,
      debit: l.debit ?? 0,
      credit: l.credit ?? 0,
      description: l.description ?? null,
      line_order: i,
    })));
  if (linesErr) {
    await supabase.from('journal_entries').delete().eq('id', je.id);
    throw linesErr;
  }

  if (params.status === 'posted') {
    const { error: upErr } = await supabase
      .from('journal_entries')
      .update({ status: 'posted' })
      .eq('id', je.id);
    if (upErr) {
      await supabase.from('journal_entry_lines').delete().eq('journal_entry_id', je.id);
      await supabase.from('journal_entries').delete().eq('id', je.id);
      throw upErr;
    }
  }
  return je;
}

async function initiateStripePayment(
  amount: number, currency: string, description: string, idempotencyKey: string,
  stripeBankAccountId: string | null
) {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  const params: Record<string, string> = {
    amount: String(Math.round(amount * 100)),
    currency: currency.toLowerCase(),
    description,
    capture_method: 'automatic',
  };
  const body = new URLSearchParams(params);
  if (stripeBankAccountId) {
    // ACH debit from the linked bank account
    body.append('payment_method_types[]', 'us_bank_account');
    body.append('payment_method_data[type]', 'us_bank_account');
    body.append('payment_method_data[us_bank_account][financial_connections_account]', stripeBankAccountId);
    body.append('confirm', 'true');
  } else {
    body.append('payment_method_types[]', 'card');
  }
  const res = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': idempotencyKey,
    },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe error: ${data?.error?.message ?? res.status}`);
  return data.id as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: cErr } = await supabase.auth.getClaims(token);
    if (cErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = claims.claims.sub;

    const { tax_payment_id, liability_account_id } = await req.json();
    if (!tax_payment_id) {
      return new Response(JSON.stringify({ error: 'tax_payment_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: payment, error: pErr } = await supabase
      .from('tax_payments').select('*').eq('id', tax_payment_id).single();
    if (pErr || !payment) {
      return new Response(JSON.stringify({ error: 'Payment not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!['draft', 'scheduled'].includes(payment.status)) {
      return new Response(JSON.stringify({ error: `Cannot process payment in status ${payment.status}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (payment.approval_state && payment.approval_state !== 'approved') {
      return new Response(JSON.stringify({ error: 'Payment is not approved yet. Complete the review/approval workflow first.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!payment.bank_account_id) {
      return new Response(JSON.stringify({ error: 'Funding bank account required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: bank } = await supabase
      .from('bank_accounts')
      .select('id, name, gl_account_id, stripe_bank_account_id, plaid_access_token')
      .eq('id', payment.bank_account_id).single();
    if (!bank?.gl_account_id) {
      return new Response(JSON.stringify({ error: 'Bank account missing GL link' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const liabAcct = await resolveLiabilityAccount(
      supabase, payment.organization_id, payment.payment_type,
      liability_account_id ?? (payment.metadata as any)?.liability_account_id
    );
    if (!liabAcct) {
      return new Response(JSON.stringify({ error: 'Could not resolve tax liability GL account. Pass liability_account_id.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // External rail
    let providerRef: string | null = null;
    let newStatus: string = 'submitted';
    if (payment.payment_method === 'stripe') {
      providerRef = await initiateStripePayment(
        Number(payment.amount), payment.currency, `Tax payment ${payment.reference}`,
        `tax-${payment.id}`, bank.stripe_bank_account_id ?? null
      );
    } else if (payment.payment_method === 'plaid_ach') {
      if (!bank.stripe_bank_account_id) {
        return new Response(JSON.stringify({ error: 'Enable Stripe ACH on this bank account first (Treasury Settings → Funding Bank Accounts).' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      providerRef = await initiateStripePayment(
        Number(payment.amount), payment.currency, `Tax payment ${payment.reference} (Plaid ACH)`,
        `tax-${payment.id}`, bank.stripe_bank_account_id
      );
    } else if (payment.payment_method === 'paysafe_card' || payment.payment_method === 'paysafe_interac') {
      // Create a hosted Paysafe payment link the org admin uses to pay CRA via card / Interac.
      // Webhook (TAX- prefix) flips tax_payments.status when settled.
      const isInterac = payment.payment_method === 'paysafe_interac';
      const { data: link, error: linkErr } = await supabase.from('payment_links').insert({
        organization_id: payment.organization_id,
        reference: payment.reference,
        status: 'open',
        amount: Number(payment.amount),
        currency: payment.currency,
        description: `CRA ${payment.payment_type} – ${payment.reference}`,
        payment_method: isInterac ? 'interac' : 'any_card',
        deposit_bank_account_id: payment.bank_account_id,
        payer_email: (payment.metadata as any)?.receipt_email ?? null,
        metadata: { tax_payment_id: payment.id, kind: 'cra_outbound' },
      }).select().single();
      if (linkErr) throw linkErr;
      providerRef = (link as { id: string }).id;
    } else if (payment.payment_method === 'paysafe_eft') {
      // Direct EFT debit on funding bank via Paysafe. Webhook flips status.
      const { data: eft, error: eftErr } = await supabase.functions.invoke('paysafe-eft-debit', {
        body: {
          amount: Number(payment.amount),
          currency: payment.currency,
          merchant_ref: payment.reference,
          bank_account_id: payment.bank_account_id,
          description: `CRA ${payment.payment_type} – ${payment.reference}`,
        },
      });
      if (eftErr) throw eftErr;
      providerRef = (eft as any)?.transaction_id ?? null;
    }
    // manual / cra_my_payment / eft / wire / cheque / pad: just mark submitted

    // Post JE (draft until rail confirms)
    const je = await postJournalEntry(supabase, {
      orgId: payment.organization_id,
      date: payment.scheduled_for ?? new Date().toISOString().slice(0, 10),
      description: `Tax payment ${payment.reference} - ${payment.payment_type}`,
      status: 'draft',
      lines: [
        { account_id: liabAcct, debit: Number(payment.amount), description: `${payment.payment_type} remittance` },
        { account_id: bank.gl_account_id, credit: Number(payment.amount), description: `From ${bank.name}` },
      ],
    });

    // Update payment record
    const before = { status: payment.status };
    await supabase.from('tax_payments').update({
      status: newStatus,
      submitted_at: new Date().toISOString(),
      submitted_by: userId,
      journal_entry_id: je.id,
      provider_transfer_id: providerRef,
    }).eq('id', payment.id);

    // Audit
    await supabase.from('treasury_payment_audit').insert({
      organization_id: payment.organization_id,
      entity_type: 'tax_payment',
      entity_id: payment.id,
      action: 'initiate',
      actor_id: userId,
      ip_address: req.headers.get('x-forwarded-for') ?? null,
      before_state: before,
      after_state: { status: newStatus, journal_entry_id: je.id, provider_transfer_id: providerRef },
    });

    return new Response(JSON.stringify({ success: true, journal_entry_id: je.id, provider_transfer_id: providerRef, status: newStatus }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('treasury-pay-tax error:', msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
