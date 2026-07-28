// Shared helpers for eFinCash proxy + webhook.
// Handles the double-nested response shape:
//   { status, message: { status, message, data: { ... } } }
// as well as flatter variants { data: {...} } or a bare object.

export function unwrap(payload: any): { d: any; outerOk: boolean } {
  const inner =
    payload?.message?.data ??
    payload?.data ??
    payload ??
    {};
  const outerStatus = (payload?.status ?? payload?.message?.status ?? '')
    .toString()
    .toLowerCase();
  return { d: inner ?? {}, outerOk: outerStatus === 'success' };
}

export interface AccountFields {
  account_number: string | null;
  bank_name: string | null;
  account_name: string | null;
  provider_account_id: string | null;
  currency: string | null;
  status_raw: string;
}

export function mapAccountFields(
  d: any,
  fallback: { first_name?: string | null; last_name?: string | null } = {},
): AccountFields {
  const account_number =
    d.account_number ?? d.accountNumber ?? d.virtual_account_number ?? null;
  const bank_name =
    d.account_bank_name ?? d.bank_name ?? d.bankName ?? null;
  const provider_account_id =
    d.id ?? d.reference ?? d.order_ref ?? null;
  const derivedName = [fallback.first_name, fallback.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  const account_name =
    d.account_name ?? d.accountName ?? (derivedName || null);
  const currency = d.currency ?? null;
  const status_raw = (d.status ?? '').toString().toLowerCase();
  return {
    account_number: account_number ? String(account_number) : null,
    bank_name: bank_name ? String(bank_name) : null,
    account_name: account_name ? String(account_name) : null,
    provider_account_id: provider_account_id ? String(provider_account_id) : null,
    currency: currency ? String(currency) : null,
    status_raw,
  };
}

export interface TxFields {
  amount: number | null;
  currency: string | null;
  provider_tx_id: string | null;
  status: 'successful' | 'pending' | 'failed';
  type: 'credit' | 'debit';
  sender_name: string | null;
  sender_bank: string | null;
  sender_account: string | null;
  narration: string | null;
  occurred_at: string;
}

export function mapTxFields(d: any, eventName: string): TxFields {
  const rawAmount = d.amount ?? d.amount_settled ?? null;
  const amount =
    rawAmount !== null && rawAmount !== undefined && !isNaN(Number(rawAmount))
      ? Number(rawAmount)
      : null;

  const statusRaw = (d.status ?? '').toString().toLowerCase();
  const status: TxFields['status'] = statusRaw.includes('fail')
    ? 'failed'
    : statusRaw.includes('pend')
    ? 'pending'
    : 'successful';

  const evt = (eventName ?? '').toLowerCase();
  const typeRaw = (d.type ?? '').toString().toLowerCase();
  const isDebit =
    /debit|outflow|withdraw|payout/.test(evt) ||
    /debit|outflow|withdraw/.test(typeRaw);

  return {
    amount,
    currency: d.currency ? String(d.currency) : null,
    provider_tx_id:
      (d.id ?? d.reference ?? d.tx_ref ?? d.flw_ref ?? null) &&
      String(d.id ?? d.reference ?? d.tx_ref ?? d.flw_ref),
    status,
    type: isDebit ? 'debit' : 'credit',
    sender_name:
      d.customer?.name ?? d.meta?.originatorname ?? d.sender_name ?? null,
    sender_bank: d.meta?.bankname ?? d.sender_bank ?? null,
    sender_account:
      d.meta?.originatoraccountnumber ?? d.sender_account ?? null,
    narration: d.narration ?? d.description ?? d.remark ?? d.note ?? null,
    occurred_at:
      d.created_datetime ??
      d.created_at ??
      d.transaction_date ??
      new Date().toISOString(),
  };
}
