import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { History, Undo2, Trash2, AlertTriangle } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useLocalizedCurrency } from '@/hooks/useLocalizedCurrency';
import { useImportPosting } from '@/hooks/useImportPosting';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAfterChange?: () => void;
}

interface Batch {
  id: string;
  status: string;
  fiscal_year: string | number | null;
  as_of_date: string | null;
  source_system: string | null;
  posting_mode: string | null;
  posted_at: string | null;
  reversed_at: string | null;
  reversal_reason: string | null;
  posted_total_debits: number | null;
  posted_total_credits: number | null;
  created_at: string;
  duplicateOf?: string;
}

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  posted: 'default',
  validated: 'secondary',
  reversed: 'outline',
  failed: 'destructive',
  posting: 'secondary',
  draft: 'outline',
};

export function TrialBalanceImportHistoryDialog({ open, onOpenChange, onAfterChange }: Props) {
  const { organization } = useCurrentOrganization();
  const { formatCurrency } = useLocalizedCurrency();
  const { reverseImportBatch } = useImportPosting();
  const queryClient = useQueryClient();
  const [pendingReverse, setPendingReverse] = useState<Batch | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Batch | null>(null);
  const [reason, setReason] = useState('');

  const { data: batches = [], isLoading, refetch } = useQuery({
    queryKey: ['tb-import-history', organization?.id],
    enabled: open && !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_batches')
        .select('id, status, fiscal_year, as_of_date, source_system, posting_mode, posted_at, reversed_at, reversal_reason, posted_total_debits, posted_total_credits, created_at')
        .eq('organization_id', organization!.id)
        .eq('import_type', 'trial_balance')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Batch[];
    },
  });

  const decorated: Batch[] = useMemo(() => {
    const seen = new Map<string, string>();
    // Iterate oldest → newest so the older posted batch is the "original"
    const sortedAsc = [...batches].sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (const b of sortedAsc) {
      if (b.status !== 'posted') continue;
      const key = `${b.fiscal_year}|${b.as_of_date}|${Number(b.posted_total_debits ?? 0).toFixed(2)}`;
      const earlier = seen.get(key);
      if (earlier) {
        b.duplicateOf = earlier;
      } else {
        seen.set(key, b.posted_at || b.created_at);
      }
    }
    return [...batches].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [batches]);

  const confirmReverse = async () => {
    if (!pendingReverse) return;
    try {
      await reverseImportBatch.mutateAsync({ batchId: pendingReverse.id, reason: reason.trim() || 'Reversed via Import History' });
      setPendingReverse(null);
      setReason('');
      refetch();
      onAfterChange?.();
    } catch {
      /* toast handled in hook */
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      const { error: rowsErr } = await supabase.from('import_batch_rows').delete().eq('batch_id', pendingDelete.id);
      if (rowsErr) throw rowsErr;
      const { error: batchErr } = await supabase.from('import_batches').delete().eq('id', pendingDelete.id);
      if (batchErr) throw batchErr;
      toast.success('Import batch deleted');
      setPendingDelete(null);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['import-batches'] });
      onAfterChange?.();
    } catch (e: any) {
      toast.error('Failed to delete batch: ' + e.message);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Trial Balance Import History
            </DialogTitle>
            <DialogDescription>
              Review every Trial Balance / Opening Balance import for this organization. Reverse a posted batch to flip its linked journal entries to <code>reversed</code>, or delete an unposted batch.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-2">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : decorated.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                No trial balance imports yet.
              </div>
            ) : (
              <div className="space-y-2">
                {decorated.map(b => {
                  const canReverse = b.status === 'posted';
                  const canDelete = b.status === 'validated' || b.status === 'failed' || b.status === 'draft';
                  return (
                    <Card key={b.id} className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">
                              FY {b.fiscal_year} · As of {b.as_of_date}
                            </span>
                            <Badge variant={statusVariant[b.status] ?? 'outline'}>{b.status}</Badge>
                            {b.posting_mode && <Badge variant="outline">{b.posting_mode.replace('_', ' ')}</Badge>}
                            {b.source_system && <Badge variant="outline">{b.source_system}</Badge>}
                            {b.duplicateOf && (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Duplicate of {format(new Date(b.duplicateOf), 'PP p')}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground space-x-3">
                            {b.posted_at && <span>Posted {format(new Date(b.posted_at), 'PPpp')}</span>}
                            {b.reversed_at && <span>Reversed {format(new Date(b.reversed_at), 'PPpp')}</span>}
                            {!b.posted_at && !b.reversed_at && <span>Created {format(new Date(b.created_at), 'PPpp')}</span>}
                          </div>
                          {(b.posted_total_debits || b.posted_total_credits) && (
                            <div className="text-xs text-muted-foreground">
                              Dr {formatCurrency(Number(b.posted_total_debits || 0))} · Cr {formatCurrency(Number(b.posted_total_credits || 0))}
                            </div>
                          )}
                          {b.reversal_reason && (
                            <div className="text-xs italic text-muted-foreground">Reason: {b.reversal_reason}</div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            disabled={!canReverse || reverseImportBatch.isPending}
                            onClick={() => { setPendingReverse(b); setReason(''); }}
                            title={canReverse ? 'Reverse this import' : 'Only posted batches can be reversed'}
                          >
                            <Undo2 className="w-4 h-4 mr-2" />
                            Reverse
                          </Button>
                          {canDelete && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setPendingDelete(b)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingReverse} onOpenChange={(o) => !o && setPendingReverse(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reverse this import?</AlertDialogTitle>
            <AlertDialogDescription>
              The linked journal entries will be marked as <code>reversed</code> so their effect nets to zero in the Trial Balance and downstream reports. The original audit trail is preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reverse-reason">Reason (optional)</Label>
            <Textarea
              id="reverse-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Duplicate of earlier 2025 TB import"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReverse} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Reverse Import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this batch?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the unposted import batch and its staged rows. No general ledger data is affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
