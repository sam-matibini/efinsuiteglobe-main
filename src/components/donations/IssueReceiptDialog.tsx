import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useIssueReceipt } from '@/hooks/useDonations';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import type { Donation } from '@/types/donations';
import { AlertTriangle, Receipt } from 'lucide-react';

interface IssueReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  donation: Donation | null;
}

export function IssueReceiptDialog({ open, onOpenChange, donation }: IssueReceiptDialogProps) {
  const { organization } = useCurrentOrganization();
  const issueReceipt = useIssueReceipt();

  const [charityLegalName, setCharityLegalName] = useState('');
  const [charityBn, setCharityBn] = useState('');
  const [charityAddress, setCharityAddress] = useState('');
  const [donorName, setDonorName] = useState('');
  const [donorAddress, setDonorAddress] = useState('');
  const [locationIssued, setLocationIssued] = useState('');
  const [signatoryName, setSignatoryName] = useState('');
  const [signatoryPosition, setSignatoryPosition] = useState('');

  useEffect(() => {
    if (organization && open) {
      setCharityLegalName(organization.name || '');
    }
  }, [organization, open]);

  useEffect(() => {
    if (donation?.donor && open) {
      setDonorName(donation.donor.name);
      const addr = [donation.donor.address_line1, donation.donor.city, donation.donor.province, donation.donor.postal_code].filter(Boolean).join(', ');
      setDonorAddress(addr);
    }
  }, [donation, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!donation) return;

    await issueReceipt.mutateAsync({
      donation_id: donation.id,
      charity_legal_name: charityLegalName,
      charity_bn: charityBn,
      charity_address: charityAddress,
      donor_name: donorName,
      donor_address: donorAddress,
      location_issued: locationIssued,
      signatory_name: signatoryName,
      signatory_position: signatoryPosition,
    });

    onOpenChange(false);
  };

  if (!donation) return null;

  const canIssue = donation.status === 'confirmed' && !donation.receipt_issued;
  const exceedsCraThreshold = (donation.advantage_value || 0) > 0 && ((donation.advantage_value || 0) / donation.amount) > 0.80;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Issue CRA Tax Receipt
          </DialogTitle>
        </DialogHeader>

        {!canIssue ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {donation.receipt_issued 
                ? 'A receipt has already been issued for this donation.'
                : 'This donation must be confirmed before issuing a receipt.'}
            </AlertDescription>
          </Alert>
        ) : exceedsCraThreshold ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>CRA De Minimis Rule:</strong> The advantage value (${(donation.advantage_value || 0).toLocaleString()}) exceeds 80% of the donation amount (${donation.amount.toLocaleString()}). This donation is not eligible for a CRA tax receipt.
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Alert>
              <AlertDescription>
                <strong>CRA Compliance Notice:</strong> Once issued, this receipt cannot be modified.
              </AlertDescription>
            </Alert>

            <div className="border rounded-lg p-4 bg-muted/30 space-y-2">
              <h4 className="font-medium text-sm">Donation Details</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Donation #:</span>
                  <p className="font-medium">{donation.donation_number}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Amount:</span>
                  <p className="font-medium">${donation.amount.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Eligible:</span>
                  <p className="font-medium text-success">${donation.eligible_amount.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Charity Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Charity Legal Name *</Label>
                  <Input value={charityLegalName} onChange={(e) => setCharityLegalName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Business Number (BN) *</Label>
                  <Input value={charityBn} onChange={(e) => setCharityBn(e.target.value)} placeholder="123456789RR0001" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Charity Address *</Label>
                <Input value={charityAddress} onChange={(e) => setCharityAddress(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Donor Information</h4>
              <div className="space-y-2">
                <Label>Donor Name *</Label>
                <Input value={donorName} onChange={(e) => setDonorName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Donor Address *</Label>
                <Input value={donorAddress} onChange={(e) => setDonorAddress(e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Signatory Name</Label>
                <Input value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Signatory Position</Label>
                <Input value={signatoryPosition} onChange={(e) => setSignatoryPosition(e.target.value)} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={issueReceipt.isPending || !charityBn || !donorName}>
                {issueReceipt.isPending ? 'Issuing...' : 'Issue Receipt'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
