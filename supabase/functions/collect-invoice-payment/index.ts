import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

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

    // Determine payment method types
    const allowedMethods = paymentMethods && paymentMethods.length > 0
      ? paymentMethods
      : ['card'];

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
