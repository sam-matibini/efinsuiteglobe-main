import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateDonation, useDonationPrograms, useDonationFunds, useDonationCampaigns, useDonationPledges } from '@/hooks/useDonations';
import { useCustomers } from '@/hooks/useCustomers';
import type { DonationType } from '@/types/donations';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface RecordDonationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const donationTypes: { value: DonationType; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'e_transfer', label: 'E-Transfer' },
  { value: 'wire_transfer', label: 'Wire Transfer' },
  { value: 'securities', label: 'Securities' },
  { value: 'in_kind', label: 'In-Kind' },
  { value: 'payroll_deduction', label: 'Payroll Deduction' },
];

export function RecordDonationDialog({ open, onOpenChange }: RecordDonationDialogProps) {
  const [donorId, setDonorId] = useState('');
  const [dateReceived, setDateReceived] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [donationType, setDonationType] = useState<DonationType>('cash');
  const [programId, setProgramId] = useState('');
  const [fundId, setFundId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [pledgeId, setPledgeId] = useState('');
  const [advantageValue, setAdvantageValue] = useState('');
  const [advantageDescription, setAdvantageDescription] = useState('');
  const [notes, setNotes] = useState('');

  const { customers } = useCustomers();
  const { data: programs = [] } = useDonationPrograms();
  const { data: funds = [] } = useDonationFunds();
  const { data: campaigns = [] } = useDonationCampaigns();
  const { data: pledges = [] } = useDonationPledges({ status: 'pending' });
  const createDonation = useCreateDonation();

  const amountNum = parseFloat(amount || '0');
  const advantageNum = parseFloat(advantageValue || '0');
  const exceedsThreshold = advantageNum > 0 && amountNum > 0 && (advantageNum / amountNum) > 0.80;
  const eligibleAmount = exceedsThreshold ? 0 : (amountNum - advantageNum);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!donorId || !amount || parseFloat(amount) <= 0) {
      return;
    }

    await createDonation.mutateAsync({
      donor_id: donorId,
      date_received: dateReceived,
      amount: parseFloat(amount),
      donation_type: donationType,
      program_id: programId || undefined,
      fund_id: fundId || undefined,
      campaign_id: campaignId || undefined,
      pledge_id: pledgeId || undefined,
      advantage_value: parseFloat(advantageValue || '0'),
      advantage_description: advantageDescription || undefined,
      notes: notes || undefined,
    });

    // Reset form
    setDonorId('');
    setAmount('');
    setDonationType('cash');
    setProgramId('');
    setFundId('');
    setCampaignId('');
    setPledgeId('');
    setAdvantageValue('');
    setAdvantageDescription('');
    setNotes('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Donation</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Donor *</Label>
              <Select value={donorId} onValueChange={setDonorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select donor" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date Received *</Label>
              <Input
                type="date"
                value={dateReceived}
                onChange={(e) => setDateReceived(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Donation Type</Label>
              <Select value={donationType} onValueChange={(v) => setDonationType(v as DonationType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {donationTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Program</Label>
              <Select value={programId || "none"} onValueChange={(v) => setProgramId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select program" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {programs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fund</Label>
              <Select value={fundId || "none"} onValueChange={(v) => setFundId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select fund" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {funds.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Campaign</Label>
              <Select value={campaignId || "none"} onValueChange={(v) => setCampaignId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select campaign" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {pledges.length > 0 && (
            <div className="space-y-2">
              <Label>Apply to Pledge</Label>
              <Select value={pledgeId || "none"} onValueChange={(v) => setPledgeId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select pledge (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {pledges.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.pledge_number} - {p.donor?.name} (${p.remaining_amount?.toLocaleString()} remaining)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
            <h4 className="font-medium text-sm">CRA Split Receipting (if applicable)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Advantage Value</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={advantageValue}
                  onChange={(e) => setAdvantageValue(e.target.value)}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Value received by donor (e.g., dinner, auction item)
                </p>
              </div>

              <div className="space-y-2">
                <Label>Eligible Amount</Label>
                <Input
                  type="text"
                  value={`$${eligibleAmount.toFixed(2)}`}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Amount qualifying for tax receipt
                </p>
              </div>
            </div>

            {parseFloat(advantageValue || '0') > 0 && (
              <div className="space-y-2">
                <Label>Advantage Description</Label>
                <Input
                  value={advantageDescription}
                  onChange={(e) => setAdvantageDescription(e.target.value)}
                  placeholder="e.g., Gala dinner ticket"
                />
              </div>
            )}

            {exceedsThreshold && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>CRA Warning:</strong> The advantage exceeds 80% of the donation amount. This donation is not eligible for a tax receipt under CRA de minimis rules. Eligible amount has been set to $0.00.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createDonation.isPending || !donorId || !amount}>
              {createDonation.isPending ? 'Recording...' : 'Record Donation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
