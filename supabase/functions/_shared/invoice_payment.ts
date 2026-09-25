// Shared server-side invoice-payment recorder used by provider webhooks
// (wise-webhook, efincash-webhook).
//
// It performs the full "invoice got paid" side effects:
//   1. insert customer_payments (idempotent on invoice + reference)
//   2. update invoice amount_paid / balance_due / status / paid_at
//   3. credit the organization's virtual account balance for that currency
//   4. post a journal entry (debit cash/bank, credit A/R)
//
// Every step is tolerant: a failure in the balance or journal step is logged and
// does not undo the recorded payment.

export interface DefaultAccounts {
  ar?: { id: string };
  cash?: { id: string };
}

/**
 * Server-side port of the frontend `getDefaultAccounts` resolver
 * (src/hooks/useJournalEntryCreation.ts). Uses the same code/name patterns so
 * webhook-posted entries land in the same accounts as manual payments.
 */
export async function getDefaultAccounts(
  admin: any,
  organizationId: string,
): Promise<DefaultAccounts> {
  const { data: accounts } = await admin
    .from('accounts')
    .select('id, code, name, account_type, is_header')
    .eq('organization_id', organizationId)
    .eq('is_active', true);

  const postable = (accounts ?? []).filter((a: any) => !a.is_header);

  const findAccount = (
    type: string,
    codePatterns: RegExp[],
    namePatterns: string[],
  ) => {
    const candidates = postable.filter((a: any) => a.account_type === type);
    for (const pattern of codePatterns) {
      const found = candidates.find((a: any) => pattern.test(a.code ?? ''));
      if (found) return found;
    }
    for (const pattern of namePatterns) {
      const found = candidates.find((a: any) =>
        (a.name ?? '').toLowerCase().includes(pattern.toLowerCase()),
      );
      if (found) return found;
    }
    return undefined;
  };

  return {
    ar: findAccount(
      'asset',
      [/^110\d*$/, /^1-\d+-110/, /^1\d{3}-.*$/],
      ['accounts receivable', 'trade receivable', 'receivable', 'a/r'],
    ),
    cash: findAccount(
      'asset',
      [/^100\d*$/, /^1-\d+-100/, /^1\d{3}-.*$/],
      ['cash', 'bank', 'chequing', 'checking', 'petty cash'],
    ),
  };
}

interface JournalLine {
  account_id: string;
  debit: number;
  credit: number;
  memo?: string;
  customer_id?: string | null;
  source_document_type?: string | null;
  source_document_id?: string | null;
}

/**
 * Minimal server-side journal entry poster: inserts as draft, adds lines, then
 * promotes to posted so the balance-validation trigger runs on a complete entry.
 */
export async function postJournalEntry(
  admin: any,
  params: {
    organizationId: string;
    date: string;
    description: string;
    reference?: string;
    journalType?: string;
    lines: JournalLine[];
  },
): Promise<string | null> {
  const { organizationId, date, description, lines } = params;

  let reference = params.reference;
  if (!reference) {
    const { data: allEntries } = await admin
      .from('journal_entries')
      .select('reference')
      .eq('organization_id', organizationId)
      .like('reference', 'JE-%');
    let maxNum = 0;
    for (const e of allEntries ?? []) {
      const m = (e.reference ?? '').match(/JE-(\d+)$/);
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
    }
    reference = `JE-${String(maxNum + 1).padStart(4, '0')}`;
  }

  const { data: entry, error: entryError } = await admin
    .from('journal_entries')
    .insert({
      organization_id: organizationId,
      entry_date: date,
      reference,
      description,
      journal_type: params.journalType ?? 'bank',
      status: 'draft',
    })
    .select()
    .single();
  if (entryError || !entry) {
    console.error('[invoice_payment] journal entry insert failed', entryError);
    return null;
  }

  const { error: linesError } = await admin.from('journal_entry_lines').insert(
    lines.map((line, idx) => ({
      journal_entry_id: entry.id,
      account_id: line.account_id,
      debit: line.debit || 0,
      credit: line.credit || 0,
      description: line.memo ?? null,
      line_order: idx,
      base_currency_debit: Math.round((line.debit || 0) * 100) / 100,
      base_currency_credit: Math.round((line.credit || 0) * 100) / 100,
      customer_id: line.customer_id ?? null,
      source_document_type: line.source_document_type ?? null,
      source_document_id: line.source_document_id ?? null,
    })),
  );
  if (linesError) {
    console.error('[invoice_payment] journal lines insert failed', linesError);
    await admin.from('journal_entries').delete().eq('id', entry.id);
    return null;
  }

  const { error: postError } = await admin
    .from('journal_entries')
    .update({ status: 'posted' })
    .eq('id', entry.id);
  if (postError) {
    console.error('[invoice_payment] journal entry posting failed', postError);
    await admin.from('journal_entry_lines').delete().eq('journal_entry_id', entry.id);
    await admin.from('journal_entries').delete().eq('id', entry.id);
    return null;
  }

  return entry.id as string;
}

/** Credit (or debit, for negative amounts) an organization's virtual account balance. */
export async function adjustVirtualAccountBalance(
  admin: any,
  opts: { organizationId: string; currency: string; delta: number },
): Promise<{ virtual_account_id: string; balance: number } | null> {
  const { data: account } = await admin
    .from('virtual_accounts')
    .select('id, balance')
    .eq('organization_id', opts.organizationId)
    .eq('currency', opts.currency)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!account) return null;

  const newBalance = Number(account.balance ?? 0) + opts.delta;
  const { error } = await admin
    .from('virtual_accounts')
    .update({ balance: newBalance })
    .eq('id', account.id);
  if (error) {
    console.error('[invoice_payment] virtual account balance update failed', error);
    return null;
  }
  return { virtual_account_id: account.id, balance: newBalance };
}

export interface InvoiceRow {
  id: string;
  organization_id: string;
  customer_id: string;
  total: number | null;
  amount_paid: number | null;
  balance_due?: number | null;
  currency?: string | null;
}

export interface RecordInvoicePaymentResult {
  status:
    | 'paid'
    | 'partially_paid'
    | 'duplicate'
    | 'payment_insert_failed';
  payment_id?: string;
  journal_entry_id?: string | null;
  virtual_account_id?: string | null;
}

/**
 * Record a provider-matched payment against an invoice and move both the
 * virtual-account balance and the general ledger.
 */
export async function recordInvoicePayment(
  admin: any,
  opts: {
    invoice: InvoiceRow;
    amount: number;
    currency: string;
    paymentDate: string;
    reference: string;
    paymentMethod: string;
    notes?: string;
    /** When set, the balance credit is skipped (caller already moved it). */
    skipVirtualAccountCredit?: boolean;
  },
): Promise<RecordInvoicePaymentResult> {
  const { invoice, amount, currency, paymentDate, reference, paymentMethod } = opts;

  // Idempotency: same invoice + same provider reference already recorded.
  const { data: existing } = await admin
    .from('customer_payments')
    .select('id')
    .eq('invoice_id', invoice.id)
    .eq('reference', reference)
    .maybeSingle();
  if (existing) {
    return { status: 'duplicate', payment_id: existing.id };
  }

  const { data: payment, error: paymentError } = await admin
    .from('customer_payments')
    .insert({
      organization_id: invoice.organization_id,
      customer_id: invoice.customer_id,
      invoice_id: invoice.id,
      payment_date: paymentDate,
      amount,
      payment_method: paymentMethod,
      reference,
      notes: opts.notes ?? null,
    })
    .select()
    .single();
  if (paymentError || !payment) {
    console.error('[invoice_payment] payment insert error', paymentError);
    return { status: 'payment_insert_failed' };
  }

  // Update the invoice totals.
  const newAmountPaid = Number(invoice.amount_paid ?? 0) + amount;
  const newBalance = Number(invoice.total ?? 0) - newAmountPaid;
  const fullyPaid = newBalance <= 0.005;
  await admin
    .from('invoices')
    .update({
      amount_paid: newAmountPaid,
      balance_due: Math.max(0, newBalance),
      status: fullyPaid ? 'paid' : 'partial',
      paid_at: fullyPaid ? new Date().toISOString() : null,
    })
    .eq('id', invoice.id);

  // Credit the org's virtual account for this currency.
  let virtualAccountId: string | null = null;
  if (!opts.skipVirtualAccountCredit) {
    const credited = await adjustVirtualAccountBalance(admin, {
      organizationId: invoice.organization_id,
      currency,
      delta: amount,
    });
    virtualAccountId = credited?.virtual_account_id ?? null;
  }

  // Post the journal entry: debit cash/bank, credit A/R.
  let journalEntryId: string | null = null;
  try {
    const accounts = await getDefaultAccounts(admin, invoice.organization_id);
    if (accounts.cash?.id && accounts.ar?.id) {
      journalEntryId = await postJournalEntry(admin, {
        organizationId: invoice.organization_id,
        date: paymentDate,
        description: 'Customer payment received',
        reference: `PMT-${String(payment.id).slice(0, 8)}`,
        journalType: 'bank',
        lines: [
          {
            account_id: accounts.cash.id,
            debit: amount,
            credit: 0,
            memo: `Customer payment (${paymentMethod})`,
            customer_id: invoice.customer_id,
            source_document_type: 'invoice',
            source_document_id: invoice.id,
          },
          {
            account_id: accounts.ar.id,
            debit: 0,
            credit: amount,
            memo: `Customer payment (${paymentMethod})`,
            customer_id: invoice.customer_id,
            source_document_type: 'invoice',
            source_document_id: invoice.id,
          },
        ],
      });
      if (journalEntryId) {
        await admin
          .from('customer_payments')
          .update({ journal_entry_id: journalEntryId })
          .eq('id', payment.id);
      }
    } else {
      console.warn(
        '[invoice_payment] cash or A/R account not found; journal entry skipped',
        invoice.organization_id,
      );
    }
  } catch (e) {
    console.error('[invoice_payment] journal entry error', (e as Error).message);
  }

  return {
    status: fullyPaid ? 'paid' : 'partially_paid',
    payment_id: payment.id,
    journal_entry_id: journalEntryId,
    virtual_account_id: virtualAccountId,
  };
}
