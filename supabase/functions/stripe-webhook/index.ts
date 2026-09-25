import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { settleCollectionToWise } from "../_shared/wise-settlement.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

// ---------- Signature verification ----------

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  const parts = sigHeader.split(',');
  const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1];
  const signatures = parts.filter(p => p.startsWith('v1=')).map(p => p.split('=')[1]);

  if (!timestamp || signatures.length === 0) return false;

  // 5 minute tolerance
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const expected = new Uint8Array(sigBuf);

  for (const s of signatures) {
    try {
      if (timingSafeEqual(expected, hexToBytes(s))) return true;
    } catch {
      // malformed hex — skip
    }
  }
  return false;
}

// ---------- Non-retriable error marker ----------

class NonRetriableError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'NonRetriableError';
  }
}

// ---------- Handlers ----------

async function handleCheckoutCompleted(supabaseAdmin: SupabaseClient, event: any) {
  const session = event.data.object;

  if (session.mode === 'subscription') {
    const organizationId = session.metadata?.organization_id;
    const planId = session.metadata?.plan_id;
    const billingCycle = session.metadata?.billing_cycle || 'monthly';
    const stripeSubscriptionId = session.subscription;

    if (!organizationId || !planId || !stripeSubscriptionId) {
      throw new NonRetriableError('checkout.session.completed missing metadata');
    }

    const { error } = await supabaseAdmin
      .from('subscriptions')
      .upsert({
        organization_id: organizationId,
        plan_id: planId,
        status: 'active',
        billing_cycle: billingCycle,
        stripe_subscription_id: stripeSubscriptionId,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + (billingCycle === 'yearly' ? 365 : 30) * 86400000).toISOString(),
      }, { onConflict: 'organization_id' });
    if (error) throw error;

    if (session.customer) {
      await supabaseAdmin
        .from('organizations')
        .update({ stripe_customer_id: session.customer })
        .eq('id', organizationId)
        .is('stripe_customer_id', null);
    }
    return;
  }

  if (session.mode === 'payment') {
    const invoiceId = session.metadata?.invoice_id;
    const organizationId = session.metadata?.organization_id;
    const customerId = session.metadata?.customer_id;
    const paymentIntentId = session.payment_intent;

    if (!invoiceId || !organizationId) {
      throw new NonRetriableError('checkout.session.completed (payment) missing metadata');
    }

    // Idempotent by payment_intent reference
    const { data: existingPayment } = await supabaseAdmin
      .from('customer_payments')
      .select('id')
      .eq('reference', `stripe:${paymentIntentId}`)
      .maybeSingle();
    if (existingPayment) {
      console.log(`[${event.id}] payment already recorded, skipping`);
      return;
    }

    const amountPaid = (session.amount_total || 0) / 100;

    const { data: payment, error: payError } = await supabaseAdmin
      .from('customer_payments')
      .insert([{
        organization_id: organizationId,
        customer_id: customerId,
        invoice_id: invoiceId,
        payment_date: new Date().toISOString().split('T')[0],
        amount: amountPaid,
        payment_method: 'credit_card',
        reference: `stripe:${paymentIntentId}`,
        notes: `Stripe Checkout payment`,
      }])
      .select()
      .single();
    if (payError) throw payError;

    const { data: invoice } = await supabaseAdmin
      .from('invoices')
      .select('amount_paid, total')
      .eq('id', invoiceId)
      .single();

    if (invoice) {
      const newAmountPaid = Number(invoice.amount_paid) + amountPaid;
      const newBalance = Number(invoice.total) - newAmountPaid;
      const newStatus = newBalance <= 0 ? 'paid' : 'partial';
      await supabaseAdmin
        .from('invoices')
        .update({
          amount_paid: newAmountPaid,
          balance_due: Math.max(0, newBalance),
          status: newStatus,
          paid_at: newStatus === 'paid' ? new Date().toISOString() : null,
        })
        .eq('id', invoiceId);
    }

    // Journal entry: Dr. Cash / Cr. AR
    try {
      const { data: accounts } = await supabaseAdmin
        .from('accounts')
        .select('id, code, name, account_type, is_header')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .eq('is_header', false);

      const findAccount = (type: string, patterns: string[]) => {
        for (const p of patterns) {
          const found = accounts?.find(a => a.account_type === type && a.name.toLowerCase().includes(p));
          if (found) return found;
        }
        return accounts?.find(a => a.account_type === type);
      };

      const cashAccount = findAccount('asset', ['cash', 'bank', 'chequing', 'checking']);
      const arAccount = findAccount('asset', ['receivable', 'accounts receivable', 'a/r']);

      if (cashAccount && arAccount) {
        const { data: allEntries } = await supabaseAdmin
          .from('journal_entries')
          .select('reference')
          .eq('organization_id', organizationId)
          .like('reference', 'JE-%');

        let maxNum = 0;
        for (const entry of allEntries ?? []) {
          const match = entry.reference?.match(/JE-(\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        }
        const jeRef = `JE-${String(maxNum + 1).padStart(4, '0')}`;

        const { data: je, error: jeError } = await supabaseAdmin
          .from('journal_entries')
          .insert([{
            organization_id: organizationId,
            entry_date: new Date().toISOString().split('T')[0],
            reference: jeRef,
            description: `Stripe payment for invoice`,
            journal_type: 'sales',
            status: 'draft',
          }])
          .select()
          .single();

        if (!jeError && je) {
          const { error: linesError } = await supabaseAdmin
            .from('journal_entry_lines')
            .insert([
              { journal_entry_id: je.id, account_id: cashAccount.id, debit: amountPaid, credit: 0, description: 'Stripe payment received', line_order: 0, customer_id: customerId, source_document_type: 'invoice', source_document_id: invoiceId },
              { journal_entry_id: je.id, account_id: arAccount.id, debit: 0, credit: amountPaid, description: 'Stripe payment received', line_order: 1, customer_id: customerId, source_document_type: 'invoice', source_document_id: invoiceId },
            ]);
          if (!linesError) {
            await supabaseAdmin.from('journal_entries').update({ status: 'posted' }).eq('id', je.id);
            if (payment) {
              await supabaseAdmin.from('customer_payments').update({ journal_entry_id: je.id }).eq('id', payment.id);
            }
          } else {
            console.error(`[${event.id}] JE lines error:`, linesError);
            await supabaseAdmin.from('journal_entries').delete().eq('id', je.id);
          }
        }
      } else {
        console.warn(`[${event.id}] Cash/AR account missing; skipping JE`);
      }
    } catch (jeErr) {
      console.error(`[${event.id}] JE creation failed:`, jeErr);
      // Do not fail the webhook over a bookkeeping error — payment is already recorded.
    }

    // Settlement leg — route the collected funds to Wise when enabled.
    try {
      const res = await settleCollectionToWise(supabaseAdmin, {
        organizationId,
        amount: amountPaid,
        currency: String(session.currency ?? 'CAD').toUpperCase(),
        reference: `stripe:${paymentIntentId}`,
        invoiceId,
        paymentLinkId: null,
        sourceLabel: 'stripe_card',
      });
      if (res.skippedReason !== 'not_enabled') {
        console.log(`[${event.id}] wise settlement`, res);
      }
    } catch (setErr) {
      console.error(`[${event.id}] Wise settlement failed:`, setErr);
    }
  }
}

async function handleInvoicePaid(supabaseAdmin: SupabaseClient, event: any) {
  const invoice = event.data.object;
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();
  if (!sub) throw new NonRetriableError(`unknown subscription ${subscriptionId}`);

  await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'active',
      current_period_start: new Date(invoice.period_start * 1000).toISOString(),
      current_period_end: new Date(invoice.period_end * 1000).toISOString(),
    })
    .eq('id', sub.id);
}

async function handleInvoicePaymentFailed(supabaseAdmin: SupabaseClient, event: any) {
  const invoice = event.data.object;
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();
  if (!sub) throw new NonRetriableError(`unknown subscription ${subscriptionId}`);

  await supabaseAdmin.from('subscriptions').update({ status: 'past_due' }).eq('id', sub.id);
}

async function handleSubscriptionUpdated(supabaseAdmin: SupabaseClient, event: any) {
  const subscription = event.data.object;
  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle();
  if (!sub) throw new NonRetriableError(`unknown subscription ${subscription.id}`);

  const statusMap: Record<string, string> = {
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'past_due',
    trialing: 'trialing',
    incomplete: 'incomplete',
    incomplete_expired: 'canceled',
    paused: 'paused',
  };
  await supabaseAdmin
    .from('subscriptions')
    .update({
      status: statusMap[subscription.status] || subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    })
    .eq('id', sub.id);
}

async function handleSubscriptionDeleted(supabaseAdmin: SupabaseClient, event: any) {
  const subscription = event.data.object;
  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle();
  if (!sub) return; // already gone — nothing to do

    await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'canceled', cancel_at_period_end: false, stripe_coupon_id: null, discount_percent: null })
      .eq('id', sub.id);
}

async function handleTrialWillEnd(supabaseAdmin: SupabaseClient, event: any) {
  const subscription = event.data.object;
  console.log(`[${event.id}] trial_will_end for ${subscription.id} — notify hook`);
  // Notification implementation is out of scope; log so it appears in the audit table.
}

async function handleDiscountEvent(supabaseAdmin: SupabaseClient, event: any) {
  const discount = event.data.object;
  const subscriptionId = discount?.subscription;
  if (!subscriptionId) {
    console.log(`[${event.id}] discount event without subscription id, skipping`);
    return;
  }

  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();
  if (!sub) return;

  if (event.type === 'customer.discount.deleted') {
    await supabaseAdmin
      .from('subscriptions')
      .update({ stripe_coupon_id: null, discount_percent: null })
      .eq('id', sub.id);
    return;
  }

  const coupon = discount.coupon || {};
  await supabaseAdmin
    .from('subscriptions')
    .update({
      stripe_coupon_id: coupon.id ?? null,
      discount_percent: coupon.percent_off ?? null,
    })
    .eq('id', sub.id);
}

// ---------- Main ----------

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured — rejecting event');
    return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const rawBody = await req.text();
  const sigHeader = req.headers.get('stripe-signature');
  if (!sigHeader) {
    return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const valid = await verifyStripeSignature(rawBody, sigHeader, webhookSecret);
  if (!valid) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Idempotency: insert event id; on conflict this event was already received.
  const { error: insertErr } = await supabaseAdmin
    .from('stripe_webhook_events')
    .insert({
      event_id: event.id,
      event_type: event.type,
      status: 'received',
      payload: event,
    });

  if (insertErr) {
    // Unique-violation code 23505 → duplicate delivery
    if ((insertErr as any).code === '23505') {
      console.log(`[${event.id}] duplicate delivery, acknowledging`);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.error(`[${event.id}] failed to record event`, insertErr);
    return new Response(JSON.stringify({ error: 'DB unavailable' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log(`[${event.id}] processing ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(supabaseAdmin, event);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(supabaseAdmin, event);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(supabaseAdmin, event);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(supabaseAdmin, event);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(supabaseAdmin, event);
        break;
      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(supabaseAdmin, event);
        break;
      case 'customer.discount.created':
      case 'customer.discount.updated':
      case 'customer.discount.deleted':
        await handleDiscountEvent(supabaseAdmin, event);
        break;
      default:
        console.log(`[${event.id}] unhandled type ${event.type}`);
        await supabaseAdmin
          .from('stripe_webhook_events')
          .update({ status: 'ignored', processed_at: new Date().toISOString(), error: 'unhandled event type' })
          .eq('event_id', event.id);
        return new Response(JSON.stringify({ received: true, ignored: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    await supabaseAdmin
      .from('stripe_webhook_events')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('event_id', event.id);

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    const isNonRetriable = error instanceof NonRetriableError;
    const status = isNonRetriable ? 'ignored' : 'failed';
    console.error(`[${event.id}] handler error (${status}):`, error?.message ?? error);

    await supabaseAdmin
      .from('stripe_webhook_events')
      .update({
        status,
        processed_at: new Date().toISOString(),
        error: String(error?.message ?? error),
      })
      .eq('event_id', event.id);

    if (isNonRetriable) {
      // 200 so Stripe stops retrying — event captured in audit table.
      return new Response(JSON.stringify({ received: true, ignored: true, reason: error.message }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Transient — let Stripe retry.
    return new Response(JSON.stringify({ error: error?.message ?? 'internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
