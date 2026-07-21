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

interface CountryOption {
  id: string;
  name: string;
  code: string;
}

async function callAdmin(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-subscription-override', {
    body: payload,
  });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

function useCountries() {
  return useQuery({
    queryKey: ['countries-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('countries')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []) as CountryOption[];
    },
  });
}

export function DiscountsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const { data: countries } = useCountries();

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

  const countryName = (id?: string | null) =>
    id ? (countries?.find(c => c.id === id)?.name || 'Country') : '—';

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Discount Library</CardTitle>
          <CardDescription>
            Reusable Stripe coupons. Set a scope to apply globally or only to organizations in a specific country.
          </CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New discount</Button>
          </DialogTrigger>
          <CreateDiscountDialog onOpenChange={setOpen} countries={countries || []} />
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Scope</TableHead>
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
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {!isLoading && (presets || []).length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No discounts yet.</TableCell></TableRow>
            )}
            {(presets || []).map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>
                  {p.scope === 'country'
                    ? <Badge variant="outline">Country: {countryName(p.country_id)}</Badge>
                    : <Badge variant="outline">Global</Badge>}
                </TableCell>
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
                <TableCell className="text-right space-x-1">
                  {p.status === 'active' && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing(p)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => archive.mutate(p.id)}
                        disabled={archive.isPending}
                      >
                        <Archive className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        {editing && <EditDiscountDialog preset={editing} onClose={() => setEditing(null)} countries={countries || []} />}
      </Dialog>
    </Card>
  );
}

function ScopeFields({
  scope, setScope, countryId, setCountryId, countries,
}: {
  scope: 'global' | 'country';
  setScope: (v: 'global' | 'country') => void;
  countryId: string;
  setCountryId: (v: string) => void;
  countries: CountryOption[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label>Scope</Label>
        <Select value={scope} onValueChange={(v) => setScope(v as any)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="global">Global</SelectItem>
            <SelectItem value="country">Country</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {scope === 'country' && (
        <div className="space-y-1">
          <Label>Country</Label>
          <Select value={countryId} onValueChange={setCountryId}>
            <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
            <SelectContent>
              {countries.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

function CreateDiscountDialog({ onOpenChange, countries }: { onOpenChange: (v: boolean) => void; countries: CountryOption[] }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [percent, setPercent] = useState('10');
  const [duration, setDuration] = useState<'once' | 'repeating' | 'forever'>('once');
  const [months, setMonths] = useState('3');
  const [expiresAt, setExpiresAt] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [scope, setScope] = useState<'global' | 'country'>('global');
  const [countryId, setCountryId] = useState('');

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
        scope,
        country_id: scope === 'country' ? countryId : null,
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
        <ScopeFields scope={scope} setScope={setScope} countryId={countryId} setCountryId={setCountryId} countries={countries} />
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
          disabled={create.isPending || !name || !percent || (scope === 'country' && !countryId)}
        >
          {create.isPending ? 'Creating…' : 'Create'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function EditDiscountDialog({ preset, onClose, countries }: { preset: any; onClose: () => void; countries: CountryOption[] }) {
  const qc = useQueryClient();
  const [name, setName] = useState(preset.name || '');
  const [percent, setPercent] = useState(String(preset.percent ?? '10'));
  const [duration, setDuration] = useState<'once' | 'repeating' | 'forever'>(preset.duration || 'once');
  const [months, setMonths] = useState(String(preset.duration_in_months ?? '3'));
  const [expiresAt, setExpiresAt] = useState(
    preset.expires_at ? new Date(preset.expires_at).toISOString().slice(0, 10) : ''
  );
  const [maxRedemptions, setMaxRedemptions] = useState(
    preset.max_redemptions ? String(preset.max_redemptions) : ''
  );
  const [scope, setScope] = useState<'global' | 'country'>((preset.scope as any) || 'global');
  const [countryId, setCountryId] = useState<string>(preset.country_id || '');

  const financialChanged =
    Number(percent) !== Number(preset.percent) ||
    duration !== preset.duration ||
    (duration === 'repeating' ? Number(months) : null) !== (preset.duration_in_months || null) ||
    (expiresAt ? new Date(expiresAt).toISOString() : null) !== (preset.expires_at || null) ||
    (maxRedemptions ? Number(maxRedemptions) : null) !== (preset.max_redemptions || null);

  const update = useMutation({
    mutationFn: async () => {
      await callAdmin({
        action: 'update-preset',
        preset_id: preset.id,
        name,
        percent: Number(percent),
        duration,
        duration_in_months: duration === 'repeating' ? Number(months) : null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        max_redemptions: maxRedemptions ? Number(maxRedemptions) : null,
        scope,
        country_id: scope === 'country' ? countryId : null,
      });
    },
    onSuccess: (res: any) => {
      toast.success(
        res?.coupon_replaced
          ? 'Discount updated — a new Stripe coupon was created (old one archived).'
          : 'Discount updated'
      );
      qc.invalidateQueries({ queryKey: ['discount_presets'] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Edit discount</DialogTitle>
        <DialogDescription>
          Stripe coupons are immutable, so changing anything other than the name will archive the old coupon and provision a new one. The preset ID stays the same, so anywhere it's linked keeps working.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="space-y-1">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <ScopeFields scope={scope} setScope={setScope} countryId={countryId} setCountryId={setCountryId} countries={countries} />
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
        {financialChanged && (
          <div className="text-xs text-amber-600 dark:text-amber-400 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2 space-y-1">
            <p className="font-medium">⚠ Coupon replacement warning</p>
            <p>These changes will archive the current Stripe coupon and create a new one. Any promotion codes generated from the old coupon will be revoked immediately and can no longer be used.</p>
            <p>Existing subscriptions already using the old coupon keep their discount until it expires.</p>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => update.mutate()}
          disabled={update.isPending || !name || !percent || (scope === 'country' && !countryId)}
        >
          {update.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
