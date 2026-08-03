import { useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Globe2, Link2, Plus, Save, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useStripeConnectedAccounts } from '@/hooks/useStripeConnectedAccounts';
import { useWisePayouts, useVendorPayoutRouting } from '@/hooks/useWisePayouts';
import StripeConnectedAccounts from './StripeConnectedAccounts';
import StripeConnectCompliance from './StripeConnectCompliance';

const TABS = ['providers', 'vendors', 'accounts', 'compliance'] as const;

export default function PayoutRouting() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS as readonly string[]).includes(params.get('tab') ?? '')
    ? (params.get('tab') as string)
    : 'providers';

  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? null;
  const { accounts: stripeAccounts } = useStripeConnectedAccounts(orgId);
  const { recipients, saveRecipient, transfers } = useWisePayouts();
  const { routing, upsert } = useVendorPayoutRouting();

  const vendors = useQuery({
    queryKey: ['vendors-for-payout-routing', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name')
        .eq('organization_id', orgId!)
        .order('name')
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const routingByVendor = useMemo(
    () => Object.fromEntries(routing.map((r) => [r.vendor_id, r])),
    [routing],
  );

  const [draft, setDraft] = useState<Record<string, { provider: string; target: string; method: string }>>({});
  const rowValue = (vendorId: string) => {
    const existing = routingByVendor[vendorId];
    return (
      draft[vendorId] ?? {
        provider: existing?.payout_provider ?? 'stripe',
        target: existing?.wise_recipient_id ?? existing?.stripe_connected_account_id ?? '',
        method: existing?.default_payout_method ?? 'eft',
      }
    );
  };
  const setRow = (vendorId: string, patch: Partial<{ provider: string; target: string; method: string }>) =>
    setDraft((d) => ({ ...d, [vendorId]: { ...rowValue(vendorId), ...patch } }));

  const [vendorSearch, setVendorSearch] = useState('');
  const filteredVendors = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    const list = (vendors.data ?? []) as Array<{ id: string; name: string }>;
    return q ? list.filter((v) => v.name?.toLowerCase().includes(q)) : list;
  }, [vendors.data, vendorSearch]);

  const [vendorOpen, setVendorOpen] = useState(false);
  const [savingVendor, setSavingVendor] = useState(false);
  const [newVendor, setNewVendor] = useState({ name: '', email: '', phone: '', default_currency: 'CAD' });

  const addVendor = async () => {
    if (!orgId || !newVendor.name.trim()) return;
    setSavingVendor(true);
    const { error } = await supabase.from('vendors').insert({
      organization_id: orgId,
      name: newVendor.name.trim(),
      email: newVendor.email || null,
      phone: newVendor.phone || null,
      default_currency: newVendor.default_currency || null,
    });
    setSavingVendor(false);
    if (error) { toast.error(`Could not add vendor: ${error.message}`); return; }
    toast.success('Vendor added');
    setNewVendor({ name: '', email: '', phone: '', default_currency: 'CAD' });
    setVendorOpen(false);
    vendors.refetch();
  };

  const saveRow = (vendorId: string, row: { provider: string; target: string; method: string }) =>
    upsert.mutate({
      vendor_id: vendorId,
      payout_provider: row.provider as 'wise' | 'stripe' | 'efinmoney',
      wise_recipient_id: row.provider === 'wise' ? row.target || null : null,
      stripe_connected_account_id: row.provider === 'stripe' ? row.target || null : null,
      wallet_id: row.provider === 'efinmoney' ? row.target || null : null,
      default_payout_method: row.method,
    });

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState({ provider: 'wise', target: '', method: 'eft' });
  const applyBulk = () => {
    filteredVendors.forEach((v) => saveRow(v.id, bulk));
    setBulkOpen(false);
  };


  const [newRecipient, setNewRecipient] = useState({
    account_holder_name: '',
    currency: 'CAD',
    bank_name: '',
    account_number: '',
    routing_number: '',
    iban: '',
    etransfer_email: '',
  });
  const [recipientOpen, setRecipientOpen] = useState(false);

  const wiseConnected = recipients.some((r) => !!r.wise_recipient_id) || recipients.length > 0;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Payout Routing</h1>
        <p className="text-muted-foreground">
          Choose how each vendor and payout is sent — Wise or Stripe — and manage connected accounts and compliance.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="vendors">Vendor routing</TabsTrigger>
          <TabsTrigger value="accounts">Stripe accounts</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe2 className="h-5 w-5 text-emerald-500" /> Wise
                  <Badge variant={wiseConnected ? 'default' : 'secondary'}>
                    {wiseConnected ? 'Active' : 'Not configured'}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Payout partner for EFT, e-Transfer, card payouts and payment links — multi-currency, low FX spread.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  {recipients.length} saved recipient{recipients.length === 1 ? '' : 's'} ·{' '}
                  {transfers.length} transfer{transfers.length === 1 ? '' : 's'} recorded
                </div>
                <div className="flex gap-2">
                  <Dialog open={recipientOpen} onOpenChange={setRecipientOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add recipient</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>New Wise payout recipient</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div><Label>Account holder</Label>
                          <Input value={newRecipient.account_holder_name} onChange={(e) => setNewRecipient({ ...newRecipient, account_holder_name: e.target.value })} /></div>
                        <div className="grid grid-cols-2 gap-2">
                          <div><Label>Currency</Label>
                            <Input value={newRecipient.currency} onChange={(e) => setNewRecipient({ ...newRecipient, currency: e.target.value.toUpperCase() })} /></div>
                          <div><Label>Bank name</Label>
                            <Input value={newRecipient.bank_name} onChange={(e) => setNewRecipient({ ...newRecipient, bank_name: e.target.value })} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div><Label>Account number</Label>
                            <Input value={newRecipient.account_number} onChange={(e) => setNewRecipient({ ...newRecipient, account_number: e.target.value })} /></div>
                          <div><Label>Routing / transit</Label>
                            <Input value={newRecipient.routing_number} onChange={(e) => setNewRecipient({ ...newRecipient, routing_number: e.target.value })} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div><Label>IBAN (optional)</Label>
                            <Input value={newRecipient.iban} onChange={(e) => setNewRecipient({ ...newRecipient, iban: e.target.value })} /></div>
                          <div><Label>e-Transfer email</Label>
                            <Input value={newRecipient.etransfer_email} onChange={(e) => setNewRecipient({ ...newRecipient, etransfer_email: e.target.value })} /></div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setRecipientOpen(false)}>Cancel</Button>
                        <Button
                          disabled={!newRecipient.account_holder_name || saveRecipient.isPending}
                          onClick={async () => {
                            await saveRecipient.mutateAsync(newRecipient);
                            setRecipientOpen(false);
                          }}
                        >
                          Save recipient
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button size="sm" variant="outline" asChild>
                    <a href="https://wise.com/your-account/" target="_blank" rel="noopener noreferrer">Open Wise</a>
                  </Button>
                </div>

                {recipients.length > 0 && (
                  <div className="border rounded divide-y text-sm">
                    {recipients.slice(0, 5).map((r) => (
                      <div key={r.id} className="p-2 flex items-center justify-between">
                        <span>{r.account_holder_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {r.currency}{r.wise_recipient_id ? ' · synced' : ' · local'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-indigo-500" /> Stripe Connect
                  <Badge variant={stripeAccounts.length ? 'default' : 'secondary'}>
                    {stripeAccounts.length ? 'Active' : 'Not configured'}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Card acquiring and connected-account transfers for vendors and payroll.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  {stripeAccounts.length} connected account{stripeAccounts.length === 1 ? '' : 's'}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setParams({ tab: 'accounts' })}>
                    Manage accounts
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setParams({ tab: 'compliance' })}>
                    <ShieldCheck className="h-4 w-4 mr-1" /> Compliance
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="vendors" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Vendor payout routing</CardTitle>
              <CardDescription>Send each vendor's payouts through Wise, Stripe or an eFinMoney wallet.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[200px]">
                  <Label>Search vendors</Label>
                  <Input
                    placeholder="Search by vendor name…"
                    value={vendorSearch}
                    onChange={(e) => setVendorSearch(e.target.value)}
                  />
                </div>

                <Dialog open={vendorOpen} onOpenChange={setVendorOpen}>
                  <DialogTrigger asChild>
                    <Button><Plus className="h-4 w-4 mr-1" /> Add vendor</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>New vendor</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div><Label>Vendor name</Label>
                        <Input value={newVendor.name} onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })} /></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label>Email</Label>
                          <Input type="email" value={newVendor.email} onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })} /></div>
                        <div><Label>Phone</Label>
                          <Input value={newVendor.phone} onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })} /></div>
                      </div>
                      <div className="w-40"><Label>Default currency</Label>
                        <Input value={newVendor.default_currency} onChange={(e) => setNewVendor({ ...newVendor, default_currency: e.target.value.toUpperCase() })} /></div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setVendorOpen(false)}>Cancel</Button>
                      <Button disabled={!newVendor.name.trim() || savingVendor} onClick={addVendor}>Create vendor</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" disabled={filteredVendors.length === 0}>
                      Bulk assign ({filteredVendors.length})
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Bulk assign payout routing</DialogTitle></DialogHeader>
                    <p className="text-sm text-muted-foreground">
                      Applies to all {filteredVendors.length} vendor{filteredVendors.length === 1 ? '' : 's'} currently listed.
                    </p>
                    <div className="space-y-3">
                      <div>
                        <Label>Provider</Label>
                        <Select value={bulk.provider} onValueChange={(v) => setBulk({ ...bulk, provider: v, target: '' })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="wise">Wise</SelectItem>
                            <SelectItem value="stripe">Stripe</SelectItem>
                            <SelectItem value="efinmoney">eFinMoney wallet</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Destination</Label>
                        {bulk.provider === 'efinmoney' ? (
                          <Input placeholder="Wallet ID" value={bulk.target} onChange={(e) => setBulk({ ...bulk, target: e.target.value })} />
                        ) : (
                          <Select value={bulk.target} onValueChange={(v) => setBulk({ ...bulk, target: v })}>
                            <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                            <SelectContent>
                              {bulk.provider === 'wise'
                                ? recipients.map((r) => (
                                    <SelectItem key={r.id} value={r.id}>{r.account_holder_name} · {r.currency}</SelectItem>
                                  ))
                                : stripeAccounts.map((a: { id: string; stripe_account_id: string }) => (
                                    <SelectItem key={a.id} value={a.id}>{a.stripe_account_id}</SelectItem>
                                  ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <div>
                        <Label>Method</Label>
                        <Select value={bulk.method} onValueChange={(v) => setBulk({ ...bulk, method: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="eft">EFT</SelectItem>
                            <SelectItem value="etransfer">e-Transfer</SelectItem>
                            <SelectItem value="card">Card</SelectItem>
                            <SelectItem value="wallet">Wallet</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
                      <Button onClick={applyBulk}>Apply to {filteredVendors.length}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVendors.map((v: { id: string; name: string }) => {
                    const row = rowValue(v.id);
                    return (
                      <TableRow key={v.id}>
                        <TableCell>{v.name}</TableCell>
                        <TableCell>
                          <Select value={row.provider} onValueChange={(val) => setRow(v.id, { provider: val, target: '' })}>
                            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="wise">Wise</SelectItem>
                              <SelectItem value="stripe">Stripe</SelectItem>
                              <SelectItem value="efinmoney">eFinMoney</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {row.provider === 'efinmoney' ? (
                            <Input
                              className="w-56"
                              placeholder="Wallet ID"
                              value={row.target}
                              onChange={(e) => setRow(v.id, { target: e.target.value })}
                            />
                          ) : (
                            <Select value={row.target} onValueChange={(val) => setRow(v.id, { target: val })}>
                              <SelectTrigger className="w-56"><SelectValue placeholder="Select destination" /></SelectTrigger>
                              <SelectContent>
                                {row.provider === 'wise'
                                  ? recipients.map((r) => (
                                      <SelectItem key={r.id} value={r.id}>{r.account_holder_name} · {r.currency}</SelectItem>
                                    ))
                                  : stripeAccounts.map((a: { id: string; stripe_account_id: string }) => (
                                      <SelectItem key={a.id} value={a.id}>{a.stripe_account_id}</SelectItem>
                                    ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select value={row.method} onValueChange={(val) => setRow(v.id, { method: val })}>
                            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="eft">EFT</SelectItem>
                              <SelectItem value="etransfer">e-Transfer</SelectItem>
                              <SelectItem value="card">Card</SelectItem>
                              <SelectItem value="wallet">Wallet</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => saveRow(v.id, row)}>
                            <Save className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredVendors.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                        {(vendors.data ?? []).length === 0 ? (
                          <>No vendors yet. Use <strong>Add vendor</strong> above or the{' '}
                            <Link className="underline" to="/purchases/vendors">Vendors page</Link>.</>
                        ) : 'No vendors match your search.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="accounts" className="pt-4">
          <StripeConnectedAccounts />
        </TabsContent>

        <TabsContent value="compliance" className="pt-4">
          <StripeConnectCompliance />
        </TabsContent>
      </Tabs>
    </div>
  );
}
