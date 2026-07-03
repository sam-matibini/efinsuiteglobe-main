import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  const parts = sigHeader.split(',');
  const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1];
  const signatures = parts.filter(p => p.startsWith('v1=')).map(p => p.split('=')[1]);

  if (!timestamp || signatures.length === 0) return false;

  // Check timestamp tolerance (5 minutes)
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
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const expectedSig = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return signatures.some(s => s === expectedSig);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    const rawBody = await req.text();

    // Verify signature if webhook secret is configured
    if (webhookSecret) {
      const sigHeader = req.headers.get('stripe-signature');
      if (!sigHeader) {
        return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const valid = await verifyStripeSignature(rawBody, sigHeader, webhookSecret);
      if (!valid) {
        return new Response(JSON.stringify({ error: 'Invalid signature' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const event = JSON.parse(rawBody);
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log(`Processing Stripe event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode === 'subscription') {
          const organizationId = session.metadata?.organization_id;
          const planId = session.metadata?.plan_id;
          const billingCycle = session.metadata?.billing_cycle || 'monthly';
          const stripeSubscriptionId = session.subscription;

          if (organizationId && planId && stripeSubscriptionId) {
            // Upsert subscription
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

            if (error) console.error('Error upserting subscription:', error);

            // Update Stripe customer ID on org if not set
            if (session.customer) {
              await supabaseAdmin
                .from('organizations')
                .update({ stripe_customer_id: session.customer })
                .eq('id', organizationId)
                .is('stripe_customer_id', null);
            }
          }
        } else if (session.mode === 'payment') {
          // Invoice payment via Stripe Checkout
          const invoiceId = session.metadata?.invoice_id;
          const organizationId = session.metadata?.organization_id;
          const customerId = session.metadata?.customer_id;
          const paymentIntentId = session.payment_intent;

          if (invoiceId && organizationId) {
            console.log(`Processing invoice payment: invoice=${invoiceId}, org=${organizationId}`);

            // Idempotency: check if payment already recorded
            const { data: existingPayment } = await supabaseAdmin
              .from('customer_payments')
              .select('id')
              .eq('reference', `stripe:${paymentIntentId}`)
              .maybeSingle();

            if (existingPayment) {
              console.log('Payment already recorded, skipping');
              break;
            }

            const amountPaid = (session.amount_total || 0) / 100;

            // Insert customer payment
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

            if (payError) {
              console.error('Error inserting customer payment:', payError);
            }

            // Update invoice balances
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

            // Create journal entry: Dr. Cash, Cr. AR
            try {
              // Find Cash and AR accounts
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
                // Generate next JE reference
                const { data: allEntries } = await supabaseAdmin
                  .from('journal_entries')
                  .select('reference')
                  .eq('organization_id', organizationId)
                  .like('reference', 'JE-%');

                let maxNum = 0;
                if (allEntries) {
                  for (const entry of allEntries) {
                    const match = entry.reference?.match(/JE-(\d+)$/);
                    if (match) {
                      const num = parseInt(match[1], 10);
                      if (num > maxNum) maxNum = num;
                    }
                  }
                }
                const jeRef = `JE-${String(maxNum + 1).padStart(4, '0')}`;

                // Create JE as draft first
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
                    // Promote to posted
                    await supabaseAdmin
                      .from('journal_entries')
                      .update({ status: 'posted' })
                      .eq('id', je.id);

                    // Link JE to payment
                    if (payment) {
                      await supabaseAdmin
                        .from('customer_payments')
                        .update({ journal_entry_id: je.id })
                        .eq('id', payment.id);
                    }
                  } else {
                    console.error('Error creating JE lines:', linesError);
                    await supabaseAdmin.from('journal_entries').delete().eq('id', je.id);
                  }
                }
              } else {
                console.warn('Could not find Cash or AR accounts for GL entry');
              }
            } catch (jeErr) {
              console.error('Error creating journal entry for Stripe payment:', jeErr);
            }
          }
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;
        if (subscriptionId) {
          const { data: sub } = await supabaseAdmin
            .from('subscriptions')
            .select('id')
            .eq('stripe_subscription_id', subscriptionId)
            .single();

          if (sub) {
            await supabaseAdmin
              .from('subscriptions')
              .update({
                status: 'active',
                current_period_start: new Date(invoice.period_start * 1000).toISOString(),
                current_period_end: new Date(invoice.period_end * 1000).toISOString(),
              })
              .eq('id', sub.id);
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const { data: sub } = await supabaseAdmin
          .from('subscriptions')
          .select('id')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        if (sub) {
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
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const { data: sub } = await supabaseAdmin
          .from('subscriptions')
          .select('id')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        if (sub) {
          await supabaseAdmin
            .from('subscriptions')
            .update({ status: 'canceled', cancel_at_period_end: false })
            .eq('id', sub.id);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
