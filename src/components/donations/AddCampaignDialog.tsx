import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateCampaign, useDonationPrograms, useDonationFunds } from '@/hooks/useDonations';

interface AddCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddCampaignDialog({ open, onOpenChange }: AddCampaignDialogProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [goalAmount, setGoalAmount] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [programId, setProgramId] = useState('');
  const [fundId, setFundId] = useState('');

  const { data: programs = [] } = useDonationPrograms();
  const { data: funds = [] } = useDonationFunds();
  const createCampaign = useCreateCampaign();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await createCampaign.mutateAsync({
      code,
      name,
      description: description || undefined,
      goal_amount: goalAmount ? parseFloat(goalAmount) : undefined,
      start_date: startDate,
      end_date: endDate || undefined,
      program_id: programId || undefined,
      fund_id: fundId || undefined,
    });

    setCode('');
    setName('');
    setDescription('');
    setGoalAmount('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setProgramId('');
    setFundId('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Fundraising Campaign</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Campaign Code *</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g., GALA-2026"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Campaign Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Annual Gala 2026"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Campaign description..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Fundraising Goal</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={goalAmount}
              onChange={(e) => setGoalAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Link to Program</Label>
              <Select value={programId || 'none'} onValueChange={(v) => setProgramId(v === 'none' ? '' : v)}>
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
              <Label>Link to Fund</Label>
              <Select value={fundId || 'none'} onValueChange={(v) => setFundId(v === 'none' ? '' : v)}>
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
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createCampaign.isPending || !code || !name || !startDate}>
              {createCampaign.isPending ? 'Creating...' : 'Create Campaign'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
