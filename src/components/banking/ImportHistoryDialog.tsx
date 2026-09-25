import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { History, Trash2, AlertTriangle, Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useLocalizedCurrency } from '@/hooks/useLocalizedCurrency';

type AccountType = 'bank' | 'credit-card';

interface ImportHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountType: AccountType;
  bankAccountId?: string;
  creditCardId?: string;
  onUndoBatch: (transactionIds: string[]) => Promise<void> | void;
  isUndoing?: boolean;
}

interface BatchRow {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  status: string | null;
  journal_entry_id: string | null;
  transaction_type: string | null;
  imported_at: string;
}

interface Batch {
  key: string;
  importedAt: string;
  rows: BatchRow[];
  rowCount: number;
  totalIn: number;
  totalOut: number;
  hasJE: boolean;
  hasReconciled: boolean;
  duplicateOf?: string;
}

// Bucket batches by imported_at rounded to the second (importTransactions sets a
// single ISO string for the whole batch, so this groups one upload together).
function batchKey(iso: string) {
  return iso.replace(/\.\d+Z?$/, '');
}

function signature(rows: BatchRow[]) {
  return rows
    .map(r => `${r.transaction_date}|${(r.description || '').trim().toLowerCase()}|${Math.abs(Number(r.amount)).toFixed(2)}`)
    .sort()
    .join('||');
}

export function ImportHistoryDialog({
  open,
  onOpenChange,
  accountType,
  bankAccountId,
  creditCardId,
  onUndoBatch,
  isUndoing,
}: ImportHistoryDialogProps) {
  const { formatCurrency } = useLocalizedCurrency();
  const [pending, setPending] = useState<Batch | null>(null);

  const accountId = accountType === 'bank' ? bankAccountId : creditCardId;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['import-history', accountType, accountId],
    enabled: open && !!accountId,
    queryFn: async () => {
      if (accountType === 'bank') {
        const { data, error } = await supabase
          .from('bank_transactions')
          .select('id, transaction_date, description, amount, status, journal_entry_id, transaction_type, imported_at')
          .eq('bank_account_id', accountId!)
          .not('imported_at', 'is', null)
          .order('imported_at', { ascending: false });
        if (error) throw error;
        return (data || []) as BatchRow[];
      }
      const { data, error } = await supabase
        .from('credit_card_transactions')
        .select('id, transaction_date, description, amount, status, journal_entry_id, transaction_type, imported_at')
        .eq('credit_card_id', accountId!)
        .not('imported_at', 'is', null)
        .order('imported_at', { ascending: false });
      if (error) throw error;
      return (data || []) as BatchRow[];
    },
  });

  const batches: Batch[] = useMemo(() => {
    const map = new Map<string, BatchRow[]>();
    for (const r of rows) {
      const k = batchKey(r.imported_at);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    const list: Batch[] = Array.from(map.entries()).map(([k, rs]) => {
      const totalIn = rs
        .filter(r => r.transaction_type === 'deposit' || r.transaction_type === 'payment' || r.transaction_type === 'credit')
        .reduce((s, r) => s + Math.abs(Number(r.amount)), 0);
      const totalOut = rs
        .filter(r => r.transaction_type === 'withdrawal' || r.transaction_type === 'charge' || r.transaction_type === 'fee' || r.transaction_type === 'interest')
        .reduce((s, r) => s + Math.abs(Number(r.amount)), 0);
      return {
        key: k,
        importedAt: rs[0].imported_at,
        rows: rs,
        rowCount: rs.length,
        totalIn,
        totalOut,
        hasJE: rs.some(r => !!r.journal_entry_id),
        hasReconciled: rs.some(r => r.status === 'reconciled'),
      };
    });
    list.sort((a, b) => b.importedAt.localeCompare(a.importedAt));

    // Mark duplicates: newer batches whose signature matches an older one
    const seen = new Map<string, string>();
    for (let i = list.length - 1; i >= 0; i--) {
      const sig = signature(list[i].rows);
      const earlier = seen.get(sig);
      if (earlier) list[i].duplicateOf = earlier;
      else seen.set(sig, list[i].importedAt);
    }
    // Bubble flagged duplicates to the top
    list.sort((a, b) => {
      if (!!a.duplicateOf === !!b.duplicateOf) return b.importedAt.localeCompare(a.importedAt);
      return a.duplicateOf ? -1 : 1;
    });
    return list;
  }, [rows]);

  const confirmUndo = async () => {
    if (!pending) return;
    const ids = pending.rows.map(r => r.id);
    await onUndoBatch(ids);
    setPending(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Import History
            </DialogTitle>
            <DialogDescription>
              Review every import batch for this account and undo any that were imported by mistake. Linked journal entries are reversed automatically.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-2">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : batches.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                No imports recorded for this account yet.
              </div>
            ) : (
              <div className="space-y-2">
                {batches.map(b => (
                  <Card key={b.key} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">
                            {format(new Date(b.importedAt), 'PPpp')}
                          </span>
                          <Badge variant="secondary">{b.rowCount} rows</Badge>
                          {b.duplicateOf && (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Duplicate of {format(new Date(b.duplicateOf), 'PP p')}
                            </Badge>
                          )}
                          {b.hasJE && <Badge variant="outline">Posted to GL</Badge>}
                          {b.hasReconciled && (
                            <Badge variant="outline" className="gap-1">
                              <Lock className="w-3 h-3" />
                              Reconciled
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {b.totalIn > 0 && <span className="mr-3 text-emerald-700">+ {formatCurrency(b.totalIn)}</span>}
                          {b.totalOut > 0 && <span className="text-red-700">− {formatCurrency(b.totalOut)}</span>}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive shrink-0"
                        disabled={b.hasReconciled || isUndoing}
                        onClick={() => setPending(b)}
                        title={b.hasReconciled ? 'Cannot undo: includes reconciled rows' : 'Undo this import'}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Undo Import
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo this import?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {pending?.rowCount} transaction
              {pending?.rowCount === 1 ? '' : 's'} imported on{' '}
              {pending && format(new Date(pending.importedAt), 'PPpp')}.
              {pending?.hasJE && ' Linked journal entries will be reversed.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUndo} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Undo Import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
