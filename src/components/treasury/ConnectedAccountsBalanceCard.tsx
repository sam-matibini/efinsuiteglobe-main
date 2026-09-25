import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { RefreshCw, Wallet } from 'lucide-react';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useConnectedAccountBalances } from '@/hooks/useConnectedAccountBalances';
import { useStripeConnectedAccounts } from '@/hooks/useStripeConnectedAccounts';

const fmt = (n: number, ccy: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: ccy.toUpperCase() }).format(n);

export function ConnectedAccountsBalanceCard() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? null;
  const { accounts } = useStripeConnectedAccounts(orgId);
  const { balances, refresh } = useConnectedAccountBalances(orgId);

  const totals = balances.reduce<Record<string, { available: number; pending: number }>>((acc, b) => {
    const key = b.currency.toLowerCase();
    acc[key] = acc[key] ?? { available: 0, pending: 0 };
    acc[key].available += Number(b.available_amount);
    acc[key].pending += Number(b.pending_amount);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Wallet className="h-4 w-4" /> Stripe Connect balances
        </CardTitle>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => refresh.mutate({})} disabled={refresh.isPending || accounts.length === 0}>
            <RefreshCw className={`h-3.5 w-3.5 ${refresh.isPending ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/banking-payments/stripe-connect">Manage</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No connected accounts.</p>
        ) : Object.keys(totals).length === 0 ? (
          <p className="text-sm text-muted-foreground">No balance snapshots yet. Click refresh to fetch from Stripe.</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(totals).map(([ccy, t]) => (
              <div key={ccy} className="flex items-center justify-between text-sm">
                <span className="uppercase font-mono text-xs">{ccy}</span>
                <div className="text-right">
                  <div className="font-medium">{fmt(t.available, ccy)} <span className="text-xs text-muted-foreground">available</span></div>
                  <div className="text-xs text-muted-foreground">{fmt(t.pending, ccy)} pending</div>
                </div>
              </div>
            ))}
            <div className="text-xs text-muted-foreground pt-2 border-t">
              Across {accounts.length} connected account{accounts.length === 1 ? '' : 's'}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
