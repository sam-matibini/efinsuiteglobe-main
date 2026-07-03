import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, RefreshCw, Download, Printer } from 'lucide-react';
import { useReissueReceipt } from '@/hooks/useDonations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { downloadDonationReceiptWithLogo, printDonationReceiptWithLogo } from '@/lib/print/donationReceiptGenerator';
import type { DonationReceipt } from '@/types/donations';

interface ReissueReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: DonationReceipt;
}

export function ReissueReceiptDialog({ open, onOpenChange, receipt }: ReissueReceiptDialogProps) {
  const { mutate: reissue, isPending } = useReissueReceipt();
  const { formatWithSymbol } = useCurrencyFormatter();
  const { organization } = useCurrentOrganization();
  const logoUrl = (() => {
    if (organization?.receipt_show_logo === false) return undefined;
    return organization?.receipt_logo_url || organization?.logo_url;
  })();

  const [reason, setReason] = useState('');
  const [donorName, setDonorName] = useState(receipt.donor_name);
  const [donorAddress, setDonorAddress] = useState(receipt.donor_address);
  const [charityName, setCharityName] = useState(receipt.charity_legal_name);
  const [charityBn, setCharityBn] = useState(receipt.charity_bn);
  const [charityAddress, setCharityAddress] = useState(receipt.charity_address);
  const [amount, setAmount] = useState(receipt.amount.toString());
  const [eligibleAmount, setEligibleAmount] = useState(receipt.eligible_amount.toString());
  const [advantageValue, setAdvantageValue] = useState(receipt.advantage_value.toString());
  const [signatoryName, setSignatoryName] = useState(receipt.signatory_name || '');
  const [signatoryPosition, setSignatoryPosition] = useState(receipt.signatory_position || '');

  const handleSubmit = () => {
    if (!reason.trim()) return;

    reissue({
      receiptId: receipt.id,
      cancellationReason: reason,
      corrections: {
        donor_name: donorName !== receipt.donor_name ? donorName : undefined,
        donor_address: donorAddress !== receipt.donor_address ? donorAddress : undefined,
        charity_legal_name: charityName !== receipt.charity_legal_name ? charityName : undefined,
        charity_bn: charityBn !== receipt.charity_bn ? charityBn : undefined,
        charity_address: charityAddress !== receipt.charity_address ? charityAddress : undefined,
        amount: parseFloat(amount) !== receipt.amount ? parseFloat(amount) : undefined,
        eligible_amount: parseFloat(eligibleAmount) !== receipt.eligible_amount ? parseFloat(eligibleAmount) : undefined,
        advantage_value: parseFloat(advantageValue) !== receipt.advantage_value ? parseFloat(advantageValue) : undefined,
        signatory_name: signatoryName !== (receipt.signatory_name || '') ? signatoryName : undefined,
        signatory_position: signatoryPosition !== (receipt.signatory_position || '') ? signatoryPosition : undefined,
      },
    }, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Reissue / Correct Receipt
          </DialogTitle>
          <DialogDescription>
            Original receipt <Badge variant="secondary">{receipt.receipt_number}</Badge> will be cancelled and a new corrected receipt will be issued.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cancellation Reason */}
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
            <div className="flex items-center gap-2 text-destructive text-sm font-medium">
              <AlertTriangle className="w-4 h-4" />
              Cancellation Reason (required)
            </div>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Donor address was incorrect, Amount error..."
              className="min-h-[60px]"
            />
          </div>

          {/* Donor Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase">Donor Information</h4>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label>Donor Name</Label>
                <Input value={donorName} onChange={(e) => setDonorName(e.target.value)} />
              </div>
              <div>
                <Label>Donor Address</Label>
                <Input value={donorAddress} onChange={(e) => setDonorAddress(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Charity Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase">Charity Information</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Legal Name</Label>
                <Input value={charityName} onChange={(e) => setCharityName(e.target.value)} />
              </div>
              <div>
                <Label>Business Number (BN)</Label>
                <Input value={charityBn} onChange={(e) => setCharityBn(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Charity Address</Label>
              <Input value={charityAddress} onChange={(e) => setCharityAddress(e.target.value)} />
            </div>
          </div>

          {/* Amounts */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase">Amounts</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Total Amount</Label>
                <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <Label>Eligible Amount</Label>
                <Input type="number" step="0.01" value={eligibleAmount} onChange={(e) => setEligibleAmount(e.target.value)} />
              </div>
              <div>
                <Label>Advantage Value</Label>
                <Input type="number" step="0.01" value={advantageValue} onChange={(e) => setAdvantageValue(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Signatory */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase">Signatory</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} />
              </div>
              <div>
                <Label>Position</Label>
                <Input value={signatoryPosition} onChange={(e) => setSignatoryPosition(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-lg border p-3 bg-muted/30 text-sm space-y-1">
            <div><span className="text-muted-foreground">Original Receipt:</span> {receipt.receipt_number} — {formatWithSymbol(receipt.amount)}</div>
            <div><span className="text-muted-foreground">Type:</span> {receipt.is_consolidated ? 'Consolidated / Annual' : 'Individual'}</div>
            <div><span className="text-muted-foreground">Action:</span> Cancel original & issue corrected replacement</div>
          </div>

          <div className="flex justify-between gap-2 pt-2">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => printDonationReceiptWithLogo(receipt, logoUrl)}>
                <Printer className="w-4 h-4 mr-2" />Print Original
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadDonationReceiptWithLogo(receipt, logoUrl)}>
                <Download className="w-4 h-4 mr-2" />Download Original
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={isPending || !reason.trim()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                {isPending ? 'Reissuing...' : 'Reissue Corrected Receipt'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
