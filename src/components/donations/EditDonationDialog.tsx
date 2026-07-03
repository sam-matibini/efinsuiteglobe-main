import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDonationPrograms, useDonationFunds, useDonationCampaigns, useUpdateDonation } from '@/hooks/useDonations';
import { useCustomers } from '@/hooks/useCustomers';
import type { Donation, DonationType } from '@/types/donations';

interface EditDonationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  donation: Donation | null;
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

export function EditDonationDialog({ open, onOpenChange, donation }: EditDonationDialogProps) {
  const [donorId, setDonorId] = useState('');
  const [dateReceived, setDateReceived] = useState('');
  const [amount, setAmount] = useState('');
  const [donationType, setDonationType] = useState<DonationType>('cash');
  const [programId, setProgramId] = useState('');
  const [fundId, setFundId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [advantageValue, setAdvantageValue] = useState('');
  const [advantageDescription, setAdvantageDescription] = useState('');
  const [notes, setNotes] = useState('');

  const { customers } = useCustomers();
  const { data: programs = [] } = useDonationPrograms();
  const { data: funds = [] } = useDonationFunds();
  const { data: campaigns = [] } = useDonationCampaigns();
  const updateDonation = useUpdateDonation();

  // Pre-populate form when donation changes
  useEffect(() => {
    if (donation) {
      setDonorId(donation.donor_id);
      setDateReceived(donation.date_received.split('T')[0]);
      setAmount(String(donation.amount));
      setDonationType(donation.donation_type);
      setProgramId(donation.program_id || '');
      setFundId(donation.fund_id || '');
      setCampaignId(donation.campaign_id || '');
      setAdvantageValue(String(donation.advantage_value || 0));
      setAdvantageDescription(donation.advantage_description || '');
      setNotes(donation.notes || '');
    }
  }, [donation]);

  const eligibleAmount = parseFloat(amount || '0') - parseFloat(advantageValue || '0');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!donation || !donorId || !amount || parseFloat(amount) <= 0) return;

    await updateDonation.mutateAsync({
      donationId: donation.id,
      updates: {
        donor_id: donorId,
        date_received: dateReceived,
        amount: parseFloat(amount),
        donation_type: donationType,
        program_id: programId || null,
        fund_id: fundId || null,
        campaign_id: campaignId || null,
        advantage_value: parseFloat(advantageValue || '0'),
        advantage_description: advantageDescription || null,
        eligible_amount: eligibleAmount,
        notes: notes || null,
      },
    });

    onOpenChange(false);
  };

  if (!donation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Donation {donation.donation_number}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Donor *</Label>
              <Select value={donorId} onValueChange={setDonorId}>
                <SelectTrigger><SelectValue placeholder="Select donor" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date Received *</Label>
              <Input type="date" value={dateReceived} onChange={(e) => setDateReceived(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Donation Type</Label>
              <Select value={donationType} onValueChange={(v) => setDonationType(v as DonationType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                <SelectTrigger><SelectValue placeholder="Select program" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {programs.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fund</Label>
              <Select value={fundId || "none"} onValueChange={(v) => setFundId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select fund" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {funds.map((f) => (<SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Campaign</Label>
              <Select value={campaignId || "none"} onValueChange={(v) => setCampaignId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select campaign" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {campaigns.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
            <h4 className="font-medium text-sm">CRA Split Receipting</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Advantage Value</Label>
                <Input type="number" step="0.01" min="0" value={advantageValue} onChange={(e) => setAdvantageValue(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Eligible Amount</Label>
                <Input type="text" value={`$${eligibleAmount.toFixed(2)}`} disabled className="bg-muted" />
              </div>
            </div>
            {parseFloat(advantageValue || '0') > 0 && (
              <div className="space-y-2">
                <Label>Advantage Description</Label>
                <Input value={advantageDescription} onChange={(e) => setAdvantageDescription(e.target.value)} placeholder="e.g., Gala dinner ticket" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes..." rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={updateDonation.isPending || !donorId || !amount}>
              {updateDonation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
