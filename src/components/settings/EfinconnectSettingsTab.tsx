import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Landmark, Send, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEfinconnectPreferences } from '@/hooks/useEfinconnectPreferences';
import type { RailId } from '@/config/countryTreasuryConfig';

export function EfinconnectSettingsTab() {
  const {
    prefs, config, isLoading, saving, save,
    railEnabled, sectionEnabled, authorityEnabled,
  } = useEfinconnectPreferences();

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  // Unique authority list from taxPayees
  const authorities = Array.from(new Set(config.taxPayees.map((p) => p.authority)));

  const sectionKeys: Array<{ key: 'bills' | 'transfers' | 'payments' | 'governance'; label: string; hint: string }> = [
    { key: 'bills',      label: 'Bills',                 hint: 'Pay bills and taxes' },
    { key: 'transfers',  label: 'Transfers',             hint: 'Move money between accounts and rails' },
    { key: 'payments',   label: 'Payments & Collections', hint: 'Payment links, connect payouts, scheduled' },
    { key: 'governance', label: 'Governance',            hint: 'Approvals, history and settings' },
  ];

  return (
    <div className="space-y-6">
      {/* Country profile */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" /> eFinconnect
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Payment rails and tax remittance targets follow your organization's country.
              Toggles below let you fine-tune what appears on the eFinconnect dashboard.
            </p>
          </div>
          <Badge variant="outline" className="gap-1">
            <Landmark className="h-3 w-3" /> {config.displayName} · {config.defaultCurrency}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          To change country, update <span className="font-medium">Organization → Country</span> in the Organization tab.
        </p>
      </Card>

      {/* Payment rails */}
      <Card className="p-6">
        <h3 className="text-base font-semibold mb-1">Payment rails</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Enable the rails your team uses. Disabled rails are hidden from payment run flows.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {config.rails.map((rail) => (
            <div
              key={rail.id}
              className="flex items-start justify-between gap-4 rounded-lg border p-4"
            >
              <div className="min-w-0">
                <Label className="text-sm font-medium">{rail.label}</Label>
                <p className="text-xs text-muted-foreground mt-1">{rail.description}</p>
                <p className="text-xs text-muted-foreground/80 mt-1">Delivery: {rail.deliveryEstimate}</p>
              </div>
              <Switch
                checked={railEnabled(rail.id)}
                disabled={saving}
                onCheckedChange={(v) => save({ rails: { [rail.id as RailId]: v } })}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Tax authorities */}
      <Card className="p-6">
        <h3 className="text-base font-semibold mb-1">Tax authorities & remittance targets</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Choose which authorities appear in the "Pay business taxes" cards on the eFinconnect dashboard.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {authorities.map((authority) => {
            const payees = config.taxPayees.filter((p) => p.authority === authority);
            return (
              <div key={authority} className="flex items-start justify-between gap-4 rounded-lg border p-4">
                <div className="min-w-0">
                  <Label className="text-sm font-medium">{authority}</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {payees.map((p) => p.label).join(' · ')}
                  </p>
                </div>
                <Switch
                  checked={authorityEnabled(authority)}
                  disabled={saving}
                  onCheckedChange={(v) => save({ taxAuthorities: { [authority]: v } })}
                />
              </div>
            );
          })}
          {authorities.length === 0 && (
            <p className="text-sm text-muted-foreground">No tax payees configured for {config.displayName}.</p>
          )}
        </div>
      </Card>

      {/* Dashboard sections */}
      <Card className="p-6">
        <h3 className="text-base font-semibold mb-1">Dashboard sections</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Show or hide entire sections on the eFinconnect dashboard.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {sectionKeys.map((s) => (
            <div key={s.key} className="flex items-start justify-between gap-4 rounded-lg border p-4">
              <div>
                <Label className="text-sm font-medium">{s.label}</Label>
                <p className="text-xs text-muted-foreground mt-1">{s.hint}</p>
              </div>
              <Switch
                checked={sectionEnabled(s.key)}
                disabled={saving}
                onCheckedChange={(v) => save({ sections: { [s.key]: v } })}
              />
            </div>
          ))}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button asChild variant="outline">
          <Link to="/treasury">
            Open eFinconnect <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default EfinconnectSettingsTab;
