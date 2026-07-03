import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUpdatePledge, useDonationPrograms, useDonationFunds, useDonationCampaigns } from '@/hooks/useDonations';
import { useCustomers } from '@/hooks/useCustomers';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import type { DonationPledge } from '@/types/donations';

interface EditPledgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pledge: DonationPledge | null;
}

export function EditPledgeDialog({ open, onOpenChange, pledge }: EditPledgeDialogProps) {
  const [donorId, setDonorId] = useState('');
  const [pledgeDate, setPledgeDate] = useState('');
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
  const updatePledge = useUpdatePledge();

  const isLocked = pledge?.status === 'fulfilled' || pledge?.status === 'cancelled';

  useEffect(() => {
    if (pledge) {
      setDonorId(pledge.donor_id);
      setPledgeDate(pledge.pledge_date);
      setTotalAmount(String(pledge.total_amount));
      setProgramId(pledge.program_id || '');
      setFundId(pledge.fund_id || '');
      setCampaignId(pledge.campaign_id || '');
      setPaymentFrequency(pledge.payment_frequency || '');
      setExpectedStartDate(pledge.expected_start_date || '');
      setExpectedEndDate(pledge.expected_end_date || '');
      setNotes(pledge.notes || '');
    }
  }, [pledge]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pledge) return;

    await updatePledge.mutateAsync({
      pledgeId: pledge.id,
      updates: {
        donor_id: donorId,
        pledge_date: pledgeDate,
        total_amount: parseFloat(totalAmount),
        program_id: programId || null,
        fund_id: fundId || null,
        campaign_id: campaignId || null,
        payment_frequency: paymentFrequency || null,
        expected_start_date: expectedStartDate || null,
        expected_end_date: expectedEndDate || null,
        notes: notes || null,
      },
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Pledge {pledge?.pledge_number}</DialogTitle>
        </DialogHeader>

        {isLocked && (
          <Alert variant="destructive">
            <Info className="h-4 w-4" />
            <AlertDescription>
              This pledge is {pledge?.status} and cannot be edited.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Donor *</Label>
            <Select value={donorId} onValueChange={setDonorId} disabled={isLocked}>
              <SelectTrigger><SelectValue placeholder="Select donor" /></SelectTrigger>
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
              <Input type="date" value={pledgeDate} onChange={(e) => setPledgeDate(e.target.value)} required disabled={isLocked} />
            </div>
            <div className="space-y-2">
              <Label>Total Amount *</Label>
              <Input type="number" step="0.01" min="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} required disabled={isLocked} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Program</Label>
              <Select value={programId || "none"} onValueChange={(v) => setProgramId(v === "none" ? "" : v)} disabled={isLocked}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {programs.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fund</Label>
              <Select value={fundId || "none"} onValueChange={(v) => setFundId(v === "none" ? "" : v)} disabled={isLocked}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {funds.map((f) => (<SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Campaign</Label>
              <Select value={campaignId || "none"} onValueChange={(v) => setCampaignId(v === "none" ? "" : v)} disabled={isLocked}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {campaigns.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Payment Frequency</Label>
            <Select value={paymentFrequency || "one_time"} onValueChange={(v) => setPaymentFrequency(v === "one_time" ? "" : v)} disabled={isLocked}>
              <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
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
              <Input type="date" value={expectedStartDate} onChange={(e) => setExpectedStartDate(e.target.value)} disabled={isLocked} />
            </div>
            <div className="space-y-2">
              <Label>Expected End</Label>
              <Input type="date" value={expectedEndDate} onChange={(e) => setExpectedEndDate(e.target.value)} disabled={isLocked} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} disabled={isLocked} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={updatePledge.isPending || !donorId || !totalAmount || isLocked}>
              {updatePledge.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
