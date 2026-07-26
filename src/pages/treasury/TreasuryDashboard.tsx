import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Landmark, Receipt, AlertTriangle, CheckCircle2,
  CreditCard, Users, ArrowLeftRight, Send, Link as LinkIcon,
  Clock, ShieldCheck, History, Settings, ChevronRight, ExternalLink,
} from 'lucide-react';
import { useTaxPayments } from '@/hooks/useTaxPayments';
import { useAPPaymentBatches } from '@/hooks/useAPPaymentBatches';
import { Link } from 'react-router-dom';
import { ConnectedAccountsBalanceCard } from '@/components/treasury/ConnectedAccountsBalanceCard';
import type { LucideIcon } from 'lucide-react';

interface ActionCardProps {
  title: string;
  description: string;
  to: string;
  icon: LucideIcon;
  external?: boolean;
  deliveryEstimate?: string;
}

function ActionCard({ title, description, to, icon: Icon, external, deliveryEstimate }: ActionCardProps) {
  return (
    <div className="space-y-2">
      <Link
        to={to}
        className="group block rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/40"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{title}</h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{description}</p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-3">
            {external ? (
              <ExternalLink className="h-4 w-4 text-primary opacity-70" />
            ) : (
              <ChevronRight className="h-4 w-4 text-primary opacity-70 transition-transform group-hover:translate-x-0.5" />
            )}
            <div className="rounded-lg bg-accent/60 p-2.5 text-primary">
              <Icon className="h-5 w-5" />
            </div>
          </div>
        </div>
      </Link>
      {deliveryEstimate && (
        <div className="rounded-md bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">Delivery estimate</span> {deliveryEstimate}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground/80">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

export default function TreasuryDashboard() {
  const { payments } = useTaxPayments();
  const { batches } = useAPPaymentBatches();

  const pendingTax = payments.filter((p) => ['draft', 'scheduled', 'submitted'].includes(p.status));
  const paidTax = payments.filter((p) => p.status === 'paid');
  const pendingBatches = batches.filter((b) => ['draft', 'approved', 'processing'].includes(b.status));
  const failedCount = payments.filter((p) => p.status === 'failed').length + batches.filter((b) => b.status === 'failed').length;

  const sum = (items: { amount?: number; total_amount?: number }[], key: 'amount' | 'total_amount') =>
    items.reduce((s, i) => s + Number(i[key] ?? 0), 0);

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold">eFinconnect</h1>
        <p className="text-muted-foreground">Pay bills, remit taxes, and move money between your accounts.</p>
      </div>

      {/* KPI strip */}
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
            <div className="text-2xl font-bold">{failedCount}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Balances */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ConnectedAccountsBalanceCard />
      </div>

      {/* Bank-style action grid */}
      <Section title="Bills">
        <ActionCard
          title="Pay bills"
          description="Pay vendor bills from anywhere with EFT or cheque."
          to="/treasury/ap-payments"
          icon={CreditCard}
        />
        <ActionCard
          title="Pay business taxes"
          description="File and remit federal & provincial taxes (CRA, IRS, FIRS, HMRC)."
          to="/treasury/tax-payments"
          icon={Receipt}
          external
        />
        <ActionCard
          title="Payroll remittances"
          description="Send source deductions and payroll taxes to the tax authority."
          to="/treasury/payroll-payments"
          icon={Users}
        />
      </Section>

      <Section title="Transfers">
        <ActionCard
          title="Transfer between accounts"
          description="Move funds between your connected bank and credit card accounts."
          to="/banking/transfers"
          icon={ArrowLeftRight}
        />
        <ActionCard
          title="Interac e-Transfer"
          description="Send or request money by email or SMS via payment links."
          to="/banking-payments/payment-links"
          icon={Send}
        />
        <ActionCard
          title="Bank deposit / Wire"
          description="Send money directly to another bank account on a schedule."
          to="/banking-payments/scheduled"
          icon={Landmark}
        />
      </Section>

      <Section title="Payments & Collections">
        <ActionCard
          title="Payment links"
          description="Create shareable pay-me links for customers."
          to="/banking-payments/payment-links"
          icon={LinkIcon}
        />
        <ActionCard
          title="Stripe Connect payouts"
          description="Route settlements to connected accounts and sub-merchants."
          to="/banking-payments/stripe-connect"
          icon={LinkIcon}
        />
        <ActionCard
          title="Scheduled payments"
          description="View and manage upcoming outbound payments."
          to="/banking-payments/scheduled"
          icon={Clock}
        />
      </Section>

      <Section title="Governance">
        <ActionCard
          title="Approvals"
          description="Review and approve pending payment batches."
          to="/treasury/approvals"
          icon={ShieldCheck}
        />
        <ActionCard
          title="Payment history"
          description="Full audit trail of every remittance and batch."
          to="/banking-payments/history"
          icon={History}
        />
        <ActionCard
          title="Settings"
          description="Rails, limits, and account defaults."
          to="/treasury/settings"
          icon={Settings}
        />
      </Section>
    </div>
  );
}
