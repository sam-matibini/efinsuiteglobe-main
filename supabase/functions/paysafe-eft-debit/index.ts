import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function paysafeBase() {
  return Deno.env.get('PAYSAFE_ENVIRONMENT') === 'live'
    ? 'https://api.paysafe.com'
    : 'https://api.test.paysafe.com';
}

function paysafeAuthHeader(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, '');
  const encoded = trimmed.includes(':') ? btoa(trimmed) : trimmed;
  return `Basic ${encoded}`;
}

type AdminClient = ReturnType<typeof createClient>;

async function findDefaultAccount(
  admin: AdminClient,
  organizationId: string,
  accountType: 'asset' | 'liability',
  codePatterns: RegExp[],
  namePatterns: string[],
  nameExcludes: string[] = [],
): Promise<{ id: string } | null> {
  const { data } = await admin.from('accounts')
    .select('id, code, name, account_type, is_header, is_active')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .eq('account_type', accountType);
  const candidates = (data ?? []).filter((a: { is_header?: boolean; name: string }) =>
    !a.is_header && !nameExcludes.some(ex => a.name.toLowerCase().includes(ex)));
  for (const p of codePatterns) {
    const f = candidates.find((a: { code: string }) => p.test(a.code));
    if (f) return { id: f.id };
  }
  for (const p of namePatterns) {
    const f = candidates.find((a: { name: string }) => a.name.toLowerCase().includes(p.toLowerCase()));
    if (f) return { id: f.id };
  }
  return null;
}

async function postPaymentJournalEntry(
  admin: AdminClient,
  args: {
    organizationId: string;
    date: string;
    amount: number;
    reference: string;
    description: string;
    bankAccountId: string | null;
  },
): Promise<string | null> {
  let cashAccountId: string | null = null;
  if (args.bankAccountId) {
    const { data: ba } = await admin.from('bank_accounts')
      .select('gl_account_id').eq('id', args.bankAccountId).maybeSingle();
    cashAccountId = ba?.gl_account_id ?? null;
  }
  if (!cashAccountId) {
    const cash = await findDefaultAccount(admin, args.organizationId, 'asset',
      [/^100\d*$/, /^1-\d+-100/, /^1\d{3}-.*$/],
      ['cash', 'bank', 'chequing', 'checking']);
    cashAccountId = cash?.id ?? null;
  }
  const ar = await findDefaultAccount(admin, args.organizationId, 'asset',
    [/^110\d*$/, /^1-\d+-110/, /^1\d{3}-.*$/],
    ['accounts receivable', 'trade receivable', 'receivable', 'a/r']);

  if (!cashAccountId || !ar) throw new Error('Could not resolve Cash or AR account for organization');

  const { data: existing } = await admin.from('journal_entries')
    .select('reference').eq('organization_id', args.organizationId).like('reference', 'JE-%');
  let maxNum = 0;
  for (const e of existing ?? []) {
    const m = (e as { reference?: string }).reference?.match(/JE-(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  const jeRef = `JE-${String(maxNum + 1).padStart(4, '0')}`;

  const { data: je, error: jeErr } = await admin.from('journal_entries').insert({
    organization_id: args.organizationId,
    entry_date: args.date,
    reference: jeRef,
    description: args.description,
    journal_type: 'bank',
    status: 'draft',
  }).select('id').single();
  if (jeErr || !je) throw jeErr ?? new Error('JE insert failed');

  const { error: linesErr } = await admin.from('journal_entry_lines').insert([
    { journal_entry_id: je.id, account_id: cashAccountId, debit: args.amount, credit: 0, description: `Payment link ${args.reference}` },
    { journal_entry_id: je.id, account_id: ar.id, debit: 0, credit: args.amount, description: `Payment link ${args.reference}` },
  ]);
  if (linesErr) {
    await admin.from('journal_entries').delete().eq('id', je.id);
    throw linesErr;
  }

  await admin.from('journal_entries').update({ status: 'posted' }).eq('id', je.id);
  return je.id;
}

interface EftBody {
  payment_link_id?: string;
  account?: {
    holder_name?: string;
    institution?: string;
    transit?: string;
    account_number?: string;
    account_type?: 'CHECKING' | 'SAVINGS';
    street?: string;
    city?: string;
    zip?: string;
  };
  consent?: boolean;
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as EftBody;
    const linkId = body?.payment_link_id;
    const acct = body?.account ?? {};
    const holder = acct.holder_name?.trim();
    const institution = acct.institution?.trim();
    const transit = acct.transit?.trim();
    const accountNumber = acct.account_number?.trim();
    const accountType = acct.account_type ?? 'CHECKING';
    const street = acct.street?.trim();
    const city = acct.city?.trim();
    const zip = (acct.zip?.trim() || 'M5H2N2').toUpperCase().replace(/\s+/g, '');

    if (!linkId || !body.consent || !holder || !institution || !transit || !accountNumber || !street || !city) {
      return new Response(JSON.stringify({ error: 'payment_link_id, consent, bank account info and billing street/city are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!/^\d{3}$/.test(institution) || !/^\d{5}$/.test(transit) || !/^\d{5,17}$/.test(accountNumber)) {
      return new Response(JSON.stringify({ error: 'Invalid Canadian bank account: institution=3 digits, transit=5 digits, account=5-17 digits' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    const apiKey = Deno.env.get('PAYSAFE_API_KEY');
    const eftAccountId = Deno.env.get('PAYSAFE_ACCOUNT_ID_EFT');
    if (!apiKey || !eftAccountId) {
      return new Response(JSON.stringify({ error: 'Paysafe EFT is not configured. Add PAYSAFE_API_KEY and PAYSAFE_ACCOUNT_ID_EFT.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: link, error: linkErr } = await admin
      .from('payment_links').select('*').eq('id', linkId).single();
    if (linkErr || !link) {
      return new Response(JSON.stringify({ error: 'Payment link not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (link.status !== 'open') {
      return new Response(JSON.stringify({ error: `Link is ${link.status}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!['eft', 'all'].includes(link.payment_method)) {
      return new Response(JSON.stringify({ error: 'This link does not accept EFT payments' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const amountMinor = Math.round(Number(link.amount) * 100);
    const merchantRefNum = `${link.reference}-EFT-${Date.now()}`;

    // 1. Create EFT payment handle
    const handleResp = await fetch(`${paysafeBase()}/paymenthub/v1/paymenthandles`, {
      method: 'POST',
      headers: {
        'Authorization': paysafeAuthHeader(apiKey),
        'Content-Type': 'application/json',
        'Simulator': Deno.env.get('PAYSAFE_ENVIRONMENT') === 'live' ? 'EXTERNAL' : 'INTERNAL',
      },
      body: JSON.stringify({
        merchantRefNum,
        transactionType: 'PAYMENT',
        paymentType: 'EFT',
        amount: amountMinor,
        currencyCode: (link.currency || 'CAD').toUpperCase(),
        accountId: eftAccountId,
        eft: {
          accountHolderName: holder,
          accountNumber,
          transitNumber: transit,
          institutionId: institution,
          accountType,
          paymentDescriptor: link.reference.slice(0, 22),
        },
        profile: { firstName: holder.split(' ')[0] || holder, lastName: holder.split(' ').slice(1).join(' ') || holder, email: link.payer_email || 'payer@example.com' },
        billingDetails: { street, city, country: 'CA', zip },
      }),
    });
    const handleBody = await handleResp.json();
    if (!handleResp.ok || !handleBody?.paymentHandleToken) {
      await admin.from('payment_link_events').insert({
        payment_link_id: link.id, event_type: 'paysafe_eft_handle_failed', payload: handleBody,
      });
      const msg = handleBody?.error?.message || 'Could not create EFT payment handle';
      return new Response(JSON.stringify({ error: msg, details: handleBody }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Settle the payment
    const psResp = await fetch(`${paysafeBase()}/paymenthub/v1/payments`, {
      method: 'POST',
      headers: { 'Authorization': paysafeAuthHeader(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantRefNum: `${merchantRefNum}-S`,
        amount: amountMinor,
        currencyCode: (link.currency || 'CAD').toUpperCase(),
        settleWithAuth: true,
        paymentHandleToken: handleBody.paymentHandleToken,
      }),
    });
    const psBody = await psResp.json();
    if (!psResp.ok) {
      await admin.from('payment_link_events').insert({
        payment_link_id: link.id, event_type: 'paysafe_eft_charge_failed', payload: psBody,
      });
      const msg = psBody?.error?.message || 'Paysafe rejected the EFT debit';
      return new Response(JSON.stringify({ error: msg, details: psBody }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const settled = psBody?.status === 'COMPLETED' || psBody?.status === 'PROCESSING' || psBody?.status === 'PENDING';
    const last3 = accountNumber.slice(-3);
    const alreadySynced = (link.metadata ?? {}).invoice_synced === true;

    if (settled) {
      await admin.from('payment_links').update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        metadata: {
          ...(link.metadata ?? {}),
          paysafe_payment: psBody,
          invoice_synced: true,
          eft_account: { holder_name: holder, institution, transit, last3, account_type: accountType },
          rail: 'eft',
        },
      }).eq('id', link.id);

      if (!alreadySynced) {
        if (link.deposit_bank_account_id) {
          await admin.from('bank_transactions').insert({
            bank_account_id: link.deposit_bank_account_id,
            transaction_date: new Date().toISOString().slice(0, 10),
            description: `Payment link ${link.reference} (EFT)`,
            amount: link.amount,
            transaction_type: 'deposit',
            status: 'unmatched',
            reference: psBody?.id ?? link.reference,
            memo: `Paysafe EFT debit · ${institution}-${transit}-***${last3}`,
            payee_payor: link.payer_name ?? holder,
          });
        }

        if (link.invoice_id) {
          const { data: inv } = await admin.from('invoices')
            .select('id, customer_id, total, amount_paid, balance_due, organization_id, invoice_number')
            .eq('id', link.invoice_id).maybeSingle();

          if (inv) {
            const newAmountPaid = Number(inv.amount_paid ?? 0) + Number(link.amount);
            const newBalance = Math.max(0, Number(inv.total) - newAmountPaid);
            const isPaid = newBalance <= 0.01;

            const { data: ipRow } = await admin.from('customer_payments').insert({
              organization_id: link.organization_id,
              invoice_id: link.invoice_id,
              customer_id: inv.customer_id ?? link.customer_id ?? null,
              amount: link.amount,
              payment_date: new Date().toISOString().slice(0, 10),
              payment_method: 'eft',
              reference: link.reference,
              notes: `Paysafe EFT payment link ${link.reference}`,
            }).select('id').maybeSingle();

            await admin.from('invoices').update({
              amount_paid: newAmountPaid,
              balance_due: newBalance,
              status: isPaid ? 'paid' : 'partial',
              paid_at: isPaid ? new Date().toISOString() : null,
            }).eq('id', link.invoice_id);

            try {
              const jeId = await postPaymentJournalEntry(admin, {
                organizationId: link.organization_id,
                date: new Date().toISOString().slice(0, 10),
                amount: Number(link.amount),
                reference: link.reference,
                description: `EFT payment received for ${inv.invoice_number}`,
                bankAccountId: link.deposit_bank_account_id ?? null,
              });
              if (jeId && ipRow?.id) {
                await admin.from('customer_payments').update({ journal_entry_id: jeId }).eq('id', ipRow.id);
              }
            } catch (jeErr) {
              console.error('JE post failed', jeErr);
              await admin.from('payment_link_events').insert({
                payment_link_id: link.id, event_type: 'je_post_failed', payload: { error: String(jeErr) },
              });
            }
          }
        }
      }
    }

    await admin.from('payment_link_events').insert({
      payment_link_id: link.id, event_type: 'paysafe_eft_completed', payload: psBody,
    });

    return new Response(JSON.stringify({ ok: true, status: psBody?.status, payment: psBody }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('paysafe-eft-debit error', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
