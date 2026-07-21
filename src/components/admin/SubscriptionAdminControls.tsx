import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { addDays, format } from 'date-fns';

async function callAdmin(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-subscription-override', {
    body: payload,
  });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

// ============ Defaults Card ============
export function SubscriptionDefaultsCard() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ['platform_settings', 'subscription'],
    queryFn: async () => {
      const { data } = await supabase
        .from('platform_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['subscription.trial_period_days', 'subscription.global_discount']);
      const map: Record<string, any> = {};
      (data || []).forEach((r: any) => (map[r.setting_key] = r.setting_value));
      return map;
    },
  });

  const { data: presets } = useQuery({
    queryKey: ['discount_presets', 'active'],
    queryFn: async () => {
      const { data } = await supabase
        .from('discount_presets')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const [trialDays, setTrialDays] = useState('14');
  const [presetId, setPresetId] = useState<string>('custom');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [discountExpires, setDiscountExpires] = useState('');
  const [duration, setDuration] = useState<'once' | 'repeating' | 'forever'>('forever');
  const [durationMonths, setDurationMonths] = useState('3');
  const [couponId, setCouponId] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!settings) return;
    setTrialDays(String(settings['subscription.trial_period_days']?.days ?? 14));
    const gd = settings['subscription.global_discount'] || {};
    setPresetId(gd.preset_id || 'custom');
    setDiscountPercent(String(gd.percent ?? 0));
    setDiscountExpires(gd.expires_at ? gd.expires_at.slice(0, 10) : '');
    setDuration((gd.duration as any) || (gd.expires_at ? 'once' : 'forever'));
    setDurationMonths(String(gd.duration_in_months ?? 3));
    setCouponId(gd.stripe_coupon_id || '');
    setNote(gd.note || '');
  }, [settings]);

  const usingPreset = presetId && presetId !== 'custom';
  const selectedPreset = (presets || []).find((p: any) => p.id === presetId);

  useEffect(() => {
    if (usingPreset && selectedPreset) {
      setDiscountPercent(String(selectedPreset.percent));
      setDiscountExpires(selectedPreset.expires_at ? String(selectedPreset.expires_at).slice(0, 10) : '');
      setDuration((selectedPreset.duration as any) || 'forever');
      setDurationMonths(String(selectedPreset.duration_in_months ?? 3));
    }
  }, [presetId, selectedPreset, usingPreset]);

  const save = useMutation({
    mutationFn: async () => {
      await callAdmin({
        action: 'update-defaults',
        trial_period_days: Number(trialDays),
        global_discount: usingPreset
          ? { preset_id: presetId, note: note || null }
          : {
              percent: Number(discountPercent),
              expires_at: discountExpires ? new Date(discountExpires).toISOString() : null,
              duration,
              duration_in_months: duration === 'repeating' ? Number(durationMonths) : null,
              note: note || null,
            },
      });
    },
    onSuccess: () => {
      toast.success('Subscription defaults saved');
      qc.invalidateQueries({ queryKey: ['platform_settings', 'subscription'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to save'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription Defaults</CardTitle>
        <CardDescription>
          Global trial length and promotional discount applied to new checkouts.
          Pick a saved discount or create a one-off — Stripe coupons are managed automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Default trial (days)</Label>
          <Input
            type="number"
            min={0}
            value={trialDays}
            onChange={(e) => setTrialDays(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Use saved discount</Label>
          <Select value={presetId} onValueChange={setPresetId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="custom">Custom (one-off)</SelectItem>
              {(presets || []).map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} — {p.percent}% ({p.duration})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Global discount (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={discountPercent}
            disabled={usingPreset}
            onChange={(e) => setDiscountPercent(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Discount expires</Label>
          <Input
            type="date"
            value={discountExpires}
            disabled={usingPreset}
            onChange={(e) => setDiscountExpires(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Duration</Label>
          <Select
            value={duration}
            onValueChange={(v) => setDuration(v as any)}
            disabled={!!usingPreset}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="once">Once (first invoice)</SelectItem>
              <SelectItem value="repeating">Repeating (N months)</SelectItem>
              <SelectItem value="forever">Forever</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {duration === 'repeating' && (
          <div className="space-y-2">
            <Label>Repeat for (months)</Label>
            <Input
              type="number"
              min={1}
              value={durationMonths}
              disabled={!!usingPreset}
              onChange={(e) => setDurationMonths(e.target.value)}
            />
          </div>
        )}
        <div className="space-y-2 md:col-span-2">
          <Label>Stripe coupon</Label>
          <div className="text-sm text-muted-foreground px-3 py-2 border rounded-md bg-muted/30 font-mono truncate">
            {couponId ? couponId : 'Auto-managed — created on save'}
          </div>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Internal note</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="md:col-span-2 flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save defaults'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


// ============ Extend Trial ============
export function ExtendTrialDialog({
  open, onOpenChange, sub, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sub: any;
  onDone: () => void;
}) {
  const currentEnd = sub?.current_period_end ? new Date(sub.current_period_end) : new Date();
  const [mode, setMode] = useState<'days' | 'date'>('days');
  const [days, setDays] = useState('14');
  const [date, setDate] = useState(format(addDays(currentEnd, 14), 'yyyy-MM-dd'));

  const submit = useMutation({
    mutationFn: async () => {
      const newEnd = mode === 'days'
        ? addDays(currentEnd, Number(days) || 0)
        : new Date(date);
      await callAdmin({
        action: 'extend-trial',
        organization_id: sub.organization_id,
        new_trial_end: newEnd.toISOString(),
      });
    },
    onSuccess: () => {
      toast.success('Trial extended');
      onDone();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Extend trial</DialogTitle>
          <DialogDescription>
            {sub?.organization_name} — current end{' '}
            {sub?.current_period_end
              ? format(new Date(sub.current_period_end), 'MMM d, yyyy')
              : '—'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={mode} onValueChange={(v) => setMode(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="days">Extend by days</SelectItem>
              <SelectItem value="date">Set exact date</SelectItem>
            </SelectContent>
          </Select>
          {mode === 'days' ? (
            <div className="space-y-1">
              <Label>Additional days</Label>
              <Input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} />
            </div>
          ) : (
            <div className="space-y-1">
              <Label>New trial end date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
            {submit.isPending ? 'Extending…' : 'Extend trial'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Override Subscription ============
export function OverrideSubscriptionDialog({
  open, onOpenChange, sub, plans, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sub: any;
  plans: any[];
  onDone: () => void;
}) {
  const [planId, setPlanId] = useState<string>('');
  const [status, setStatus] = useState<string>('active');
  const [billingCycle, setBillingCycle] = useState<string>('monthly');
  const [periodEnd, setPeriodEnd] = useState<string>('');
  const [customPrice, setCustomPrice] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (!open || !sub) return;
    setPlanId(sub.plan_id || '');
    setStatus(sub.status || 'active');
    setBillingCycle(sub.billing_cycle || 'monthly');
    setPeriodEnd(sub.current_period_end ? String(sub.current_period_end).slice(0, 10) : '');
    setCustomPrice(sub.custom_price != null ? String(sub.custom_price) : '');
    setNotes(sub.admin_notes || '');
  }, [open, sub]);

  const submit = useMutation({
    mutationFn: async () => {
      await callAdmin({
        action: 'override',
        organization_id: sub.organization_id,
        plan_id: planId || null,
        status,
        billing_cycle: billingCycle,
        current_period_end: periodEnd ? new Date(periodEnd).toISOString() : null,
        custom_price: customPrice === '' ? null : Number(customPrice),
        admin_notes: notes || null,
      });
    },
    onSuccess: () => {
      toast.success('Subscription overridden');
      onDone();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Override subscription</DialogTitle>
          <DialogDescription>
            {sub?.organization_name} — manually adjust plan, status and billing.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
              <SelectContent>
                {plans?.map((p) => {
                  const region = p.country_name || p.country?.name || (p.country_id ? p.country_id : 'Global');
                  const currency = p.currency || 'USD';
                  const price = p.price_monthly ?? p.monthly_price ?? p.price;
                  const priceLabel = price != null ? `${currency} ${Number(price).toFixed(2)}` : currency;
                  return (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {region} · {priceLabel}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trialing">Trialing</SelectItem>
                <SelectItem value="past_due">Past due</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
                <SelectItem value="incomplete">Incomplete</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Billing cycle</Label>
            <Select value={billingCycle} onValueChange={setBillingCycle}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Period end</Label>
            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Custom price (blank = plan price)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={customPrice}
              onChange={(e) => setCustomPrice(e.target.value)}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Admin notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
            {submit.isPending ? 'Saving…' : 'Save override'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Set Discount ============
export function SetDiscountDialog({
  open, onOpenChange, sub, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sub: any;
  onDone: () => void;
}) {
  const [presetId, setPresetId] = useState<string>('custom');
  const [percent, setPercent] = useState('');
  const [expires, setExpires] = useState('');
  const [duration, setDuration] = useState<'once' | 'repeating' | 'forever'>('forever');
  const [durationMonths, setDurationMonths] = useState('3');

  const { data: presets } = useQuery({
    queryKey: ['discount_presets', 'active'],
    queryFn: async () => {
      const { data } = await supabase
        .from('discount_presets')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open || !sub) return;
    setPresetId('custom');
    setPercent(sub.discount_percent != null ? String(sub.discount_percent) : '');
    setExpires(sub.discount_expires_at ? String(sub.discount_expires_at).slice(0, 10) : '');
    setDuration(sub.discount_expires_at ? 'once' : 'forever');
    setDurationMonths('3');
  }, [open, sub]);

  const usingPreset = presetId && presetId !== 'custom';
  const selectedPreset = (presets || []).find((p: any) => p.id === presetId);

  useEffect(() => {
    if (usingPreset && selectedPreset) {
      setPercent(String(selectedPreset.percent));
      setExpires(selectedPreset.expires_at ? String(selectedPreset.expires_at).slice(0, 10) : '');
      setDuration((selectedPreset.duration as any) || 'forever');
      setDurationMonths(String(selectedPreset.duration_in_months ?? 3));
    }
  }, [presetId, selectedPreset, usingPreset]);

  const submit = useMutation({
    mutationFn: async () => {
      await callAdmin({
        action: 'set-discount',
        organization_id: sub.organization_id,
        ...(usingPreset
          ? { preset_id: presetId }
          : {
              discount_percent: Number(percent) || 0,
              discount_expires_at: expires ? new Date(expires).toISOString() : null,
              duration,
              duration_in_months: duration === 'repeating' ? Number(durationMonths) : null,
            }),
      });
    },
    onSuccess: () => {
      toast.success('Discount updated');
      onDone();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  });

  const remove = useMutation({
    mutationFn: async () => {
      await callAdmin({
        action: 'set-discount',
        organization_id: sub.organization_id,
        discount_percent: 0,
        discount_expires_at: null,
      });
    },
    onSuccess: () => {
      toast.success('Discount removed');
      onDone();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  });


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set discount</DialogTitle>
          <DialogDescription>
            {sub?.organization_name} — pick a saved discount or set a one-off percent.
            Set percent to 0 or click Remove to fall back to the global discount.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Use saved discount</Label>
            <Select value={presetId} onValueChange={setPresetId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom (one-off)</SelectItem>
                {(presets || []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {p.percent}% ({p.duration})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Discount (%)</Label>
            <Input
              type="number" min={0} max={100}
              value={percent}
              disabled={usingPreset}
              onChange={(e) => setPercent(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Duration</Label>
            <Select
              value={duration}
              onValueChange={(v) => setDuration(v as any)}
              disabled={!!usingPreset}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="once">Once (first invoice)</SelectItem>
                <SelectItem value="repeating">Repeating (N months)</SelectItem>
                <SelectItem value="forever">Forever</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {duration === 'repeating' && (
            <div className="space-y-1">
              <Label>Repeat for (months)</Label>
              <Input
                type="number"
                min={1}
                value={durationMonths}
                disabled={!!usingPreset}
                onChange={(e) => setDurationMonths(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-1">
            <Label>Expires (optional)</Label>
            <Input
              type="date"
              value={expires}
              disabled={usingPreset}
              onChange={(e) => setExpires(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {(sub?.discount_percent > 0 || sub?.stripe_coupon_id) && (
            <Button
              variant="destructive"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              {remove.isPending ? 'Removing…' : 'Remove discount'}
            </Button>
          )}
          <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
            {submit.isPending ? 'Saving…' : 'Save discount'}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
