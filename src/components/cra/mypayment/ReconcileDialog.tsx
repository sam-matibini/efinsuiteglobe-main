import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCraMyPayments, type MyPaymentRow } from '@/hooks/useCraMyPayments';
import { bankCandidates, formatCad, type BankCandidate } from '@/lib/cra/mypayment/workflow';

export function ReconcileDialog({ row, open, onOpenChange }: { row: MyPaymentRow | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const pay = useCraMyPayments();
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<BankCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !row) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    pay.findBankLines(row)
      .then((lines) => !cancelled && setCandidates(bankCandidates(row, lines)))
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, row?.id]);

  if (!row) return null;

  const markPending = async () => {
    if (row.workflow_status === 'payment_completed') {
      await pay.transition.mutateAsync({ id: row.id, to: 'reconciliation_pending', message: `${row.reference} flagged for reconciliation follow-up` });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Match {row.reference} to a bank transaction</DialogTitle>
          <DialogDescription>
            Looking for a {formatCad(row.amount)} withdrawal{row.bank_account_id ? ' from the chosen bank account' : ''} within a few days of {row.paid_at?.slice(0, 10)}.
          </DialogDescription>
        </DialogHeader>
        {!row.journal_entry_id ? (
          <p className="rounded-md border border-amber-400/50 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            Post the journal entry first. Matching links the bank line to that entry so the payment is counted once.
          </p>
        ) : null}
        {loading ? <p className="text-sm text-muted-foreground">Searching bank transactions…</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {!loading && !error && candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matching bank transaction yet. Bank feeds can take a few business days. Flag it as pending and check again later.</p>
        ) : null}
        <ul className="space-y-2">
          {candidates.map((c) => (
            <li key={c.line.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
              <div>
                <div className="font-medium">{c.line.description}</div>
                <div className="text-xs text-muted-foreground">
                  {c.line.transaction_date} · {formatCad(Math.abs(c.line.amount))} · {c.daysApart === 0 ? 'same day' : `${Math.abs(c.daysApart)} day${Math.abs(c.daysApart) === 1 ? '' : 's'} ${c.daysApart > 0 ? 'after' : 'before'}`}
                </div>
                {c.alreadyPosted ? <Badge variant="destructive" className="mt-1">Already posted on its own: matching would double count</Badge> : null}
              </div>
              <Button size="sm" disabled={!row.journal_entry_id || c.alreadyPosted || pay.reconcile.isPending} onClick={async () => {
                await pay.reconcile.mutateAsync({ row, line: c.line });
                onOpenChange(false);
              }}>
                Match
              </Button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          {row.workflow_status === 'payment_completed' ? <Button variant="outline" onClick={markPending}>Flag as reconciliation pending</Button> : null}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
