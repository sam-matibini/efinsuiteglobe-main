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
import { JournalEntryWithLines } from '@/hooks/useJournalEntries';
import { useMultiCurrencySettings } from '@/hooks/useMultiCurrencySettings';

interface ViewJournalEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: JournalEntryWithLines | null;
}

export function ViewJournalEntryDialog({
  open,
  onOpenChange,
  entry,
}: ViewJournalEntryDialogProps) {
  const { settings: mcSettings } = useMultiCurrencySettings();
  if (!entry) return null;

  const baseCcy = mcSettings?.base_currency || 'CAD';

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
  const lineBaseDr = (l: any): number =>
    Number(l.base_currency_debit ?? Number(l.debit) * Number(l.exchange_rate ?? 1));
  const lineBaseCr = (l: any): number =>
    Number(l.base_currency_credit ?? Number(l.credit) * Number(l.exchange_rate ?? 1));

  const hasMixedCurrency = entry.lines.some((l) => lineCcy(l) !== baseCcy);

  const totalBaseDebits = entry.lines.reduce((s, l) => s + lineBaseDr(l), 0);
  const totalBaseCredits = entry.lines.reduce((s, l) => s + lineBaseCr(l), 0);
  const totalRawDebits = entry.lines.reduce((s, l) => s + Number(l.debit), 0);
  const totalRawCredits = entry.lines.reduce((s, l) => s + Number(l.credit), 0);

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
            <div className={`grid ${hasMixedCurrency ? 'grid-cols-[1fr_140px_140px]' : 'grid-cols-[1fr_120px_120px]'} text-sm`}>
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
                const dr = Number(line.debit);
                const cr = Number(line.credit);
                const baseDr = lineBaseDr(line);
                const baseCr = lineBaseCr(line);
                return (
                  <div
                    key={line.id}
                    className={`grid ${hasMixedCurrency ? 'grid-cols-[1fr_140px_140px]' : 'grid-cols-[1fr_120px_120px]'} border-t`}
                  >
                    <div className="p-3">
                      <p className="font-medium">{line.account?.name || 'Unknown Account'}</p>
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
                      {dr > 0 ? fmt(dr, ccy) : '-'}
                      {hasMixedCurrency && dr > 0 && (
                        <div className="text-xs text-muted-foreground">{fmt(baseDr, baseCcy)}</div>
                      )}
                    </div>
                    <div className="p-3 text-right font-mono text-emerald-600">
                      {cr > 0 ? fmt(cr, ccy) : '-'}
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
            <div className={`grid ${hasMixedCurrency ? 'grid-cols-[1fr_140px_140px]' : 'grid-cols-[1fr_120px_120px]'} text-sm`}>
              <div className="p-3">
                Total
                {hasMixedCurrency && (
                  <div className="text-xs font-normal text-muted-foreground">in base currency ({baseCcy})</div>
                )}
              </div>
              <div className="p-3 text-right font-mono text-emerald-600">
                {hasMixedCurrency ? fmt(totalBaseDebits, baseCcy) : fmt(totalRawDebits, baseCcy)}
              </div>
              <div className="p-3 text-right font-mono text-emerald-600">
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

        <div className="flex justify-end pt-4 flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
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

