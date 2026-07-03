import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, XCircle } from 'lucide-react';
import { useBulkCancelReceipts } from '@/hooks/useDonations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import type { DonationReceipt } from '@/types/donations';

interface BulkCancelReceiptsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipts: DonationReceipt[];
  onComplete: () => void;
}

export function BulkCancelReceiptsDialog({ open, onOpenChange, receipts, onComplete }: BulkCancelReceiptsDialogProps) {
  const { mutate: bulkCancel, isPending } = useBulkCancelReceipts();
  const { formatWithSymbol } = useCurrencyFormatter();
  const [reason, setReason] = useState('');
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);

  const handleSubmit = () => {
    if (!reason.trim()) return;
    setProgress({ completed: 0, total: receipts.length });

    bulkCancel({
      receiptIds: receipts.map(r => r.id),
      reason,
      onProgress: (completed, total) => setProgress({ completed, total }),
    }, {
      onSuccess: () => {
        setReason('');
        setProgress(null);
        onComplete();
        onOpenChange(false);
      },
      onSettled: () => setProgress(null),
    });
  };

  const totalAmount = receipts.reduce((sum, r) => sum + r.amount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-destructive" />
            Bulk Cancel Receipts
          </DialogTitle>
          <DialogDescription>
            Cancel {receipts.length} selected receipt(s) totalling {formatWithSymbol(totalAmount)}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning */}
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
            <div className="flex items-center gap-2 text-destructive text-sm font-medium">
              <AlertTriangle className="w-4 h-4" />
              CRA Compliance Notice
            </div>
            <p className="text-sm text-muted-foreground">
              Cancelled receipts are permanently retained for audit purposes per CRA regulations. This action cannot be undone.
            </p>
          </div>

          {/* Receipt list */}
          <div className="max-h-40 overflow-y-auto rounded border p-2 space-y-1">
            {receipts.map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm py-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{r.receipt_number}</Badge>
                  <span className="text-muted-foreground truncate max-w-[200px]">{r.donor_name}</span>
                </div>
                <span className="font-medium">{formatWithSymbol(r.amount)}</span>
              </div>
            ))}
          </div>

          {/* Reason */}
          <div>
            <label className="text-sm font-medium">Cancellation Reason (required)</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Issued in error, duplicate receipts..."
              className="mt-1 min-h-[60px]"
            />
          </div>

          {/* Progress */}
          {progress && (
            <div className="space-y-1">
              <Progress value={(progress.completed / progress.total) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {progress.completed} / {progress.total} processed
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={isPending || !reason.trim()}>
            {isPending ? 'Cancelling...' : `Cancel ${receipts.length} Receipt(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
