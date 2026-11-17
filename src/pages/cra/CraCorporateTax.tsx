import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CraModule } from '@/components/cra/CraModule';
import { FileReturnDialog } from '@/components/cra/FileReturnDialog';
import { bookAmount, craAmount, filingLabel, formatCad, formatDay, NOT_RETURNED_BY_CRA } from '@/lib/cra/engine';
import { knownCraOverview } from '@/lib/cra/store';
import { useCraTaxCentre } from '@/hooks/useCraTaxCentre';

export default function CraCorporateTax() {
  const cra = useCraTaxCentre();
  const t2 = cra.ledger.corporate;
  const overview = knownCraOverview(cra.ledger.profile.businessNumber);
  const craBalance = cra.ledger.balances.corporate_tax;
  const [fileOpen, setFileOpen] = useState(false);
  const [refile, setRefile] = useState(false);

  return (
    <CraModule
      title="Corporate income tax"
      description="Prepare the T2, file it with CRA-certified T2 software, then pay the balance or installments through CRA My Payment. The return balance is not the same figure as the CRA account balance."
    >
      {!cra.ledger.profile.programs.includes('RC') ? (
        <Card><CardContent className="p-5 text-sm text-muted-foreground">RC is not enrolled. Add corporate income tax under CRA Authorizations.</CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>T2</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Fiscal year" value={t2.fiscalStart && t2.fiscalEnd ? `${formatDay(t2.fiscalStart)} → ${formatDay(t2.fiscalEnd)}` : NOT_RETURNED_BY_CRA} />
              <Field label="Return status" value={t2.filingStatus === 'not_filed' && t2.balance === 0 ? 'Not calculated' : filingLabel(t2.filingStatus)} />
              <Field label="Balance" value={bookAmount(t2.balance, t2.balance !== 0 || t2.filingStatus !== 'not_filed')} />
              <Field label="Installments" value={bookAmount(t2.installmentsPaid, t2.installmentsPaid !== 0 || t2.filingStatus !== 'not_filed')} />
              <Field label="Next installment" value={t2.nextInstallmentDate ? `${formatDay(t2.nextInstallmentDate)} · ${formatCad(t2.nextInstallmentAmount)}` : NOT_RETURNED_BY_CRA} />
              <Field label="CRA account balance" value={craAmount(craBalance)} />
              <Field label="Current interim balance" value={overview ? formatCad(overview.corporateInterim) : NOT_RETURNED_BY_CRA} />
              <Field label="As of" value={overview?.asOf ? formatDay(overview.asOf) : NOT_RETURNED_BY_CRA} />
              <Field label="Account" value="RC0001" />
              <Field label="Business number" value={cra.ledger.profile.businessNumber} />
            </CardContent>
          </Card>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => cra.prepareT2()} disabled={!cra.can('prepare_corporate') || t2.filingStatus !== 'not_filed'}>
              Prepare T2
            </Button>
            <Button onClick={() => { setRefile(false); setFileOpen(true); }} disabled={!cra.can('file_return') || t2.filingStatus === 'not_filed'}>
              File T2
            </Button>
            <Button variant="outline" onClick={() => { setRefile(true); setFileOpen(true); }} disabled={!cra.can('file_return') || t2.filingStatus !== 'filed'}>
              ReFILE
            </Button>
            {cra.can('prepare_payment') ? (
              <Button asChild variant="outline">
                <Link to="/tax-cra/payments">Pay CRA</Link>
              </Button>
            ) : (
              <Button variant="outline" disabled>Pay CRA</Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            CRA accepts a T2 only from CRA-certified software through Corporation Internet Filing. Record CRA's confirmation here after filing. Pay CRA opens CRA Payments.
          </p>
          <FileReturnDialog
            open={fileOpen}
            onOpenChange={setFileOpen}
            title={refile ? 'ReFILE T2' : 'File T2'}
            returnType={refile ? 'ReFILE' : 'T2'}
            taxYear="2025"
            account="RC0001"
            obligationId={refile ? `${t2.id}-refile` : t2.id}
            summary={[
              { label: 'Fiscal year', value: `${t2.fiscalStart} → ${t2.fiscalEnd}` },
              { label: 'Balance', value: formatCad(t2.balance) },
              { label: 'Installments', value: formatCad(t2.installmentsPaid) },
              { label: 'Next installment', value: formatCad(t2.nextInstallmentAmount) },
            ]}
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
