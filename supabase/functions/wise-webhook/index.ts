// Wise webhook receiver (public endpoint).
// Verifies Wise's X-Signature-SHA256 RSA signature against the Wise webhook
// public key, then logs every transfer update event to public.wise_webhook_events.
// Business logic (applying transfer state to payment records) is a placeholder.
import { corsHeaders as baseCorsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { recordInvoicePayment } from '../_shared/invoice_payment.ts';

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


// ---------------------------------------------------------------------------
// Invoice auto-matching for incoming Wise deposits
// ---------------------------------------------------------------------------

/** Pull any customer-supplied reference out of the webhook payload. */
function referenceFromPayload(payload: any): string | null {
  const d = payload?.data ?? {};
  return (
    str(
      d.reference_number ??
        d.referenceNumber ??
        d.reference ??
        d.payment_reference ??
        d.paymentReference ??
        d.details?.reference ??
        d.details?.paymentReference,
    ) ?? null
  );
}

/** Pull the Wise incoming-transfer (deposit) id out of the webhook payload. */
function incomingTransferIdFromPayload(payload: any): string | null {
  const d = payload?.data ?? {};
  const res = d.resource ?? payload?.resource ?? {};
  return (
    str(
      d.incoming_transfer_id ??
        d.incomingTransferId ??
        d.transaction_id ??
        d.transactionId ??
        d.reference_id ??
        d.referenceId ??
        (String(res.type ?? '').toLowerCase().includes('incoming') ? res.id : null),
    ) ?? null
  );
}

/**
 * Preferred reference source: Wise's incoming-transfers resource exposes the
 * payer's `unstructuredReference` verbatim, so no narration parsing is needed.
 * Returns null when the token is missing or the deposit id is unknown.
 */
async function referenceFromIncomingTransfer(
  profileId: string,
  incomingTransferId: string,
): Promise<string | null> {
  const token = Deno.env.get('WISE_API_TOKEN');
  if (!token) {
    console.warn('[wise-webhook] WISE_API_TOKEN not set; cannot look up incoming transfer');
    return null;
  }

  // Wise exposes the resource both profile-scoped and standalone depending on
  // account setup; try the profile-scoped path first.
  const urls = [
    `https://api.wise.com/v1/profiles/${profileId}/incoming-transfers/${incomingTransferId}`,
    `https://api.wise.com/v1/incoming-transfers/${incomingTransferId}`,
  ];

  for (const url of urls) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      console.warn('[wise-webhook] incoming-transfer lookup failed', url, res.status);
      continue;
    }
    const body = await res.json().catch(() => null);
    if (!body) continue;

    const reference = str(
      body.unstructuredReference ??
        body.unstructured_reference ??
        body.reference ??
        body.details?.unstructuredReference ??
        body.details?.reference ??
        body.details?.paymentReference ??
        body.details?.description,
    );
    if (reference) return reference;
  }

  return null;
}


/**
 * Wise balance-credit webhooks omit the payer reference, so look it up on the
 * balance statement for a small window around the event.
 */
async function referenceFromStatement(
  profileId: string,
  balanceId: string,
  currency: string,
  amount: number,
  occurredAt: string | null,
): Promise<string | null> {
  const token = Deno.env.get('WISE_API_TOKEN');
  if (!token) {
    console.warn('[wise-webhook] WISE_API_TOKEN not set; cannot look up statement reference');
    return null;
  }

  const center = occurredAt ? new Date(occurredAt) : new Date();
  const start = new Date(center.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const end = new Date(center.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const url =
    `https://api.wise.com/v1/profiles/${profileId}/balance-statements/${balanceId}/statement.json` +
    `?currency=${encodeURIComponent(currency)}&intervalStart=${encodeURIComponent(start)}` +
    `&intervalEnd=${encodeURIComponent(end)}&type=COMPACT`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    console.error('[wise-webhook] statement lookup failed', res.status, await res.text());
    return null;
  }

  const body = await res.json().catch(() => null);
  const transactions: any[] = body?.transactions ?? [];
  const credits = transactions.filter((t) => String(t?.type ?? '').toUpperCase() === 'CREDIT');

  // Prefer the credit whose amount matches the webhook amount exactly.
  const match =
    credits.find((t) => Math.abs(Number(t?.amount?.value ?? NaN) - amount) < 0.01) ?? null;

  const candidate = match ?? credits[0] ?? null;
  if (!candidate) return null;

  return (
    str(
      candidate.referenceNumber ??
        candidate.details?.paymentReference ??
        candidate.details?.reference ??
        candidate.details?.description,
    ) ?? null
  );
}

/** Extract an invoice reference token from free-form bank narration. */
function extractReferenceTokens(raw: string): string[] {
  const cleaned = raw.toUpperCase();
  const tokens = cleaned.match(/[A-Z0-9]+-[A-Z0-9]+/g) ?? [];
  return Array.from(new Set([cleaned.trim(), ...tokens]));
}

type MatchResult = {
  match_status: string;
  matched_invoice_id: string | null;
  matched_reference: string | null;
  organization_id: string | null;
};

/**
 * Match a Wise deposit to an open invoice via its wise_payment_reference and
 * record a customer payment. Reference matching is exact (case-insensitive) so
 * a wrong reference is reported rather than guessed.
 */
async function matchDepositToInvoice(
  admin: any,
  mapped: MappedEvent,
  payload: any,
): Promise<MatchResult> {
  const result: MatchResult = {
    match_status: 'unmatched',
    matched_invoice_id: null,
    matched_reference: null,
    organization_id: null,
  };

  if (!mapped.currency || !mapped.amount || mapped.amount <= 0) {
    result.match_status = 'not_applicable';
    return result;
  }

  // Resolve the platform receiving account for this currency (shared pool).
  let accountQuery = admin
    .from('wise_receiving_accounts')
    .select('id, wise_profile_id, wise_balance_id, currency')
    .eq('is_active', true)
    .eq('currency', mapped.currency);
  if (mapped.balance_id) accountQuery = accountQuery.eq('wise_balance_id', mapped.balance_id);
  else if (mapped.profile_id) accountQuery = accountQuery.eq('wise_profile_id', mapped.profile_id);

  const { data: accounts } = await accountQuery.limit(2);
  const account = accounts?.[0] ?? null;
  if (!account) {
    result.match_status = 'no_receiving_account';
    return result;
  }

  // Find the payer reference: payload first, then Wise's incoming-transfers
  // resource (exact `unstructuredReference`), then the balance statement.
  let reference = referenceFromPayload(payload);

  const incomingTransferId = incomingTransferIdFromPayload(payload);
  const profileId = account.wise_profile_id ?? mapped.profile_id ?? null;
  if (!reference && incomingTransferId && profileId) {
    reference = await referenceFromIncomingTransfer(profileId, incomingTransferId);
  }

  if (!reference && account.wise_profile_id && account.wise_balance_id) {
    reference = await referenceFromStatement(
      account.wise_profile_id,
      account.wise_balance_id,
      mapped.currency,
      mapped.amount,
      mapped.occurred_at,
    );
  }

  if (!reference) {
    result.match_status = 'no_reference';
    return result;
  }
  result.matched_reference = reference;

  const candidates = extractReferenceTokens(reference);
  const { data: invoices } = await admin
    .from('invoices')
    .select('id, organization_id, customer_id, total, amount_paid, balance_due, currency, wise_payment_reference')
    .in('wise_payment_reference', candidates)
    .limit(1);

  const invoice = invoices?.[0] ?? null;
  if (!invoice) {
    result.match_status = 'reference_not_found';
    return result;
  }
  result.matched_invoice_id = invoice.id;
  // The shared receiving pool means the paying organization is determined by
  // the invoice that owns the reference, not by the receiving account.
  result.organization_id = invoice.organization_id;

  if (invoice.currency && invoice.currency !== mapped.currency) {
    result.match_status = 'currency_mismatch';
    return result;
  }

  // Record the payment against the invoice: customer_payments row, invoice
  // totals, virtual-account balance credit and the cash/AR journal entry.
  const paymentDate = (mapped.occurred_at ?? new Date().toISOString()).slice(0, 10);
  const recorded = await recordInvoicePayment(admin, {
    invoice,
    amount: mapped.amount,
    currency: mapped.currency,
    paymentDate,
    reference,
    paymentMethod: 'wise_bank_transfer',
    notes: `Auto-matched Wise deposit (balance ${mapped.balance_id ?? 'n/a'})`,
  });

  if (recorded.status === 'payment_insert_failed') {
    result.match_status = 'payment_insert_failed';
    return result;
  }

  result.match_status = recorded.status;
  return result;
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

    // Incoming deposits: try to auto-match to an open invoice by reference.
    let match: MatchResult = {
      match_status: 'not_applicable',
      matched_invoice_id: null,
      matched_reference: null,
      organization_id: null,
    };
    const isDeposit =
      mapped.event_type.startsWith('balances#') &&
      (mapped.transaction_type ?? '').toLowerCase() !== 'debit' &&
      (mapped.amount ?? 0) > 0;
    if (isDeposit) {
      try {
        match = await matchDepositToInvoice(admin, mapped, payload);
      } catch (e) {
        console.error('[wise-webhook] invoice matching error', (e as Error).message);
        match = { ...match, match_status: 'match_error' };
      }
      console.log('[wise-webhook] match result', match.match_status, match.matched_reference ?? '');
    }

    const { error: insertError } = await admin.from('wise_webhook_events').insert({
      ...mapped,
      ...match,
      delivery_id: deliveryId,
      signature_valid: true,
      payload,
    });

    // Unique violation on delivery_id => Wise redelivery, safe to ignore.
    if (insertError && (insertError as any).code !== '23505') {
      console.error('[wise-webhook] insert error', insertError);
    }
    const duplicate = !!insertError && (insertError as any).code === '23505';

    // TODO(next phase): apply transfer state to outbound payment records.
    // Match `mapped.transfer_id` against ap_payment_batch_items.provider_transfer_id
    // and tax_payments.provider_transfer_id, then flip to paid/failed and post/reverse
    // the linked journal entry (mirroring treasury-payment-webhook). Intentionally a
    // no-op for now: this deployment only logs events.

    return json({
      received: true,
      duplicate,
      event_type: mapped.event_type,
      resource_type: mapped.resource_type,
      needs_attention: mapped.needs_attention,
      match_status: match.match_status,
      matched_invoice_id: match.matched_invoice_id,
    });
  } catch (e) {
    console.error('[wise-webhook] error', e);
    return json({ error: (e as Error).message }, 500);
  }
});
