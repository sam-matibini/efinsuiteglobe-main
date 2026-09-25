import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paysafe-signature',
};

interface PaysafeWebhook {
  eventType?: string;
  resource?: {
    merchantRefNum?: string;
    status?: string;
    amount?: number;
    currencyCode?: string;
    id?: string;
    card?: {
      cardType?: string;   // 'CREDIT' | 'DEBIT'
      brand?: string;      // 'VI' | 'MC' | 'AM' | 'VD' (Visa Debit) ...
      lastDigits?: string;
    };
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const secret = Deno.env.get('PAYSAFE_WEBHOOK_SECRET');
    const provided = req.headers.get('x-paysafe-signature') || req.headers.get('X-Webhook-Secret');
    if (!secret || provided !== secret) {
      console.warn('Paysafe webhook auth failed');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const payload = await req.json() as PaysafeWebhook;
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const ref = payload?.resource?.merchantRefNum ?? '';
    const status = payload?.resource?.status;
    const linkRef = ref.split('-').slice(0, 3).join('-'); // PL-YYYY-NNNNN[-timestamp]
    const isLink = linkRef.startsWith('PL-');
    const isTax = linkRef.startsWith('TX-') || linkRef.startsWith('TP-') || linkRef.startsWith('TAX-');
    const isBatch = ref.startsWith('BP-');

    if (isLink) {
      const { data: link } = await admin
        .from('payment_links')
        .select('*')
        .eq('reference', linkRef)
        .maybeSingle();

      if (link) {
        await admin.from('payment_link_events').insert({
          payment_link_id: link.id,
          event_type: payload.eventType ?? 'webhook',
          payload: {
            ...payload,
            card_type: payload?.resource?.card?.cardType ?? null,
            card_brand: payload?.resource?.card?.brand ?? null,
            card_last_digits: payload?.resource?.card?.lastDigits ?? null,
          },
        });

        if (status === 'COMPLETED') {
          const alreadySynced = (link.metadata ?? {}).invoice_synced === true;

          await admin.from('payment_links').update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            metadata: { ...(link.metadata ?? {}), invoice_synced: true },
          }).eq('id', link.id);

          if (alreadySynced) {
            // charge handler already posted invoice + bank tx + JE; skip
            return new Response(JSON.stringify({ received: true, skipped: 'already synced' }), {
              status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // Record matching bank deposit so it can be reconciled
          if (link.deposit_bank_account_id) {
            await admin.from('bank_transactions').insert({
              bank_account_id: link.deposit_bank_account_id,
              transaction_date: new Date().toISOString().slice(0, 10),
              description: `Payment link ${link.reference}`,
              amount: link.amount,
              transaction_type: 'deposit',
              status: 'unmatched',
              reference: payload?.resource?.id ?? link.reference,
              memo: link.instant_payment
                ? `Instant (${link.instant_method ?? 'instant'}) via Paysafe`
                : 'Paysafe payment link',
              payee_payor: link.payer_name ?? null,
            } as Record<string, unknown>);
          }

          // If linked to invoice → record invoice payment
          if (link.invoice_id) {
            const { data: inv } = await admin.from('invoices').select('balance_due, total, amount_paid, organization_id, customer_id, invoice_number').eq('id', link.invoice_id).single();
            if (inv) {
              await admin.from('customer_payments').insert({
                organization_id: link.organization_id,
                invoice_id: link.invoice_id,
                customer_id: inv.customer_id ?? link.customer_id,
                amount: link.amount,
                payment_date: new Date().toISOString().slice(0, 10),
                payment_method: 'paysafe',
                reference: payload?.resource?.id ?? linkRef,
                notes: `Paysafe payment link ${link.reference}`,
              } as Record<string, unknown>);
              const newAmountPaid = Number(inv.amount_paid ?? 0) + Number(link.amount);
              const newBalance = Math.max(0, Number(inv.total) - newAmountPaid);
              const isPaid = newBalance <= 0.01;
              await admin.from('invoices').update({
                amount_paid: newAmountPaid,
                balance_due: newBalance,
                status: isPaid ? 'paid' : 'partial',
                paid_at: isPaid ? new Date().toISOString() : null,
              } as Record<string, unknown>).eq('id', link.invoice_id);
            }
          }
        } else if (status === 'FAILED') {
          await admin.from('payment_links').update({ status: 'open' }).eq('id', link.id);
        }
      }
    } else if (isTax) {
      const { data: tp } = await admin.from('tax_payments').select('*').eq('reference', linkRef).maybeSingle();
      if (tp) {
        if (status === 'COMPLETED') {
          await admin.from('tax_payments').update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            metadata: { ...(tp.metadata ?? {}), paysafe_webhook: payload },
          }).eq('id', tp.id);
        } else if (status === 'FAILED') {
          await admin.from('tax_payments').update({
            status: 'failed',
            metadata: { ...(tp.metadata ?? {}), paysafe_webhook: payload },
          }).eq('id', tp.id);
        }
      }
    } else if (isBatch) {
      // BP-<item_id> - settle AP or payroll batch item
      const itemId = ref.slice(3);
      const completed = status === 'COMPLETED';
      const failed = status === 'FAILED';
      if (completed || failed) {
        const patch = completed
          ? { status: 'completed', provider_transfer_id: payload?.resource?.id ?? ref }
          : { status: 'failed', failure_reason: 'Paysafe reported FAILED' };
        await admin.from('ap_payment_batch_items').update(patch).eq('id', itemId);
        await admin.from('payroll_payment_items').update(patch).eq('id', itemId);
        // Mirror against payment_links if one exists
        await admin.from('payment_links').update({
          status: completed ? 'paid' : 'open',
          paid_at: completed ? new Date().toISOString() : null,
        }).eq('reference', ref);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('paysafe-webhook error', msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
