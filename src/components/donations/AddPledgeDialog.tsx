import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreatePledge, useDonationPrograms, useDonationFunds, useDonationCampaigns } from '@/hooks/useDonations';
import { useCustomers } from '@/hooks/useCustomers';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

interface AddPledgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddPledgeDialog({ open, onOpenChange }: AddPledgeDialogProps) {
  const [donorId, setDonorId] = useState('');
  const [pledgeDate, setPledgeDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalAmount, setTotalAmount] = useState('');
  const [programId, setProgramId] = useState('');
  const [fundId, setFundId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [paymentFrequency, setPaymentFrequency] = useState('');
  const [expectedStartDate, setExpectedStartDate] = useState('');
  const [expectedEndDate, setExpectedEndDate] = useState('');
  const [notes, setNotes] = useState('');

  const { customers } = useCustomers();
  const { data: programs = [] } = useDonationPrograms();
  const { data: funds = [] } = useDonationFunds();
  const { data: campaigns = [] } = useDonationCampaigns();
  const createPledge = useCreatePledge();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await createPledge.mutateAsync({
      donor_id: donorId,
      pledge_date: pledgeDate,
      total_amount: parseFloat(totalAmount),
      program_id: programId || undefined,
      fund_id: fundId || undefined,
      campaign_id: campaignId || undefined,
      payment_frequency: paymentFrequency || undefined,
      expected_start_date: expectedStartDate || undefined,
      expected_end_date: expectedEndDate || undefined,
      notes: notes || undefined,
    });

    setDonorId('');
    setPledgeDate(new Date().toISOString().split('T')[0]);
    setTotalAmount('');
    setProgramId('');
    setFundId('');
    setCampaignId('');
    setPaymentFrequency('');
    setExpectedStartDate('');
    setExpectedEndDate('');
    setNotes('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Pledge</DialogTitle>
        </DialogHeader>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Per CRA rules, pledges are not receipted until payment is received. 
            Donations applied to this pledge will automatically update the fulfilled amount.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pledge Date *</Label>
              <Input
                type="date"
                value={pledgeDate}
                onChange={(e) => setPledgeDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Total Amount *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Program</Label>
              <Select value={programId || "none"} onValueChange={(v) => setProgramId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
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
                  <SelectValue placeholder="Select" />
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
                  <SelectValue placeholder="Select" />
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

          <div className="space-y-2">
            <Label>Payment Frequency</Label>
            <Select value={paymentFrequency || "one_time"} onValueChange={(v) => setPaymentFrequency(v === "one_time" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one_time">One-time</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="annually">Annually</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Expected Start</Label>
              <Input
                type="date"
                value={expectedStartDate}
                onChange={(e) => setExpectedStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Expected End</Label>
              <Input
                type="date"
                value={expectedEndDate}
                onChange={(e) => setExpectedEndDate(e.target.value)}
              />
            </div>
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
            <Button type="submit" disabled={createPledge.isPending || !donorId || !totalAmount}>
              {createPledge.isPending ? 'Recording...' : 'Record Pledge'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
