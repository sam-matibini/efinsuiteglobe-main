import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StripeRequest {
  action: 'health-check' | 'test' | 'create-customer' | 'create-payment-intent' | 'create-wallet-payment' | 'sync-plans' | 'create-checkout-session' | 'manage-subscription' | 'preview-plan-change' | 'create-billing-portal-session' | 'get-payment-method' | 'list-invoices' | 'verify-checkout-session' | 'validate-promotion-code';
  sessionId?: string;
  returnUrl?: string;
  portalFlow?: 'payment_method_update' | 'subscription_cancel';
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
      const { planId, billingCycle, organizationId, successUrl, cancelUrl, promotionCodeId } = body as any;
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

      // Grant a free trial (length from platform_settings) to orgs that have never subscribed
      const { data: priorSub } = await supabaseAdmin
        .from('subscriptions')
        .select('id')
        .eq('organization_id', organizationId)
        .limit(1)
        .maybeSingle();
      if (!priorSub) {
        const { data: trialSetting } = await supabaseAdmin
          .from('platform_settings')
          .select('setting_value')
          .eq('setting_key', 'subscription.trial_period_days')
          .maybeSingle();
        const trialDays = Number((trialSetting?.setting_value as any)?.days ?? 14);
        sessionParams['subscription_data[trial_period_days]'] = String(trialDays);
      }

      // Apply discount coupon: per-org coupon takes precedence, else global.
      const { data: subRow } = await supabaseAdmin
        .from('subscriptions')
        .select('discount_percent, discount_expires_at, stripe_coupon_id')
        .eq('organization_id', organizationId)
        .in('status', ['active', 'trialing'])
        .maybeSingle();
      const { data: globalDiscount } = await supabaseAdmin
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'subscription.global_discount')
        .maybeSingle();
      const gd = (globalDiscount?.setting_value as any) || {};
      const nowTs = new Date();
      const orgDiscountActive = subRow && Number(subRow.discount_percent) > 0 &&
        (!subRow.discount_expires_at || new Date(subRow.discount_expires_at) > nowTs) &&
        !!subRow.stripe_coupon_id;
      const globalDiscountActive = Number(gd.percent) > 0 &&
        (!gd.expires_at || new Date(gd.expires_at) > nowTs) &&
        !!gd.stripe_coupon_id;
      const couponId = orgDiscountActive
        ? subRow!.stripe_coupon_id
        : (globalDiscountActive ? gd.stripe_coupon_id : null);
      if (couponId) {
        sessionParams['discounts[0][coupon]'] = String(couponId);
      } else if (promotionCodeId) {
        // User-supplied promotion code from our in-app field
        sessionParams['discounts[0][promotion_code]'] = String(promotionCodeId);
      } else {
        // No admin coupon attached — let the customer type a promotion code on the Stripe Checkout page.
        sessionParams['allow_promotion_codes'] = 'true';
        if ((subRow && Number(subRow.discount_percent) > 0) || Number(gd.percent) > 0) {
          console.warn('Discount configured without a Stripe coupon id — skipping Stripe discount');
        }
      }

      const session = await stripeRequest('/checkout/sessions', 'POST', sessionParams);
      if (session.error) {
        return new Response(JSON.stringify({ success: false, error: session.error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ success: true, sessionId: session.id, url: session.url }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ===== VALIDATE PROMOTION CODE =====
    if (action === 'validate-promotion-code') {
      if (!stripeSecretKey) {
        return new Response(JSON.stringify({ success: false, error: 'Stripe not configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { code, planId, billingCycle, organizationId } = body as any;
      if (!code || typeof code !== 'string') {
        return new Response(JSON.stringify({ success: false, error: 'code is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const supabaseAdmin = getSupabaseAdmin();

      // Refuse if org already has an admin-applied coupon (per-org or global)
      if (organizationId) {
        const { data: subRow } = await supabaseAdmin
          .from('subscriptions')
          .select('stripe_coupon_id, discount_percent, discount_expires_at')
          .eq('organization_id', organizationId)
          .in('status', ['active', 'trialing'])
          .maybeSingle();
        const { data: globalDiscount } = await supabaseAdmin
          .from('platform_settings')
          .select('setting_value')
          .eq('setting_key', 'subscription.global_discount')
          .maybeSingle();
        const gd = (globalDiscount?.setting_value as any) || {};
        const nowTs = new Date();
        const orgActive = subRow && Number(subRow.discount_percent) > 0 &&
          (!subRow.discount_expires_at || new Date(subRow.discount_expires_at) > nowTs) &&
          !!subRow.stripe_coupon_id;
        const globalActive = Number(gd.percent) > 0 &&
          (!gd.expires_at || new Date(gd.expires_at) > nowTs) &&
          !!gd.stripe_coupon_id;
        if (orgActive || globalActive) {
          return new Response(JSON.stringify({
            success: false,
            error: 'A discount is already applied to this subscription.',
            adminDiscountActive: true,
          }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // Look up promotion code
      const qs = new URLSearchParams({ code: code.trim(), active: 'true', limit: '1' }).toString();
      const listRes = await fetch(`https://api.stripe.com/v1/promotion_codes?${qs}&expand[]=data.coupon`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${stripeSecretKey}` },
      });
      const list = await listRes.json();
      if (list.error) {
        return new Response(JSON.stringify({ success: false, error: list.error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const promo = (list.data && list.data[0]) || null;
      if (!promo) {
        return new Response(JSON.stringify({ success: false, error: 'Code not valid' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const nowSec = Math.floor(Date.now() / 1000);
      if (promo.expires_at && promo.expires_at < nowSec) {
        return new Response(JSON.stringify({ success: false, error: 'Code has expired' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (promo.max_redemptions && promo.times_redeemed >= promo.max_redemptions) {
        return new Response(JSON.stringify({ success: false, error: 'Code has reached its redemption limit' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      let coupon: any = promo.coupon || {};
      // Fallback: if coupon wasn't inlined/expanded, or fields are missing, fetch it directly
      const couponId = typeof promo.coupon === 'string' ? promo.coupon : coupon?.id;
      const missingDiscount = coupon?.percent_off == null && coupon?.amount_off == null;
      if (couponId && missingDiscount) {
        const cRes = await fetch(`https://api.stripe.com/v1/coupons/${couponId}`, {
          headers: { 'Authorization': `Bearer ${stripeSecretKey}` },
        });
        const cJson = await cRes.json();
        if (!cJson.error) coupon = cJson;
        console.log('[validate-promotion-code] fetched coupon directly:', JSON.stringify(cJson));
      }
      console.log('[validate-promotion-code] final coupon:', JSON.stringify(coupon));

      // Optional plan preview
      let preview: any = null;
      if (planId) {
        const { data: plan } = await supabaseAdmin
          .from('pricing_plans')
          .select('price_monthly, price_yearly')
          .eq('id', planId)
          .maybeSingle();
        if (plan) {
          const baseDollars = billingCycle === 'yearly' ? Number(plan.price_yearly) : Number(plan.price_monthly);
          const baseCents = Math.round(baseDollars * 100);
          let savingsCents = 0;
          if (coupon.percent_off) {
            savingsCents = Math.round((baseCents * Number(coupon.percent_off)) / 100);
          } else if (coupon.amount_off) {
            savingsCents = Math.min(baseCents, Number(coupon.amount_off));
          }
          preview = {
            currency: coupon.currency || 'usd',
            base_amount: baseCents,
            savings: savingsCents,
            discounted_amount: Math.max(0, baseCents - savingsCents),
          };
        }
      }

      return new Response(JSON.stringify({
        success: true,
        valid: true,
        promotion_code_id: promo.id,
        code: promo.code,
        coupon: {
          id: coupon.id,
          percent_off: coupon.percent_off ?? null,
          amount_off: coupon.amount_off ?? null,
          currency: coupon.currency ?? null,
          duration: coupon.duration || 'once',
          duration_in_months: coupon.duration_in_months ?? null,
        },
        preview,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }


    // ===== PREVIEW PLAN CHANGE (proration) =====
    if (action === 'preview-plan-change') {
      if (!stripeSecretKey) {
        return new Response(JSON.stringify({ success: false, error: 'Stripe not configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { organizationId, newPlanId, billingCycle } = body;
      if (!organizationId || !newPlanId) {
        return new Response(JSON.stringify({ success: false, error: 'organizationId and newPlanId required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const supabaseAdmin = getSupabaseAdmin();
      const { data: sub } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('organization_id', organizationId)
        .in('status', ['active', 'trialing'])
        .maybeSingle();
      if (!sub || !sub.stripe_subscription_id) {
        return new Response(JSON.stringify({ success: false, error: 'No active subscription found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
      const stripeSub = await stripeRequest(`/subscriptions/${sub.stripe_subscription_id}`, 'GET');
      if (stripeSub.error) {
        return new Response(JSON.stringify({ success: false, error: stripeSub.error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const itemId = stripeSub.items?.data?.[0]?.id;
      const customerId = stripeSub.customer;
      if (!itemId || !customerId) {
        return new Response(JSON.stringify({ success: false, error: 'Could not resolve subscription item' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const params = new URLSearchParams({
        customer: customerId,
        subscription: sub.stripe_subscription_id,
        'subscription_items[0][id]': itemId,
        'subscription_items[0][price]': newPriceId,
        subscription_proration_behavior: 'create_prorations',
      });
      const upcomingRes = await fetch(`https://api.stripe.com/v1/invoices/upcoming?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${stripeSecretKey}` },
      });
      const upcoming = await upcomingRes.json();
      if (upcoming.error) {
        return new Response(JSON.stringify({ success: false, error: upcoming.error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      // Sum only prorated line items to get "amount due today"
      const prorationLines = (upcoming.lines?.data || []).filter((l: any) => l.proration);
      const prorationAmount = prorationLines.reduce((s: number, l: any) => s + (l.amount || 0), 0);
      return new Response(JSON.stringify({
        success: true,
        preview: {
          currency: upcoming.currency,
          amount_due_today: prorationAmount, // cents; can be negative (credit)
          next_invoice_total: upcoming.total, // cents
          next_invoice_date: upcoming.next_payment_attempt || upcoming.period_end,
          period_end: upcoming.period_end,
        },
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

    // Helper: load subscription + customer id for org
    async function loadOrgStripeCustomer(organizationId: string) {
      const supabaseAdmin = getSupabaseAdmin();
      const { data: sub } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('organization_id', organizationId)
        .in('status', ['active', 'trialing', 'past_due', 'canceled'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return sub;
    }

    if (action === 'create-billing-portal-session') {
      if (!stripeSecretKey) {
        return new Response(JSON.stringify({ success: false, error: 'Stripe not configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { organizationId, returnUrl, portalFlow } = body;
      if (!organizationId) {
        return new Response(JSON.stringify({ success: false, error: 'organizationId required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const sub = await loadOrgStripeCustomer(organizationId);
      if (!sub?.stripe_customer_id) {
        return new Response(JSON.stringify({ success: false, error: 'No Stripe customer for this organization' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const params: Record<string, string> = {
        customer: sub.stripe_customer_id,
        return_url: returnUrl || `${req.headers.get('origin') || ''}/settings?tab=billing`,
      };
      if (portalFlow === 'payment_method_update') {
        params['flow_data[type]'] = 'payment_method_update';
      } else if (portalFlow === 'subscription_cancel' && sub.stripe_subscription_id) {
        params['flow_data[type]'] = 'subscription_cancel';
        params['flow_data[subscription_cancel][subscription]'] = sub.stripe_subscription_id;
      }
      const session = await stripeRequest('/billing_portal/sessions', 'POST', params);
      if (session.error) {
        return new Response(JSON.stringify({ success: false, error: session.error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true, url: session.url }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get-payment-method') {
      if (!stripeSecretKey) {
        return new Response(JSON.stringify({ success: false, error: 'Stripe not configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { organizationId } = body;
      if (!organizationId) {
        return new Response(JSON.stringify({ success: false, error: 'organizationId required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const sub = await loadOrgStripeCustomer(organizationId);
      if (!sub?.stripe_customer_id) {
        return new Response(JSON.stringify({ success: true, paymentMethod: null }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const customer = await stripeRequest(`/customers/${sub.stripe_customer_id}`, 'GET');
      let pmId = customer?.invoice_settings?.default_payment_method || customer?.default_source;
      if (!pmId) {
        const pms = await stripeRequest(`/payment_methods?customer=${sub.stripe_customer_id}&type=card&limit=1`, 'GET');
        pmId = pms?.data?.[0]?.id;
      }
      if (!pmId) {
        return new Response(JSON.stringify({ success: true, paymentMethod: null }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const pm = typeof pmId === 'string' ? await stripeRequest(`/payment_methods/${pmId}`, 'GET') : pmId;
      const card = pm?.card;
      return new Response(JSON.stringify({
        success: true,
        paymentMethod: card ? {
          brand: card.brand, last4: card.last4, exp_month: card.exp_month, exp_year: card.exp_year,
        } : null,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'list-invoices') {
      if (!stripeSecretKey) {
        return new Response(JSON.stringify({ success: false, error: 'Stripe not configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { organizationId } = body;
      if (!organizationId) {
        return new Response(JSON.stringify({ success: false, error: 'organizationId required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const sub = await loadOrgStripeCustomer(organizationId);
      if (!sub?.stripe_customer_id) {
        return new Response(JSON.stringify({ success: true, invoices: [] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const result = await stripeRequest(`/invoices?customer=${sub.stripe_customer_id}&limit=24`, 'GET');
      if (result.error) {
        return new Response(JSON.stringify({ success: false, error: result.error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const invoices = (result.data || []).map((inv: any) => ({
        id: inv.id,
        number: inv.number,
        created: inv.created,
        amount_paid: inv.amount_paid,
        amount_due: inv.amount_due,
        currency: inv.currency,
        status: inv.status,
        hosted_invoice_url: inv.hosted_invoice_url,
        invoice_pdf: inv.invoice_pdf,
      }));
      return new Response(JSON.stringify({ success: true, invoices }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ===== VERIFY CHECKOUT SESSION =====
    if (action === 'verify-checkout-session') {
      if (!stripeSecretKey) {
        return new Response(JSON.stringify({ success: false, error: 'Stripe not configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { sessionId, organizationId } = body;
      if (!sessionId) {
        return new Response(JSON.stringify({ success: false, error: 'sessionId required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Auth: require valid JWT
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: claims, error: claimsErr } = await userClient.auth.getClaims(
        authHeader.replace('Bearer ', '')
      );
      if (claimsErr || !claims?.claims?.sub) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const userId = claims.claims.sub;

      const session = await stripeRequest(
        `/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription&expand[]=customer`,
        'GET'
      );
      if (session.error) {
        return new Response(JSON.stringify({ success: false, error: session.error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const sessionOrgId = session.metadata?.organization_id || organizationId;
      const supabaseAdmin = getSupabaseAdmin();

      // Verify caller belongs to the org that owns this checkout session
      if (sessionOrgId) {
        const { data: membership } = await supabaseAdmin
          .from('organization_members')
          .select('id')
          .eq('user_id', userId)
          .eq('organization_id', sessionOrgId)
          .maybeSingle();
        if (!membership) {
          return new Response(JSON.stringify({ success: false, error: 'Session does not belong to your organization' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      const stripeSub = session.subscription && typeof session.subscription === 'object'
        ? session.subscription
        : null;

      // If checkout is complete but our local subscription row hasn't been synced by the webhook yet,
      // upsert now so the UI can reflect the new plan immediately. Idempotent w/ webhook.
      if (session.status === 'complete' && stripeSub && sessionOrgId) {
        const planId = session.metadata?.plan_id || stripeSub.metadata?.plan_id || null;
        const billingCycle = session.metadata?.billing_cycle || null;
        const periodEnd = stripeSub.current_period_end
          ? new Date(stripeSub.current_period_end * 1000).toISOString()
          : null;

        const { data: existing } = await supabaseAdmin
          .from('subscriptions')
          .select('id')
          .eq('organization_id', sessionOrgId)
          .maybeSingle();

        const row: Record<string, unknown> = {
          organization_id: sessionOrgId,
          status: stripeSub.status,
          stripe_subscription_id: stripeSub.id,
          stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id,
          current_period_end: periodEnd,
        };
        if (planId) row.plan_id = planId;
        if (billingCycle) row.billing_cycle = billingCycle;

        if (existing?.id) {
          await supabaseAdmin.from('subscriptions').update(row).eq('id', existing.id);
        } else {
          await supabaseAdmin.from('subscriptions').insert(row);
        }
      }

      // Load plan name for display
      let planName: string | null = null;
      let currentPeriodEnd: string | null = null;
      if (stripeSub) {
        currentPeriodEnd = stripeSub.current_period_end
          ? new Date(stripeSub.current_period_end * 1000).toISOString()
          : null;
        const planId = session.metadata?.plan_id || stripeSub.metadata?.plan_id;
        if (planId) {
          const { data: plan } = await supabaseAdmin
            .from('pricing_plans')
            .select('name')
            .eq('id', planId)
            .maybeSingle();
          planName = plan?.name ?? null;
        }
      }

      return new Response(JSON.stringify({
        success: true,
        status: session.status, // 'complete' | 'open' | 'expired'
        payment_status: session.payment_status,
        subscription_status: stripeSub?.status ?? null,
        plan_name: planName,
        current_period_end: currentPeriodEnd,
        amount_total: session.amount_total,
        currency: session.currency,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Stripe integration error:', error);
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
