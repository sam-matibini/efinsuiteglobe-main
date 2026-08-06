// Creates a Square hosted checkout (Online Checkout / Payment Links API) for an
// open payment link, and returns the hosted URL the payer is redirected to.
//
// Public endpoint (verify_jwt = false): the payer is not authenticated. Only the
// payment link id is accepted and only 'open' links are honoured.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { squareFetch, squareErrorMessage, squareLocationId, toMinorUnits } from "../_shared/square.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { payment_link_id, redirect_url } = await req.json().catch(() => ({}));
    if (!payment_link_id || typeof payment_link_id !== 'string') {
      return json({ error: 'payment_link_id is required' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: link, error } = await admin
      .from('payment_links')
      .select('id, organization_id, reference, amount, currency, description, status, invoice_id, payer_email, square_checkout_url, expires_at')
      .eq('id', payment_link_id)
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);
    if (!link) return json({ error: 'This payment link is no longer available.' }, 404);
    if (link.status !== 'open') return json({ error: `This payment link is ${link.status}.` }, 400);
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return json({ error: 'This payment link has expired.' }, 400);
    }

    // Reuse the hosted checkout if one was already created for this link.
    if (link.square_checkout_url) {
      return json({ url: link.square_checkout_url, reused: true });
    }

    const amountMinor = toMinorUnits(Number(link.amount));
    if (!(amountMinor > 0)) return json({ error: 'Nothing to pay on this link.' }, 400);

    const created = await squareFetch('/v2/online-checkout/payment-links', {
      method: 'POST',
      body: {
        idempotency_key: `pl-${link.id}`,
        quick_pay: {
          name: link.description || `Payment ${link.reference}`,
          price_money: {
            amount: amountMinor,
            currency: (link.currency || 'CAD').toUpperCase(),
          },
          location_id: squareLocationId(),
        },
        checkout_options: {
          redirect_url: redirect_url || undefined,
          ask_for_shipping_address: false,
        },
        pre_populated_data: {
          buyer_email: link.payer_email || undefined,
        },
        payment_note: `${link.reference}${link.invoice_id ? ' · invoice payment' : ''}`,
      },
    });

    if (!created.ok) {
      const msg = squareErrorMessage(created.body, 'Square rejected the checkout request');
      await admin.from('payment_link_events').insert({
        payment_link_id: link.id,
        event_type: 'square_link_failed',
        payload: created.body,
      });
      return json({ error: msg }, 502);
    }

    const sqLink = created.body?.payment_link ?? {};
    const url: string | undefined = sqLink.long_url || sqLink.url;
    if (!url) return json({ error: 'Square did not return a checkout URL' }, 502);

    await admin
      .from('payment_links')
      .update({
        square_payment_link_id: sqLink.id ?? null,
        square_order_id: sqLink.order_id ?? null,
        square_checkout_url: url,
      })
      .eq('id', link.id);

    await admin.from('payment_link_events').insert({
      payment_link_id: link.id,
      event_type: 'square_link_created',
      payload: created.body,
    });

    return json({ url, payment_link_id: sqLink.id ?? null, order_id: sqLink.order_id ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('square-create-payment-link error:', message);
    return json({ error: message }, 500);
  }
});
