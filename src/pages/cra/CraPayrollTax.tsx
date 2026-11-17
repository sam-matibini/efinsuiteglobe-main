import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CraModule } from '@/components/cra/CraModule';
import { bookAmount, craAmount, filingLabel, formatCad, formatDay, NOT_RETURNED_BY_CRA, remitAmount } from '@/lib/cra/engine';
import { useCraTaxCentre } from '@/hooks/useCraTaxCentre';

export default function CraPayrollTax() {
  const cra = useCraTaxCentre();
  const payroll = cra.ledger.payroll;
  const total = payroll.cpp + payroll.ei + payroll.incomeTax;
  const payAmount = remitAmount(cra.ledger.balances.payroll, total);
  const calculated = payroll.cpp !== 0 || payroll.ei !== 0 || payroll.incomeTax !== 0 || payroll.filingStatus !== 'calculated';

  return (
    <CraModule
      title="Payroll tax"
      description="Source deductions come from the eFinsuite payroll module. Review them, then remit through CRA My Payment. Payment approval is separate from the pay run."
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
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => cra.reviewPayroll()} disabled={!cra.can('prepare_payroll') || payroll.filingStatus !== 'calculated'}>
              Review
            </Button>
            {cra.can('prepare_payment') && payAmount > 0 ? (
              <Button asChild>
                <Link to="/tax-cra/payments">Remit source deductions</Link>
              </Button>
            ) : (
              <Button disabled>Remit source deductions</Button>
            )}
            <Button asChild variant="link">
              <Link to="/payroll/runs">Open pay runs</Link>
            </Button>
            <Button asChild variant="link">
              <Link to="/payroll/remittances">Payroll remittances</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {payAmount > 0
              ? `Remit source deductions opens CRA Payments to pay ${formatCad(payAmount)} for ${payroll.account} through CRA My Payment.`
              : 'CRA has not returned a payroll balance, and source deductions are not calculated yet. Review them after the pay run is ready, or remit once CRA returns an RP balance.'}
          </p>
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
