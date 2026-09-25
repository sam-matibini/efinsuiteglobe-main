import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCurrencies, useExchangeRates } from '@/hooks/useCurrencies';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddRateDialog({ open, onOpenChange }: Props) {
  const { activeCurrencies, baseCurrency } = useCurrencies();
  const { createExchangeRate } = useExchangeRates();

  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>(baseCurrency?.code || '');
  const [rate, setRate] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const handleSubmit = () => {
    const r = parseFloat(rate);
    if (!from || !to || !r || r <= 0) return;
    createExchangeRate.mutate(
      { from_currency: from, to_currency: to, rate: r, effective_date: date, source: 'manual' },
      { onSuccess: () => { onOpenChange(false); setFrom(''); setRate(''); } },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Exchange Rate</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>From Currency</Label>
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger><SelectValue placeholder="From" /></SelectTrigger>
                <SelectContent>
                  {activeCurrencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>To Currency</Label>
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger><SelectValue placeholder="To" /></SelectTrigger>
                <SelectContent>
                  {activeCurrencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Rate (1 {from || 'FROM'} = ? {to || 'TO'})</Label>
            <Input type="number" step="0.00000001" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="1.35" />
          </div>
          <div className="space-y-1.5">
            <Label>Effective Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createExchangeRate.isPending || !from || !to || !rate}>Save Rate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
