import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { usePendingApprovalsForUser } from '@/hooks/usePaymentApprovals';

export default function TreasuryApprovals() {
  const { data, isLoading } = usePendingApprovalsForUser();

  const tax = data?.tax_payments ?? [];
  const ap = data?.ap_batches ?? [];
  const payroll = data?.payroll_batches ?? [];

  const Section = ({ title, items, kind }: { title: string; items: Array<Record<string, unknown>>; kind: 'tax' | 'ap' | 'payroll' }) => (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing waiting.</p>
        ) : (
          <ul className="divide-y">
            {items.map((row) => {
              const id = row.id as string;
              const label = (row.reference ?? row.batch_number) as string;
              const amount = (row.amount ?? row.total_amount ?? row.total_net) as number;
              const state = row.approval_state as string;
              const href =
                kind === 'tax' ? '/treasury/tax-payments'
                : kind === 'ap' ? `/treasury/ap-payments/${id}`
                : `/treasury/payroll-payments/${id}`;
              return (
                <li key={id} className="flex items-center justify-between py-2 text-sm">
                  <Link to={href} className="font-mono text-xs hover:underline">{label}</Link>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{state.replace('_', ' ')}</Badge>
                    <span className="font-mono">${Number(amount ?? 0).toFixed(2)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Treasury Approvals</h1>
        <p className="text-muted-foreground">Payments awaiting review or approval</p>
      </div>
      {isLoading ? <p>Loading…</p> : (
        <div className="grid gap-4 md:grid-cols-3">
          <Section title="Tax Payments" items={tax} kind="tax" />
          <Section title="AP Batches" items={ap} kind="ap" />
          <Section title="Payroll Batches" items={payroll} kind="payroll" />
        </div>
      )}
    </div>
  );
}
