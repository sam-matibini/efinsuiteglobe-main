import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CraModule } from '@/components/cra/CraModule';
import { FileReturnDialog } from '@/components/cra/FileReturnDialog';
import { PayCraDialog } from '@/components/cra/PayCraDialog';
import { bookAmount, craAmount, filingLabel, formatCad, formatDay, NOT_RETURNED_BY_CRA, obligationPayments } from '@/lib/cra/engine';
import { useCraTaxCentre } from '@/hooks/useCraTaxCentre';

const STEPS = ['Tax calculation', 'Return preparation', 'Filing', 'Payment', 'Reconciliation'];

export default function CraGstHst() {
  const cra = useCraTaxCentre();
  const gst = cra.ledger.gst;
  const payable = gst.collected - gst.itcs;
  const calculated = gst.collected !== 0 || gst.itcs !== 0 || gst.filingStatus !== 'calculated';
  const payments = obligationPayments(cra.ledger, gst.id);
  const [fileOpen, setFileOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const step = stepIndex(gst.filingStatus, payments.some((payment) => payment.status === 'confirmed'), payments.length > 0);

  return (
    <CraModule
      title="GST/HST"
      description="Calculate the return from collected tax and ITCs, review it, file it through EFILE, then pay CRA. Those steps stay separate."
    >
      {!cra.ledger.profile.programs.includes('RT') ? (
        <Card><CardContent className="p-5 text-sm text-muted-foreground">RT is not enrolled. Add it under CRA Authorizations.</CardContent></Card>
      ) : (
        <>
          <ol className="grid gap-2 md:grid-cols-5">
            {STEPS.map((label, index) => (
              <li key={label} className={`rounded-md border px-3 py-2 text-sm ${index <= step ? 'border-primary/40 bg-primary/5' : 'text-muted-foreground'}`}>
                {index + 1}. {label}
              </li>
            ))}
          </ol>
          <Card>
            <CardHeader>
              <CardTitle>Current period</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Reporting period" value={gst.periodStart && gst.periodEnd ? `${formatDay(gst.periodStart)} – ${formatDay(gst.periodEnd)}` : NOT_RETURNED_BY_CRA} />
              <Field label="Return status" value={calculated ? filingLabel(gst.filingStatus) : 'Not calculated'} />
              <Field label="GST/HST collected" value={bookAmount(gst.collected, calculated)} />
              <Field label="ITCs" value={bookAmount(gst.itcs, calculated)} />
              <Field label="Estimated amount payable" value={bookAmount(payable, calculated)} />
              <Field label="Due date" value={gst.dueDate ? formatDay(gst.dueDate) : NOT_RETURNED_BY_CRA} />
              <Field label="CRA account balance" value={craAmount(cra.ledger.balances.gst_hst)} />
              <Field label="Account" value="RT0001" />
            </CardContent>
          </Card>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => cra.reviewGst()} disabled={!cra.can('prepare_gst') || gst.filingStatus !== 'calculated'}>
              Review return
            </Button>
            <Button onClick={() => setFileOpen(true)} disabled={!cra.can('file_return') || gst.filingStatus === 'calculated'}>
              File return
            </Button>
            <Button variant="outline" onClick={() => setPayOpen(true)} disabled={!cra.can('prepare_payment')}>
              Pay CRA
            </Button>
            <Button asChild variant="link">
              <Link to="/tax">Sales tax transactions</Link>
            </Button>
          </div>
          <FileReturnDialog
            open={fileOpen}
            onOpenChange={setFileOpen}
            title="File GST/HST return"
            returnType="GST34"
            taxYear="2026"
            account="RT0001"
            obligationId={gst.id}
            summary={[
              { label: 'Collected', value: formatCad(gst.collected) },
              { label: 'ITCs', value: formatCad(gst.itcs) },
              { label: 'Payable', value: formatCad(payable) },
              { label: 'Due', value: formatDay(gst.dueDate) },
            ]}
          />
          <PayCraDialog
            open={payOpen}
            onOpenChange={setPayOpen}
            preset={{
              taxType: 'gst_hst',
              amount: payable,
              dueDate: gst.dueDate,
              purpose: 'GST/HST return',
              obligationId: gst.id,
            }}
          />
        </>
      )}
    </CraModule>
  );
}

function stepIndex(filing: string, reconciled: boolean, paymentStarted: boolean) {
  if (reconciled) return 4;
  if (paymentStarted) return 3;
  if (filing === 'filed') return 2;
  if (filing === 'reviewed') return 1;
  return 0;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-lg font-medium">{value}</div>
    </div>
  );
}
