import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useBulkReissueReceipts } from '@/hooks/useDonations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import type { DonationReceipt } from '@/types/donations';

interface BulkReissueReceiptsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipts: DonationReceipt[];
  onComplete: () => void;
}

export function BulkReissueReceiptsDialog({ open, onOpenChange, receipts, onComplete }: BulkReissueReceiptsDialogProps) {
  const { mutate: bulkReissue, isPending } = useBulkReissueReceipts();
  const { formatWithSymbol } = useCurrencyFormatter();
  const [reason, setReason] = useState('');
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);

  // Shared correction fields — only non-empty values are applied
  const [charityName, setCharityName] = useState('');
  const [charityBn, setCharityBn] = useState('');
  const [charityAddress, setCharityAddress] = useState('');
  const [signatoryName, setSignatoryName] = useState('');
  const [signatoryPosition, setSignatoryPosition] = useState('');

  const handleSubmit = () => {
    if (!reason.trim()) return;
    setProgress({ completed: 0, total: receipts.length });

    // Build corrections — only include fields that have values
    const corrections: Record<string, any> = {};
    if (charityName.trim()) corrections.charity_legal_name = charityName.trim();
    if (charityBn.trim()) corrections.charity_bn = charityBn.trim();
    if (charityAddress.trim()) corrections.charity_address = charityAddress.trim();
    if (signatoryName.trim()) corrections.signatory_name = signatoryName.trim();
    if (signatoryPosition.trim()) corrections.signatory_position = signatoryPosition.trim();

    bulkReissue({
      receiptIds: receipts.map(r => r.id),
      cancellationReason: reason,
      corrections,
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Bulk Reissue / Correct Receipts
          </DialogTitle>
          <DialogDescription>
            Reissue {receipts.length} selected receipt(s) totalling {formatWithSymbol(totalAmount)}. Original receipts will be cancelled and new corrected ones issued.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning */}
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
            <div className="flex items-center gap-2 text-destructive text-sm font-medium">
              <AlertTriangle className="w-4 h-4" />
              Cancellation Reason (required)
            </div>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Charity BN was incorrect, signatory changed..."
              className="min-h-[60px]"
            />
          </div>

          {/* Receipt list */}
          <div className="max-h-32 overflow-y-auto rounded border p-2 space-y-1">
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

          {/* Shared corrections */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase">Shared Corrections (leave blank to keep original)</h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Charity Legal Name</Label>
                <Input value={charityName} onChange={(e) => setCharityName(e.target.value)} placeholder="Leave blank to keep" />
              </div>
              <div>
                <Label>Business Number (BN)</Label>
                <Input value={charityBn} onChange={(e) => setCharityBn(e.target.value)} placeholder="Leave blank to keep" />
              </div>
            </div>
            <div>
              <Label>Charity Address</Label>
              <Input value={charityAddress} onChange={(e) => setCharityAddress(e.target.value)} placeholder="Leave blank to keep" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Signatory Name</Label>
                <Input value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} placeholder="Leave blank to keep" />
              </div>
              <div>
                <Label>Signatory Position</Label>
                <Input value={signatoryPosition} onChange={(e) => setSignatoryPosition(e.target.value)} placeholder="Leave blank to keep" />
              </div>
            </div>
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
          <Button onClick={handleSubmit} disabled={isPending || !reason.trim()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {isPending ? 'Reissuing...' : `Reissue ${receipts.length} Receipt(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
