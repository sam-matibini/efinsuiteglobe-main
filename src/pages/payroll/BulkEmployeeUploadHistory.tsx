import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useEmployeeImport } from '@/hooks/useEmployeeImport';
import { format } from 'date-fns';

export default function BulkEmployeeUploadHistory() {
  const navigate = useNavigate();
  const { history, isLoadingHistory, rollbackBatch } = useEmployeeImport();
  const [rollbackTarget, setRollbackTarget] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const statusColor = (s: string) =>
    s === 'posted' ? 'bg-success/10 text-success' :
    s === 'failed' ? 'bg-destructive/10 text-destructive' :
    s === 'reversed' ? 'bg-muted text-muted-foreground' :
    'bg-primary/10 text-primary';

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/payroll/employees/bulk-upload')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Employee Import History</h1>
          <p className="text-muted-foreground text-sm">Audit trail of every bulk employee upload.</p>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoadingHistory ? (
          <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Country</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Created</TableHead>
                <TableHead className="text-right">Updated</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No imports yet.</TableCell></TableRow>
              )}
              {history.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="text-xs">{format(new Date(b.created_at), 'yyyy-MM-dd HH:mm')}</TableCell>
                  <TableCell className="text-xs font-mono">{b.file_name ?? '—'}</TableCell>
                  <TableCell>{b.import_mode}</TableCell>
                  <TableCell>{b.country_code ?? '—'}</TableCell>
                  <TableCell className="text-right">{b.total_rows}</TableCell>
                  <TableCell className="text-right">{b.created_count}</TableCell>
                  <TableCell className="text-right">{b.updated_count}</TableCell>
                  <TableCell className="text-right">{b.failed_count}</TableCell>
                  <TableCell><Badge className={statusColor(b.status)} variant="outline">{b.status}</Badge></TableCell>
                  <TableCell>
                    {b.status === 'posted' && (
                      <Button variant="ghost" size="sm" onClick={() => setRollbackTarget(b.id)}>
                        <RotateCcw className="w-3 h-3 mr-1" /> Rollback
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={!!rollbackTarget} onOpenChange={(o) => !o && setRollbackTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rollback Import</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Rolling back will remove compensation, deduction and payment records posted by this import,
              and soft-delete employees created by it. Requires admin role.
            </p>
            <Label>Reason</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Duplicate upload" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRollbackTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!reason || rollbackBatch.isPending}
              onClick={async () => {
                if (!rollbackTarget) return;
                await rollbackBatch.mutateAsync({ batchId: rollbackTarget, reason });
                setRollbackTarget(null);
                setReason('');
              }}
            >
              {rollbackBatch.isPending ? 'Rolling back…' : 'Confirm Rollback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
