/** Editable debit and credit amounts for a journal entry opened from a drilldown. */

export interface JournalAmountLine {
  id: string;
  debit: number | string | null;
  credit: number | string | null;
  exchange_rate?: number | string | null;
  base_currency_debit?: number | string | null;
  base_currency_credit?: number | string | null;
}

export interface JournalAmountDraft {
  debit: string;
  credit: string;
}

export interface JournalAmountUpdate {
  id: string;
  debit: number;
  credit: number;
  baseDebit: number;
  baseCredit: number;
  valid: boolean;
}

const BALANCE_TOLERANCE_CENTS = 2;

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function moneyCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100);
}

export function parseJournalAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '-' || trimmed === '—' || trimmed === '–') return 0;
  if (/[-–—]/.test(trimmed)) return null;
  const normalized = trimmed.replace(/[^0-9.]/g, '');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return roundMoney(value);
}

export function lineExchangeRate(rate: unknown): number {
  const value = Number(rate ?? 1);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function seedAmountDrafts(lines: JournalAmountLine[]): Record<string, JournalAmountDraft> {
  const drafts: Record<string, JournalAmountDraft> = {};
  for (const line of lines) {
    const debit = Number(line.debit) || 0;
    const credit = Number(line.credit) || 0;
    drafts[line.id] = {
      debit: debit > 0 ? debit.toFixed(2) : '',
      credit: credit > 0 ? credit.toFixed(2) : '',
    };
  }
  return drafts;
}

/** Typing a debit clears that line's credit, and typing a credit clears its debit. */
export function draftAfterSideEdit(
  current: JournalAmountDraft,
  side: 'debit' | 'credit',
  raw: string,
): JournalAmountDraft {
  const parsed = parseJournalAmount(raw);
  const clearsOther = parsed !== null && parsed > 0;
  if (side === 'debit') {
    return { debit: raw, credit: clearsOther ? '' : current.credit };
  }
  return { debit: clearsOther ? '' : current.debit, credit: raw };
}

function storedBase(raw: number | string | null | undefined, amount: number, rate: number): number {
  if (raw === null || raw === undefined || raw === '') return roundMoney(amount * rate);
  const value = Number(raw);
  return Number.isFinite(value) ? roundMoney(value) : roundMoney(amount * rate);
}

export function editedJournalAmounts(
  lines: JournalAmountLine[],
  drafts: Record<string, JournalAmountDraft>,
): { lines: JournalAmountUpdate[]; valid: boolean; balanced: boolean; changed: boolean } {
  const next = lines.map((line) => {
    const draft = drafts[line.id] ?? {
      debit: Number(line.debit) ? String(line.debit) : '',
      credit: Number(line.credit) ? String(line.credit) : '',
    };
    const debit = parseJournalAmount(draft.debit);
    const credit = parseJournalAmount(draft.credit);
    const valid = debit !== null && credit !== null && !(debit > 0 && credit > 0);
    const rate = lineExchangeRate(line.exchange_rate);
    const storedDebit = roundMoney(Number(line.debit) || 0);
    const storedCredit = roundMoney(Number(line.credit) || 0);
    if (!valid || debit === null || credit === null) {
      return {
        id: line.id,
        debit: 0,
        credit: 0,
        baseDebit: 0,
        baseCredit: 0,
        valid: false,
      };
    }
    const changed = debit !== storedDebit || credit !== storedCredit;
    return {
      id: line.id,
      debit,
      credit,
      baseDebit: changed ? roundMoney(debit * rate) : storedBase(line.base_currency_debit, storedDebit, rate),
      baseCredit: changed ? roundMoney(credit * rate) : storedBase(line.base_currency_credit, storedCredit, rate),
      valid: true,
    };
  });

  const valid = next.every((line) => line.valid);
  const debitCents = next.reduce((sum, line) => sum + moneyCents(line.baseDebit), 0);
  const creditCents = next.reduce((sum, line) => sum + moneyCents(line.baseCredit), 0);
  const changed = lines.some((line) => {
    const draft = drafts[line.id];
    if (!draft) return false;
    const debit = parseJournalAmount(draft.debit);
    const credit = parseJournalAmount(draft.credit);
    if (debit === null || credit === null) return true;
    return debit !== roundMoney(Number(line.debit) || 0) || credit !== roundMoney(Number(line.credit) || 0);
  });

  return {
    lines: next,
    valid,
    balanced: valid && Math.abs(debitCents - creditCents) <= BALANCE_TOLERANCE_CENTS,
    changed,
  };
}
