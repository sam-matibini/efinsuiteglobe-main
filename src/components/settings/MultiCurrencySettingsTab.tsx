import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Lock, RefreshCw, Plus, Coins } from 'lucide-react';
import { useMultiCurrencySettings, useFxRateSync } from '@/hooks/useMultiCurrencySettings';
import { useCurrencies } from '@/hooks/useCurrencies';
import { FxAccountsPicker } from '@/components/currency/FxAccountsPicker';
import { EnableMultiCurrencyDialog } from '@/components/currency/EnableMultiCurrencyDialog';
import { Link } from 'react-router-dom';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';

const COMMON_CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'JPY', 'CNY', 'INR', 'CHF', 'MXN'];

export function MultiCurrencySettingsTab() {
  const isReadOnly = useIsReadOnly();
  const { settings, isLoading, updateSettings, enableAndLock } = useMultiCurrencySettings();
  const { currencies, activeCurrencies, baseCurrency, createCurrency, updateCurrency, initializeDefaultCurrencies } = useCurrencies();
  const fxSync = useFxRateSync();

  const [enableDialogOpen, setEnableDialogOpen] = useState(false);
  const [newCurrency, setNewCurrency] = useState({ code: '', name: '', symbol: '', decimal_places: 2 });

  if (isLoading) return <Card className="p-6">Loading multi-currency settings…</Card>;

  const enabled = !!settings?.multi_currency_enabled;
  const locked = !!settings?.base_currency_locked_at;

  const handleToggle = (next: boolean) => {
    if (next && !locked) {
      setEnableDialogOpen(true);
    } else if (!next && enabled) {
      // allow disabling but warn
      updateSettings.mutate({ multi_currency_enabled: false });
    }
  };

  return (
    <div className="space-y-6">
      {/* Master toggle */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Coins className="w-5 h-5 text-primary" />
              Multi-Currency Engine
            </h2>
            <p className="text-sm text-muted-foreground">
              Record transactions in foreign currencies and translate them to your base currency for reporting.
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={handleToggle} disabled={isReadOnly} />
        </div>

        {enabled && (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2">
                Base Currency
                {locked && <Lock className="w-3 h-3 text-muted-foreground" />}
              </Label>
              <Input value={settings?.base_currency || ''} disabled />
              {locked && (
                <p className="text-xs text-muted-foreground">
                  Locked on {new Date(settings!.base_currency_locked_at!).toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Reporting Currency</Label>
              <Select
                value={settings?.reporting_currency || settings?.base_currency || ''}
                onValueChange={(v) => updateSettings.mutate({ reporting_currency: v })}
                disabled={isReadOnly}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMMON_CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Used for consolidated reporting (often same as base).</p>
            </div>
          </div>
        )}
      </Card>

      {enabled && (
        <>
          {/* FX GL Accounts */}
          <Card className="p-6">
            <h3 className="text-base font-semibold mb-1">FX General Ledger Accounts</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Map foreign-exchange gain/loss accounts. Create them in your Chart of Accounts first if missing.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <FxAccountsPicker
                label="Realized FX Gain/Loss"
                value={settings?.realized_fx_account_id || null}
                onChange={(id) => updateSettings.mutate({ realized_fx_account_id: id })}
                accountType="income"
                hint="Posted on payment of foreign invoices/bills"
                disabled={isReadOnly}
              />
              <FxAccountsPicker
                label="Unrealized FX Gain/Loss"
                value={settings?.unrealized_fx_account_id || null}
                onChange={(id) => updateSettings.mutate({ unrealized_fx_account_id: id })}
                accountType="income"
                hint="Posted at period-end revaluation"
                disabled={isReadOnly}
              />
              <FxAccountsPicker
                label="Cumulative Translation Adjustment (CTA)"
                value={settings?.cta_account_id || null}
                onChange={(id) => updateSettings.mutate({ cta_account_id: id })}
                accountType="equity"
                hint="Equity plug for statement translation"
                disabled={isReadOnly}
              />
            </div>
            <div className="mt-4">
              <Button asChild variant="outline" size="sm">
                <Link to="/accounts">Open Chart of Accounts →</Link>
              </Button>
            </div>
          </Card>

          {/* Currency Master List */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold">Currency Master List</h3>
                <p className="text-sm text-muted-foreground">Currencies you transact in.</p>
              </div>
              {currencies.length === 0 && (
                <Button onClick={() => initializeDefaultCurrencies.mutate()} variant="outline" size="sm" disabled={isReadOnly}>
                  Initialize Defaults
                </Button>
              )}
            </div>

            {currencies.length > 0 && (
              <div className="space-y-2">
                {currencies.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-md border p-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-semibold w-12">{c.code}</span>
                      <span className="text-muted-foreground">{c.symbol}</span>
                      <span>{c.name}</span>
                      {c.is_base && <Badge variant="secondary">Base</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Active</Label>
                      <Switch
                        checked={c.is_active}
                        onCheckedChange={(v) => updateCurrency.mutate({ id: c.id, is_active: v })}
                        disabled={isReadOnly}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Separator className="my-4" />

            <div className="grid gap-2 sm:grid-cols-5">
              <Input placeholder="Code (USD)" value={newCurrency.code} onChange={(e) => setNewCurrency({ ...newCurrency, code: e.target.value.toUpperCase() })} maxLength={3} disabled={isReadOnly} />
              <Input placeholder="Name" value={newCurrency.name} onChange={(e) => setNewCurrency({ ...newCurrency, name: e.target.value })} className="sm:col-span-2" disabled={isReadOnly} />
              <Input placeholder="Symbol" value={newCurrency.symbol} onChange={(e) => setNewCurrency({ ...newCurrency, symbol: e.target.value })} disabled={isReadOnly} />
              <Button
                onClick={() => {
                  if (!newCurrency.code || !newCurrency.name) return;
                  createCurrency.mutate(newCurrency, {
                    onSuccess: () => setNewCurrency({ code: '', name: '', symbol: '', decimal_places: 2 }),
                  });
                }}
                disabled={isReadOnly}
              >
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
          </Card>

          {/* Exchange Rate Source */}
          <Card className="p-6">
            <h3 className="text-base font-semibold mb-4">Exchange Rate Source</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Select
                  value={settings?.fx_rate_source}
                  onValueChange={(v) => updateSettings.mutate({ fx_rate_source: v as 'manual' | 'automated' })}
                  disabled={isReadOnly}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual entry</SelectItem>
                    <SelectItem value="automated">Automated (open.er-api.com)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Update Frequency</Label>
                <Select
                  value={settings?.fx_rate_sync_frequency}
                  onValueChange={(v) => updateSettings.mutate({ fx_rate_sync_frequency: v as 'daily' | 'hourly' })}
                  disabled={isReadOnly || settings?.fx_rate_source !== 'automated'}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Manual Refresh</Label>
                <Button onClick={() => fxSync.mutate()} disabled={fxSync.isPending || isReadOnly} className="w-full">
                  <RefreshCw className={`w-4 h-4 mr-2 ${fxSync.isPending ? 'animate-spin' : ''}`} />
                  Sync Rates Now
                </Button>
              </div>
            </div>

            <div className="mt-4">
              <Button asChild variant="outline" size="sm">
                <Link to="/exchange-rates">Manage Exchange Rates →</Link>
              </Button>
            </div>
          </Card>
        </>
      )}

      <EnableMultiCurrencyDialog
        open={enableDialogOpen}
        onOpenChange={setEnableDialogOpen}
        defaultBase={settings?.base_currency || 'USD'}
        onConfirm={(base) => {
          enableAndLock.mutate(base);
          setEnableDialogOpen(false);
        }}
      />
    </div>
  );
}
