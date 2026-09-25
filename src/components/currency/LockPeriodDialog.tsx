import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';

interface Props { open: boolean; onOpenChange: (o: boolean) => void; }

export function LockPeriodDialog({ open, onOpenChange }: Props) {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const lock = useMutation({
    mutationFn: async () => {
      if (!organization?.id) throw new Error('No org');
      const { error } = await supabase
        .from('exchange_rate_locks')
        .upsert({
          organization_id: organization.id,
          period_end: periodEnd,
          locked: true,
          notes: notes || null,
        }, { onConflict: 'organization_id,period_end' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange_rate_locks'] });
      toast.success('Period locked');
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Lock className="w-4 h-4" /> Lock Exchange Rate Period</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Locking a period prevents any exchange rate edits dated on or before the period end date.
          </p>
          <div className="space-y-1.5">
            <Label>Period End Date</Label>
            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => lock.mutate()} disabled={lock.isPending}>Lock Period</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
