import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Copy, Plus, Archive, Pencil } from 'lucide-react';
import { format } from 'date-fns';

async function callAdmin(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-subscription-override', {
    body: payload,
  });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

export function DiscountsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: presets, isLoading } = useQuery({
    queryKey: ['discount_presets', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discount_presets')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const archive = useMutation({
    mutationFn: async (id: string) => callAdmin({ action: 'archive-preset', preset_id: id }),
    onSuccess: () => {
      toast.success('Discount archived');
      qc.invalidateQueries({ queryKey: ['discount_presets'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Discount Library</CardTitle>
          <CardDescription>
            Reusable Stripe coupons. Creating a discount here provisions a coupon in Stripe automatically.
          </CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New discount</Button>
          </DialogTrigger>
          <CreateDiscountDialog onOpenChange={setOpen} />
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Percent</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Stripe coupon</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {!isLoading && (presets || []).length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No discounts yet.</TableCell></TableRow>
            )}
            {(presets || []).map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.percent}%</TableCell>
                <TableCell>
                  {p.duration === 'repeating'
                    ? `${p.duration_in_months} mo`
                    : p.duration}
                </TableCell>
                <TableCell>{p.expires_at ? format(new Date(p.expires_at), 'MMM d, yyyy') : '—'}</TableCell>
                <TableCell>
                  <button
                    className="font-mono text-xs inline-flex items-center gap-1 hover:text-primary"
                    onClick={() => {
                      navigator.clipboard.writeText(p.stripe_coupon_id);
                      toast.success('Copied');
                    }}
                  >
                    {p.stripe_coupon_id}
                    <Copy className="w-3 h-3" />
                  </button>
                </TableCell>
                <TableCell>
                  <Badge variant={p.status === 'active' ? 'default' : 'secondary'}>
                    {p.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {p.status === 'active' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => archive.mutate(p.id)}
                      disabled={archive.isPending}
                    >
                      <Archive className="w-4 h-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CreateDiscountDialog({ onOpenChange }: { onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [percent, setPercent] = useState('10');
  const [duration, setDuration] = useState<'once' | 'repeating' | 'forever'>('once');
  const [months, setMonths] = useState('3');
  const [expiresAt, setExpiresAt] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');

  const create = useMutation({
    mutationFn: async () => {
      await callAdmin({
        action: 'create-preset',
        name,
        percent: Number(percent),
        duration,
        duration_in_months: duration === 'repeating' ? Number(months) : null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        max_redemptions: maxRedemptions ? Number(maxRedemptions) : null,
      });
    },
    onSuccess: () => {
      toast.success('Discount created in Stripe');
      qc.invalidateQueries({ queryKey: ['discount_presets'] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create discount</DialogTitle>
        <DialogDescription>
          Provisions a Stripe coupon and saves it for reuse.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="space-y-1">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Launch promo" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Percent off</Label>
            <Input type="number" min={1} max={100} value={percent} onChange={(e) => setPercent(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Duration</Label>
            <Select value={duration} onValueChange={(v) => setDuration(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="once">Once</SelectItem>
                <SelectItem value="repeating">Repeating (months)</SelectItem>
                <SelectItem value="forever">Forever</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {duration === 'repeating' && (
          <div className="space-y-1">
            <Label>Duration in months</Label>
            <Input type="number" min={1} value={months} onChange={(e) => setMonths(e.target.value)} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Redeem-by date (optional)</Label>
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Max redemptions (optional)</Label>
            <Input type="number" min={1} value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button
          onClick={() => create.mutate()}
          disabled={create.isPending || !name || !percent}
        >
          {create.isPending ? 'Creating…' : 'Create'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
