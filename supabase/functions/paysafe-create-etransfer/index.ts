import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function paysafeBase() {
  return Deno.env.get('PAYSAFE_ENVIRONMENT') === 'live'
    ? 'https://api.paysafe.com'
    : 'https://api.test.paysafe.com';
}

function paysafeAuthHeader(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, '');
  const encoded = trimmed.includes(':') ? btoa(trimmed) : trimmed;
  return `Basic ${encoded}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const payment_link_id: string | undefined = body?.payment_link_id;
    const returnUrl: string | undefined = body?.return_url;

    if (!payment_link_id || typeof payment_link_id !== 'string') {
      return new Response(JSON.stringify({ error: 'payment_link_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: link, error: linkErr } = await admin
      .from('payment_links')
      .select('*')
      .eq('id', payment_link_id)
      .eq('status', 'open')
      .maybeSingle();

    if (linkErr || !link) {
      return new Response(JSON.stringify({ error: 'Payment link not found or not open' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (link.instant_method !== 'interac_etransfer') {
      return new Response(JSON.stringify({ error: 'Link is not configured for Interac e-Transfer' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('PAYSAFE_API_KEY');
    const accountId = Deno.env.get('PAYSAFE_ACCOUNT_ID_INTERAC')
      ?? Deno.env.get('PAYSAFE_ACCOUNT_ID_EFT');
    if (!apiKey || !accountId) {
      return new Response(JSON.stringify({ error: 'Paysafe Interac is not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const amountCents = Math.round(Number(link.amount) * 100);
    const merchantRefNum = `${link.reference}-ET-${Date.now()}`;
    const successUrl = `${returnUrl || req.headers.get('origin')}/pay/${link.id}?status=success`;
    const failUrl = `${returnUrl || req.headers.get('origin')}/pay/${link.id}?status=failed`;

    const psResp = await fetch(`${paysafeBase()}/paymenthub/v1/paymenthandles`, {
      method: 'POST',
      headers: {
        'Authorization': paysafeAuthHeader(apiKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merchantRefNum,
        transactionType: 'PAYMENT',
        amount: amountCents,
        currencyCode: (link.currency || 'CAD').toUpperCase(),
        paymentType: 'INTERAC_ETRANSFER',
        accountId,
        profile: link.payer_email ? { email: link.payer_email, firstName: (link.payer_name ?? 'Payer').split(' ')[0] ?? 'Payer', lastName: (link.payer_name ?? 'Payer').split(' ').slice(1).join(' ') || 'Payer' } : undefined,
        returnLinks: [
          { rel: 'default', href: successUrl, method: 'GET' },
          { rel: 'on_completed', href: successUrl, method: 'GET' },
          { rel: 'on_failed', href: failUrl, method: 'GET' },
        ],
      }),
    });

    const psBody = await psResp.json();

    await admin.from('payment_link_events').insert({
      payment_link_id: link.id,
      event_type: 'paysafe_etransfer_requested',
      payload: { ...psBody, merchantRefNum },
    });

    if (!psResp.ok) {
      console.error('Paysafe Interac error', psBody);
      return new Response(JSON.stringify({
        error: psBody?.error?.message || 'Paysafe rejected the Interac request',
        details: psBody,
      }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const hostedUrl = psBody?.links?.find((l: { rel: string; href: string }) => l.rel === 'redirect_payment')?.href
      || psBody?.links?.[0]?.href
      || null;

    await admin.from('payment_links').update({
      paysafe_payment_handle_id: psBody?.id ?? null,
      hosted_url: hostedUrl,
      metadata: { ...(link.metadata ?? {}), paysafe_interac_handle: psBody },
    }).eq('id', link.id);

    return new Response(JSON.stringify({ url: hostedUrl, paysafe_payment_handle_id: psBody?.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('paysafe-create-etransfer error', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
