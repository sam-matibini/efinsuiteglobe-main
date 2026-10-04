import { useEffect, useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { ChevronDown, Pencil, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { signedBankAmount } from '@/lib/plaidBankAmount';
import { parseLocalDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export interface TransactionDetail {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  transaction_type: string;
  status: string;
  category: string | null;
  payee_payor: string | null;
  reference: string | null;
  memo: string | null;
  gl_account_id: string | null;
  journal_entry_id: string | null;
  is_cleared?: boolean | null;
  imported_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  bank_account_id?: string;
  credit_card_id?: string;
}

interface JournalLinePreview {
  id: string;
  debit: number;
  credit: number;
  description: string | null;
  account: { code: string | null; name: string | null } | null;
}

interface TransactionDetailPanelProps {
  transaction: TransactionDetail;
  accountName: string;
  accountKind: 'bank' | 'credit-card';
  glAccountLabel: string | null;
  formatCurrency: (value: number) => string;
  formatDate: (value: string) => string;
  locked: boolean;
  editing: boolean;
  editForm?: ReactNode;
  onEdit: () => void;
  onClose: () => void;
  onUncategorize: () => void;
  onSaveMemo: (memo: string) => void;
}

const typeLabel = (value: string) => {
  if (value === 'deposit') return 'Deposit';
  if (value === 'withdrawal') return 'Withdrawal';
  if (value === 'transfer') return 'Transfer';
  if (value === 'payment') return 'Payment';
  if (value === 'credit') return 'Credit';
  return value.replace(/_/g, ' ');
};

function isInflow(transaction: TransactionDetail, accountKind: 'bank' | 'credit-card') {
  if (accountKind === 'credit-card') {
    return (
      transaction.transaction_type === 'payment' ||
      transaction.transaction_type === 'credit' ||
      transaction.description?.toLowerCase().includes('payment') ||
      Number(transaction.amount) < 0
    );
  }
  return (
    signedBankAmount(Number(transaction.amount), transaction.transaction_type) >= 0 &&
    transaction.transaction_type !== 'withdrawal'
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[9.5rem_minmax(0,1fr)] gap-3 border-b py-3 text-sm">
      <div className="font-semibold uppercase tracking-wide text-indigo-900/70">{label}</div>
      <div className="min-w-0 break-words text-foreground">{value}</div>
    </div>
  );
}

export function TransactionDetailPanel({
  transaction,
  accountName,
  accountKind,
  glAccountLabel,
  formatCurrency,
  formatDate,
  locked,
  editing,
  editForm,
  onEdit,
  onClose,
  onUncategorize,
  onSaveMemo,
}: TransactionDetailPanelProps) {
  const [tab, setTab] = useState<'details' | 'comments'>('details');
  const [journalOpen, setJournalOpen] = useState(false);
  const [journalLines, setJournalLines] = useState<JournalLinePreview[] | null>(null);
  const [note, setNote] = useState(transaction.memo || '');
  const inflow = isInflow(transaction, accountKind);
  const shown = accountKind === 'bank'
    ? signedBankAmount(Number(transaction.amount), transaction.transaction_type)
    : Number(transaction.amount);
  const amountText = `${inflow ? '' : '-'}${formatCurrency(Math.abs(shown))}`;
  const canUncategorize = !locked && !transaction.journal_entry_id && (!!transaction.category || !!transaction.gl_account_id);

  useEffect(() => {
    setNote(transaction.memo || '');
  }, [transaction.id, transaction.memo]);

  useEffect(() => {
    setJournalOpen(false);
    setJournalLines(null);
    setTab('details');
  }, [transaction.id]);

  useEffect(() => {
    if (!journalOpen || !transaction.journal_entry_id || journalLines) return;
    let cancelled = false;
    supabase
      .from('journal_entry_lines')
      .select('id, debit, credit, description, account:accounts(code, name)')
      .eq('journal_entry_id', transaction.journal_entry_id)
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setJournalLines((data || []) as unknown as JournalLinePreview[]);
      });
    return () => {
      cancelled = true;
    };
  }, [journalOpen, journalLines, transaction.journal_entry_id]);

  const history = [
    transaction.imported_at ? `Imported ${format(new Date(transaction.imported_at), 'MMM d, yyyy p')}` : null,
    transaction.created_at ? `Added ${format(new Date(transaction.created_at), 'MMM d, yyyy p')}` : null,
    transaction.journal_entry_id ? 'Posted to the general ledger' : null,
    transaction.is_cleared ? 'Marked cleared on the bank statement' : null,
    transaction.updated_at ? `Updated ${format(new Date(transaction.updated_at), 'MMM d, yyyy p')}` : null,
  ].filter(Boolean) as string[];

  return (
    <aside
      className="flex h-[min(72vh,860px)] w-full shrink-0 flex-col overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-sm xl:w-[420px]"
      data-testid="transaction-detail-panel"
    >
      <div className="flex items-center justify-between gap-2 border-b bg-indigo-50/70 px-4 py-3">
        <div className="flex min-w-0 gap-4 text-xs font-semibold uppercase tracking-wide">
          <button
            type="button"
            className={cn('border-b-2 pb-1', tab === 'details' ? 'border-indigo-600 text-indigo-800' : 'border-transparent text-muted-foreground')}
            onClick={() => setTab('details')}
          >
            Transaction details
          </button>
          <button
            type="button"
            className={cn('border-b-2 pb-1', tab === 'comments' ? 'border-cyan-600 text-cyan-800' : 'border-transparent text-muted-foreground')}
            onClick={() => setTab('comments')}
          >
            Comments & history
          </button>
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Close transaction details">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {tab === 'details' && editing && editForm ? (
        <div className="min-h-0 flex-1 overflow-hidden">{editForm}</div>
      ) : tab === 'details' ? (
        <div className="banking-tx-scroll min-h-0 flex-1 overflow-y-scroll px-4 py-4">
          <div className="mb-4 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-gradient-to-r from-indigo-600 to-cyan-500 text-white"
              onClick={onEdit}
              data-testid="transaction-panel-edit"
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              {locked ? 'View' : 'Edit'}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={!canUncategorize} onClick={onUncategorize}>
              Uncategorize
            </Button>
          </div>

          <p className={cn('text-3xl font-semibold tracking-tight', inflow ? 'text-emerald-600' : 'text-foreground')} data-testid="transaction-panel-amount">
            {amountText}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">on {formatDate(transaction.transaction_date)}</p>
          <Badge variant="outline" className="mt-3 border-indigo-200 bg-indigo-50 text-indigo-800">
            {typeLabel(transaction.transaction_type)}
          </Badge>

          <div className="mt-4">
            <DetailRow label="Customer details" value={transaction.payee_payor || '—'} />
            <DetailRow label="From account" value={accountName} />
            <DetailRow label="Mode" value={typeLabel(transaction.transaction_type)} />
            <DetailRow label="Reference" value={transaction.reference || '—'} />
            <DetailRow label="Category" value={transaction.category || 'Uncategorized'} />
            <DetailRow label="GL account" value={glAccountLabel || '—'} />
            <DetailRow label="Status" value={transaction.status || 'unmatched'} />
          </div>

          <button
            type="button"
            className="mt-4 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm font-medium"
            onClick={() => setJournalOpen((open) => !open)}
            aria-expanded={journalOpen}
          >
            Display journal
            <ChevronDown className={cn('h-4 w-4 transition-transform', journalOpen && 'rotate-180')} />
          </button>
          {journalOpen && (
            <div className="mt-2 rounded-lg bg-muted/40 p-3 text-sm" data-testid="transaction-journal">
              {!transaction.journal_entry_id && <p className="text-muted-foreground">This transaction is not posted yet.</p>}
              {transaction.journal_entry_id && !journalLines && <p className="text-muted-foreground">Loading journal lines…</p>}
              {journalLines && journalLines.length === 0 && <p className="text-muted-foreground">No journal lines were found.</p>}
              {journalLines && journalLines.length > 0 && (
                <ul className="space-y-1">
                  {journalLines.map((line) => (
                    <li key={line.id} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate">{line.account?.name || line.description || 'Account'}</span>
                      <span className="font-mono text-emerald-700">
                        {Number(line.debit) > 0 ? `Dr ${formatCurrency(Number(line.debit))}` : `Cr ${formatCurrency(Number(line.credit))}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-4 rounded-lg border">
            <div className="border-b px-3 py-2 text-sm font-medium">Statement line information (1)</div>
            <div className="grid grid-cols-[1fr_auto] gap-2 px-3 py-3 text-sm">
              <div>
                <p>{formatDate(transaction.transaction_date)}</p>
                <p className="text-muted-foreground">{transaction.description}</p>
              </div>
              <p className="font-mono">{amountText}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="banking-tx-scroll min-h-0 flex-1 overflow-y-scroll px-4 py-4">
          <h3 className="text-sm font-semibold text-indigo-950">History</h3>
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            {history.length === 0 && <li>No history recorded yet.</li>}
            {history.map((item) => (
              <li key={item} className="rounded-md bg-indigo-50/60 px-3 py-2">{item}</li>
            ))}
          </ul>
          <label className="mt-4 block text-sm font-semibold text-indigo-950" htmlFor="transaction-note">
            Comment
          </label>
          <Textarea
            id="transaction-note"
            className="mt-2"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Add a note for this transaction"
            disabled={locked}
          />
          <Button
            type="button"
            className="mt-3 bg-cyan-600 text-white hover:bg-cyan-700"
            disabled={locked || note === (transaction.memo || '')}
            onClick={() => onSaveMemo(note)}
          >
            Save comment
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            Statement date {format(parseLocalDate(transaction.transaction_date), 'MMM d, yyyy')} stays on the bank line.
          </p>
        </div>
      )}
    </aside>
  );
}
