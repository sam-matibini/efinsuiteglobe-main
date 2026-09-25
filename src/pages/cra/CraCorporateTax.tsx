import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CraModule } from '@/components/cra/CraModule';
import { FileReturnDialog } from '@/components/cra/FileReturnDialog';
import { PayCraDialog } from '@/components/cra/PayCraDialog';
import { filingLabel, formatCad, formatDay } from '@/lib/cra/engine';
import { useCraTaxCentre } from '@/hooks/useCraTaxCentre';

export default function CraCorporateTax() {
  const cra = useCraTaxCentre();
  const t2 = cra.ledger.corporate;
  const [fileOpen, setFileOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [refile, setRefile] = useState(false);

  return (
    <CraModule
      title="Corporate income tax"
      description="Prepare the T2, file it through EFILE, and pay installments separately. The return balance is not the same figure as the CRA account balance."
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
              <Field label="Fiscal year" value={`${formatDay(t2.fiscalStart)} → ${formatDay(t2.fiscalEnd)}`} />
              <Field label="Return status" value={filingLabel(t2.filingStatus)} />
              <Field label="Balance" value={formatCad(t2.balance)} />
              <Field label="Installments" value={formatCad(t2.installmentsPaid)} />
              <Field label="Next installment" value={`${formatDay(t2.nextInstallmentDate)} · ${formatCad(t2.nextInstallmentAmount)}`} />
              <Field label="CRA account balance" value={formatCad(cra.ledger.balances.corporate_tax)} />
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
            <Button variant="outline" onClick={() => setPayOpen(true)} disabled={!cra.can('prepare_payment')}>
              Pay CRA
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            T1 and T3 stay on the EFILE gateway for clients whose authorization includes those returns. This organization is a corporation, so the active return is the T2.
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
          <PayCraDialog
            open={payOpen}
            onOpenChange={setPayOpen}
            preset={{
              taxType: 'corporate_tax',
              amount: t2.nextInstallmentAmount,
              dueDate: t2.nextInstallmentDate,
              purpose: 'Corporate tax installment',
              obligationId: `${t2.id}-installment-${t2.nextInstallmentDate}`,
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
