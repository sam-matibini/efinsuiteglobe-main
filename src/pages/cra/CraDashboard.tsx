import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConnectionSummary, CraModule } from '@/components/cra/CraModule';
import { PayCraDialog, type PayPreset } from '@/components/cra/PayCraDialog';
import { formatCad, formatDay, outstandingBalance, upcomingAssessed } from '@/lib/cra/engine';
import { useCraTaxCentre } from '@/hooks/useCraTaxCentre';

export default function CraDashboard() {
  const cra = useCraTaxCentre();
  const [payOpen, setPayOpen] = useState(false);
  const [preset, setPreset] = useState<PayPreset | undefined>();
  const { ledger } = cra;
  const outstanding = outstandingBalance(ledger);
  const upcoming = upcomingAssessed(ledger);
  const gstPayable = ledger.gst.collected - ledger.gst.itcs;
  const payrollTotal = ledger.payroll.cpp + ledger.payroll.ei + ledger.payroll.incomeTax;
  const unfiled = [ledger.gst.filingStatus !== 'filed', ledger.corporate.filingStatus !== 'filed'].filter(Boolean).length;

  const openPay = (next?: PayPreset) => {
    setPreset(next);
    setPayOpen(true);
  };

  return (
    <CraModule
      title="Tax & CRA"
      description="Balances, filings, and remittances for this organization. Amounts are limited to program accounts the client enrolled and the authorization CRA has granted."
      actions={
        <>
          <Button variant="outline" onClick={() => cra.refresh()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button onClick={() => openPay()} disabled={!cra.can('prepare_payment')}>
            Pay CRA
          </Button>
        </>
      }
    >
      <ConnectionSummary ledger={ledger} />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding CRA balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCad(outstanding)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming assessed payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCad(upcoming)}</div>
            <p className="mt-1 text-xs text-muted-foreground">Payroll and corporate account balances with a due date.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Client data enquiry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>Balance owing {formatCad(outstanding)}</div>
            <div>Outstanding returns {unfiled > 0 ? 1 : 0}</div>
            <div>Review status {ledger.accountReviewStatus}</div>
            <div>Unfiled returns {unfiled}</div>
            <div>GST/HST outstanding {formatCad(ledger.balances.gst_hst)}</div>
            <div>{ledger.authorization.status === 'connected' ? '✓' : '○'} No EFILE restriction</div>
            <div>{ledger.directDepositAvailable ? '✓' : '○'} Direct deposit information available</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ProgramCard
          title="GST/HST"
          href="/tax-cra/gst-hst"
          balance={ledger.balances.gst_hst}
          detail={`Next filing ${formatDay(ledger.gst.dueDate)}`}
          enrolled={ledger.profile.programs.includes('RT')}
        />
        <ProgramCard
          title="Payroll"
          href="/tax-cra/payroll"
          balance={ledger.balances.payroll}
          detail={`Next remittance ${formatDay(ledger.payroll.dueDate)}`}
          enrolled={ledger.profile.programs.includes('RP')}
        />
        <ProgramCard
          title="Corporate tax"
          href="/tax-cra/corporate"
          balance={ledger.balances.corporate_tax}
          detail={`Next payment ${formatDay(ledger.corporate.nextInstallmentDate)}`}
          enrolled={ledger.profile.programs.includes('RC')}
        />
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">eFinsuite Tax Centre</div>
              <div className="text-lg font-semibold">{ledger.profile.legalName}</div>
            </div>
            <div className="text-sm">CRA connection {ledger.authorization.status === 'connected' ? '✓ Connected' : 'Pending'}</div>
          </div>
          <div className="grid gap-2 text-sm md:grid-cols-3">
            <div>GST/HST <span className="float-right font-medium">{formatCad(gstPayable)} owing</span></div>
            <div>Payroll <span className="float-right font-medium">{formatCad(payrollTotal)} owing</span></div>
            <div>Corporate tax <span className="float-right font-medium">{formatCad(ledger.corporate.balance)} owing</span></div>
          </div>
          <div className="border-t pt-3 text-sm">
            <div className="mb-2 font-medium">Upcoming</div>
            <div className="flex justify-between"><span>GST/HST</span><span>{formatDay(ledger.gst.dueDate)} · {formatCad(gstPayable)}</span></div>
            <div className="flex justify-between"><span>Payroll</span><span>{formatDay(ledger.payroll.dueDate)} · {formatCad(payrollTotal)}</span></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => openPay()} disabled={!cra.can('prepare_payment')}>Pay CRA</Button>
            <Button asChild variant="outline">
              <Link to="/tax-cra/gst-hst">File return</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/tax-cra/efile">EFILE gateway</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <PayCraDialog open={payOpen} onOpenChange={setPayOpen} preset={preset} />
    </CraModule>
  );
}

function ProgramCard({
  title,
  href,
  balance,
  detail,
  enrolled,
}: {
  title: string;
  href: string;
  balance: number;
  detail: string;
  enrolled: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {enrolled ? (
          <>
            <div>Balance <span className="font-semibold">{formatCad(balance)}</span></div>
            <div className="text-muted-foreground">{detail}</div>
            <Button asChild variant="link" className="h-auto p-0">
              <Link to={href}>Open</Link>
            </Button>
          </>
        ) : (
          <p className="text-muted-foreground">This organization has not enrolled this CRA program account.</p>
        )}
      </CardContent>
    </Card>
  );
}
