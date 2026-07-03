import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTaxPayments, type TaxPayment } from '@/hooks/useTaxPayments';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: Pick<TaxPayment, 'id' | 'reference'> | null;
}

export function RecordCraConfirmationDialog({ open, onOpenChange, payment }: Props) {
  const { recordConfirmation } = useTaxPayments();
  const [confirmationNumber, setConfirmationNumber] = useState('');
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setConfirmationNumber('');
      setPaidAt(new Date().toISOString().slice(0, 10));
      setNotes('');
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!payment || !confirmationNumber.trim() || !paidAt) return;
    await recordConfirmation.mutateAsync({
      id: payment.id,
      confirmation_number: confirmationNumber.trim(),
      paid_at: paidAt,
      notes: notes.trim() || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record CRA confirmation</DialogTitle>
          <DialogDescription>
            Enter the CRA confirmation number from My Business Account or your bank's CRA bill-pay
            receipt to close out remittance {payment?.reference ?? ''}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="confirmation-number">CRA confirmation number *</Label>
            <Input
              id="confirmation-number"
              value={confirmationNumber}
              onChange={(e) => setConfirmationNumber(e.target.value)}
              placeholder="e.g. 1234567890"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="paid-at">Payment date *</Label>
            <Input
              id="paid-at"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional reference or memo..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={recordConfirmation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!confirmationNumber.trim() || !paidAt || recordConfirmation.isPending}
          >
            {recordConfirmation.isPending ? 'Saving…' : 'Record confirmation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
