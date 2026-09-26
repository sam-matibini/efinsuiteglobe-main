import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConnectionSummary, CraModule } from '@/components/cra/CraModule';
import { PayCraDialog, type PayPreset } from '@/components/cra/PayCraDialog';
import { authorizationView } from '@/lib/cra/authorizationView';
import { bookAmount, craAmount, craCount, craYesNo, formatDay, NOT_RETURNED_BY_CRA, outstandingBalance, upcomingAssessed } from '@/lib/cra/engine';
import { useCraTaxCentre } from '@/hooks/useCraTaxCentre';

export default function CraDashboard() {
  const cra = useCraTaxCentre();
  const [payOpen, setPayOpen] = useState(false);
  const [preset, setPreset] = useState<PayPreset | undefined>();
  const { ledger } = cra;
  const outstanding = outstandingBalance(ledger);
  const upcoming = upcomingAssessed(ledger);
  const gstCalculated = ledger.gst.collected !== 0 || ledger.gst.itcs !== 0 || ledger.gst.filingStatus !== 'calculated';
  const payrollCalculated = ledger.payroll.cpp !== 0 || ledger.payroll.ei !== 0 || ledger.payroll.incomeTax !== 0 || ledger.payroll.filingStatus !== 'calculated';
  const corporateCalculated = ledger.corporate.balance !== 0 || ledger.corporate.installmentsPaid !== 0 || ledger.corporate.filingStatus !== 'not_filed';
  const gstPayable = ledger.gst.collected - ledger.gst.itcs;
  const payrollTotal = ledger.payroll.cpp + ledger.payroll.ei + ledger.payroll.incomeTax;
  const enquiry = ledger.enquiry;

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
            <div className="text-2xl font-semibold">{craAmount(outstanding)}</div>
            {ledger.balanceSource === 'represent_a_client' ? (
              <p className="mt-1 text-xs text-muted-foreground">Represent a Client business total. GST/HST RT0001 is listed separately.</p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming assessed payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{craAmount(upcoming)}</div>
            <p className="mt-1 text-xs text-muted-foreground">Payroll and corporate account balances with a due date.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Client data enquiry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>Balance owing {craAmount(outstanding)}</div>
            <div>Outstanding returns {craYesNo(enquiry?.outstandingReturnsLabel, enquiry?.outstandingReturns)}</div>
            <div>Review status {enquiry?.reviewStatus || NOT_RETURNED_BY_CRA}</div>
            <div>Unfiled returns {craCount(enquiry?.unfiledReturns)}</div>
            <div>GST/HST outstanding {craAmount(ledger.balances.gst_hst)}</div>
            {enquiry?.gstOutstandingReturnsLabel ? <div>GST/HST outstanding returns {enquiry.gstOutstandingReturnsLabel}</div> : null}
            {ledger.notices.map((notice) => (
              <div key={notice.id}>{notice.title} · {formatDay(notice.receivedAt.slice(0, 10))} · {notice.body}</div>
            ))}
            <div>EFILE restriction {enquiry?.efileRestricted == null ? NOT_RETURNED_BY_CRA : enquiry.efileRestricted ? 'Yes' : 'No'}</div>
            <div>Direct deposit {enquiry?.directDepositAvailable == null ? NOT_RETURNED_BY_CRA : enquiry.directDepositAvailable ? 'Available' : 'Not available'}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ProgramCard
          title="GST/HST"
          href="/tax-cra/gst-hst"
          balance={ledger.balances.gst_hst}
          detail={ledger.gst.dueDate ? `Next filing ${formatDay(ledger.gst.dueDate)}` : 'Due date not returned by CRA'}
          enrolled={ledger.profile.programs.includes('RT')}
        />
        <ProgramCard
          title="Payroll"
          href="/tax-cra/payroll"
          balance={ledger.balances.payroll}
          detail={ledger.payroll.dueDate ? `Next remittance ${formatDay(ledger.payroll.dueDate)}` : 'Due date not returned by CRA'}
          enrolled={ledger.profile.programs.includes('RP')}
        />
        <ProgramCard
          title="Corporate tax"
          href="/tax-cra/corporate"
          balance={ledger.balances.corporate_tax}
          detail={ledger.corporate.nextInstallmentDate ? `Next payment ${formatDay(ledger.corporate.nextInstallmentDate)}` : 'Due date not returned by CRA'}
          enrolled={ledger.profile.programs.includes('RC')}
        />
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Books in eFinsuite</div>
              <div className="text-lg font-semibold">{ledger.profile.legalName}</div>
              <p className="text-xs text-muted-foreground">Local book figures. They are not CRA account balances. Ledger GST/HST and PST reports are in Sales Tax.</p>
            </div>
            <div className="text-sm">CRA connection {authorizationView(ledger.authorization).label}</div>
          </div>
          <div className="grid gap-2 text-sm md:grid-cols-3">
            <div>GST/HST <span className="float-right font-medium">{bookAmount(gstPayable, gstCalculated)}</span></div>
            <div>Payroll <span className="float-right font-medium">{bookAmount(payrollTotal, payrollCalculated)}</span></div>
            <div>Corporate tax <span className="float-right font-medium">{bookAmount(ledger.corporate.balance, corporateCalculated)}</span></div>
          </div>
          <div className="border-t pt-3 text-sm">
            <div className="mb-2 font-medium">Upcoming</div>
            <div className="flex justify-between"><span>GST/HST</span><span>{ledger.gst.dueDate ? formatDay(ledger.gst.dueDate) : NOT_RETURNED_BY_CRA} · {bookAmount(gstPayable, gstCalculated)}</span></div>
            <div className="flex justify-between"><span>Payroll</span><span>{ledger.payroll.dueDate ? formatDay(ledger.payroll.dueDate) : NOT_RETURNED_BY_CRA} · {bookAmount(payrollTotal, payrollCalculated)}</span></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => openPay()} disabled={!cra.can('prepare_payment')}>Pay CRA</Button>
            <Button asChild variant="outline">
              <Link to="/tax-cra/gst-hst">File return</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/tax-cra/efile">EFILE gateway</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/tax">Sales tax reporting</Link>
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
  balance: number | null;
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
            <div>Balance <span className="font-semibold">{craAmount(balance)}</span></div>
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
