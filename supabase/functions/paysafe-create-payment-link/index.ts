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

/**
 * Inspect the Paysafe API key for common misconfigurations.
 * Returns a setup-error message when the value clearly isn't a server
 * `username:password` credential (e.g. someone pasted the Public Key).
 */
function detectPaysafeKeyMisconfig(raw: string | undefined): string | null {
  if (!raw) return 'PAYSAFE_API_KEY is not set.';
  const trimmed = raw.trim();
  // Public keys from the Merchant Portal look like `B-qa2-0-...` and are NOT
  // valid server credentials — they cannot create payment handles.
  if (/^B-[a-z0-9]{2,4}-\d+-/i.test(trimmed)) {
    return 'PAYSAFE_API_KEY appears to be the Public Key (starts with "B-..."). Use the Secret Key in the form "username:password" from Paysafe Merchant Portal → Settings → API Keys (click "Authenticate now" to reveal it).';
  }
  // Must either be raw `username:password` or already-base64 encoded.
  const compact = trimmed.replace(/\s+/g, '');
  if (!compact.includes(':')) {
    // Heuristic: a real base64(username:password) decodes to something with a colon.
    try {
      const decoded = atob(compact);
      if (!decoded.includes(':')) {
        return 'PAYSAFE_API_KEY is not in the expected "username:password" or base64(username:password) form.';
      }
    } catch {
      return 'PAYSAFE_API_KEY is not in the expected "username:password" or base64(username:password) form.';
    }
  }
  return null;
}

function paysafeAuthHeader(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, '');
  const encoded = trimmed.includes(':') ? btoa(trimmed) : trimmed;
  return `Basic ${encoded}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // This endpoint is invoked from the public Pay page — no auth required.
    const body = await req.json();

    const payment_link_id: string | undefined = body?.payment_link_id;
    const returnUrl: string | undefined = body?.return_url;
    const cardTypeHint: 'credit' | 'debit' | 'visa_debit' | undefined = body?.card_type_hint;
    const instantFunding: boolean = body?.instant_funding === true;

    if (!payment_link_id) {
      return new Response(JSON.stringify({ error: 'payment_link_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: link, error: linkErr } = await admin
      .from('payment_links')
      .select('*')
      .eq('id', payment_link_id)
      .single();
    if (linkErr || !link) {
      return new Response(JSON.stringify({ error: 'Payment link not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (link.status !== 'open') {
      return new Response(JSON.stringify({ error: `Link is ${link.status}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Resolve Paysafe paymentType from link.payment_method
    // All card variants share the single card merchant account; only EFT routes to a different one.
    const cardMethods = ['credit_card', 'debit_card', 'visa_debit', 'any_card', 'all'];
    const wantsCard = cardMethods.includes(link.payment_method);
    const paymentType = wantsCard ? 'CARD' : 'EFT';

    const apiKey = Deno.env.get('PAYSAFE_API_KEY');
    const accountIdSecret = paymentType === 'EFT' ? 'PAYSAFE_ACCOUNT_ID_EFT' : 'PAYSAFE_ACCOUNT_ID_CARD';
    const accountId = Deno.env.get(accountIdSecret);
    const env = Deno.env.get('PAYSAFE_ENVIRONMENT') === 'live' ? 'live' : 'test';

    const keyIssue = detectPaysafeKeyMisconfig(apiKey);
    if (keyIssue) {
      return new Response(JSON.stringify({ error: keyIssue, code: 'PAYSAFE_KEY_MISCONFIG', env }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!accountId) {
      return new Response(JSON.stringify({ error: `Paysafe ${paymentType} account ID is missing. Set ${accountIdSecret} to the numeric account ID for ${paymentType} from Paysafe Merchant Portal → Payment Methods.`, code: 'PAYSAFE_ACCOUNT_MISSING', env }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!/^\d+$/.test(accountId.trim())) {
      return new Response(JSON.stringify({ error: `${accountIdSecret} must be the numeric Paysafe account ID (digits only). Re-copy it from Merchant Portal → Payment Methods.`, code: 'PAYSAFE_ACCOUNT_INVALID', env }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const amountCents = Math.round(Number(link.amount) * 100);
    const merchantRefNum = `${link.reference}-${Date.now()}`;

    const effectiveHint = cardTypeHint
      ?? (link.payment_method === 'credit_card' ? 'credit'
        : link.payment_method === 'debit_card' ? 'debit'
        : link.payment_method === 'visa_debit' ? 'visa_debit'
        : undefined);

    const origin = req.headers.get('origin') ?? '';
    const psBodyReq: Record<string, unknown> = {
      merchantRefNum,
      transactionType: 'PAYMENT',
      amount: amountCents,
      currencyCode: (link.currency || 'CAD').toUpperCase(),
      paymentType,
      accountId: accountId.trim(),
      ...(paymentType === 'CARD' ? {
        card: {},
        threeDs: {
          merchantUrl: origin || returnUrl || '',
          deviceChannel: 'BROWSER',
          messageCategory: 'PAYMENT',
          authenticationPurpose: 'PAYMENT_TRANSACTION',
          transactionIntent: 'GOODS_OR_SERVICE_PURCHASE',
        },
      } : {}),
      ...(paymentType === 'EFT' ? { eft: {} } : {}),
      ...(instantFunding ? { settleWithAuth: true, instantFunding: true } : {}),
      returnLinks: [
        { rel: 'default', href: returnUrl || `${origin}/pay/${link.id}?status=success`, method: 'GET' },
        { rel: 'on_completed', href: `${returnUrl || origin}/pay/${link.id}?status=success`, method: 'GET' },
        { rel: 'on_failed', href: `${returnUrl || origin}/pay/${link.id}?status=failed`, method: 'GET' },
      ],
    };

    // Paysafe Payment Hub - single-use Payment Handle
    const psResp = await fetch(`${paysafeBase()}/paymenthub/v1/paymenthandles`, {
      method: 'POST',
      headers: {
        'Authorization': paysafeAuthHeader(apiKey!),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(psBodyReq),
    });

    const psBody = await psResp.json();
    if (!psResp.ok) {
      console.error('Paysafe error', { env, paymentType, accountIdSecret, body: psBody });
      const code = String(psBody?.error?.code ?? '');
      const fieldErrs: string = Array.isArray(psBody?.error?.fieldErrors)
        ? psBody.error.fieldErrors.map((f: { field?: string; error?: string }) => f.field ? `${f.field}: ${f.error}` : f.error).filter(Boolean).join('; ')
        : '';
      let msg: string;
      if (code === '5279' || code === '5280' || code === '5000') {
        msg = `Paysafe authentication failed (${code}). PAYSAFE_API_KEY must be the Server Secret Key in "username:password" form from Merchant Portal → Settings → API Keys (click "Authenticate now" to reveal it) — the Public Key (starts with "B-...") will NOT work. Also confirm the key is for the ${env} environment.`;
      } else if (code === '5270') {
        msg = `Paysafe rejected the request (5270 — Unauthorized access). The credentials are valid but cannot use ${accountIdSecret}=${accountId} for ${paymentType}. Most likely: (a) the account ID belongs to a different Paysafe account/environment than PAYSAFE_API_KEY, or (b) the ${paymentType} payment method is not enabled on that specific account ID. Re-copy the ${paymentType} account ID from the same Merchant Portal account as the API key, and confirm PAYSAFE_ENVIRONMENT="${env}" matches.`;
      } else if (code === '5068') {
        msg = `Paysafe validation error (5068)${fieldErrs ? ` — ${fieldErrs}` : ''}.`;
      } else {
        msg = (psBody?.error?.message || 'Paysafe rejected the request') + (fieldErrs ? ` — ${fieldErrs}` : '');
      }
      return new Response(JSON.stringify({ error: msg, code: code || 'PAYSAFE_ERROR', env, accountIdSecret, paymentType, details: psBody }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }


    const hostedUrl = psBody?.links?.find((l: { rel: string; href: string }) => l.rel === 'redirect_payment')?.href
      || psBody?.links?.[0]?.href
      || null;

    await admin.from('payment_links').update({
      paysafe_payment_handle_id: psBody?.id ?? null,
      hosted_url: hostedUrl,
      metadata: { ...(link.metadata ?? {}), paysafe_handle: psBody },
    }).eq('id', link.id);

    await admin.from('payment_link_events').insert({
      payment_link_id: link.id,
      event_type: 'paysafe_handle_created',
      payload: { ...psBody, requested_payment_method: link.payment_method, card_type_hint: effectiveHint ?? null, instant_funding: instantFunding },
    });

    return new Response(JSON.stringify({ url: hostedUrl, paysafe_payment_handle_id: psBody?.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('paysafe-create-payment-link error', msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
