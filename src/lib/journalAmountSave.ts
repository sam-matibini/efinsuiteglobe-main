/**
 * Saves a drilldown journal edit.
 *
 * The database function is used when it exists. Until that migration is applied,
 * an account change is written onto the existing lines. An amount change on a
 * posted entry is unbalanced between the first line and the last, and the live
 * balance trigger rejects that, so the entry is set to draft for those updates
 * and posted again once every line matches. Lines are updated in place.
 */

import { lineExchangeRate, roundMoney, type JournalAmountLine, type JournalAmountUpdate } from './journalAmountEdit';

export interface JournalLineWrite {
  id: string;
  debit: number;
  credit: number;
  baseDebit: number;
  baseCredit: number;
  accountId: string;
  previousAccountId: string;
  previousDebit: number;
  previousCredit: number;
  previousBaseDebit: number;
  previousBaseCredit: number;
}

export interface JournalLinePatch {
  debit: number;
  credit: number;
  base_currency_debit: number;
  base_currency_credit: number;
  account_id?: string;
}

export interface JournalAmountWriter {
  callAmountRpc(
    entryId: string,
    lines: Array<{ id: string; debit: number; credit: number; account_id: string }>,
  ): Promise<{ error: unknown }>;
  setEntryStatus(entryId: string, status: 'draft' | 'posted'): Promise<{ error: unknown }>;
  updateLine(entryId: string, lineId: string, patch: JournalLinePatch): Promise<{ error: unknown }>;
  refreshBalances(organizationId: string): Promise<{ error: unknown }>;
}

export interface JournalAmountSaveInput {
  entryId: string;
  organizationId: string;
  status: string;
  lines: JournalLineWrite[];
}

function errorParts(error: unknown): string[] {
  if (typeof error === 'string') return [error];
  if (!error || typeof error !== 'object') return [];
  const record = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  return [record.code, record.message, record.details, record.hint].filter(
    (part): part is string => typeof part === 'string' && part.trim() !== '',
  );
}

export function journalSaveErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (error && typeof error === 'object') {
    const record = error as { message?: unknown; details?: unknown };
    const message = typeof record.message === 'string' ? record.message.trim() : '';
    const details = typeof record.details === 'string' ? record.details.trim() : '';
    if (message && details && !message.includes(details)) return `${message} ${details}`;
    if (message) return message;
    if (details) return details;
  }
  if (typeof error === 'string' && error.trim()) return error.trim();
  return 'Could not save the journal amounts';
}

/** True when update_journal_entry_amounts is absent from the live schema cache. */
export function isMissingJournalAmountFunction(error: unknown): boolean {
  const text = errorParts(error).join(' ');
  if (!text) return false;
  const missing = /PGRST202|42883|schema cache|could not find the function|does not exist/i.test(text);
  const aboutThisFunction = /update_journal_entry_amounts|PGRST202|42883/i.test(text);
  return missing && aboutThisFunction;
}

function previousBase(raw: number | string | null | undefined, amount: number, rate: number): number {
  if (raw === null || raw === undefined || raw === '') return roundMoney(amount * rate);
  const value = Number(raw);
  return Number.isFinite(value) ? roundMoney(value) : roundMoney(amount * rate);
}

export function journalLinesForSave(source: JournalAmountLine[], updates: JournalAmountUpdate[]): JournalLineWrite[] {
  return updates.map((update) => {
    const line = source.find((item) => item.id === update.id);
    const previousDebit = roundMoney(Number(line?.debit) || 0);
    const previousCredit = roundMoney(Number(line?.credit) || 0);
    const rate = lineExchangeRate(line?.exchange_rate);
    return {
      id: update.id,
      debit: update.debit,
      credit: update.credit,
      baseDebit: update.baseDebit,
      baseCredit: update.baseCredit,
      accountId: update.accountId,
      previousAccountId: line?.account_id ?? '',
      previousDebit,
      previousCredit,
      previousBaseDebit: previousBase(line?.base_currency_debit, previousDebit, rate),
      previousBaseCredit: previousBase(line?.base_currency_credit, previousCredit, rate),
    };
  });
}

function centsDiffer(left: number, right: number): boolean {
  return Math.round((left + Number.EPSILON) * 100) !== Math.round((right + Number.EPSILON) * 100);
}

/** Posted amount edits have to leave posted status so each line can change without failing the balance trigger. */
export function journalEditNeedsDraftWindow(status: string, lines: JournalLineWrite[]): boolean {
  if (status !== 'posted') return false;
  return lines.some(
    (line) =>
      centsDiffer(line.debit, line.previousDebit) ||
      centsDiffer(line.credit, line.previousCredit) ||
      centsDiffer(line.baseDebit, line.previousBaseDebit) ||
      centsDiffer(line.baseCredit, line.previousBaseCredit),
  );
}

function nextPatch(line: JournalLineWrite): JournalLinePatch {
  const patch: JournalLinePatch = {
    debit: line.debit,
    credit: line.credit,
    base_currency_debit: line.baseDebit,
    base_currency_credit: line.baseCredit,
  };
  if (line.accountId && line.accountId !== line.previousAccountId) patch.account_id = line.accountId;
  return patch;
}

function previousPatch(line: JournalLineWrite): JournalLinePatch {
  const patch: JournalLinePatch = {
    debit: line.previousDebit,
    credit: line.previousCredit,
    base_currency_debit: line.previousBaseDebit,
    base_currency_credit: line.previousBaseCredit,
  };
  if (line.previousAccountId && line.accountId !== line.previousAccountId) patch.account_id = line.previousAccountId;
  return patch;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(journalSaveErrorMessage(error));
}

export async function saveJournalAmountEdits(
  writer: JournalAmountWriter,
  input: JournalAmountSaveInput,
): Promise<{ balanceWarning?: string }> {
  if (input.status === 'reversed') {
    throw new Error('Reversed entries stay unchanged.');
  }

  const rpc = await writer.callAmountRpc(
    input.entryId,
    input.lines.map((line) => ({
      id: line.id,
      debit: line.debit,
      credit: line.credit,
      account_id: line.accountId || line.previousAccountId,
    })),
  );
  if (!rpc.error) return {};
  if (!isMissingJournalAmountFunction(rpc.error)) throw asError(rpc.error);

  const pauseBalance = journalEditNeedsDraftWindow(input.status, input.lines);
  if (pauseBalance) {
    const drafted = await writer.setEntryStatus(input.entryId, 'draft');
    if (drafted.error) throw asError(drafted.error);
  }

  const applied: JournalLineWrite[] = [];
  try {
    for (const line of input.lines) {
      const updated = await writer.updateLine(input.entryId, line.id, nextPatch(line));
      if (updated.error) throw asError(updated.error);
      applied.push(line);
    }
    if (pauseBalance) {
      const posted = await writer.setEntryStatus(input.entryId, 'posted');
      if (posted.error) throw asError(posted.error);
    }
  } catch (error) {
    let restoreError: unknown = null;
    for (const line of [...applied].reverse()) {
      const restored = await writer.updateLine(input.entryId, line.id, previousPatch(line));
      if (restored.error) restoreError = restored.error;
    }
    if (pauseBalance) {
      const posted = await writer.setEntryStatus(input.entryId, 'posted');
      if (posted.error) restoreError = posted.error;
    }
    const message = journalSaveErrorMessage(error);
    if (restoreError) {
      throw new Error(`${message} The entry could not be put back: ${journalSaveErrorMessage(restoreError)}`);
    }
    throw asError(error);
  }

  if (input.status === 'posted') {
    const refreshed = await writer.refreshBalances(input.organizationId);
    if (refreshed.error) return { balanceWarning: journalSaveErrorMessage(refreshed.error) };
  }
  return {};
}
