import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CraModule } from '@/components/cra/CraModule';
import { formatCad, isReconciled, reconciliationReport } from '@/lib/cra/engine';
import type { CraPayment } from '@/lib/cra/types';
import { useCraTaxCentre } from '@/hooks/useCraTaxCentre';

export default function CraReconciliationReport() {
  const cra = useCraTaxCentre();
  const report = reconciliationReport(cra.ledger);
  const sections: { title: string; rows: CraPayment[] }[] = [
    { title: 'Payments initiated', rows: report.initiated },
    { title: 'Payments submitted', rows: report.submitted },
    { title: 'Payments settled', rows: report.settled },
    { title: 'CRA-confirmed payments', rows: report.confirmed },
    { title: 'Failed payments', rows: report.failed },
    { title: 'Unreconciled items', rows: report.unreconciled },
  ];

  return (
    <CraModule
      title="CRA reconciliation"
      description="Wallet deductions, bank settlement, and CRA confirmations for this organization."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Outstanding balances" value={formatCad(report.outstanding)} />
        <Stat label="Payment fees" value={formatCad(report.fees)} />
        <Stat label="Client wallet deductions" value={formatCad(report.walletDeductions)} />
      </div>
      {sections.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle className="text-base">{section.title} ({section.rows.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {section.rows.length === 0 ? <p className="text-muted-foreground">None.</p> : null}
            {section.rows.map((payment) => (
              <div key={`${section.title}-${payment.id}`} className="flex flex-wrap justify-between gap-2 border-b py-2">
                <span>
                  {payment.id} · {payment.account} · {cra.ledger.profile.legalName}
                  <span className="block text-muted-foreground">{isReconciled(payment) ? '✓ Reconciled' : payment.status}</span>
                </span>
                <span>{formatCad(payment.amount)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      <Link to="/reports" className="text-sm text-primary underline-offset-4 hover:underline">Back to Reports Centre</Link>
    </CraModule>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">{value}</CardContent>
    </Card>
  );
}
