/**
 * E2E-only page for editing amounts on the journal entry opened from a drilldown.
 * Registered at /__e2e__/drilldown-journal when served with VITE_E2E=1.
 */
import { useState } from 'react';
import { ViewJournalEntryDialog } from '@/components/journal/ViewJournalEntryDialog';
import type { GLAccountChoice } from '@/components/banking/SearchableGLAccountSelect';
import type { JournalEntryWithLines } from '@/hooks/useJournalEntries';
import type { JournalAmountWriter } from '@/lib/journalAmountSave';

const accountChoices: GLAccountChoice[] = [
  { id: 'ap', code: '2-01-101-0001', name: 'Trade Payables', account_type: 'liability', is_header: false, is_active: true },
  { id: 'due', code: '2-01-101-0002', name: 'Due to Shareholders', account_type: 'liability', is_header: false, is_active: true },
  { id: 'bank', code: '1-01-100', name: 'Chequing - ScotiaBank-eFintax Account', account_type: 'asset', is_header: false, is_active: true },
  { id: 'office', code: '6-03-105', name: 'Office', account_type: 'expense', is_header: false, is_active: true },
  { id: 'taxes-header', code: '2-02-000', name: 'Taxes Payable', account_type: 'liability', is_header: true, is_active: true },
];

const postedEntry = {
  id: 'je-bank-1500',
  organization_id: 'org-e2e',
  reference: 'BANK-E45944AB-01FC-445F-9A03-A0C0A4DB1BFE',
  entry_date: '2025-03-06',
  description: 'withdrawal',
  status: 'posted',
  journal_type: 'manual',
  created_by: null,
  posted_by: null,
  posted_at: null,
  reversed_by: null,
  reversed_at: null,
  reversal_of: null,
  notes: null,
  created_at: '2025-03-06T00:00:00Z',
  updated_at: '2025-03-06T00:00:00Z',
  lines: [
    {
      id: 'line-ap',
      journal_entry_id: 'je-bank-1500',
      account_id: 'ap',
      description: 'withdrawal',
      debit: 1500,
      credit: 0,
      line_order: 0,
      created_at: '2025-03-06T00:00:00Z',
      account: { code: '2-01-101-0001', name: 'Trade Payables' },
      currency: 'CAD',
      exchange_rate: 1,
      base_currency_debit: 1500,
      base_currency_credit: 0,
    },
    {
      id: 'line-bank',
      journal_entry_id: 'je-bank-1500',
      account_id: 'bank',
      description: 'Payment - Only The Family Auto Sales & Financ~ Interac E-Transfer: withdrawal',
      debit: 0,
      credit: 1500,
      line_order: 1,
      created_at: '2025-03-06T00:00:00Z',
      account: { code: '1-01-100', name: 'Chequing - ScotiaBank-eFintax Account' },
      currency: 'CAD',
      exchange_rate: 1,
      base_currency_debit: 0,
      base_currency_credit: 1500,
    },
  ],
} as unknown as JournalEntryWithLines;

const reversedEntry = {
  ...postedEntry,
  id: 'je-reversed',
  status: 'reversed',
  reference: 'BANK-REVERSED',
} as unknown as JournalEntryWithLines;

const missingFunction = {
  code: 'PGRST202',
  message:
    'Could not find the function public.update_journal_entry_amounts(p_entry_id, p_lines) in the schema cache',
};

export default function E2EDrilldownJournalHarness() {
  const [mode, setMode] = useState<'posted' | 'reversed' | 'missing'>('posted');
  const [saved, setSaved] = useState('');
  const [trace, setTrace] = useState('No save trace');

  const missingWriter: JournalAmountWriter = {
    async callAmountRpc() {
      return { error: missingFunction };
    },
    async setEntryStatus(_entryId, status) {
      setTrace((current) => `${current === 'No save trace' ? '' : `${current}>`}status:${status}`);
      return { error: null };
    },
    async updateLine(_entryId, lineId, patch) {
      const account = patch.account_id ?? 'same';
      setSaved((current) => `${current ? `${current}|` : ''}${lineId}:${account}:${patch.debit}:${patch.credit}`);
      setTrace((current) => `${current === 'No save trace' ? '' : `${current}>`}line:${lineId}`);
      return { error: null };
    },
    async refreshBalances() {
      setTrace((current) => `${current === 'No save trace' ? '' : `${current}>`}refresh`);
      return { error: null };
    },
  };

  return (
    <main className="p-6">
      <h1 className="text-lg font-semibold">Drilldown journal entry</h1>
      <p className="text-sm text-muted-foreground">Trade Payables as of Dec 31, 2025.</p>
      <div className="mt-3 flex gap-2">
        <button type="button" className="rounded-md border px-3 py-1 text-sm" onClick={() => setMode('posted')}>
          Posted entry
        </button>
        <button type="button" className="rounded-md border px-3 py-1 text-sm" onClick={() => setMode('reversed')}>
          Reversed entry
        </button>
        <button type="button" className="rounded-md border px-3 py-1 text-sm" onClick={() => { setSaved(''); setTrace('No save trace'); setMode('missing'); }}>
          Missing function
        </button>
      </div>
      <p className="mt-3 text-sm" data-testid="saved-amounts">{saved || 'Not saved'}</p>
      <p className="mt-1 text-sm" data-testid="save-trace">{trace}</p>
      <ViewJournalEntryDialog
        open
        onOpenChange={() => undefined}
        entry={mode === 'reversed' ? reversedEntry : postedEntry}
        accountChoices={accountChoices}
        onSaveAmounts={mode === 'missing' ? undefined : async (lines) => {
          setSaved(lines.map((line) => `${line.id}:${line.accountId}:${line.debit}:${line.credit}`).join('|'));
        }}
        amountWriter={mode === 'missing' ? missingWriter : undefined}
      />
    </main>
  );
}
