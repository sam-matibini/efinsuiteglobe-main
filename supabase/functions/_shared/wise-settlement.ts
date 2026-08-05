// Settlement leg for invoice card collections.
//
// Card capture is unchanged (Paysafe hosted window / Stripe Checkout). Once the
// payment is captured and applied to the invoice, this helper moves the
// collected funds to the organization's Wise destination when the org has
// enabled "settle invoice card payments to Wise" in eFinconnect settings.
//
// It never throws into the capture path: failures are recorded on the
// wise_transfers row (status `failed`) so they can be retried.

// deno-lint-ignore-file no-explicit-any
const WISE_API_BASE = Deno.env.get('WISE_API_BASE') ?? 'https://api.transferwise.com';

export interface CardSettlementPrefs {
  provider: 'processor' | 'wise';
  wiseRecipientId: string | null;
  currency: string | null;
}

export interface SettleInput {
  organizationId: string;
  amount: number;
  currency: string;
  reference: string;
  invoiceId?: string | null;
  paymentLinkId?: string | null;
  sourceLabel?: string;
}

export interface SettleResult {
  settled: boolean;
  status?: string;
  transferRowId?: string;
  wiseTransferId?: string | null;
  error?: string;
  skippedReason?: string;
}

export async function getCardSettlementPrefs(admin: any, orgId: string): Promise<CardSettlementPrefs> {
  const { data } = await admin
    .from('organizations')
    .select('efinconnect_preferences')
    .eq('id', orgId)
    .maybeSingle();
  const prefs = (data?.efinconnect_preferences ?? {}) as Record<string, any>;
  const cs = (prefs.cardSettlement ?? {}) as Record<string, any>;
  return {
    provider: cs.provider === 'wise' ? 'wise' : 'processor',
    wiseRecipientId: cs.wiseRecipientId ?? null,
    currency: cs.currency ?? null,
  };
}

/**
 * Create the Wise settlement transfer for a captured invoice card payment.
 * Idempotent per (source_type, source_id): a settlement already recorded for
 * the same payment link / invoice is not duplicated.
 */
export async function settleCollectionToWise(admin: any, input: SettleInput): Promise<SettleResult> {
  const { organizationId, amount, currency, reference } = input;
  if (!organizationId || !(Number(amount) > 0)) {
    return { settled: false, skippedReason: 'invalid_input' };
  }

  const prefs = await getCardSettlementPrefs(admin, organizationId);
  if (prefs.provider !== 'wise') return { settled: false, skippedReason: 'not_enabled' };

  const sourceId = input.paymentLinkId ?? input.invoiceId ?? null;

  // Idempotency — never settle the same collection twice.
  if (sourceId) {
    const { data: existing } = await admin
      .from('wise_transfers')
      .select('id, status, wise_transfer_id')
      .eq('organization_id', organizationId)
      .eq('source_type', 'payment_link')
      .eq('source_id', sourceId)
      .neq('status', 'failed')
      .limit(1);
    if (existing && existing.length > 0) {
      return {
        settled: true,
        status: existing[0].status,
        transferRowId: existing[0].id,
        wiseTransferId: existing[0].wise_transfer_id,
        skippedReason: 'already_settled',
      };
    }
  }

  let recipient: Record<string, any> | null = null;
  if (prefs.wiseRecipientId) {
    const { data } = await admin
      .from('wise_payout_recipients')
      .select('*')
      .eq('id', prefs.wiseRecipientId)
      .eq('organization_id', organizationId)
      .maybeSingle();
    recipient = data ?? null;
  }

  const settleCurrency = (prefs.currency || recipient?.currency || currency || 'CAD').toUpperCase();
  const token = Deno.env.get('WISE_API_TOKEN');
  const profileId = Deno.env.get('WISE_PROFILE_ID');

  let status = 'instructed';
  let quoteId: string | null = null;
  let transferId: string | null = null;
  let errorMessage: string | null = null;

  if (!token || !profileId) {
    status = 'instructed';
    errorMessage = 'Wise credentials not configured — settlement recorded for manual confirmation.';
  } else if (!recipient?.wise_recipient_id) {
    status = 'instructed';
    errorMessage = 'No synced Wise destination selected — settlement recorded for manual confirmation.';
  } else {
    try {
      const quoteRes = await fetch(`${WISE_API_BASE}/v3/profiles/${profileId}/quotes`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceCurrency: (currency || 'CAD').toUpperCase(),
          targetCurrency: settleCurrency,
          sourceAmount: Number(amount),
          payOut: 'BANK_TRANSFER',
          targetAccount: Number(recipient.wise_recipient_id),
        }),
      });
      const quote = await quoteRes.json().catch(() => ({}));
      if (!quoteRes.ok) {
        throw new Error(`[${quoteRes.status}] ${quote?.errors?.[0]?.message ?? JSON.stringify(quote)}`);
      }
      quoteId = String(quote.id);

      const transferRes = await fetch(`${WISE_API_BASE}/v1/transfers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetAccount: Number(recipient.wise_recipient_id),
          quoteUuid: quoteId,
          customerTransactionId: crypto.randomUUID(),
          details: { reference: reference.slice(0, 35) },
        }),
      });
      const transfer = await transferRes.json().catch(() => ({}));
      if (!transferRes.ok) {
        throw new Error(`[${transferRes.status}] ${transfer?.errors?.[0]?.message ?? JSON.stringify(transfer)}`);
      }
      transferId = String(transfer.id);

      const fundRes = await fetch(`${WISE_API_BASE}/v3/profiles/${profileId}/transfers/${transferId}/payments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'BALANCE' }),
      });
      if (fundRes.ok) {
        status = 'processing';
      } else {
        const fp = await fundRes.json().catch(() => ({}));
        status = 'funding_failed';
        errorMessage = `[${fundRes.status}] ${fp?.errors?.[0]?.message ?? 'Wise funding failed'}`;
      }
    } catch (e) {
      status = 'failed';
      errorMessage = e instanceof Error ? e.message : String(e);
    }
  }

  const { data: row, error: insErr } = await admin
    .from('wise_transfers')
    .insert({
      organization_id: organizationId,
      source_type: 'payment_link',
      source_id: sourceId,
      recipient_id: recipient?.id ?? null,
      method: 'eft',
      amount: Number(amount),
      currency: settleCurrency,
      reference,
      wise_quote_id: quoteId,
      wise_transfer_id: transferId,
      status,
      error: errorMessage,
      metadata: {
        settlement: true,
        source: input.sourceLabel ?? 'card_collection',
        invoice_id: input.invoiceId ?? null,
        payment_link_id: input.paymentLinkId ?? null,
        captured_currency: (currency || '').toUpperCase(),
      },
    })
    .select('id')
    .maybeSingle();

  if (insErr) {
    return { settled: false, status, error: insErr.message };
  }

  return {
    settled: status !== 'failed',
    status,
    transferRowId: row?.id,
    wiseTransferId: transferId,
    error: errorMessage ?? undefined,
  };
}
