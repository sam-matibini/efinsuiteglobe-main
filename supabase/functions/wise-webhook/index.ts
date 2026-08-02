// Wise webhook receiver (public endpoint).
// Verifies Wise's X-Signature-SHA256 RSA signature against the Wise webhook
// public key, then logs every transfer update event to public.wise_webhook_events.
// Business logic (applying transfer state to payment records) is a placeholder.
import { corsHeaders as baseCorsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  ...baseCorsHeaders,
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-signature-sha256, x-signature, x-delivery-id, x-test-notification',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function pemToArrayBuffer(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\s+/g, '');
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function base64ToBytes(b64: string): Uint8Array {
  const raw = atob(b64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function verifyWiseSignature(rawBody: string, signatureB64: string, pem: string) {
  const key = await crypto.subtle.importKey(
    'spki',
    pemToArrayBuffer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  return await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    base64ToBytes(signatureB64),
    new TextEncoder().encode(rawBody),
  );
}

type MappedEvent = {
  event_type: string;
  subscription_id: string | null;
  resource_type: string | null;
  transfer_id: string | null;
  balance_id: string | null;
  profile_id: string | null;
  current_state: string | null;
  previous_state: string | null;
  amount: number | null;
  currency: string | null;
  post_balance_amount: number | null;
  transaction_type: string | null;
  needs_attention: boolean;
  issue_summary: string | null;
  active_cases: unknown | null;
  occurred_at: string | null;
};

const str = (v: unknown) => (v == null ? null : String(v));
const num = (v: unknown) => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v));

/** Transfer states that represent money not delivered / clawed back. */
const PROBLEM_STATES = new Set([
  'cancelled',
  'funds_refunded',
  'bounced_back',
  'charged_back',
  'unknown',
]);

/** Normalize the varying `data` shapes across all Wise event types. */
function mapEvent(payload: any): MappedEvent {
  const d = payload?.data ?? {};
  const res = d.resource ?? payload?.resource ?? {};

  const base: MappedEvent = {
    event_type: String(payload?.event_type ?? payload?.eventType ?? 'unknown'),
    subscription_id: str(payload?.subscription_id ?? payload?.subscriptionId),
    resource_type: str(res.type ?? null),
    transfer_id: null,
    balance_id: null,
    profile_id: str(res.profile_id ?? res.profileId ?? d.profile_id ?? d.profileId),
    current_state: null,
    previous_state: null,
    amount: null,
    currency: null,
    post_balance_amount: null,
    transaction_type: null,
    needs_attention: false,
    issue_summary: null,
    active_cases: null,
    occurred_at: str(d.occurred_at ?? d.occurredAt ?? payload?.sent_at ?? payload?.sentAt),
  };

  const type = base.event_type;

  // ---- Balance / Account Deposit events -----------------------------------
  if (type.startsWith('balances#')) {
    base.resource_type = base.resource_type ?? 'balance';
    base.balance_id = str(res.id ?? d.balance_id ?? d.balanceId);
    base.amount = num(d.amount?.value ?? d.amount);
    base.currency = str(d.amount?.currency ?? d.currency);
    base.post_balance_amount = num(
      d.post_transaction_balance_amount?.value ??
        d.post_transaction_balance_amount ??
        d.postTransactionBalanceAmount?.value ??
        d.postTransactionBalanceAmount,
    );
    base.transaction_type = str(d.transaction_type ?? d.transactionType);
    return base;
  }

  // ---- Transfer events ----------------------------------------------------
  if (type.startsWith('transfers#')) {
    base.resource_type = base.resource_type ?? 'transfer';
    base.transfer_id = str(res.id ?? d.transfer_id ?? d.transferId ?? d.id);
    base.current_state = str(d.current_state ?? d.currentState ?? d.state);
    base.previous_state = str(d.previous_state ?? d.previousState);
    base.amount = num(d.amount?.value ?? d.amount);
    base.currency = str(d.amount?.currency ?? d.currency);

    if (type.endsWith('#active-cases')) {
      const cases = d.active_cases ?? d.activeCases ?? [];
      base.active_cases = cases;
      const names = (Array.isArray(cases) ? cases : [])
        .map((c: any) => (typeof c === 'string' ? c : c?.type ?? c?.name ?? 'case'))
        .filter(Boolean);
      base.needs_attention = names.length > 0;
      base.issue_summary = names.length
        ? `active cases: ${names.join(', ')}`
        : 'active cases cleared';
      return base;
    }

    if (type.endsWith('#payout-failure')) {
      base.needs_attention = true;
      const reason =
        d.failure_reason ?? d.failureReason ?? d.reason ?? d.error_code ?? d.errorCode ?? null;
      base.issue_summary = reason ? `payout failure: ${reason}` : 'payout failure';
      return base;
    }

    if (type.endsWith('#refund')) {
      base.needs_attention = true;
      const reason = d.refund_reason ?? d.refundReason ?? d.reason ?? null;
      base.issue_summary = reason ? `refund: ${reason}` : 'transfer refunded';
      return base;
    }

    // state-change and any other transfer event
    if (base.current_state && PROBLEM_STATES.has(base.current_state)) {
      base.needs_attention = true;
      base.issue_summary = `transfer state ${base.current_state}`;
    }
    return base;
  }

  // ---- Anything else: log generically ------------------------------------
  return base;
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const rawBody = await req.text();
    const signature =
      req.headers.get('x-signature-sha256') ?? req.headers.get('X-Signature-SHA256') ??
      req.headers.get('x-signature');
    const deliveryId = req.headers.get('x-delivery-id');
    const isTest = (req.headers.get('x-test-notification') ?? '').toLowerCase() === 'true';

    const publicKey = Deno.env.get('WISE_WEBHOOK_PUBLIC_KEY');
    if (!publicKey) {
      console.error('[wise-webhook] WISE_WEBHOOK_PUBLIC_KEY is not configured');
      return json({ error: 'Unauthorized' }, 401);
    }

    let signatureValid = false;
    if (signature) {
      try {
        signatureValid = await verifyWiseSignature(rawBody, signature, publicKey);
      } catch (e) {
        console.error('[wise-webhook] signature verification error', (e as Error).message);
      }
    }
    if (!signatureValid) {
      console.warn('[wise-webhook] rejected request with invalid/missing signature');
      return json({ error: 'Invalid signature' }, 401);
    }

    let payload: any = {};
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      console.error('[wise-webhook] body is not valid JSON');
      return json({ received: true, note: 'invalid json' }, 200);
    }

    const mapped = mapEvent(payload);
    console.log(
      '[wise-webhook] event',
      mapped.event_type,
      'resource',
      mapped.resource_type,
      'id',
      mapped.transfer_id ?? mapped.balance_id,
      'state',
      mapped.current_state,
      'amount',
      mapped.amount,
      mapped.currency,
      mapped.needs_attention ? `ATTENTION: ${mapped.issue_summary}` : '',
    );


    // Wise test pings from the dashboard: acknowledge without persisting.
    if (isTest) {
      return json({ received: true, test: true });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { error: insertError } = await admin.from('wise_webhook_events').insert({
      ...mapped,
      delivery_id: deliveryId,
      signature_valid: true,
      payload,
    });

    // Unique violation on delivery_id => Wise redelivery, safe to ignore.
    if (insertError && (insertError as any).code !== '23505') {
      console.error('[wise-webhook] insert error', insertError);
    }
    const duplicate = !!insertError && (insertError as any).code === '23505';

    // TODO(next phase): apply transfer state to payment records.
    // Match `mapped.transfer_id` against ap_payment_batch_items.provider_transfer_id
    // and tax_payments.provider_transfer_id, then flip to paid/failed and post/reverse
    // the linked journal entry (mirroring treasury-payment-webhook). Intentionally a
    // no-op for now: this deployment only logs events.

    return json({ received: true, duplicate, event_type: mapped.event_type });
  } catch (e) {
    console.error('[wise-webhook] error', e);
    return json({ error: (e as Error).message }, 500);
  }
});
