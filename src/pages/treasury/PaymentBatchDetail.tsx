import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAPPaymentBatchItems, useAPPaymentBatches } from '@/hooks/useAPPaymentBatches';
import { useTreasuryRails } from '@/hooks/useTreasuryRails';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';
import { ArrowLeft, Play } from 'lucide-react';

export default function PaymentBatchDetail() {
  const { batchId } = useParams<{ batchId: string }>();
  const { batches } = useAPPaymentBatches();
  const { data: items = [], isLoading } = useAPPaymentBatchItems(batchId);
  const { processAPBatch } = useTreasuryRails();
  const isReadOnly = useIsReadOnly();
  const batch = batches.find((b) => b.id === batchId);
  const canRun = batch && (batch.status === 'draft' || batch.status === 'approved');

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="ghost"><Link to="/treasury/ap-payments"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link></Button>
          <h1 className="text-2xl font-bold">{batch?.batch_number ?? 'Batch'}</h1>
          {batch && <Badge variant="secondary">{batch.status}</Badge>}
        </div>
        {!isReadOnly && canRun && batchId && (
          <Button onClick={() => processAPBatch.mutate({ batch_id: batchId })} disabled={processAPBatch.isPending}>
            <Play className="h-4 w-4 mr-1" />Run Batch
          </Button>
        )}
      </div>
      <Card>
        <CardHeader><CardTitle>Items</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p>Loading…</p> : items.length === 0 ? <p className="text-sm text-muted-foreground">No items.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Bill</TableHead><TableHead>Vendor</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead>Failure</TableHead></TableRow></TableHeader>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs">{i.bill_id?.slice(0, 8)}</TableCell>
                    <TableCell className="text-xs">{i.vendor_id?.slice(0, 8)}</TableCell>
                    <TableCell className="text-right">{Number(i.amount).toFixed(2)} {i.currency}</TableCell>
                    <TableCell><Badge variant={i.status === 'completed' ? 'default' : i.status === 'failed' ? 'destructive' : 'secondary'}>{i.status}</Badge></TableCell>
                    <TableCell className="text-xs text-destructive">{i.failure_reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
