import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Plus, Receipt, Users, Landmark, Calendar, History, Building2, AlertTriangle, CheckCircle2, Shield, ShieldAlert, ListChecks, Layers, Workflow, UserCog, MapPin, FileCode2, Cable, ShieldCheck, Sparkles, BellRing, ClipboardCheck, Eye } from 'lucide-react';
import { AnomalyBanner } from '@/components/treasury/AnomalyBanner';
import { CopilotPanel } from '@/components/treasury/CopilotPanel';
import { useTaxPayments, type TaxPayment } from '@/hooks/useTaxPayments';
import { useScheduledPayments } from '@/hooks/useScheduledPayments';
import { useCraAccounts, type CraTaxType } from '@/hooks/useCraAccounts';
import { useFintracReports } from '@/hooks/useFintracReports';
import { useReconciliationQueue } from '@/hooks/useReconciliationQueue';
import { CraPaymentWizard } from '@/components/treasury/CraPaymentWizard';
import { CraRemittanceStatusBadge, normalizeLifecycleStatus } from '@/components/treasury/CraRemittanceStatusBadge';
import { RecordCraConfirmationDialog } from '@/components/treasury/RecordCraConfirmationDialog';
import { PaysafePayCraDialog } from '@/components/treasury/PaysafePayCraDialog';
import { CraRailStatusCard } from '@/components/treasury/CraRailStatusCard';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

const CRA_PAYMENT_TYPES = ['gst_hst', 'source_deductions', 'corporate_tax'] as const;

function craPayments(payments: TaxPayment[]) {
  return payments.filter((p) => (CRA_PAYMENT_TYPES as readonly string[]).includes(p.payment_type));
}

export default function CraRemittanceCentre() {
  const { payments, isLoading } = useTaxPayments();
  const { schedules } = useScheduledPayments();
  const { accounts } = useCraAccounts();
  const { pending: pendingFintrac } = useFintracReports();
  const { open: openReconciliation } = useReconciliationQueue();
  const fmt = useCurrencyFormatter();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardType, setWizardType] = useState<CraTaxType | undefined>(undefined);
  const [confirmPayment, setConfirmPayment] = useState<TaxPayment | null>(null);
  const [paysafePayment, setPaysafePayment] = useState<TaxPayment | null>(null);

  const cra = useMemo(() => craPayments(payments), [payments]);
  const today = new Date().toISOString().slice(0, 10);

  const kpi = useMemo(() => {
    const open = cra.filter((p) => ['draft', 'pending', 'authorized', 'processing', 'scheduled', 'submitted'].includes(p.status));
    const completed = cra.filter((p) => ['completed', 'paid'].includes(p.status));
    const failed = cra.filter((p) => ['failed', 'returned', 'reversed'].includes(p.status));
    const completedAmt = completed.reduce((s, p) => s + Number(p.amount ?? 0), 0);
    return { open: open.length, completed: completed.length, failed: failed.length, completedAmt };
  }, [cra]);

  const craSchedules = useMemo(
    () => schedules.filter((s) => s.payment_kind === 'cra' && s.is_active).sort((a, b) => a.next_run_date.localeCompare(b.next_run_date)),
    [schedules],
  );
  const overdue = craSchedules.filter((s) => s.next_run_date < today);
  const upcoming = craSchedules.filter((s) => s.next_run_date >= today).slice(0, 5);
  const recent = cra.slice(0, 6);

  const openWizard = (t?: CraTaxType) => { setWizardType(t); setWizardOpen(true); };

  const tiles = [
    { title: 'GST / HST',                  href: '/banking-payments/cra-payments', icon: Receipt,  taxType: 'gst_hst'       as CraTaxType, desc: 'RT program remittances' },
    { title: 'Payroll Source Deductions',  href: '/banking-payments/cra-payments', icon: Users,    taxType: 'payroll'       as CraTaxType, desc: 'RP program (PD7A)' },
    { title: 'Corporation Tax',            href: '/banking-payments/cra-payments', icon: Landmark, taxType: 'corporate_tax' as CraTaxType, desc: 'RC program installments' },
    { title: 'Scheduled Remittances',      href: '/banking-payments/scheduled',    icon: Calendar, desc: 'Recurring CRA payments' },
    { title: 'Payment History',            href: '/banking-payments/history',      icon: History,  desc: 'All CRA payments' },
    { title: 'CRA Account Settings',       href: '/banking-payments/cra-accounts', icon: Building2,desc: `${accounts.length} registered` },
    { title: 'Audit Log',                  href: '/banking-payments/cra-audit-log',icon: Shield,   desc: 'FINTRAC-style event log' },
    { title: 'Reconciliation Review',      href: '/banking-payments/reconciliation-review', icon: ListChecks, desc: `${openReconciliation.length} ambiguous match${openReconciliation.length === 1 ? '' : 'es'} to resolve` },
    { title: 'FINTRAC Reports',            href: '/banking-payments/fintrac-reports', icon: ShieldAlert, desc: `${pendingFintrac.length} pending LCTR report${pendingFintrac.length === 1 ? '' : 's'}` },
    { title: 'RPAA Compliance',            href: '/banking-payments/rpaa', icon: Shield, desc: 'Safeguarding, attestations, incident reporting' },
    { title: 'Bulk Payroll Remittance',    href: '/banking-payments/bulk-payroll', icon: Layers, desc: 'Roll up payroll source deductions into a single batch' },
    { title: 'Multi-Business',             href: '/banking-payments/multi-business', icon: Building2, desc: 'Orchestrate CRA across every organization' },
    { title: 'Approval Rules',             href: '/banking-payments/approval-rules', icon: Workflow, desc: 'Configure approval chains by amount and program' },
    { title: 'Delegated Access',           href: '/banking-payments/delegated-access', icon: UserCog, desc: 'Grant scoped access to external accountants' },
    { title: 'Provincial Remittances',     href: '/banking-payments/provincial', icon: MapPin, desc: 'Revenu Québec, WSIB, WCB, EHT, PST/RST' },
    { title: 'CRA XML Filings',            href: '/banking-payments/cra-filings', icon: FileCode2, desc: 'T4, T5018, PD7A, GST/HST NETFILE XML' },
    { title: 'EFT Rail Settings',          href: '/banking-payments/eft-rails', icon: Cable, desc: 'Paysafe, VoPay, Telpay + Stripe payouts' },
    { title: 'Compliance Exports',         href: '/banking-payments/compliance-exports', icon: ShieldCheck, desc: 'SOC-2 evidence pack' },
    { title: 'Cash-Flow Forecast',         href: '/banking-payments/forecast', icon: Sparkles, desc: '13-week + 12-month projection with what-if sliders' },
    { title: 'Anomaly Inbox',              href: '/banking-payments/anomalies', icon: BellRing, desc: 'Missed periods, duplicates, swing detection' },
    { title: 'Period Close',               href: '/banking-payments/period-close', icon: ClipboardCheck, desc: 'Kanban board: open → reconciled → filed → paid → closed' },
    { title: 'Auditor Portal',             href: '/banking-payments/auditor-portal', icon: Eye, desc: 'Self-serve evidence access for external auditors' },
    { title: 'Vendor Tax Slips',           href: '/banking-payments/vendor-slips', icon: FileCode2, desc: 'T4A, T5018, 1099-NEC, 1099-MISC year-end issuance' },
    { title: 'Vendor Tax Profiles',        href: '/banking-payments/vendor-tax-profiles', icon: ShieldCheck, desc: 'W-9 / W-8 / TD1 with TIN/SIN validation' },
    { title: 'US Remittance Centre',       href: '/banking-payments/us-remittance', icon: MapPin, desc: 'IRS 941, sales-tax nexus, state payroll' },
  ] as const;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">CRA Remittance Centre</h1>
          <p className="text-muted-foreground">Remit GST/HST, payroll source deductions and corporate tax to the Canada Revenue Agency.</p>
      </div>



        <div className="flex gap-2">
          <CopilotPanel />
          <Button onClick={() => openWizard()}>
            <Plus className="mr-1 h-4 w-4" /> New remittance
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard title="Open remittances" value={String(kpi.open)} icon={<Receipt className="h-4 w-4" />} />
        <KpiCard title="Completed YTD" value={fmt.formatCurrency(kpi.completedAmt, { showCurrencySymbol: true, currencyOverride: 'CAD' })} icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} />
        <KpiCard title="Failed / returned" value={String(kpi.failed)} icon={<AlertTriangle className="h-4 w-4 text-destructive" />} tone={kpi.failed ? 'destructive' : undefined} />
        <KpiCard title="Recon. review" value={String(openReconciliation.length)} icon={<ListChecks className="h-4 w-4" />} tone={openReconciliation.length ? 'destructive' : undefined} />
        <KpiCard title="FINTRAC pending" value={String(pendingFintrac.length)} icon={<ShieldAlert className="h-4 w-4" />} tone={pendingFintrac.length ? 'destructive' : undefined} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2"><AnomalyBanner filterAuthority="cra" /></div>
        <CraRailStatusCard />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Card key={t.href} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <t.icon className="h-5 w-5 text-primary" />
                {t.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">{t.desc}</p>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm"><Link to={t.href}>Open <ArrowRight className="ml-2 h-3 w-3" /></Link></Button>
                {'taxType' in t && t.taxType && (
                  <Button size="sm" variant="ghost" onClick={() => openWizard(t.taxType)}>
                    <Plus className="mr-1 h-3 w-3" /> Pay now
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Upcoming CRA schedules</CardTitle></CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming scheduled remittances.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {upcoming.map((s) => (
                  <li key={s.id} className="flex justify-between border-b py-2">
                    <span><span className="font-mono mr-2">{s.next_run_date}</span>{s.description ?? s.payment_kind}</span>
                    <Badge variant="outline" className="capitalize">{s.frequency}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent CRA remittances</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No remittances yet. Click <strong>New remittance</strong> to record one.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {recent.map((p) => {
                  const canConfirm = ['submitted', 'processing', 'pending', 'authorized', 'scheduled'].includes(p.status);
                  const canPaysafe = ['draft', 'scheduled', 'pending', 'failed'].includes(p.status);
                  return (
                    <li key={p.id} className="flex justify-between items-center border-b py-2">
                      <span>
                        <span className="font-mono text-xs mr-2">{p.reference}</span>
                        {p.filing_period_label || (p.period_end ?? '—')}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{fmt.formatCurrency(Number(p.amount ?? 0), { showCurrencySymbol: true, currencyOverride: p.currency || 'CAD' })}</span>
                        <CraRemittanceStatusBadge status={normalizeLifecycleStatus(p.status)} />
                        {canPaysafe && (
                          <Button size="sm" onClick={() => setPaysafePayment(p)}>
                            Pay with Paysafe
                          </Button>
                        )}
                        {canConfirm && (
                          <Button size="sm" variant="outline" onClick={() => setConfirmPayment(p)}>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Record CRA confirmation
                          </Button>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <CraPaymentWizard open={wizardOpen} onOpenChange={setWizardOpen} initialTaxType={wizardType} />
      <RecordCraConfirmationDialog
        open={!!confirmPayment}
        onOpenChange={(o) => !o && setConfirmPayment(null)}
        payment={confirmPayment}
      />
      <PaysafePayCraDialog
        open={!!paysafePayment}
        onOpenChange={(o) => !o && setPaysafePayment(null)}
        payment={paysafePayment}
      />
    </div>
  );
}

function KpiCard({ title, value, icon, tone }: { title: string; value: string; icon: React.ReactNode; tone?: 'destructive' }) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-bold ${tone === 'destructive' ? 'text-destructive' : ''}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
