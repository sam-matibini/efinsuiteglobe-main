import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Landmark, Receipt, AlertTriangle, CheckCircle2,
  ShieldCheck, History, Settings, ChevronRight, ExternalLink,
} from 'lucide-react';
import { useTaxPayments } from '@/hooks/useTaxPayments';
import { useAPPaymentBatches } from '@/hooks/useAPPaymentBatches';
import { Link } from 'react-router-dom';
import { ConnectedAccountsBalanceCard } from '@/components/treasury/ConnectedAccountsBalanceCard';
import { useCountryTreasuryConfig } from '@/hooks/useCountryTreasuryConfig';
import { useEfinconnectPreferences } from '@/hooks/useEfinconnectPreferences';
import type { DashboardActionDef } from '@/config/countryTreasuryConfig';

function ActionCard({ title, description, to, icon: Icon, external, deliveryEstimate }: DashboardActionDef) {
  return (
    <div className="space-y-2">
      <Link
        to={to}
        className="group block rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/40"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground">{title}</h3>
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

function Section({ title, cards }: { title: string; cards: DashboardActionDef[] }) {
  if (!cards.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground/80">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => <ActionCard key={c.title} {...c} />)}
      </div>
    </section>
  );
}

export default function TreasuryDashboard() {
  const { payments } = useTaxPayments();
  const { batches } = useAPPaymentBatches();
  const { config } = useCountryTreasuryConfig();
  const { sectionEnabled, authorityEnabled } = useEfinconnectPreferences();

  // Filter bills cards to only include those whose ?authority= query param is enabled
  const filterByAuthority = (cards: DashboardActionDef[]) =>
    cards.filter((c) => {
      const m = c.to.match(/authority=([^&]+)/);
      return !m || authorityEnabled(m[1]);
    });

  const pendingTax = payments.filter((p) => ['draft', 'scheduled', 'submitted'].includes(p.status));
  const paidTax = payments.filter((p) => p.status === 'paid');
  const pendingBatches = batches.filter((b) => ['draft', 'approved', 'processing'].includes(b.status));
  const failedCount = payments.filter((p) => p.status === 'failed').length + batches.filter((b) => b.status === 'failed').length;

  const sum = (items: { amount?: number; total_amount?: number }[], key: 'amount' | 'total_amount') =>
    items.reduce((s, i) => s + Number(i[key] ?? 0), 0);

  const governance: DashboardActionDef[] = [
    { title: 'Approvals',       description: 'Review and approve pending payment batches.',        to: '/treasury/approvals',        icon: ShieldCheck },
    { title: 'Payment history', description: 'Full audit trail of every remittance and batch.',    to: '/banking-payments/history',  icon: History },
    { title: 'Settings',        description: 'Rails, limits, and account defaults.',               to: '/treasury/settings',         icon: Settings },
  ];

  const fmt = new Intl.NumberFormat('en', { style: 'currency', currency: config.defaultCurrency, maximumFractionDigits: 0 });

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">eFinconnect</h1>
          <p className="text-muted-foreground">Pay bills, remit taxes, and move money between your accounts.</p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Landmark className="h-3 w-3" /> {config.displayName} · {config.defaultCurrency}
        </Badge>
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
            <p className="text-xs text-muted-foreground">{fmt.format(sum(pendingTax, 'amount'))} outstanding</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid This Year</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paidTax.length}</div>
            <p className="text-xs text-muted-foreground">{fmt.format(sum(paidTax, 'amount'))} remitted</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AP Batches In Flight</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingBatches.length}</div>
            <p className="text-xs text-muted-foreground">{fmt.format(sum(pendingBatches, 'total_amount'))} pending</p>
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

      {/* Country-driven action grid (filtered by user preferences) */}
      {sectionEnabled('bills')      && <Section title="Bills"                    cards={filterByAuthority(config.sections.bills)} />}
      {sectionEnabled('transfers')  && <Section title="Transfers"                cards={config.sections.transfers} />}
      {sectionEnabled('payments')   && <Section title="Payments & Collections"   cards={config.sections.payments} />}
      {sectionEnabled('governance') && <Section title="Governance"               cards={governance} />}
    </div>
  );
}
