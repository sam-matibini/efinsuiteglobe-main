import { addDays, format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';

export interface PaymentTermOption {
  /** Stored + displayed label, e.g. "Net 30". */
  label: string;
  /** Days added to the bill date to derive the due date. */
  days: number;
}

export const CUSTOM_TERM_VALUE = '__custom__';

export const BILL_PAYMENT_TERMS: PaymentTermOption[] = [
  { label: 'Due on receipt', days: 0 },
  { label: 'Net 7', days: 7 },
  { label: 'Net 10', days: 10 },
  { label: 'Net 15', days: 15 },
  { label: 'Net 30', days: 30 },
  { label: 'Net 45', days: 45 },
  { label: 'Net 60', days: 60 },
  { label: 'Net 90', days: 90 },
];

/** Returns the preset matching a stored terms string, or null when it's custom. */
export function findPaymentTerm(terms?: string | null): PaymentTermOption | null {
  if (!terms) return null;
  const needle = terms.trim().toLowerCase();
  return (
    BILL_PAYMENT_TERMS.find((t) => t.label.toLowerCase() === needle) ?? null
  );
}

/** Days for a stored terms string, or null when it isn't a known preset. */
export function getTermDays(terms?: string | null): number | null {
  return findPaymentTerm(terms)?.days ?? null;
}

/** Computes yyyy-MM-dd due date from a bill date string and a term's days. */
export function computeDueDate(billDate: string, days: number): string {
  const base = billDate ? parseLocalDate(billDate) : new Date();
  return format(addDays(base, days), 'yyyy-MM-dd');
}
