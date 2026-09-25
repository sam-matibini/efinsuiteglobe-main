import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RefreshCw, Wallet, Activity, ShieldCheck, Users, Link2, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useStripeConnectedAccounts } from '@/hooks/useStripeConnectedAccounts';
import { useConnectedAccountBalances } from '@/hooks/useConnectedAccountBalances';
import { useConnectedAccountActivity } from '@/hooks/useConnectedAccountActivity';
import { ConnectedAccountStatusBadge } from '@/components/treasury/ConnectedAccountStatusBadge';
import { LinkBankAccountDialog } from '@/components/treasury/LinkBankAccountDialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const fmt = (n: number, ccy: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: (ccy || 'USD').toUpperCase() }).format(n);

export default function StripeConnectedAccountDetail() {
  const { accountId } = useParams<{ accountId: string }>();
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? null;
  const { accounts, sync } = useStripeConnectedAccounts(orgId);
  const { balances, refresh } = useConnectedAccountBalances(orgId, accountId);
  const activity = useConnectedAccountActivity(accountId);
  const [linkOpen, setLinkOpen] = useState(false);

  const account = useMemo(() => accounts.find((a) => a.id === accountId), [accounts, accountId]);

  const persons = useQuery({
    queryKey: ['stripe-connect-persons', accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stripe_connected_account_persons' as any)
        .select('*')
        .eq('connected_account_id', accountId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const linkedBank = useQuery({
    queryKey: ['bank-link', accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_account_stripe_connect' as any)
        .select('*, bank_accounts:bank_account_id(name, currency)')
        .eq('connected_account_id', accountId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const payouts = useQuery({
    queryKey: ['stripe-payout-ledger', accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stripe_payout_ledger' as any)
        .select('*')
        .eq('connected_account_id', accountId!)
        .order('arrival_date', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const syncPayouts = async () => {
    const { error } = await supabase.functions.invoke('stripe-payout-sync', {
      body: { organization_id: orgId },
    });
    if (error) toast.error(error.message); else { toast.success('Payouts synced'); payouts.refetch(); }
  };

  if (!account) {
    return (
      <div className="p-6">
        <Button variant="ghost" asChild><Link to="/banking-payments/stripe-connect"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link></Button>
        <p className="mt-4 text-muted-foreground">Connected account not found.</p>
      </div>
    );
  }

  const reqs: any = account.requirements ?? {};

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link to="/banking-payments/stripe-connect"><ArrowLeft className="h-4 w-4 mr-1" /> All accounts</Link>
          </Button>
          <h1 className="text-2xl font-bold font-mono">{account.stripe_account_id}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="capitalize">{account.account_type}</span> · {account.country ?? '—'} · {(account.default_currency ?? '—').toUpperCase()}
            <ConnectedAccountStatusBadge account={account} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => sync.mutate(account.id)} disabled={sync.isPending}>
            <RefreshCw className={`h-4 w-4 mr-1 ${sync.isPending ? 'animate-spin' : ''}`} /> Refresh status
          </Button>
          <Button onClick={() => refresh.mutate({ connected_account_id: account.id })} disabled={refresh.isPending}>
            <Wallet className={`h-4 w-4 mr-1`} /> Refresh balance
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview"><Wallet className="h-4 w-4 mr-1" /> Overview</TabsTrigger>
          <TabsTrigger value="payouts"><Banknote className="h-4 w-4 mr-1" /> Payouts</TabsTrigger>
          <TabsTrigger value="activity"><Activity className="h-4 w-4 mr-1" /> Activity</TabsTrigger>
          <TabsTrigger value="requirements"><ShieldCheck className="h-4 w-4 mr-1" /> Requirements</TabsTrigger>
          <TabsTrigger value="persons"><Users className="h-4 w-4 mr-1" /> Persons</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Balances</CardTitle></CardHeader>
            <CardContent>
              {balances.length === 0 ? (
                <p className="text-sm text-muted-foreground">No snapshots yet. Click "Refresh balance".</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Currency</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right">Pending</TableHead>
                      <TableHead className="text-right">Reserved</TableHead>
                      <TableHead className="text-right">As of</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {balances.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="uppercase font-mono">{b.currency}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(Number(b.available_amount), b.currency)}</TableCell>
                        <TableCell className="text-right">{fmt(Number(b.pending_amount), b.currency)}</TableCell>
                        <TableCell className="text-right">{fmt(Number(b.reserved_amount), b.currency)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">{new Date(b.as_of).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Link2 className="h-4 w-4" /> Linked bank account</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setLinkOpen(true)}>
                {linkedBank.data ? 'Change link' : 'Link bank account'}
              </Button>
            </CardHeader>
            <CardContent>
              {linkedBank.data ? (
                <p className="text-sm">
                  {linkedBank.data.bank_accounts?.name ?? linkedBank.data.bank_account_id}
                  {linkedBank.data.bank_accounts?.currency && (
                    <span className="ml-2 text-xs text-muted-foreground">({linkedBank.data.bank_accounts.currency})</span>
                  )}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No internal bank account linked. Transfers will not auto-post to a bank account.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Capabilities</CardTitle></CardHeader>
            <CardContent className="space-x-2">
              {Object.entries(account.capabilities ?? {}).map(([k, v]) => (
                <Badge key={k} variant={v === 'active' ? 'default' : 'secondary'} className="capitalize">
                  {k}: {String(v)}
                </Badge>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Stripe payouts</CardTitle>
              <Button size="sm" variant="outline" onClick={syncPayouts}>
                <RefreshCw className="h-4 w-4 mr-1" /> Sync from Stripe
              </Button>
            </CardHeader>
            <CardContent>
              {(payouts.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No payouts synced yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Arrival</TableHead>
                      <TableHead>Payout ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Fees</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead>Reconciled</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(payouts.data ?? []).map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs">{p.arrival_date ?? '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{p.stripe_payout_id}</TableCell>
                        <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                        <TableCell className="text-right">{fmt(Number(p.gross_amount), p.currency)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{fmt(Number(p.fees), p.currency)}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(Number(p.net_amount), p.currency)}</TableCell>
                        <TableCell>{p.reconciled_at ? <Badge>Matched</Badge> : <Badge variant="secondary">Pending</Badge>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>



        <TabsContent value="activity">
          <Card>
            <CardHeader><CardTitle className="text-base">Recent transfers, top-ups and fees</CardTitle></CardHeader>
            <CardContent>
              {activity.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (activity.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(activity.data ?? []).map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs">{new Date(a.occurred_at).toLocaleString()}</TableCell>
                        <TableCell className="capitalize">{a.kind.replace('_', ' ')}</TableCell>
                        <TableCell className="text-sm">{a.description ?? '—'}</TableCell>
                        <TableCell><Badge variant="outline">{a.status ?? '—'}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{a.reference ?? '—'}</TableCell>
                        <TableCell className={`text-right font-medium ${a.amount < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmt(a.amount, a.currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requirements">
          <Card>
            <CardHeader><CardTitle className="text-base">Outstanding requirements</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              {account.disabled_reason && (
                <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-amber-900">
                  <strong>Disabled reason:</strong> {account.disabled_reason}
                </div>
              )}
              <div>
                <p className="font-medium mb-1">Currently due</p>
                {(reqs.currently_due ?? []).length === 0 ? <p className="text-muted-foreground">None</p> : (
                  <ul className="list-disc pl-5 text-muted-foreground">{(reqs.currently_due as string[]).map((r) => <li key={r}>{r}</li>)}</ul>
                )}
              </div>
              <div>
                <p className="font-medium mb-1">Past due</p>
                {(reqs.past_due ?? []).length === 0 ? <p className="text-muted-foreground">None</p> : (
                  <ul className="list-disc pl-5 text-red-600">{(reqs.past_due as string[]).map((r) => <li key={r}>{r}</li>)}</ul>
                )}
              </div>
              <div>
                <p className="font-medium mb-1">Eventually due</p>
                {(reqs.eventually_due ?? []).length === 0 ? <p className="text-muted-foreground">None</p> : (
                  <ul className="list-disc pl-5 text-muted-foreground">{(reqs.eventually_due as string[]).map((r) => <li key={r}>{r}</li>)}</ul>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="persons">
          <Card>
            <CardHeader><CardTitle className="text-base">Persons</CardTitle></CardHeader>
            <CardContent>
              {(persons.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No persons on file.</p> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stripe ID</TableHead>
                      <TableHead>Relationship</TableHead>
                      <TableHead>Verification</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(persons.data as any[]).map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.stripe_person_id}</TableCell>
                        <TableCell className="text-xs">{Object.entries(p.relationship ?? {}).filter(([, v]) => v).map(([k]) => k).join(', ') || '—'}</TableCell>
                        <TableCell className="text-xs">{p.verification?.status ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {orgId && (
        <LinkBankAccountDialog
          open={linkOpen}
          onOpenChange={setLinkOpen}
          organizationId={orgId}
          connectedAccountId={account.id}
        />
      )}
    </div>
  );
}
