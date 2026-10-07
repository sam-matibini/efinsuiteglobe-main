import { describe, expect, it } from 'vitest';
import { editedJournalAmounts, seedAmountDrafts } from './journalAmountEdit';
import {
  isMissingJournalAmountFunction,
  journalEditNeedsDraftWindow,
  journalLinesForSave,
  journalSaveErrorMessage,
  saveJournalAmountEdits,
  type JournalAmountWriter,
  type JournalLinePatch,
  type JournalLineWrite,
} from './journalAmountSave';

const missingFunction = {
  code: 'PGRST202',
  message:
    'Could not find the function public.update_journal_entry_amounts(p_entry_id, p_lines) in the schema cache',
  hint: 'Perhaps you meant to call the function public.validate_journal_entry_balance',
};

const shareholders = {
  id: 'line-due',
  account_id: 'trade-payables',
  debit: 1500,
  credit: 0,
  exchange_rate: 1,
  base_currency_debit: 1500,
  base_currency_credit: 0,
};

const chequing = {
  id: 'line-bank',
  account_id: 'chequing',
  debit: 0,
  credit: 1500,
  exchange_rate: 1,
  base_currency_debit: 0,
  base_currency_credit: 1500,
};

function recordingWriter(rpcError: unknown = missingFunction) {
  const calls: string[] = [];
  const patches: Record<string, JournalLinePatch> = {};
  const writer: JournalAmountWriter = {
    async callAmountRpc() {
      calls.push('rpc');
      return { error: rpcError };
    },
    async setEntryStatus(_entryId, status) {
      calls.push(`status:${status}`);
      return { error: null };
    },
    async updateLine(_entryId, lineId, patch) {
      calls.push(`line:${lineId}`);
      patches[lineId] = patch;
      return { error: null };
    },
    async refreshBalances() {
      calls.push('refresh');
      return { error: null };
    },
  };
  return { writer, calls, patches };
}

function postedAccountChange(): JournalLineWrite[] {
  const drafts = seedAmountDrafts([shareholders, chequing]);
  drafts['line-due'] = { ...drafts['line-due'], accountId: 'due-to-shareholders' };
  const edited = editedJournalAmounts([shareholders, chequing], drafts);
  return journalLinesForSave([shareholders, chequing], edited.lines);
}

describe('journal amount save', () => {
  it('shows the database message instead of the generic save toast', () => {
    expect(journalSaveErrorMessage(missingFunction)).toBe(missingFunction.message);
    expect(journalSaveErrorMessage(new Error('Cannot post to header account: Taxes Payable.'))).toBe(
      'Cannot post to header account: Taxes Payable.',
    );
    expect(isMissingJournalAmountFunction(missingFunction)).toBe(true);
    expect(isMissingJournalAmountFunction({ message: 'Not authorized for this organization' })).toBe(false);
  });

  it('saves the shareholder account change in place when the function is missing', async () => {
    const lines = postedAccountChange();
    expect(journalEditNeedsDraftWindow('posted', lines)).toBe(false);
    const { writer, calls, patches } = recordingWriter();

    const result = await saveJournalAmountEdits(writer, {
      entryId: 'BANK-entry',
      organizationId: 'org',
      status: 'posted',
      lines,
    });

    expect(result).toEqual({});
    expect(calls).toEqual(['rpc', 'line:line-due', 'line:line-bank', 'refresh']);
    expect(patches['line-due']).toEqual({
      debit: 1500,
      credit: 0,
      base_currency_debit: 1500,
      base_currency_credit: 0,
      account_id: 'due-to-shareholders',
    });
    expect(patches['line-bank']).toEqual({
      debit: 0,
      credit: 1500,
      base_currency_debit: 0,
      base_currency_credit: 1500,
    });
    expect(patches['line-bank'].account_id).toBeUndefined();
  });

  it('moves a posted amount change to draft and posts it again', async () => {
    const drafts = {
      'line-due': { debit: '1600.00', credit: '', accountId: 'trade-payables' },
      'line-bank': { debit: '', credit: '1600.00', accountId: 'chequing' },
    };
    const edited = editedJournalAmounts([shareholders, chequing], drafts);
    const lines = journalLinesForSave([shareholders, chequing], edited.lines);
    expect(journalEditNeedsDraftWindow('posted', lines)).toBe(true);
    const { writer, calls, patches } = recordingWriter();

    await saveJournalAmountEdits(writer, {
      entryId: 'BANK-entry',
      organizationId: 'org',
      status: 'posted',
      lines,
    });

    expect(calls).toEqual([
      'rpc',
      'status:draft',
      'line:line-due',
      'line:line-bank',
      'status:posted',
      'refresh',
    ]);
    expect(patches['line-due'].debit).toBe(1600);
    expect(patches['line-bank'].credit).toBe(1600);
  });

  it('keeps the database function when it succeeds', async () => {
    const { writer, calls } = recordingWriter(null);
    await saveJournalAmountEdits(writer, {
      entryId: 'BANK-entry',
      organizationId: 'org',
      status: 'posted',
      lines: postedAccountChange(),
    });
    expect(calls).toEqual(['rpc']);
  });

  it('does not fall back when the function rejects the edit', async () => {
    const { writer, calls } = recordingWriter({
      message: 'Choose a postable account in this organization. Header accounts are for grouping only.',
    });
    await expect(
      saveJournalAmountEdits(writer, {
        entryId: 'BANK-entry',
        organizationId: 'org',
        status: 'posted',
        lines: postedAccountChange(),
      }),
    ).rejects.toThrow('Header accounts are for grouping only.');
    expect(calls).toEqual(['rpc']);
  });

  it('puts a failed amount edit back and posts the original entry', async () => {
    const drafts = {
      'line-due': { debit: '1600.00', credit: '', accountId: 'due-to-shareholders' },
      'line-bank': { debit: '', credit: '1600.00', accountId: 'chequing' },
    };
    const lines = journalLinesForSave(
      [shareholders, chequing],
      editedJournalAmounts([shareholders, chequing], drafts).lines,
    );
    const calls: string[] = [];
    const writer: JournalAmountWriter = {
      async callAmountRpc() {
        calls.push('rpc');
        return { error: missingFunction };
      },
      async setEntryStatus(_entryId, status) {
        calls.push(`status:${status}`);
        return { error: null };
      },
      async updateLine(_entryId, lineId, patch) {
        calls.push(`line:${lineId}:${patch.account_id ?? 'same'}:${patch.debit}:${patch.credit}`);
        if (lineId === 'line-bank' && patch.credit === 1600) {
          return { error: { message: 'Cannot post to header account: Taxes Payable. Header accounts are for grouping only.' } };
        }
        return { error: null };
      },
      async refreshBalances() {
        calls.push('refresh');
        return { error: null };
      },
    };

    await expect(
      saveJournalAmountEdits(writer, {
        entryId: 'BANK-entry',
        organizationId: 'org',
        status: 'posted',
        lines,
      }),
    ).rejects.toThrow('Cannot post to header account: Taxes Payable.');
    expect(calls).toEqual([
      'rpc',
      'status:draft',
      'line:line-due:due-to-shareholders:1600:0',
      'line:line-bank:same:0:1600',
      'line:line-due:trade-payables:1500:0',
      'status:posted',
    ]);
  });

  it('leaves reversed entries unchanged', async () => {
    const { writer, calls } = recordingWriter();
    await expect(
      saveJournalAmountEdits(writer, {
        entryId: 'BANK-entry',
        organizationId: 'org',
        status: 'reversed',
        lines: postedAccountChange(),
      }),
    ).rejects.toThrow('Reversed entries stay unchanged.');
    expect(calls).toEqual([]);
  });
});
