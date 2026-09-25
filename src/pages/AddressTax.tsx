/**
 * Phase 12 — Address-tax & nexus management page
 * Route: /tax/address-tax
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, MapPin, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTaxProviderSettings, useNexusRegistrations, useEconomicNexusTracker, useAddressTax } from '@/hooks/useAddressTax';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
];

export default function AddressTax() {
  const isReadOnly = useIsReadOnly();
  const { settings, upsert: saveSettings } = useTaxProviderSettings();
  const { registrations, upsert: saveNexus, remove: removeNexus } = useNexusRegistrations();
  const tracker = useEconomicNexusTracker();
  const { calculate, validate } = useAddressTax();

  const [provider, setProvider] = useState(settings?.provider ?? 'none');
  const [environment, setEnvironment] = useState(settings?.environment ?? 'sandbox');
  const [companyCode, setCompanyCode] = useState(settings?.company_code ?? '');
  const [autoCalc, setAutoCalc] = useState(settings?.auto_calculate_on_invoice ?? false);
  const [autoValidate, setAutoValidate] = useState(settings?.auto_validate_addresses ?? true);

  // Test calc
  const [testZip, setTestZip] = useState('');
  const [testState, setTestState] = useState('CA');
  const [testAmount, setTestAmount] = useState('100');

  return (
    <div className="container py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MapPin className="h-7 w-7" /> Real-Time Address Tax
        </h1>
        <p className="text-muted-foreground mt-1">
          Live sales-tax rates per ship-to address via Avalara or TaxJar, with U.S. nexus tracking.
        </p>
      </div>

      <Tabs defaultValue="provider">
        <TabsList>
          <TabsTrigger value="provider">Provider</TabsTrigger>
          <TabsTrigger value="nexus">Nexus Registrations</TabsTrigger>
          <TabsTrigger value="tracker">Economic Nexus</TabsTrigger>
          <TabsTrigger value="test">Test Calculator</TabsTrigger>
        </TabsList>

        {/* Provider settings */}
        <TabsContent value="provider" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tax Rate Provider</CardTitle>
              <CardDescription>
                Connect Avalara AvaTax or TaxJar for jurisdiction-accurate rate lookups. API keys
                are stored as backend secrets.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Provider</Label>
                  <Select value={provider} onValueChange={(v) => setProvider(v as typeof provider)} disabled={isReadOnly}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (manual rates)</SelectItem>
                      <SelectItem value="avalara">Avalara AvaTax</SelectItem>
                      <SelectItem value="taxjar">TaxJar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Environment</Label>
                  <Select value={environment} onValueChange={(v) => setEnvironment(v as typeof environment)} disabled={isReadOnly}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">Sandbox</SelectItem>
                      <SelectItem value="production">Production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {provider === 'avalara' && (
                  <div className="md:col-span-2">
                    <Label>Avalara Company Code</Label>
                    <Input value={companyCode} onChange={(e) => setCompanyCode(e.target.value)} placeholder="DEFAULT" disabled={isReadOnly} />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <div>
                  <Label>Auto-calculate on invoice</Label>
                  <p className="text-sm text-muted-foreground">Recalculate tax when ship-to address changes.</p>
                </div>
                <Switch checked={autoCalc} onCheckedChange={setAutoCalc} disabled={isReadOnly} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-validate addresses</Label>
                  <p className="text-sm text-muted-foreground">Normalize ship-to addresses before tax lookup.</p>
                </div>
                <Switch checked={autoValidate} onCheckedChange={setAutoValidate} disabled={isReadOnly} />
              </div>

              {provider !== 'none' && (
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <p className="font-medium mb-1">Required backend secrets</p>
                  {provider === 'avalara' ? (
                    <p>Add <code>AVALARA_ACCOUNT_ID</code> and <code>AVALARA_LICENSE_KEY</code> to enable submissions.</p>
                  ) : (
                    <p>Add <code>TAXJAR_API_KEY</code> to enable submissions.</p>
                  )}
                </div>
              )}

              <Button
                onClick={() => saveSettings.mutate({
                  provider: provider as 'avalara' | 'taxjar' | 'none',
                  environment: environment as 'sandbox' | 'production',
                  company_code: companyCode || undefined,
                  auto_calculate_on_invoice: autoCalc,
                  auto_validate_addresses: autoValidate,
                })}
                disabled={isReadOnly || saveSettings.isPending}
              >
                Save Provider Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Nexus registrations */}
        <TabsContent value="nexus" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>State Nexus Registrations</CardTitle>
                <CardDescription>States where you're registered to collect sales tax.</CardDescription>
              </div>
              {!isReadOnly && <NexusDialog onSave={(p) => saveNexus.mutate(p)} />}
            </CardHeader>
            <CardContent>
              {registrations.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No nexus registrations yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>State</TableHead>
                      <TableHead>Reg #</TableHead>
                      <TableHead>Effective</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Status</TableHead>
                      {!isReadOnly && <TableHead></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registrations.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.region_code}</TableCell>
                        <TableCell>{r.registration_number ?? '—'}</TableCell>
                        <TableCell>{format(parseLocalDate(r.effective_date), 'PP')}</TableCell>
                        <TableCell className="capitalize">{r.filing_frequency ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={r.is_active ? 'default' : 'secondary'}>
                            {r.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        {!isReadOnly && (
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => removeNexus.mutate(r.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Economic nexus tracker */}
        <TabsContent value="tracker" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Economic Nexus Tracker</CardTitle>
              <CardDescription>
                Rolling 12-month sales by state. Crossing a state's threshold typically triggers a registration requirement.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(tracker.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No tracker data yet. Records appear as invoices are posted with US ship-to addresses.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>State</TableHead>
                      <TableHead>12-Month Sales</TableHead>
                      <TableHead>Transactions</TableHead>
                      <TableHead>Threshold</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(tracker.data ?? []).map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.region_code}</TableCell>
                        <TableCell>${Number(t.sales_amount).toLocaleString()}</TableCell>
                        <TableCell>{t.transaction_count}</TableCell>
                        <TableCell>
                          {t.threshold_amount ? `$${Number(t.threshold_amount).toLocaleString()}` : '—'}
                          {t.threshold_transactions ? ` / ${t.threshold_transactions} tx` : ''}
                        </TableCell>
                        <TableCell>
                          {t.threshold_crossed ? (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="h-3 w-3" /> Threshold crossed
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Below
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test calculator */}
        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Tax Calculator</CardTitle>
              <CardDescription>Verify your provider integration with a one-line ship-to lookup.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Ship-to State</Label>
                  <Select value={testState} onValueChange={setTestState}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Ship-to ZIP</Label>
                  <Input value={testZip} onChange={(e) => setTestZip(e.target.value)} placeholder="94103" />
                </div>
                <div>
                  <Label>Sale amount (USD)</Label>
                  <Input type="number" value={testAmount} onChange={(e) => setTestAmount(e.target.value)} />
                </div>
              </div>
              <Button
                onClick={() => {
                  const orgId = settings?.organization_id;
                  if (!orgId || !testZip) return;
                  calculate.mutate({
                    organizationId: orgId,
                    origin: { region: testState, postalCode: testZip, countryCode: 'US' },
                    destination: { region: testState, postalCode: testZip, countryCode: 'US' },
                    lines: [{ id: '1', amount: Number(testAmount) }],
                    currency: 'USD',
                  });
                }}
                disabled={!testZip || calculate.isPending || provider === 'none'}
              >
                {calculate.isPending ? 'Calculating…' : 'Calculate Tax'}
              </Button>

              {calculate.data && (
                <div className="border rounded-md p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Provider</span>
                    <span className="font-medium capitalize">{calculate.data.provider}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Effective rate</span>
                    <span className="font-medium">{(calculate.data.effectiveRate * 100).toFixed(3)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total tax</span>
                    <span className="font-bold text-lg">${calculate.data.totalTax.toFixed(2)}</span>
                  </div>
                  {calculate.data.jurisdictions.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-sm font-medium mb-2">Jurisdiction breakdown</p>
                      {calculate.data.jurisdictions.map((j, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span>{j.jurisdiction} <span className="text-muted-foreground">({j.type})</span></span>
                          <span>{(j.rate * 100).toFixed(3)}% — ${j.taxAmount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {calculate.data.cacheHit && (
                    <Badge variant="secondary" className="mt-2">Served from cache</Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NexusDialog({ onSave }: { onSave: (p: {
  region_code: string;
  registration_number?: string;
  effective_date: string;
  filing_frequency?: 'monthly' | 'quarterly' | 'annually';
  economic_nexus_threshold_amount?: number;
  economic_nexus_threshold_transactions?: number;
  is_active?: boolean;
}) => void }) {
  const [open, setOpen] = useState(false);
  const [region, setRegion] = useState('CA');
  const [regNo, setRegNo] = useState('');
  const [effDate, setEffDate] = useState(new Date().toISOString().slice(0, 10));
  const [freq, setFreq] = useState<'monthly' | 'quarterly' | 'annually'>('quarterly');
  const [thresholdAmt, setThresholdAmt] = useState('100000');
  const [thresholdTx, setThresholdTx] = useState('200');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-1" /> Add State</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Nexus Registration</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>State</Label>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Registration #</Label>
            <Input value={regNo} onChange={(e) => setRegNo(e.target.value)} />
          </div>
          <div>
            <Label>Effective Date</Label>
            <Input type="date" value={effDate} onChange={(e) => setEffDate(e.target.value)} />
          </div>
          <div>
            <Label>Filing Frequency</Label>
            <Select value={freq} onValueChange={(v) => setFreq(v as typeof freq)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="annually">Annually</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Economic threshold ($)</Label>
              <Input type="number" value={thresholdAmt} onChange={(e) => setThresholdAmt(e.target.value)} />
            </div>
            <div>
              <Label>Threshold (txns)</Label>
              <Input type="number" value={thresholdTx} onChange={(e) => setThresholdTx(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => {
            onSave({
              region_code: region,
              registration_number: regNo || undefined,
              effective_date: effDate,
              filing_frequency: freq,
              economic_nexus_threshold_amount: Number(thresholdAmt) || undefined,
              economic_nexus_threshold_transactions: Number(thresholdTx) || undefined,
              is_active: true,
            });
            setOpen(false);
          }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
