import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, X, ListChecks } from 'lucide-react';
import { useReconciliationQueue } from '@/hooks/useReconciliationQueue';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

export default function ReconciliationReview() {
  const { items, open, isLoading, resolve, dismiss } = useReconciliationQueue();
  const fmt = useCurrencyFormatter();

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ListChecks className="h-7 w-7 text-primary" />
          Reconciliation Review
        </h1>
        <p className="text-muted-foreground">Ambiguous bank-feed matches the auto-reconciler couldn't close. Pick the correct bank transaction to complete the CRA payment.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Open items</CardTitle></CardHeader>
          <CardContent><p className={`text-2xl font-bold ${open.length ? 'text-destructive' : ''}`}>{open.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Resolved</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{items.filter((i) => i.status === 'resolved').length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Dismissed</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{items.filter((i) => i.status === 'dismissed').length}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Queue</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing to review. The bank-feed reconciler will queue items here when more than one bank debit matches a CRA payment.</p>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <Card key={item.id} className="border-muted">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <div>
                      <Badge variant={item.status === 'open' ? 'destructive' : 'outline'} className="capitalize mr-2">{item.status}</Badge>
                      <span className="text-sm text-muted-foreground">{item.reason}</span>
                    </div>
                    {item.status === 'open' && (
                      <Button size="sm" variant="ghost" onClick={() => dismiss.mutate(item.id)}>
                        <X className="h-3 w-3 mr-1" /> Dismiss
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    {item.candidates.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No candidates captured.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {item.candidates.map((c) => (
                            <TableRow key={c.id}>
                              <TableCell className="font-mono text-xs">{c.date}</TableCell>
                              <TableCell>{fmt.formatCurrency(Math.abs(Number(c.amount)), { showCurrencySymbol: true, currencyOverride: 'CAD' })}</TableCell>
                              <TableCell className="text-xs">{c.description}</TableCell>
                              <TableCell className="font-mono text-xs">{c.reference ?? '—'}</TableCell>
                              <TableCell className="text-right">
                                {item.status === 'open' && item.tax_payment_id && (
                                  <Button
                                    size="sm"
                                    onClick={() => resolve.mutate({ id: item.id, bank_transaction_id: c.id, tax_payment_id: item.tax_payment_id! })}
                                  >
                                    <CheckCircle2 className="h-3 w-3 mr-1" /> Use this match
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
