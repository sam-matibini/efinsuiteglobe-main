import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Landmark, Receipt, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTaxPayments } from '@/hooks/useTaxPayments';
import { useAPPaymentBatches } from '@/hooks/useAPPaymentBatches';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ConnectedAccountsBalanceCard } from '@/components/treasury/ConnectedAccountsBalanceCard';

export default function TreasuryDashboard() {
  const { payments, isLoading: txLoading } = useTaxPayments();
  const { batches, isLoading: bLoading } = useAPPaymentBatches();

  const pendingTax = payments.filter((p) => ['draft', 'scheduled', 'submitted'].includes(p.status));
  const paidTax = payments.filter((p) => p.status === 'paid');
  const pendingBatches = batches.filter((b) => ['draft', 'approved', 'processing'].includes(b.status));

  const sum = (items: { amount?: number; total_amount?: number }[], key: 'amount' | 'total_amount') =>
    items.reduce((s, i) => s + Number(i[key] ?? 0), 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Treasury Management</h1>
          <p className="text-muted-foreground">Outbound payments: tax authorities and supplier bills</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/treasury/tax-payments">Tax Payments</Link></Button>
          <Button asChild><Link to="/treasury/ap-payments">AP Payments</Link></Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Tax Remittances</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingTax.length}</div>
            <p className="text-xs text-muted-foreground">${sum(pendingTax, 'amount').toFixed(2)} outstanding</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid This Year</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paidTax.length}</div>
            <p className="text-xs text-muted-foreground">${sum(paidTax, 'amount').toFixed(2)} remitted</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AP Batches In Flight</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingBatches.length}</div>
            <p className="text-xs text-muted-foreground">${sum(pendingBatches, 'total_amount').toFixed(2)} pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {payments.filter((p) => p.status === 'failed').length + batches.filter((b) => b.status === 'failed').length}
            </div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ConnectedAccountsBalanceCard />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Recent Tax Payments</CardTitle></CardHeader>
          <CardContent>
            {txLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
              payments.slice(0, 6).map((p) => (
                <div key={p.id} className="flex justify-between border-b py-2 text-sm last:border-0">
                  <div>
                    <div className="font-medium">{p.reference}</div>
                    <div className="text-xs text-muted-foreground capitalize">{p.payment_type.replace(/_/g, ' ')} · {p.status}</div>
                  </div>
                  <div className="text-right font-medium">${Number(p.amount).toFixed(2)}</div>
                </div>
              ))}
            {!txLoading && payments.length === 0 && <p className="text-sm text-muted-foreground">No tax payments yet.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent AP Batches</CardTitle></CardHeader>
          <CardContent>
            {bLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
              batches.slice(0, 6).map((b) => (
                <Link to={`/treasury/ap-payments/${b.id}`} key={b.id} className="flex justify-between border-b py-2 text-sm last:border-0 hover:bg-muted/50">
                  <div>
                    <div className="font-medium">{b.batch_number}</div>
                    <div className="text-xs text-muted-foreground capitalize">{b.provider} · {b.status}</div>
                  </div>
                  <div className="text-right font-medium">${Number(b.total_amount).toFixed(2)}</div>
                </Link>
              ))}
            {!bLoading && batches.length === 0 && <p className="text-sm text-muted-foreground">No payment batches yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
