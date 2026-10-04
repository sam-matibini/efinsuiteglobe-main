import { useState } from 'react';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { JournalAttachmentsSection } from './JournalAttachmentsSection';
import { JournalAIAnalyzer } from './JournalAIAnalyzer';
import { useJournalAttachments } from '@/hooks/useJournalAttachments';
import { DbJournalEntryLine, JournalEntryWithLines } from '@/hooks/useJournalEntries';
import { useMultiCurrencySettings } from '@/hooks/useMultiCurrencySettings';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  draftAfterSideEdit,
  editedJournalAmounts,
  seedAmountDrafts,
  type JournalAmountDraft,
  type JournalAmountUpdate,
} from '@/lib/journalAmountEdit';

interface ViewJournalEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: JournalEntryWithLines | null;
  /** Called after amounts are stored so the drilldown can reload. */
  onSaved?: (entry: JournalEntryWithLines) => void;
  /** Replaces the ledger save. Used by the local preview. */
  onSaveAmounts?: (lines: JournalAmountUpdate[]) => Promise<void> | void;
}

export function ViewJournalEntryDialog({
  open,
  onOpenChange,
  entry,
  onSaved,
  onSaveAmounts,
}: ViewJournalEntryDialogProps) {
  const { settings: mcSettings } = useMultiCurrencySettings();
  const queryClient = useQueryClient();
  const entryKey = entry
    ? `${entry.id}:${entry.status}:${entry.lines.map((line) => `${line.id}:${line.debit}:${line.credit}`).join('|')}`
    : '';
  const [drafts, setDrafts] = useState<Record<string, JournalAmountDraft>>(() =>
    entry ? seedAmountDrafts(entry.lines) : {},
  );
  const [sourceLines, setSourceLines] = useState<DbJournalEntryLine[]>(entry?.lines ?? []);
  const [seenKey, setSeenKey] = useState(entryKey);
  const [saving, setSaving] = useState(false);

  if (seenKey !== entryKey) {
    setSeenKey(entryKey);
    if (entry) {
      setSourceLines(entry.lines);
      setDrafts(seedAmountDrafts(entry.lines));
    }
  }

  if (!entry) return null;

  const readOnly = entry.status === 'reversed';
  const baseCcy = mcSettings?.base_currency || 'CAD';
  const edited = editedJournalAmounts(sourceLines, drafts);
  const canSave = !readOnly && edited.valid && edited.balanced && edited.changed && !saving;

  const fmt = (value: number, ccy: string) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: ccy,
        minimumFractionDigits: 2,
      }).format(value);
    } catch {
      return `${ccy} ${value.toFixed(2)}`;
    }
  };

  const lineCcy = (l: any): string => (l.currency || baseCcy) as string;
  const hasMixedCurrency = entry.lines.some((l) => lineCcy(l) !== baseCcy);
  const totalBaseDebits = edited.lines.reduce((sum, line) => sum + line.baseDebit, 0);
  const totalBaseCredits = edited.lines.reduce((sum, line) => sum + line.baseCredit, 0);
  const totalRawDebits = edited.lines.reduce((sum, line) => sum + line.debit, 0);
  const totalRawCredits = edited.lines.reduce((sum, line) => sum + line.credit, 0);

  const getPeriod = (dateStr: string) => format(parseLocalDate(dateStr), 'yyyy-MM');

  const typeLabels: Record<string, string> = {
    manual: 'Manual',
    sales: 'Sales',
    purchase: 'Purchase',
    payroll: 'Payroll',
    bank: 'Bank',
    adjustment: 'Adjustment',
    depreciation: 'Depreciation',
  };

  const amountStatus = readOnly
    ? 'Reversed entries stay unchanged.'
    : !edited.valid
      ? 'Enter each amount as a number, such as 1500.00.'
      : edited.changed && !edited.balanced
        ? 'Debits and credits must match before this entry can be saved.'
        : edited.changed
          ? 'Amounts are balanced and ready to save.'
          : 'Edit a debit or credit, then save.';

  const editSide = (lineId: string, side: 'debit' | 'credit', raw: string) => {
    setDrafts((current) => {
      const lineDraft = current[lineId] ?? { debit: '', credit: '' };
      return { ...current, [lineId]: draftAfterSideEdit(lineDraft, side, raw) };
    });
  };

  const saveAmounts = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (onSaveAmounts) {
        await onSaveAmounts(edited.lines);
      } else {
        const { error } = await supabase.rpc('update_journal_entry_amounts' as never, {
          p_entry_id: entry.id,
          p_lines: edited.lines.map((line) => ({
            id: line.id,
            debit: line.debit,
            credit: line.credit,
          })),
        } as never);
        if (error) throw error;
      }
      const nextLines = entry.lines.map((line) => {
        const update = edited.lines.find((item) => item.id === line.id);
        if (!update) return line;
        return {
          ...line,
          debit: update.debit,
          credit: update.credit,
          base_currency_debit: update.baseDebit,
          base_currency_credit: update.baseCredit,
        };
      });
      const next = { ...entry, lines: nextLines };
      setSourceLines(nextLines);
      setDrafts(seedAmountDrafts(nextLines));
      queryClient.invalidateQueries({ queryKey: ['journal-entries', entry.organization_id] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      onSaved?.(next);
      toast.success('Journal amounts updated');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save the journal amounts';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'h-9 w-full rounded-md border border-indigo-200 bg-white px-2 text-right font-mono text-sm text-emerald-600 shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[820px] h-[85vh] max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Journal Entry - {entry.reference}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-6 py-4 flex-shrink-0">
          <div>
            <p className="text-sm text-muted-foreground">Date</p>
            <p className="font-medium">{format(parseLocalDate(entry.entry_date), 'MMM d, yyyy')}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Period</p>
            <p className="font-medium">{getPeriod(entry.entry_date)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Source</p>
            <Badge variant="secondary" className="mt-1">
              {typeLabels[entry.journal_type] || 'Manual'}
            </Badge>
          </div>
        </div>

        <div className="border rounded-lg flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="bg-muted/50 border-b flex-shrink-0">
            <div className={`grid ${hasMixedCurrency ? 'grid-cols-[1fr_160px_160px]' : 'grid-cols-[1fr_150px_150px]'} text-sm`}>
              <div className="p-3 font-medium text-left">Account</div>
              <div className="p-3 font-medium text-right">Debit{hasMixedCurrency && <div className="text-xs font-normal text-muted-foreground">Base ({baseCcy})</div>}</div>
              <div className="p-3 font-medium text-right">Credit{hasMixedCurrency && <div className="text-xs font-normal text-muted-foreground">Base ({baseCcy})</div>}</div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="text-sm">
              {entry.lines.map((line: any) => {
                const ccy = lineCcy(line);
                const isFc = ccy !== baseCcy;
                const update = edited.lines.find((item) => item.id === line.id);
                const draft = drafts[line.id] ?? { debit: '', credit: '' };
                const dr = update?.debit ?? Number(line.debit);
                const cr = update?.credit ?? Number(line.credit);
                const baseDr = update?.baseDebit ?? Number(line.base_currency_debit ?? line.debit);
                const baseCr = update?.baseCredit ?? Number(line.base_currency_credit ?? line.credit);
                const accountName = line.account?.name || 'Unknown Account';
                return (
                  <div
                    key={line.id}
                    className={`grid ${hasMixedCurrency ? 'grid-cols-[1fr_160px_160px]' : 'grid-cols-[1fr_150px_150px]'} border-t items-center`}
                  >
                    <div className="p-3">
                      <p className="font-medium">{accountName}</p>
                      <p className="text-sm text-muted-foreground">
                        {line.description || entry.description || ''}
                        {isFc && line.exchange_rate ? (
                          <span className="ml-2 text-xs">
                            · {ccy} @ {Number(line.exchange_rate).toFixed(6)}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className="p-3 text-right font-mono text-emerald-600">
                      {readOnly ? (
                        dr > 0 ? fmt(dr, ccy) : '-'
                      ) : (
                        <input
                          aria-label={`Debit ${accountName}`}
                          data-testid={`journal-debit-${line.id}`}
                          inputMode="decimal"
                          className={inputClass}
                          placeholder="-"
                          value={draft.debit}
                          onChange={(event) => editSide(line.id, 'debit', event.target.value)}
                        />
                      )}
                      {hasMixedCurrency && dr > 0 && (
                        <div className="text-xs text-muted-foreground">{fmt(baseDr, baseCcy)}</div>
                      )}
                    </div>
                    <div className="p-3 text-right font-mono text-emerald-600">
                      {readOnly ? (
                        cr > 0 ? fmt(cr, ccy) : '-'
                      ) : (
                        <input
                          aria-label={`Credit ${accountName}`}
                          data-testid={`journal-credit-${line.id}`}
                          inputMode="decimal"
                          className={inputClass}
                          placeholder="-"
                          value={draft.credit}
                          onChange={(event) => editSide(line.id, 'credit', event.target.value)}
                        />
                      )}
                      {hasMixedCurrency && cr > 0 && (
                        <div className="text-xs text-muted-foreground">{fmt(baseCr, baseCcy)}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t-2 bg-muted/30 font-semibold flex-shrink-0">
            <div className={`grid ${hasMixedCurrency ? 'grid-cols-[1fr_160px_160px]' : 'grid-cols-[1fr_150px_150px]'} text-sm`}>
              <div className="p-3">
                Total
                {hasMixedCurrency && (
                  <div className="text-xs font-normal text-muted-foreground">in base currency ({baseCcy})</div>
                )}
              </div>
              <div className="p-3 text-right font-mono text-emerald-600" data-testid="journal-total-debit">
                {hasMixedCurrency ? fmt(totalBaseDebits, baseCcy) : fmt(totalRawDebits, baseCcy)}
              </div>
              <div className="p-3 text-right font-mono text-emerald-600" data-testid="journal-total-credit">
                {hasMixedCurrency ? fmt(totalBaseCredits, baseCcy) : fmt(totalRawCredits, baseCcy)}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 flex-shrink-0 border-t mt-2 max-h-64 overflow-y-auto space-y-3">
          <JournalAttachmentsSection
            journalEntryId={entry.id}
            organizationId={entry.organization_id}
            readOnly
          />
          <ViewAnalyzer entryId={entry.id} currentNotes={entry.notes} />
        </div>

        <div className="flex items-center justify-between gap-3 pt-4 flex-shrink-0">
          <p className="text-sm text-muted-foreground" data-testid="journal-amount-status">
            {amountStatus}
          </p>
          <div className="flex gap-2">
            {!readOnly && (
              <Button
                type="button"
                data-testid="save-journal-amounts"
                className="bg-gradient-to-r from-indigo-600 to-cyan-500 text-white shadow-sm hover:from-indigo-500 hover:to-cyan-400"
                disabled={!canSave}
                onClick={saveAmounts}
              >
                {saving ? 'Saving…' : 'Save amounts'}
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}

function ViewAnalyzer({ entryId, currentNotes }: { entryId: string; currentNotes: string | null | undefined }) {
  const { data: attachments = [] } = useJournalAttachments(entryId);
  if (attachments.length === 0) return null;
  return (
    <JournalAIAnalyzer
      journalEntryId={entryId}
      currentNotes={currentNotes ?? ''}
      hasAttachments
    />
  );
}
