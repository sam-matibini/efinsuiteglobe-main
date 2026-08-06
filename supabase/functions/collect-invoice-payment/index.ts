import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { squareFetch, squareErrorMessage, squareLocationId, toMinorUnits } from "../_shared/square.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace('Bearer ', '')
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { invoiceId, paymentMethods, successUrl, cancelUrl } = await req.json();

    if (!invoiceId) {
      return new Response(JSON.stringify({ error: 'invoiceId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role for data access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch invoice with customer info
    const { data: invoice, error: invError } = await supabaseAdmin
      .from('invoices')
      .select('*, customer:customers(id, name, email, stripe_customer_id)')
      .eq('id', invoiceId)
      .single();

    if (invError || !invoice) {
      return new Response(JSON.stringify({ error: 'Invoice not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (Number(invoice.balance_due) <= 0) {
      return new Response(JSON.stringify({ error: 'Invoice has no balance due' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (['paid', 'void', 'draft'].includes(invoice.status)) {
      return new Response(JSON.stringify({ error: `Cannot collect payment on ${invoice.status} invoice` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine the payment methods the caller wants.
    const allowedMethods = paymentMethods && paymentMethods.length > 0
      ? paymentMethods
      : ['card'];

    // Square handles cards only; any ACH/Interac method keeps the Stripe path.
    const cardOnly = allowedMethods.every((m: string) => m === 'card');

    // Does this org route card checkout through Square?
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('efinconnect_preferences')
      .eq('id', invoice.organization_id)
      .maybeSingle();
    const prefs = (org?.efinconnect_preferences ?? {}) as Record<string, any>;
    const squareEnabled = prefs?.payoutProviders?.square === true;

    if (squareEnabled && cardOnly) {
      try {
        return await collectViaSquare(supabaseAdmin, invoice, allowedMethods, successUrl, req, claimsData.claims.sub as string | undefined);
      } catch (squareError: any) {
        // Square misconfigured / rejected the currency — fall through to Stripe.
        console.error('collect-invoice-payment: Square path failed, falling back to Stripe:', squareError?.message ?? squareError);
      }
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: 'Stripe is not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

    // Get or create Stripe customer
    let stripeCustomerId = invoice.customer?.stripe_customer_id;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: invoice.customer?.name || 'Unknown',
        email: invoice.customer?.email || undefined,
        metadata: {
          supabase_customer_id: invoice.customer_id,
          organization_id: invoice.organization_id,
        },
      });
      stripeCustomerId = customer.id;

      // Save Stripe customer ID
      await supabaseAdmin
        .from('customers')
        .update({ stripe_customer_id: stripeCustomerId } as Record<string, unknown>)
        .eq('id', invoice.customer_id);
    }

    // Create Checkout Session
    const balanceCents = Math.round(Number(invoice.balance_due) * 100);
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: allowedMethods,
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: (invoice.currency || 'cad').toLowerCase(),
          product_data: {
            name: `Invoice ${invoice.invoice_number}`,
            description: `Payment for invoice ${invoice.invoice_number}`,
          },
          unit_amount: balanceCents,
        },
        quantity: 1,
      }],
      metadata: {
        invoice_id: invoice.id,
        organization_id: invoice.organization_id,
        customer_id: invoice.customer_id,
      },
      success_url: successUrl || `${req.headers.get('origin')}/invoices?payment=success`,
      cancel_url: cancelUrl || `${req.headers.get('origin')}/invoices?payment=cancelled`,
    });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('collect-invoice-payment error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/**
 * Square hosted-checkout leg: ensures a payment_links row exists for the
 * invoice (reusing an OPEN one whose amount/currency still match), creates the
 * Square checkout, persists the square ids + hosted URL, and returns the URL
 * the payer is redirected to. The square-webhook reconciles the payment.
 */
async function collectViaSquare(
  supabaseAdmin: any,
  invoice: any,
  _allowedMethods: string[],
  successUrl: string | undefined,
  req: Request,
  userId: string | undefined,
) {
  const balanceDue = Number(invoice.balance_due);
  const currency = (invoice.currency || 'CAD').toUpperCase();
  const payerEmail = invoice.customer?.email ?? null;
  const payerName = invoice.customer?.name ?? null;

  // Reuse the most recent OPEN link for this invoice if amount + currency match.
  const { data: existing } = await supabaseAdmin
    .from('payment_links')
    .select('id, reference, amount, currency, status, square_checkout_url')
    .eq('organization_id', invoice.organization_id)
    .eq('invoice_id', invoice.id)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1);

  let link = existing?.[0] ?? null;
  const matches =
    link &&
    Math.abs(Number(link.amount) - balanceDue) < 0.01 &&
    String(link.currency || '').toUpperCase() === currency;

  if (link && matches && link.square_checkout_url) {
    return new Response(JSON.stringify({ url: link.square_checkout_url, provider: 'square', reused: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!link || !matches) {
    const { data: refData, error: refErr } = await supabaseAdmin.rpc(
      'next_payment_link_reference',
      { p_org: invoice.organization_id },
    );
    if (refErr) throw new Error(refErr.message);
    const reference = refData as string;

    const { data: created, error: createErr } = await supabaseAdmin
      .from('payment_links')
      .insert({
        organization_id: invoice.organization_id,
        reference,
        status: 'open',
        currency,
        payment_method: 'any_card',
        create_invoice_on_payment: false,
        created_by: userId ?? null,
        amount: balanceDue,
        description: invoice.invoice_number
          ? `Invoice ${invoice.invoice_number}`
          : 'Invoice payment',
        invoice_id: invoice.id,
        customer_id: invoice.customer_id ?? null,
        payer_name: payerName,
        payer_email: payerEmail,
        metadata: { source: 'invoice_pay_now' },
      })
      .select('id, reference')
      .single();
    if (createErr) throw new Error(createErr.message);
    link = created;
  }

  const amountMinor = toMinorUnits(balanceDue);
  if (!(amountMinor > 0)) throw new Error('Nothing to pay on this invoice');

  const origin = req.headers.get('origin');
  const redirectUrl = origin
    ? `${origin}/payment-status/${link.id}?method=square`
    : successUrl;

  const created = await squareFetch('/v2/online-checkout/payment-links', {
    method: 'POST',
    body: {
      idempotency_key: `pl-${link.id}`,
      quick_pay: {
        name: invoice.invoice_number
          ? `Invoice ${invoice.invoice_number}`
          : 'Invoice payment',
        price_money: { amount: amountMinor, currency },
        location_id: squareLocationId(),
      },
      checkout_options: {
        redirect_url: redirectUrl || undefined,
        ask_for_shipping_address: false,
      },
      pre_populated_data: { buyer_email: payerEmail || undefined },
      payment_note: `${link.reference} · invoice payment`,
    },
  });

  if (!created.ok) {
    throw new Error(squareErrorMessage(created.body, 'Square rejected the checkout request'));
  }

  const sqLink = created.body?.payment_link ?? {};
  const url: string | undefined = sqLink.long_url || sqLink.url;
  if (!url) throw new Error('Square did not return a checkout URL');

  await supabaseAdmin
    .from('payment_links')
    .update({
      square_payment_link_id: sqLink.id ?? null,
      square_order_id: sqLink.order_id ?? null,
      square_checkout_url: url,
    })
    .eq('id', link.id);

  await supabaseAdmin.from('payment_link_events').insert({
    payment_link_id: link.id,
    event_type: 'square_link_created',
    payload: created.body,
  });

  return new Response(JSON.stringify({ url, provider: 'square', paymentLinkId: link.id }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
