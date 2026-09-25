import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paysafe-signature',
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

interface PaysafePaymentRequest {
  source_type: 'tax_payment';
  source_id: string;
  rail: 'eft' | 'card';
  payment_handle_token?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json() as PaysafePaymentRequest;
    if (!body?.source_type || !body?.source_id || !body?.rail) {
      return new Response(JSON.stringify({ error: 'source_type, source_id, rail required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Only tax_payment supported in this pass
    const { data: tp, error: tpErr } = await admin.from('tax_payments').select('*').eq('id', body.source_id).single();
    if (tpErr || !tp) {
      return new Response(JSON.stringify({ error: 'Tax payment not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Enforce org membership on the caller
    const callerId = claims.claims.sub as string | undefined;
    if (!callerId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: isMember } = await admin.rpc('is_org_member', {
      _user_id: callerId,
      _org_id: tp.organization_id,
    });
    if (isMember !== true) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // PAD enforcement for EFT rail — must have an active PAD agreement
    // covering this org's funding bank account before we can debit.
    if (body.rail === 'eft' && tp.bank_account_id) {
      const { data: pads } = await admin
        .from('pad_agreements')
        .select('id, max_amount_per_debit, status, scope')
        .eq('organization_id', tp.organization_id)
        .eq('bank_account_id', tp.bank_account_id)
        .eq('status', 'active');
      const active = (pads ?? []).filter((p: any) => !p.scope || p.scope === 'cra' || p.scope === 'general');
      if (active.length === 0) {
        return new Response(JSON.stringify({
          error: 'No active Pre-Authorized Debit (PAD) agreement covers this bank account. Capture a PAD in Treasury Settings → PAD Agreements before remitting via EFT.',
          code: 'PAD_REQUIRED',
        }), { status: 412, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const cap = Math.max(...active.map((p: any) => Number(p.max_amount_per_debit ?? 0)));
      if (cap > 0 && Number(tp.amount) > cap) {
        return new Response(JSON.stringify({
          error: `Amount ${tp.amount} exceeds the PAD per-debit cap of ${cap}. Update the PAD agreement or split the payment.`,
          code: 'PAD_CAP_EXCEEDED',
        }), { status: 412, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const apiKey = Deno.env.get('PAYSAFE_API_KEY');
    const accountId = body.rail === 'eft'
      ? Deno.env.get('PAYSAFE_ACCOUNT_ID_EFT')
      : Deno.env.get('PAYSAFE_ACCOUNT_ID_CARD');
    if (!apiKey || !accountId) {
      return new Response(JSON.stringify({ error: 'Paysafe not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }


    const amountCents = Math.round(Number(tp.amount) * 100);
    const merchantRefNum = `${tp.reference}-${Date.now()}`;

    const psResp = await fetch(`${paysafeBase()}/paymenthub/v1/payments`, {
      method: 'POST',
      headers: {
        'Authorization': paysafeAuthHeader(apiKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merchantRefNum,
        amount: amountCents,
        currencyCode: (tp.currency || 'CAD').toUpperCase(),
        paymentHandleToken: body.payment_handle_token,
      }),
    });

    const psBody = await psResp.json();

    if (!psResp.ok) {
      console.error('Paysafe payment error', psBody);
      await admin.from('tax_payments').update({
        status: 'failed',
        metadata: { ...(tp.metadata ?? {}), paysafe_error: psBody },
      }).eq('id', tp.id);
      return new Response(JSON.stringify({ error: psBody?.error?.message || 'Payment rejected', details: psBody }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const status = psBody?.status === 'COMPLETED' ? 'paid'
      : psBody?.status === 'PENDING' ? 'submitted'
      : psBody?.status === 'FAILED' ? 'failed' : 'submitted';

    await admin.from('tax_payments').update({
      status,
      provider_transfer_id: psBody?.id ?? null,
      submitted_at: new Date().toISOString(),
      paid_at: status === 'paid' ? new Date().toISOString() : null,
      confirmation_number: psBody?.id ?? null,
      metadata: { ...(tp.metadata ?? {}), paysafe: psBody },
    }).eq('id', tp.id);

    return new Response(JSON.stringify({ ok: true, status, paysafe_id: psBody?.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('paysafe-create-payment error', msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
