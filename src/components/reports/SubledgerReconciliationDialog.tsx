import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScaleIcon, RefreshCw } from 'lucide-react';
import { useSubledgerReconciliation } from '@/hooks/useSubledgerReconciliation';

interface Props {
  formatCurrency: (n: number) => string;
}

/**
 * Phase 2 — Always Balanced.
 * Subledger Reconciliation panel: AR / AP / Bank subledger totals vs GL control accounts,
 * with a "Safe Recalculate" action that rebuilds account balances from posted journals.
 */
export function SubledgerReconciliationDialog({ formatCurrency }: Props) {
  const [open, setOpen] = useState(false);
  const { rows, isLoading, refetch, safeRecalculate, isRecalculating } = useSubledgerReconciliation();

  const mismatches = rows.filter((r) => Math.abs(r.difference) > 0.01).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="text-muted-foreground hover:text-foreground"
        >
          <ScaleIcon className="h-4 w-4 mr-1" />
          Subledger Recon
          {mismatches > 0 && (
            <Badge variant="destructive" className="ml-2">{mismatches}</Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScaleIcon className="h-5 w-5" />
            Subledger Reconciliation
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subledger</TableHead>
                <TableHead className="text-right">Subledger Balance</TableHead>
                <TableHead className="text-right">GL Balance</TableHead>
                <TableHead className="text-right">Difference</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No subledger data.</TableCell></TableRow>
              )}
              {rows.map((r, i) => {
                const ok = Math.abs(r.difference) <= 0.01;
                return (
                  <TableRow key={`${r.subledger}-${r.reference_id ?? i}`}>
                    <TableCell className="font-medium">{r.reference_label}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(Number(r.subledger_balance) || 0)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(Number(r.gl_balance) || 0)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${ok ? 'text-muted-foreground' : 'text-destructive font-semibold'}`}>
                      {formatCurrency(Number(r.difference) || 0)}
                    </TableCell>
                    <TableCell className="text-center">
                      {ok ? (
                        <Badge className="bg-success/20 text-success border-success/30">In sync</Badge>
                      ) : (
                        <Badge variant="destructive">Mismatch</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          Compares open AR/AP balances and cleared bank balances against their General Ledger control accounts in base currency.
          Differences indicate that the subledger and GL have drifted and may need a posting fix or a balance recalculation.
        </p>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => safeRecalculate()}
            disabled={isRecalculating}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isRecalculating ? 'animate-spin' : ''}`} />
            {isRecalculating ? 'Rebuilding…' : 'Safe Recalculate Balances'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
