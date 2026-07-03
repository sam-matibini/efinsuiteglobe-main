import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StripeRequest {
  action: 'health-check' | 'test' | 'create-customer' | 'create-payment-intent' | 'create-wallet-payment' | 'sync-plans' | 'create-checkout-session' | 'manage-subscription';
  customerId?: string;
  email?: string;
  amount?: number;
  currency?: string;
  organizationId?: string;
  description?: string;
  planId?: string;
  billingCycle?: 'monthly' | 'yearly';
  successUrl?: string;
  cancelUrl?: string;
  subscriptionAction?: 'cancel' | 'reactivate' | 'change-plan';
  newPlanId?: string;
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

async function stripeRequest(path: string, method: string, body?: Record<string, string>, stripeKey?: string) {
  const key = stripeKey || Deno.env.get('STRIPE_SECRET_KEY')!;
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };
  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = new URLSearchParams(body).toString();
  }
  const res = await fetch(`https://api.stripe.com/v1${path}`, options);
  return res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const body: StripeRequest = await req.json();
    const { action } = body;

    // Health check
    if (action === 'health-check') {
      const configured = !!stripeSecretKey;
      return new Response(
        JSON.stringify({ success: true, configured, message: configured ? 'Stripe is configured' : 'Stripe secret key not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Test connection
    if (action === 'test') {
      if (!stripeSecretKey) {
        return new Response(JSON.stringify({ success: false, error: 'Stripe secret key not configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const response = await fetch('https://api.stripe.com/v1/account', {
        headers: { 'Authorization': `Bearer ${stripeSecretKey}` },
      });
      if (response.ok) {
        const account = await response.json();
        return new Response(JSON.stringify({ success: true, message: 'Stripe connection verified', accountId: account.id }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } else {
        const error = await response.json();
        return new Response(JSON.stringify({ success: false, error: error.error?.message || 'Invalid API key' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Create customer
    if (action === 'create-customer') {
      if (!stripeSecretKey) {
        return new Response(JSON.stringify({ success: false, error: 'Stripe not configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { email } = body;
      const customer = await stripeRequest('/customers', 'POST', { email: email || '' });
      return new Response(JSON.stringify({ success: true, customer }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Create wallet payment
    if (action === 'create-wallet-payment') {
      if (!stripeSecretKey) {
        return new Response(JSON.stringify({ success: false, error: 'Stripe not configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { amount, currency, organizationId, description } = body;
      if (!amount || amount <= 0) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid amount' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const noDecimalCurrencies = ['bif','clp','djf','gnf','jpy','kmf','krw','mga','pyg','rwf','ugx','vnd','vuv','xaf','xof','xpf'];
      const currencyLower = (currency || 'usd').toLowerCase();
      const amountInSmallestUnit = noDecimalCurrencies.includes(currencyLower) ? Math.round(amount) : Math.round(amount * 100);

      const params: Record<string, string> = {
        amount: amountInSmallestUnit.toString(),
        currency: currencyLower,
        'automatic_payment_methods[enabled]': 'true',
        'metadata[type]': 'voice_wallet_topup',
      };
      if (description) params.description = description;
      if (organizationId) params['metadata[organization_id]'] = organizationId;

      const paymentIntent = await stripeRequest('/payment_intents', 'POST', params);
      if (paymentIntent.error) {
        return new Response(JSON.stringify({ success: false, error: paymentIntent.error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true, paymentIntentId: paymentIntent.id, clientSecret: paymentIntent.client_secret, amount, currency }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ===== SYNC PLANS =====
    if (action === 'sync-plans') {
      if (!stripeSecretKey) {
        return new Response(JSON.stringify({ success: false, error: 'Stripe not configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const supabaseAdmin = getSupabaseAdmin();
      const { data: plans, error: plansError } = await supabaseAdmin
        .from('pricing_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (plansError) {
        return new Response(JSON.stringify({ success: false, error: plansError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const results = [];
      for (const plan of plans || []) {
        // Create or retrieve Stripe Product
        let stripeProductId = plan.stripe_product_id;
        if (!stripeProductId) {
          const productParams: Record<string, string> = {
            name: plan.name,
            'metadata[plan_id]': plan.id,
          };
          if (plan.description) productParams.description = plan.description;
          const product = await stripeRequest('/products', 'POST', productParams);
          if (product.error) {
            results.push({ plan: plan.name, error: product.error.message });
            continue;
          }
          stripeProductId = product.id;
        }

        // Create monthly price if needed
        let monthlyPriceId = plan.stripe_price_id_monthly;
        if (!monthlyPriceId && plan.price_monthly > 0) {
          const price = await stripeRequest('/prices', 'POST', {
            product: stripeProductId,
            unit_amount: Math.round(plan.price_monthly * 100).toString(),
            currency: 'usd',
            'recurring[interval]': 'month',
            'metadata[plan_id]': plan.id,
            'metadata[cycle]': 'monthly',
          });
          if (price.error) {
            results.push({ plan: plan.name, error: `Monthly price: ${price.error.message}` });
            continue;
          }
          monthlyPriceId = price.id;
        }

        // Create yearly price if needed
        let yearlyPriceId = plan.stripe_price_id_yearly;
        if (!yearlyPriceId && plan.price_yearly > 0) {
          const price = await stripeRequest('/prices', 'POST', {
            product: stripeProductId,
            unit_amount: Math.round(plan.price_yearly * 100).toString(),
            currency: 'usd',
            'recurring[interval]': 'year',
            'metadata[plan_id]': plan.id,
            'metadata[cycle]': 'yearly',
          });
          if (price.error) {
            results.push({ plan: plan.name, error: `Yearly price: ${price.error.message}` });
            continue;
          }
          yearlyPriceId = price.id;
        }

        // Update plan with Stripe IDs
        const { error: updateError } = await supabaseAdmin
          .from('pricing_plans')
          .update({
            stripe_product_id: stripeProductId,
            stripe_price_id_monthly: monthlyPriceId,
            stripe_price_id_yearly: yearlyPriceId,
          })
          .eq('id', plan.id);

        if (updateError) {
          results.push({ plan: plan.name, error: `DB update: ${updateError.message}` });
        } else {
          results.push({ plan: plan.name, success: true, stripeProductId, monthlyPriceId, yearlyPriceId });
        }
      }

      return new Response(JSON.stringify({ success: true, results }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ===== CREATE CHECKOUT SESSION =====
    if (action === 'create-checkout-session') {
      if (!stripeSecretKey) {
        return new Response(JSON.stringify({ success: false, error: 'Stripe not configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { planId, billingCycle, organizationId, successUrl, cancelUrl } = body;
      if (!planId || !organizationId) {
        return new Response(JSON.stringify({ success: false, error: 'planId and organizationId are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const supabaseAdmin = getSupabaseAdmin();

      // Get plan
      const { data: plan, error: planError } = await supabaseAdmin
        .from('pricing_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (planError || !plan) {
        return new Response(JSON.stringify({ success: false, error: 'Plan not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const priceId = billingCycle === 'yearly' ? plan.stripe_price_id_yearly : plan.stripe_price_id_monthly;
      if (!priceId) {
        return new Response(JSON.stringify({ success: false, error: 'Plan not synced to Stripe. Please sync plans first.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Get or create Stripe customer for org
      const { data: org, error: orgError } = await supabaseAdmin
        .from('organizations')
        .select('id, name, email, stripe_customer_id')
        .eq('id', organizationId)
        .single();

      if (orgError || !org) {
        return new Response(JSON.stringify({ success: false, error: 'Organization not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      let stripeCustomerId = org.stripe_customer_id;
      if (!stripeCustomerId) {
        const customer = await stripeRequest('/customers', 'POST', {
          name: org.name,
          email: org.email || '',
          'metadata[organization_id]': org.id,
        });
        if (customer.error) {
          return new Response(JSON.stringify({ success: false, error: customer.error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        stripeCustomerId = customer.id;
        await supabaseAdmin.from('organizations').update({ stripe_customer_id: stripeCustomerId }).eq('id', org.id);
      }

      // Create checkout session
      const sessionParams: Record<string, string> = {
        customer: stripeCustomerId,
        mode: 'subscription',
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        success_url: successUrl || `${req.headers.get('origin') || ''}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${req.headers.get('origin') || ''}/subscription/cancel`,
        'metadata[organization_id]': organizationId,
        'metadata[plan_id]': planId,
        'metadata[billing_cycle]': billingCycle || 'monthly',
        'subscription_data[metadata][organization_id]': organizationId,
        'subscription_data[metadata][plan_id]': planId,
      };

      const session = await stripeRequest('/checkout/sessions', 'POST', sessionParams);
      if (session.error) {
        return new Response(JSON.stringify({ success: false, error: session.error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ success: true, sessionId: session.id, url: session.url }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ===== MANAGE SUBSCRIPTION =====
    if (action === 'manage-subscription') {
      if (!stripeSecretKey) {
        return new Response(JSON.stringify({ success: false, error: 'Stripe not configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { organizationId, subscriptionAction, newPlanId, billingCycle } = body;
      if (!organizationId || !subscriptionAction) {
        return new Response(JSON.stringify({ success: false, error: 'organizationId and subscriptionAction required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const supabaseAdmin = getSupabaseAdmin();
      const { data: sub, error: subError } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('organization_id', organizationId)
        .in('status', ['active', 'trialing'])
        .single();

      if (subError || !sub || !sub.stripe_subscription_id) {
        return new Response(JSON.stringify({ success: false, error: 'No active subscription found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (subscriptionAction === 'cancel') {
        const result = await stripeRequest(`/subscriptions/${sub.stripe_subscription_id}`, 'POST', {
          cancel_at_period_end: 'true',
        });
        if (result.error) {
          return new Response(JSON.stringify({ success: false, error: result.error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        await supabaseAdmin.from('subscriptions').update({ cancel_at_period_end: true }).eq('id', sub.id);
        return new Response(JSON.stringify({ success: true, message: 'Subscription will cancel at period end' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (subscriptionAction === 'reactivate') {
        const result = await stripeRequest(`/subscriptions/${sub.stripe_subscription_id}`, 'POST', {
          cancel_at_period_end: 'false',
        });
        if (result.error) {
          return new Response(JSON.stringify({ success: false, error: result.error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        await supabaseAdmin.from('subscriptions').update({ cancel_at_period_end: false }).eq('id', sub.id);
        return new Response(JSON.stringify({ success: true, message: 'Subscription reactivated' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (subscriptionAction === 'change-plan') {
        if (!newPlanId) {
          return new Response(JSON.stringify({ success: false, error: 'newPlanId required for plan change' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { data: newPlan } = await supabaseAdmin.from('pricing_plans').select('*').eq('id', newPlanId).single();
        if (!newPlan) {
          return new Response(JSON.stringify({ success: false, error: 'New plan not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const newPriceId = billingCycle === 'yearly' ? newPlan.stripe_price_id_yearly : newPlan.stripe_price_id_monthly;
        if (!newPriceId) {
          return new Response(JSON.stringify({ success: false, error: 'New plan not synced to Stripe' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Get current subscription items
        const stripeSub = await stripeRequest(`/subscriptions/${sub.stripe_subscription_id}`, 'GET');
        if (stripeSub.error) {
          return new Response(JSON.stringify({ success: false, error: stripeSub.error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const itemId = stripeSub.items?.data?.[0]?.id;
        if (!itemId) {
          return new Response(JSON.stringify({ success: false, error: 'No subscription item found' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const result = await stripeRequest(`/subscriptions/${sub.stripe_subscription_id}`, 'POST', {
          [`items[0][id]`]: itemId,
          [`items[0][price]`]: newPriceId,
          proration_behavior: 'create_prorations',
          'metadata[plan_id]': newPlanId,
        });

        if (result.error) {
          return new Response(JSON.stringify({ success: false, error: result.error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        await supabaseAdmin.from('subscriptions').update({
          plan_id: newPlanId,
          billing_cycle: billingCycle || sub.billing_cycle,
        }).eq('id', sub.id);

        return new Response(JSON.stringify({ success: true, message: 'Plan changed successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ success: false, error: 'Invalid subscription action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Stripe integration error:', error);
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
