import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, RefreshCw, Shuffle } from 'lucide-react';
import { useAccounts } from '@/hooks/useAccounts';
import { Lease, useRebuildLeaseSchedule, useReclassifyLeaseBankPostings } from '@/hooks/useLeases';

interface Props {
  lease: Lease | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RepairLeaseGLDialog({ lease, open, onOpenChange }: Props) {
  const { data: accounts = [] } = useAccounts();
  const rebuild = useRebuildLeaseSchedule();
  const reclassify = useReclassifyLeaseBankPostings();
  const [clearingAccountId, setClearingAccountId] = useState<string>('');

  const eligibleClearing = useMemo(
    () =>
      accounts.filter(
        (a: any) =>
          a.is_active &&
          !a.is_header &&
          ['asset', 'liability'].includes(a.account_type) &&
          a.id !== lease?.lease_liability_account_id &&
          a.id !== lease?.rou_asset_account_id,
      ),
    [accounts, lease],
  );

  if (!lease) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Repair GL — {lease.name}</DialogTitle>
          <DialogDescription>
            Tools to bring this lease back in sync with the General Ledger. Run these in order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center gap-2 font-medium">
              <RefreshCw className="w-4 h-4" /> 1. Rebuild amortization schedule
            </div>
            <p className="text-sm text-muted-foreground">
              Recomputes interest, principal and depreciation for every unposted row using the
              effective-interest method. Posted rows are left untouched.
            </p>
            <Button
              size="sm"
              variant="secondary"
              disabled={rebuild.isPending}
              onClick={() => rebuild.mutate(lease.id)}
            >
              {rebuild.isPending ? 'Rebuilding…' : 'Rebuild schedule'}
            </Button>
          </div>

          <Separator />

          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center gap-2 font-medium">
              <Shuffle className="w-4 h-4" /> 2. Reclassify bank postings to a clearing account
            </div>
            <p className="text-sm text-muted-foreground">
              Reverses any bank-feed entries that hit the lease liability directly and moves them
              onto the clearing account below. Idempotent — safe to re-run.
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Clearing account</Label>
              <Select value={clearingAccountId} onValueChange={setClearingAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a clearing / suspense account" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleClearing.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={!clearingAccountId || reclassify.isPending}
              onClick={() =>
                reclassify.mutate({ leaseId: lease.id, clearingAccountId })
              }
            >
              {reclassify.isPending ? 'Reclassifying…' : 'Reclassify bank postings'}
            </Button>
          </div>

          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm space-y-2">
            <div className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" /> Next steps (manual)
            </div>
            <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
              <li>Confirm the Payment From (Cash/Bank) and Depreciation Expense accounts on the lease.</li>
              <li>Use “Post Commencement to GL” to book ROU Asset / Lease Liability.</li>
              <li>Open “Post Payments to GL” and post historical periods; the clearing account should net to zero.</li>
            </ol>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
