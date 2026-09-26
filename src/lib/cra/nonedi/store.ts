import type { ClientBalance, GstFilingAttempt, PaymentInstruction, RacAuthorization } from './engine';

export interface NonEdiBook {
  instructions: PaymentInstruction[];
  balances: ClientBalance[];
  authorizations: RacAuthorization[];
  gstFilings: GstFilingAttempt[];
}

const EMPTY: NonEdiBook = { instructions: [], balances: [], authorizations: [], gstFilings: [] };

function key(orgId: string) {
  return `efinsuite.cra-nonedi.v1:${orgId}`;
}

export function readNonEdiBook(orgId: string): NonEdiBook {
  if (!orgId || typeof localStorage === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(key(orgId));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as NonEdiBook;
    return {
      instructions: parsed.instructions ?? [],
      balances: parsed.balances ?? [],
      authorizations: parsed.authorizations ?? [],
      gstFilings: parsed.gstFilings ?? [],
    };
  } catch {
    return EMPTY;
  }
}

export function writeNonEdiBook(orgId: string, book: NonEdiBook) {
  if (!orgId || typeof localStorage === 'undefined') return;
  localStorage.setItem(key(orgId), JSON.stringify(book));
}
