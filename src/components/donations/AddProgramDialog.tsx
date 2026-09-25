import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateProgram } from '@/hooks/useDonations';

interface AddProgramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddProgramDialog({ open, onOpenChange }: AddProgramDialogProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const createProgram = useCreateProgram();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await createProgram.mutateAsync({
      code,
      name,
      description: description || undefined,
      budget: budget ? parseFloat(budget) : undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    });

    setCode('');
    setName('');
    setDescription('');
    setBudget('');
    setStartDate('');
    setEndDate('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Charitable Program</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Program Code *</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g., YOUTH-EDU"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Program Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Youth Education Initiative"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Program description..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Annual Budget</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createProgram.isPending || !code || !name}>
              {createProgram.isPending ? 'Creating...' : 'Create Program'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
