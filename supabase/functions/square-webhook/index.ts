// Square webhook: marks payment links paid when a Square hosted checkout
// completes, records the invoice payment + journal entry, and (when enabled)
// settles the collected funds to Wise.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifySquareSignature, squareFetch } from "../_shared/square.ts";
import { recordInvoicePayment } from "../_shared/invoice_payment.ts";
import { settleCollectionToWise } from "../_shared/wise-settlement.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-square-hmacsha256-signature',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const rawBody = await req.text();
  const signature = req.headers.get('x-square-hmacsha256-signature');
  const notificationUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/square-webhook`;

  const valid = await verifySquareSignature(rawBody, signature, notificationUrl);
  if (!valid) {
    console.error('square-webhook: invalid signature');
    return json({ error: 'Invalid signature' }, 401);
  }

  let event: any = null;
  try { event = JSON.parse(rawBody); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const type: string = event?.type ?? '';
  const object = event?.data?.object ?? {};

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Resolve the Square payment (and its order) from the supported events.
    let payment: any = null;
    if (type === 'payment.created' || type === 'payment.updated') {
      payment = object.payment ?? null;
    } else if (type === 'order.updated' || type === 'order.fulfillment.updated') {
      const orderId = object.order_updated?.order_id ?? object.order?.id;
      if (orderId) {
        const res = await squareFetch(`/v2/orders/${orderId}`);
        const state = res.body?.order?.state;
        if (state === 'COMPLETED') {
          payment = {
            id: res.body?.order?.tenders?.[0]?.id ?? orderId,
            order_id: orderId,
            status: 'COMPLETED',
            amount_money: res.body?.order?.total_money,
          };
        }
      }
    }

    if (!payment || String(payment.status).toUpperCase() !== 'COMPLETED') {
      return json({ received: true, ignored: type });
    }

    const orderId = payment.order_id;
    if (!orderId) return json({ received: true, ignored: 'no order_id' });

    const { data: link } = await admin
      .from('payment_links')
      .select('id, organization_id, reference, amount, currency, status, invoice_id')
      .eq('square_order_id', orderId)
      .maybeSingle();

    if (!link) return json({ received: true, ignored: 'no matching payment link' });

    await admin.from('payment_link_events').insert({
      payment_link_id: link.id,
      event_type: `square_${type}`,
      payload: event,
    });

    if (link.status === 'paid') return json({ received: true, duplicate: true });

    const amount = payment.amount_money?.amount != null
      ? Number(payment.amount_money.amount) / 100
      : Number(link.amount);
    const currency = (payment.amount_money?.currency ?? link.currency ?? 'CAD').toUpperCase();
    const reference = `SQ-${payment.id}`;
    const paymentDate = new Date().toISOString().slice(0, 10);

    await admin
      .from('payment_links')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', link.id);

    // Record against the invoice (payment + invoice totals + journal entry).
    let paymentResult: unknown = null;
    if (link.invoice_id) {
      const { data: invoice } = await admin
        .from('invoices')
        .select('id, organization_id, customer_id, total, amount_paid, balance_due, currency')
        .eq('id', link.invoice_id)
        .maybeSingle();
      if (invoice) {
        paymentResult = await recordInvoicePayment(admin, {
          invoice,
          amount,
          currency,
          paymentDate,
          reference,
          paymentMethod: 'credit_card',
          notes: `Square checkout ${link.reference}`,
        });
      }
    }

    // Optional Wise settlement of the collected funds.
    let settlement: unknown = null;
    try {
      settlement = await settleCollectionToWise(admin, {
        organizationId: link.organization_id,
        amount,
        currency,
        reference,
        invoiceId: link.invoice_id,
        paymentLinkId: link.id,
        sourceLabel: 'Square checkout',
      });
    } catch (e) {
      console.error('square-webhook settlement error:', e);
    }

    return json({ received: true, payment: paymentResult, settlement });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('square-webhook error:', message);
    return json({ error: message }, 500);
  }
});
