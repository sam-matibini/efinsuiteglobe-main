import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Receipt, CreditCard, Users, Calendar, History, Building2,
  TrendingUp, Clock, AlertTriangle, CheckCircle2, Link2, Wallet, Landmark, Zap,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useTaxPayments } from '@/hooks/useTaxPayments';
import { useScheduledPayments } from '@/hooks/useScheduledPayments';
import { useCraAccounts } from '@/hooks/useCraAccounts';
import { usePaymentLinks } from '@/hooks/usePaymentLinks';
import { useCustomerPayments } from '@/hooks/useCustomerPayments';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useCountryTreasuryConfig } from '@/hooks/useCountryTreasuryConfig';
import { parseLocalDate } from '@/lib/utils';

const METHOD_COLORS: Record<string, string> = {
  card: 'hsl(var(--primary))',
  eft: 'hsl(var(--chart-2, 142 71% 45%))',
  interac: 'hsl(var(--chart-3, 38 92% 50%))',
  manual: 'hsl(var(--muted-foreground))',
};

const safeDate = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  try { return s.length === 10 ? parseLocalDate(s) : new Date(s); } catch { return null; }
};

export default function BankingPaymentsDashboard() {
  const { payments: taxPayments } = useTaxPayments();
  const { schedules } = useScheduledPayments();
  const { accounts } = useCraAccounts();
  const { links } = usePaymentLinks();
  const { payments: customerPayments } = useCustomerPayments();
  const fmt = useCurrencyFormatter();

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);
  const todayIso = today.toISOString().slice(0, 10);

  // === KPIs ===
  const paidLinks = useMemo(() => links.filter((l) => l.status === 'paid'), [links]);
  const openLinks = useMemo(() => links.filter((l) => l.status === 'open'), [links]);
  const failedLinks = useMemo(
    () => links.filter((l) => l.status === 'cancelled' && (safeDate(l.created_at)?.getTime() ?? 0) >= thirtyDaysAgo.getTime()),
    [links, thirtyDaysAgo],
  );

  const paidThisMonth = useMemo(() => {
    const linksSum = paidLinks
      .filter((l) => (safeDate(l.paid_at)?.getTime() ?? 0) >= monthStart.getTime())
      .reduce((s, l) => s + Number(l.amount), 0);
    const cpSum = customerPayments
      .filter((p) => (safeDate(p.payment_date)?.getTime() ?? 0) >= monthStart.getTime())
      .reduce((s, p) => s + Number(p.amount), 0);
    const taxSum = taxPayments
      .filter((p) => p.status === 'paid' && (safeDate(p.paid_at as string | null)?.getTime() ?? 0) >= monthStart.getTime())
      .reduce((s, p) => s + Number(p.amount ?? 0), 0);
    return linksSum + cpSum + taxSum;
  }, [paidLinks, customerPayments, taxPayments, monthStart]);

  const outstanding = useMemo(() => {
    const linksSum = openLinks.reduce((s, l) => s + Number(l.amount), 0);
    const taxSum = taxPayments
      .filter((p) => p.status === 'draft' || p.status === 'scheduled')
      .reduce((s, p) => s + Number(p.amount ?? 0), 0);
    return linksSum + taxSum;
  }, [openLinks, taxPayments]);

  const inFlight = useMemo(() => {
    return openLinks.filter((l) => !!l.paysafe_payment_handle_id).length +
      taxPayments.filter((p) => p.status === 'submitted').length;
  }, [openLinks, taxPayments]);

  const avgSettleHours = useMemo(() => {
    const recent = paidLinks
      .filter((l) => (safeDate(l.paid_at)?.getTime() ?? 0) >= thirtyDaysAgo.getTime())
      .map((l) => {
        const created = safeDate(l.created_at)?.getTime();
        const paid = safeDate(l.paid_at)?.getTime();
        return created && paid ? (paid - created) / 3600000 : null;
      })
      .filter((n): n is number => n !== null && n >= 0);
    if (!recent.length) return null;
    return recent.reduce((s, n) => s + n, 0) / recent.length;
  }, [paidLinks, thirtyDaysAgo]);

  const feesYtd = useMemo(() => {
    return paidLinks
      .filter((l) => (safeDate(l.paid_at)?.getTime() ?? 0) >= yearStart.getTime())
      .reduce((s, l) => {
        const fee = Number((l.metadata as { fee_amount?: number } | null)?.fee_amount ?? 0);
        return s + (isNaN(fee) ? 0 : fee);
      }, 0);
  }, [paidLinks, yearStart]);

  // === Trend (last 30 days) ===
  const trend = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      buckets[d.toISOString().slice(0, 10)] = 0;
    }
    for (const l of paidLinks) {
      const d = safeDate(l.paid_at);
      if (!d) continue;
      const key = d.toISOString().slice(0, 10);
      if (key in buckets) buckets[key] += Number(l.amount);
    }
    for (const p of customerPayments) {
      const d = safeDate(p.payment_date);
      if (!d) continue;
      const key = d.toISOString().slice(0, 10);
      if (key in buckets) buckets[key] += Number(p.amount);
    }
    return Object.entries(buckets).map(([date, total]) => ({
      date: date.slice(5),
      total: Math.round(total * 100) / 100,
    }));
  }, [paidLinks, customerPayments, today]);

  // === Method mix ===
  const methodMix = useMemo(() => {
    const counts: Record<string, number> = { card: 0, eft: 0, interac: 0, manual: 0 };
    for (const l of paidLinks) {
      const m = (l.metadata as { rail?: string } | null)?.rail
        ?? (l.instant_method === 'interac_etransfer' ? 'interac'
          : l.payment_method === 'eft' ? 'eft'
          : 'card');
      const key = ['card', 'eft', 'interac'].includes(m) ? m : 'card';
      counts[key] += Number(l.amount);
    }
    for (const p of customerPayments) {
      const m = (p.payment_method ?? 'manual').toLowerCase();
      const key = ['card', 'eft', 'interac'].includes(m) ? m : 'manual';
      counts[key] += Number(p.amount);
    }
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
  }, [paidLinks, customerPayments]);

  // === Recent completed payments ===
  const recent = useMemo(() => {
    const rows: Array<{
      id: string; date: string; ref: string; amount: number; currency: string; method: string; source: string;
    }> = [];
    paidLinks.forEach((l) => rows.push({
      id: `link-${l.id}`,
      date: (l.paid_at ?? l.created_at).slice(0, 10),
      ref: l.reference,
      amount: Number(l.amount),
      currency: l.currency,
      method: (l.metadata as { rail?: string } | null)?.rail
        ?? (l.payment_method === 'eft' ? 'eft' : l.instant_method === 'interac_etransfer' ? 'interac' : 'card'),
      source: 'Payment link',
    }));
    customerPayments.forEach((p) => rows.push({
      id: `cp-${p.id}`,
      date: p.payment_date,
      ref: p.reference ?? p.invoice?.invoice_number ?? '—',
      amount: Number(p.amount),
      currency: 'CAD',
      method: p.payment_method ?? 'manual',
      source: p.customer?.name ?? 'Customer payment',
    }));
    taxPayments.filter((p) => p.status === 'paid').forEach((p) => rows.push({
      id: `tp-${p.id}`,
      date: (p.paid_at as string | null)?.slice(0, 10) ?? '',
      ref: p.reference,
      amount: Number(p.amount ?? 0),
      currency: p.currency ?? 'CAD',
      method: 'eft',
      source: `CRA · ${p.payment_type.replace('_', ' ')}`,
    }));
    return rows
      .filter((r) => r.date)
      .sort((a, b) => (a.date > b.date ? -1 : 1))
      .slice(0, 10);
  }, [paidLinks, customerPayments, taxPayments]);

  // === Upcoming / overdue ===
  const upcoming = schedules.filter((s) => s.is_active && s.next_run_date >= todayIso).slice(0, 5);
  const overdue = schedules.filter((s) => s.is_active && s.next_run_date < todayIso);

  const tiles = [
    { title: 'CRA Remittance', href: '/banking-payments/cra-remittance', icon: Receipt },
    { title: 'AP Payments', href: '/treasury/ap-payments', icon: CreditCard },
    { title: 'Payroll Payments', href: '/treasury/payroll-payments', icon: Users },
    { title: 'Scheduled', href: '/banking-payments/scheduled', icon: Calendar },
    { title: 'Payment History', href: '/banking-payments/history', icon: History },
    { title: 'Payment Links', href: '/banking-payments/payment-links', icon: Link2 },
    { title: 'CRA Accounts', href: '/banking-payments/cra-accounts', icon: Building2, desc: `${accounts.length} registered` },
    { title: 'EFT Rails', href: '/banking-payments/eft-rails', icon: Landmark },
  ];

  const cad = (n: number) =>
    fmt.formatCurrency(n, { showCurrencySymbol: true, currencyOverride: 'CAD' });

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Banking & Payments</h1>
          <p className="text-muted-foreground">Real-time payments performance, settlements and remittances</p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm">
            <Link to="/banking-payments/payment-links"><Link2 className="h-4 w-4 mr-1" />New payment link</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/banking-payments/cra-remittance"><Receipt className="h-4 w-4 mr-1" />CRA remittance</Link>
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Paid this month" value={cad(paidThisMonth)} icon={CheckCircle2} accent="text-emerald-600" />
        <KpiCard label="Outstanding" value={cad(outstanding)} icon={Wallet} />
        <KpiCard label="In-flight" value={String(inFlight)} icon={Zap} />
        <KpiCard label="Failed (30d)" value={String(failedLinks.length)} icon={AlertTriangle} accent={failedLinks.length ? 'text-destructive' : ''} />
        <KpiCard label="Avg settle" value={avgSettleHours == null ? '—' : `${avgSettleHours.toFixed(1)}h`} icon={Clock} />
        <KpiCard label="Fees YTD" value={cad(feesYtd)} icon={TrendingUp} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: charts + recent */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Payments — last 30 days
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="paidGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => cad(v)}
                  />
                  <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="url(#paidGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Method mix</CardTitle></CardHeader>
              <CardContent className="h-56">
                {methodMix.length === 0 ? (
                  <p className="text-sm text-muted-foreground flex items-center justify-center h-full">No completed payments yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={methodMix} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                        {methodMix.map((m) => <Cell key={m.name} fill={METHOD_COLORS[m.name] ?? 'hsl(var(--muted))'} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => cad(v)} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v: string) => v.charAt(0).toUpperCase() + v.slice(1)} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Upcoming & overdue</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {overdue.length > 0 && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2">
                    <div className="text-xs font-semibold text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" /> {overdue.length} overdue
                    </div>
                  </div>
                )}
                {upcoming.length === 0 && overdue.length === 0 && (
                  <p className="text-muted-foreground text-sm">Nothing scheduled.</p>
                )}
                <ul className="space-y-1">
                  {upcoming.map((s) => (
                    <li key={s.id} className="flex justify-between text-xs border-b py-1.5 last:border-0">
                      <span className="truncate"><span className="font-mono text-muted-foreground mr-2">{s.next_run_date}</span>{s.description ?? s.payment_kind}</span>
                      <span className="capitalize text-muted-foreground">{s.frequency}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent completed payments</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/banking-payments/history">View all <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No completed payments yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b">
                        <th className="py-2 font-medium">Date</th>
                        <th className="py-2 font-medium">Reference</th>
                        <th className="py-2 font-medium">Source</th>
                        <th className="py-2 font-medium">Method</th>
                        <th className="py-2 font-medium text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((r) => (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="py-2 text-xs text-muted-foreground">{r.date}</td>
                          <td className="py-2 font-mono text-xs">{r.ref}</td>
                          <td className="py-2 text-xs truncate max-w-[160px]">{r.source}</td>
                          <td className="py-2"><Badge variant="outline" className="capitalize text-[10px]">{r.method}</Badge></td>
                          <td className="py-2 text-right font-medium">{fmt.formatCurrency(r.amount, { showCurrencySymbol: true, currencyOverride: r.currency })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: module tiles */}
        <div>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">All modules</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              {tiles.map((t) => (
                <Link key={t.href} to={t.href}
                  className="group flex items-center justify-between rounded-md border bg-card px-3 py-2.5 hover:bg-accent hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <t.icon className="h-4 w-4 text-primary" />
                    <div>
                      <div className="text-sm font-medium">{t.title}</div>
                      {t.desc && <div className="text-[11px] text-muted-foreground">{t.desc}</div>}
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label, value, icon: Icon, accent,
}: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Icon className={`h-4 w-4 ${accent || 'text-muted-foreground'}`} />
        </div>
        <div className={`text-xl font-bold ${accent ?? ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
