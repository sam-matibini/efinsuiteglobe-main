import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CraModule } from '@/components/cra/CraModule';
import { FileReturnDialog } from '@/components/cra/FileReturnDialog';
import { PayCraDialog } from '@/components/cra/PayCraDialog';
import { bookAmount, craAmount, filingLabel, formatCad, formatDay, NOT_RETURNED_BY_CRA, obligationPayments, remitAmount } from '@/lib/cra/engine';
import { useCraTaxCentre } from '@/hooks/useCraTaxCentre';

export default function CraPayrollTax() {
  const cra = useCraTaxCentre();
  const payroll = cra.ledger.payroll;
  const total = payroll.cpp + payroll.ei + payroll.incomeTax;
  const payAmount = remitAmount(cra.ledger.balances.payroll, total);
  const calculated = payroll.cpp !== 0 || payroll.ei !== 0 || payroll.incomeTax !== 0 || payroll.filingStatus !== 'calculated';
  const openPayment = obligationPayments(cra.ledger, payroll.id).find((payment) =>
    ['draft', 'authorized', 'submitted', 'processing', 'accepted', 'settled'].includes(payment.status),
  );
  const [fileOpen, setFileOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  return (
    <CraModule
      title="Payroll tax"
      description="Source deductions come from the eFinsuite payroll module. Review the PD7A, submit it, then pay CRA. Payment approval is separate from the pay run."
    >
      {!cra.ledger.profile.programs.includes('RP') ? (
        <Card><CardContent className="p-5 text-sm text-muted-foreground">RP is not enrolled. Add payroll under CRA Authorizations.</CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Payroll source deductions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Account" value={payroll.account} />
              <Field label="Pay period" value={payroll.periodStart && payroll.periodEnd ? `${formatDay(payroll.periodStart)} – ${formatDay(payroll.periodEnd)}` : NOT_RETURNED_BY_CRA} />
              <Field label="Source" value={payroll.sourcePayRunLabel || NOT_RETURNED_BY_CRA} />
              <Field label="Remittance status" value={calculated ? filingLabel(payroll.filingStatus) : 'Not calculated'} />
              <Field label="CPP" value={bookAmount(payroll.cpp, calculated)} />
              <Field label="EI" value={bookAmount(payroll.ei, calculated)} />
              <Field label="Income tax" value={bookAmount(payroll.incomeTax, calculated)} />
              <Field label="Total remittance" value={bookAmount(total, calculated)} />
              <Field label="Due date" value={payroll.dueDate ? formatDay(payroll.dueDate) : NOT_RETURNED_BY_CRA} />
              <Field label="CRA payroll balance" value={craAmount(cra.ledger.balances.payroll)} />
            </CardContent>
          </Card>
          {openPayment ? (
            <p className="text-sm text-muted-foreground">
              {openPayment.id} is {openPayment.status}, prepared by {openPayment.preparedByName}. Release it from Tax Remittances.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => cra.reviewPayroll()} disabled={!cra.can('prepare_payroll') || payroll.filingStatus !== 'calculated'}>
              Review
            </Button>
            <Button onClick={() => setFileOpen(true)} disabled={!cra.can('file_return') || payroll.filingStatus === 'calculated'}>
              Submit
            </Button>
            <Button variant="outline" onClick={() => setPayOpen(true)} disabled={!cra.can('prepare_payment') || Boolean(openPayment) || payAmount <= 0}>
              Remit source deductions
            </Button>
            <Button asChild variant="link">
              <Link to="/payroll/runs">Open pay runs</Link>
            </Button>
            <Button asChild variant="link">
              <Link to="/payroll/remittances">Payroll remittances</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {payAmount > 0
              ? `Remit source deductions sends ${formatCad(payAmount)} for ${payroll.account}. Filing the PD7A is a separate step and does not move money.`
              : 'CRA has not returned a payroll balance, and source deductions are not calculated yet. Review and file the PD7A after the pay run is ready, or remit once CRA returns an RP balance.'}
          </p>
          <FileReturnDialog
            open={fileOpen}
            onOpenChange={setFileOpen}
            title="Submit payroll remittance"
            returnType="PD7A"
            taxYear="2026"
            account={payroll.account}
            obligationId={payroll.id}
            summary={[
              { label: 'CPP', value: formatCad(payroll.cpp) },
              { label: 'EI', value: formatCad(payroll.ei) },
              { label: 'Income tax', value: formatCad(payroll.incomeTax) },
              { label: 'Total', value: formatCad(total) },
            ]}
          />
          <PayCraDialog
            open={payOpen}
            onOpenChange={setPayOpen}
            preset={{
              taxType: 'payroll',
              amount: payAmount,
              dueDate: payroll.dueDate,
              purpose: 'Payroll source deductions balance',
              obligationId: payroll.id,
            }}
          />
        </>
      )}
    </CraModule>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-lg font-medium">{value}</div>
    </div>
  );
}
