import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { settleCollectionToWise } from "../_shared/wise-settlement.ts";

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
  // Resolve bank GL account (from bank_accounts.gl_account_id) or fall back to default cash
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

  if (!cashAccountId || !ar) {
    throw new Error('Could not resolve Cash or AR account for organization');
  }

  // Generate next JE reference
  const { data: existing } = await admin.from('journal_entries')
    .select('reference').eq('organization_id', args.organizationId).like('reference', 'JE-%');
  let maxNum = 0;
  for (const e of existing ?? []) {
    const m = (e as { reference?: string }).reference?.match(/JE-(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  const jeRef = `JE-${String(maxNum + 1).padStart(4, '0')}`;

  // Create as draft, insert lines, then post
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const payment_link_id: string | undefined = body?.payment_link_id;
    const payment_handle_token: string | undefined = body?.payment_handle_token;

    if (!payment_link_id || !payment_handle_token) {
      return new Response(JSON.stringify({ error: 'payment_link_id and payment_handle_token required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('PAYSAFE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'PAYSAFE_API_KEY is not configured.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: link, error: linkErr } = await admin
      .from('payment_links')
      .select('*')
      .eq('id', payment_link_id)
      .single();
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

    const amountMinor = Math.round(Number(link.amount) * 100);
    const merchantRefNum = `${link.reference}-${Date.now()}`;

    const psResp = await fetch(`${paysafeBase()}/paymenthub/v1/payments`, {
      method: 'POST',
      headers: {
        'Authorization': paysafeAuthHeader(apiKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merchantRefNum,
        amount: amountMinor,
        currencyCode: (link.currency || 'CAD').toUpperCase(),
        settleWithAuth: true,
        paymentHandleToken: payment_handle_token,
      }),
    });

    const psBody = await psResp.json();
    if (!psResp.ok) {
      const code = String(psBody?.error?.code ?? '');
      const fieldErrs: string = Array.isArray(psBody?.error?.fieldErrors)
        ? psBody.error.fieldErrors.map((f: { field?: string; error?: string }) => f.field ? `${f.field}: ${f.error}` : f.error).filter(Boolean).join('; ')
        : '';
      const msg = (psBody?.error?.message || 'Paysafe rejected the charge') + (fieldErrs ? ` — ${fieldErrs}` : '');

      await admin.from('payment_link_events').insert({
        payment_link_id: link.id,
        event_type: 'paysafe_charge_failed',
        payload: psBody,
      });

      return new Response(JSON.stringify({ error: msg, code: code || 'PAYSAFE_ERROR', details: psBody }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const settled = psBody?.status === 'COMPLETED' || psBody?.status === 'PROCESSING';

    if (settled) {
      const alreadySynced = (link.metadata ?? {}).invoice_synced === true;

      await admin.from('payment_links').update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        metadata: { ...(link.metadata ?? {}), paysafe_payment: psBody, invoice_synced: true },
      }).eq('id', link.id);

      if (!alreadySynced) {
        // 1. Bank transaction for reconciliation
        if (link.deposit_bank_account_id) {
          await admin.from('bank_transactions').insert({
            bank_account_id: link.deposit_bank_account_id,
            transaction_date: new Date().toISOString().slice(0, 10),
            description: `Payment link ${link.reference}`,
            amount: link.amount,
            transaction_type: 'deposit',
            status: 'unmatched',
            reference: psBody?.id ?? link.reference,
            memo: link.instant_payment
              ? `Instant (${link.instant_method ?? 'instant'}) via Paysafe`
              : 'Paysafe payment link',
            payee_payor: link.payer_name ?? null,
          });
        }

        // 2. Apply to invoice + journal entry
        if (link.invoice_id) {
          const { data: inv } = await admin
            .from('invoices')
            .select('id, customer_id, total, amount_paid, balance_due, organization_id, invoice_number')
            .eq('id', link.invoice_id)
            .maybeSingle();

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
              payment_method: 'card',
              reference: link.reference,
              notes: `Paysafe payment link ${link.reference}`,
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
                description: `Payment received for ${inv.invoice_number}`,
                bankAccountId: link.deposit_bank_account_id ?? null,
              });
              if (jeId && ipRow?.id) {
                await admin.from('customer_payments').update({ journal_entry_id: jeId }).eq('id', ipRow.id);
              }
            } catch (jeErr) {
              console.error('JE post failed', jeErr);
              await admin.from('payment_link_events').insert({
                payment_link_id: link.id,
                event_type: 'je_post_failed',
                payload: { error: String(jeErr) },
              });
            }
          }
        }
      }
    }

    // Settlement leg — move the captured funds to Wise when the org routes
    // invoice card collections there. Never fails the capture.
    let settlement: Record<string, unknown> | null = null;
    if (settled) {
      try {
        const res = await settleCollectionToWise(admin, {
          organizationId: link.organization_id,
          amount: Number(link.amount),
          currency: (link.currency || 'CAD').toUpperCase(),
          reference: link.reference,
          invoiceId: link.invoice_id ?? null,
          paymentLinkId: link.id,
          sourceLabel: 'paysafe_card',
        });
        if (!res.skippedReason || res.skippedReason !== 'not_enabled') {
          settlement = res as unknown as Record<string, unknown>;
          await admin.from('payment_link_events').insert({
            payment_link_id: link.id,
            event_type: res.settled ? 'wise_settlement_initiated' : 'wise_settlement_failed',
            payload: res,
          });
        }
      } catch (setErr) {
        console.error('Wise settlement failed', setErr);
        await admin.from('payment_link_events').insert({
          payment_link_id: link.id,
          event_type: 'wise_settlement_failed',
          payload: { error: String(setErr) },
        });
      }
    }

    await admin.from('payment_link_events').insert({
      payment_link_id: link.id,
      event_type: 'paysafe_charge_completed',
      payload: psBody,
    });

    return new Response(JSON.stringify({ ok: true, status: psBody?.status, payment: psBody, settlement }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('paysafe-charge-handle error', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
