// Read-only payment-status check used by the payment-status page and the public
// /pay page after a Square hosted checkout redirects the payer back.
//
// Public endpoint (verify_jwt = false): only a payment link id is accepted and
// nothing sensitive is returned. It never writes. Bookkeeping stays webhook-driven;
// this only verifies what the payer should be told.
//
//   { status: 'paid' }                     order COMPLETED or link already marked paid
//   { status: 'cancelled' }                order CANCELED
//   { status: 'pending' }                  order OPEN or no checkout created yet
//   { status: 'unknown', error }           Square/DB error — never report success
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { squareFetch, squareErrorMessage } from "../_shared/square.ts";

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
    const { payment_link_id } = await req.json().catch(() => ({}));
    if (!payment_link_id || typeof payment_link_id !== 'string') {
      return json({ error: 'payment_link_id is required' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: link, error } = await admin
      .from('payment_links')
      .select('id, status, amount, currency, square_order_id')
      .eq('id', payment_link_id)
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);
    if (!link) return json({ status: 'unknown', error: 'Payment link not found' }, 404);

    // Webhook already processed this payment — authoritative.
    if (link.status === 'paid') {
      return json({ status: 'paid', amount: Number(link.amount), currency: link.currency });
    }

    if (!link.square_order_id) {
      // Checkout created but never opened/paid yet — keep polling.
      return json({ status: 'pending' });
    }

    const res = await squareFetch(`/v2/orders/${link.square_order_id}`);
    if (!res.ok) {
      const msg = squareErrorMessage(res.body, `Square returned ${res.status}`);
      return json({ status: 'unknown', error: msg }, 502);
    }

    const state = res.body?.order?.state;
    if (state === 'COMPLETED') {
      return json({ status: 'paid', amount: Number(link.amount), currency: link.currency });
    }
    if (state === 'CANCELED') {
      return json({ status: 'cancelled' });
    }
    return json({ status: 'pending' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('square-check-payment-status error:', message);
    return json({ status: 'unknown', error: message }, 500);
  }
});
