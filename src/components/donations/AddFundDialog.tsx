import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateFund } from '@/hooks/useDonations';
import type { FundType } from '@/types/donations';

interface AddFundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const fundTypes: { value: FundType; label: string; description: string }[] = [
  { value: 'unrestricted', label: 'Unrestricted', description: 'Can be used for any purpose' },
  { value: 'restricted', label: 'Restricted', description: 'Must be used for specific purposes' },
  { value: 'endowment', label: 'Endowment', description: 'Principal preserved, earnings used' },
  { value: 'designated', label: 'Designated', description: 'Board-designated purposes' },
];

export function AddFundDialog({ open, onOpenChange }: AddFundDialogProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [fundType, setFundType] = useState<FundType>('unrestricted');
  const [description, setDescription] = useState('');
  const [restrictionTerms, setRestrictionTerms] = useState('');
  const [targetAmount, setTargetAmount] = useState('');

  const createFund = useCreateFund();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await createFund.mutateAsync({
      code,
      name,
      fund_type: fundType,
      description: description || undefined,
      restriction_terms: restrictionTerms || undefined,
      target_amount: targetAmount ? parseFloat(targetAmount) : undefined,
    });

    setCode('');
    setName('');
    setFundType('unrestricted');
    setDescription('');
    setRestrictionTerms('');
    setTargetAmount('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Fund</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fund Code *</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g., BLDG-FUND"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Fund Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Building Fund"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Fund Type *</Label>
            <Select value={fundType} onValueChange={(v) => setFundType(v as FundType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fundTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <div>
                      <div>{t.label}</div>
                      <div className="text-xs text-muted-foreground">{t.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Fund description..."
              rows={2}
            />
          </div>

          {(fundType === 'restricted' || fundType === 'endowment') && (
            <div className="space-y-2">
              <Label>Restriction Terms</Label>
              <Textarea
                value={restrictionTerms}
                onChange={(e) => setRestrictionTerms(e.target.value)}
                placeholder="Describe how funds may be used..."
                rows={2}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Target Amount</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createFund.isPending || !code || !name}>
              {createFund.isPending ? 'Creating...' : 'Create Fund'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
