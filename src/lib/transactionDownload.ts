import { classifyCreditCardType, type CreditCardTxnType } from '@/lib/creditCardImportNormalizer';
import { signedBankAmount } from '@/lib/plaidBankAmount';

/** Column order for a downloaded bank or credit-card file. */
export const TRANSACTION_DOWNLOAD_HEADERS = [
  'Date',
  'Description',
  'Amount',
  'Type',
  'Payee_Payor',
  'Reference',
] as const;

export type TransactionDownloadKind = 'bank' | 'credit-card';

export interface TransactionDownloadRow {
  date: string;
  description: string;
  amount: number;
  type: string;
  payee_payor?: string | null;
  reference?: string | null;
}

export function downloadPayee(row: {
  payee_payor?: string | null;
  memo?: string | null;
  reference?: string | null;
}): string {
  if (row.payee_payor) return row.payee_payor;
  if (row.reference?.startsWith('PLAID-') && row.memo) return row.memo;
  return '';
}

export function bankDownloadType(type: string | null | undefined, amount: number): 'deposit' | 'withdrawal' {
  const value = (type || '').toLowerCase();
  if (value === 'deposit' || value === 'withdrawal') return value;
  return amount < 0 ? 'withdrawal' : 'deposit';
}

export function creditCardDownloadType(
  type: string | null | undefined,
  amount: number,
  description?: string | null,
): CreditCardTxnType {
  return classifyCreditCardType(amount, type, description);
}

export function downloadAmount(kind: TransactionDownloadKind, amount: number, type: string): number {
  if (kind === 'bank') return signedBankAmount(amount, type);
  const magnitude = Math.abs(Number(amount) || 0);
  if (type === 'payment' || type === 'credit') return -magnitude;
  return magnitude;
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function transactionDownloadCells(
  kind: TransactionDownloadKind,
  row: TransactionDownloadRow,
): [string, string, string, string, string, string] {
  const type = kind === 'bank'
    ? bankDownloadType(row.type, row.amount)
    : creditCardDownloadType(row.type, row.amount, row.description);
  const amount = downloadAmount(kind, row.amount, type);
  return [
    String(row.date || '').slice(0, 10),
    row.description || '',
    amount.toFixed(2),
    type,
    row.payee_payor || '',
    row.reference || '',
  ];
}

export function buildTransactionDownloadCsv(
  kind: TransactionDownloadKind,
  rows: TransactionDownloadRow[],
): string {
  const lines = [
    TRANSACTION_DOWNLOAD_HEADERS.join(','),
    ...rows.map((row) => transactionDownloadCells(kind, row).map(csvCell).join(',')),
  ];
  return lines.join('\n');
}

export function transactionDownloadMatrix(
  kind: TransactionDownloadKind,
  rows: TransactionDownloadRow[],
): (string | number)[][] {
  return rows.map((row) => {
    const cells = transactionDownloadCells(kind, row);
    return [cells[0], cells[1], Number(cells[2]), cells[3], cells[4], cells[5]];
  });
}
