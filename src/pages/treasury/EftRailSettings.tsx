import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Cable, Info } from 'lucide-react';
import { useEftRails, type EftProvider } from '@/hooks/useEftRails';

export default function EftRailSettings() {
  const { settings, update } = useEftRails();
  const [local, setLocal] = useState(settings);
  useEffect(() => setLocal(settings), [settings]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">EFT Rail Settings</h1>
        <p className="text-muted-foreground">Choose which EFT processor is used for CRA, provincial and AP payments.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Cable className="h-5 w-5" /> Primary EFT provider</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Provider</Label>
            <Select value={local.eft_provider} onValueChange={(v) => setLocal((s) => ({ ...s, eft_provider: v as EftProvider }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="paysafe">Paysafe (default)</SelectItem>
                <SelectItem value="vopay" disabled>VoPay — needs credentials</SelectItem>
                <SelectItem value="telpay" disabled>Telpay — needs credentials</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Info className="h-3 w-3" /> VoPay and Telpay require API credentials. Ask support to enable them.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>VoPay daily cap (CAD)</Label>
              <Input type="number" value={local.vopay_daily_cap ?? ''} onChange={(e) => setLocal((s) => ({ ...s, vopay_daily_cap: e.target.value ? Number(e.target.value) : null }))} />
            </div>
            <div>
              <Label>Telpay daily cap (CAD)</Label>
              <Input type="number" value={local.telpay_daily_cap ?? ''} onChange={(e) => setLocal((s) => ({ ...s, telpay_daily_cap: e.target.value ? Number(e.target.value) : null }))} />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div>
              <Label>Allow Stripe payouts as funding source</Label>
              <p className="text-xs text-muted-foreground">When enabled, available Stripe balance can fund CRA remittances.</p>
            </div>
            <Switch
              checked={local.stripe_payout_funding_enabled}
              onCheckedChange={(v) => setLocal((s) => ({ ...s, stripe_payout_funding_enabled: v }))}
            />
          </div>

          <Button onClick={() => update.mutate(local)} disabled={update.isPending}>Save settings</Button>
        </CardContent>
      </Card>
    </div>
  );
}
