import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { authorizationView } from '@/lib/cra/authorizationView';
import { formatWhen } from '@/lib/cra/engine';
import type { CraConnectionInfo } from '@/lib/cra/gatewayClient';
import type { CraLedger } from '@/lib/cra/types';
import { useCraTaxCentre } from '@/hooks/useCraTaxCentre';

export function CraSandboxNote({ connection }: { connection?: CraConnectionInfo }) {
  const representativeName = connection?.representativeName || 'not configured';
  const representativeId = connection?.representativeId || 'not configured';
  const efileName = connection?.efileName || 'not configured';
  const gaps = [
    connection?.loaded && !connection.efileConfigured
      ? connection.efileNumberConfigured
        ? 'The EFILE number is saved. Transmit still needs the https address from the CRA certification kit, so a return is not accepted.'
        : 'Save the firm EFILE number and password in Admin → Tax & CRA. A return is not accepted until CRA confirms it.'
      : '',
    connection?.loaded && !connection.cdeConfigured
      ? 'Client Data Enquiry still needs the firm representative ID and EFILE software credentials. Refresh does not change balances unless CRA returns account data.'
      : '',
    connection?.loaded && !connection.nombaConfigured ? 'Nomba card checkout is not configured, so a payment stays authorized.' : '',
  ].filter(Boolean);
  return (
    <div className="rounded-lg border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
      eFinsuite does not store CRA passwords. Firm representative and EFILE software credentials saved in Admin → Tax & CRA are used for filing, Client Data Enquiry, and remittances. Represent a Client uses{' '}
      <span className="text-foreground">{representativeName}</span>, representative ID{' '}
      <span className="text-foreground">{representativeId}</span>. EFILE transmissions use{' '}
      <span className="text-foreground">{efileName}</span>. A return is accepted only when the configured CRA
      EFILE service returns a confirmation. A remittance is paid only after Nomba confirms a Visa or Mastercard charge. Card numbers stay on Nomba Checkout.
      {gaps.length ? ` ${gaps.join(' ')}` : ''}
    </div>
  );
}

export function CraModule({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const cra = useCraTaxCentre();

  if (cra.isLoading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading CRA Tax & Remittance…</div>;
  }

  if (cra.country !== 'CA') {
    return (
      <Card>
        <CardContent className="space-y-2 p-6">
          <h1 className="text-2xl font-bold">CRA Tax & Remittance</h1>
          <p className="text-muted-foreground">
            CRA services apply to Canadian business numbers and program accounts. Switch the country scope to Canada
            to open GST/HST, payroll source deductions, and corporate income tax for this organization.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!cra.can('view')) {
    return (
      <Card>
        <CardContent className="space-y-2 p-6">
          <h1 className="text-2xl font-bold">CRA access required</h1>
          <p className="text-muted-foreground">
            Your eFinsuite role does not include CRA Tax & Remittance. An owner or finance manager can grant access
            without sharing a CRA password.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <CraSandboxNote connection={cra.connection} />
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">CRA Tax & Remittance</p>
          <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
          {description ? <p className="mt-1 max-w-3xl text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function ConnectionSummary({ ledger }: { ledger: CraLedger }) {
  const cra = useCraTaxCentre();
  const view = authorizationView(ledger.authorization);
  const representativeId = ledger.authorization.representativeId || cra.connection?.representativeId || '';
  const programs = ledger.accounts.map((account) => ({
    ok: true,
    label: account.label,
  }));
  return (
    <Card>
      <CardContent className="grid gap-4 p-5 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> CRA connection
          </div>
          <div>
            <div className="text-lg font-semibold">{ledger.profile.legalName}</div>
            <div className="text-sm text-muted-foreground">{ledger.profile.businessNumber ? `BN ${ledger.profile.businessNumber}` : 'Business number not on file'}</div>
          </div>
          {view.representativeName ? (
            <div className="text-sm">
              <span className="text-muted-foreground">CRA representative </span>
              <span className="font-medium">{view.representativeName}</span>
              {representativeId ? <span className="text-muted-foreground"> · {representativeId}</span> : null}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className={`inline-flex h-2.5 w-2.5 rounded-full ${view.tone === 'authorized' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span>{view.label}</span>
            <Badge variant="outline">{view.badge}</Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            {ledger.balanceSource === 'represent_a_client'
              ? 'Balances match the Represent a Client overview. Internet File Transfer does not include those amounts.'
              : ledger.syncedAt && (ledger.balancesFromCra || ledger.authorization.verifiedByCra)
                ? `Last synchronized ${formatWhen(ledger.syncedAt)}`
                : 'CRA has not returned account balances.'}
          </div>
          <div className="text-sm text-muted-foreground">
            {ledger.authorization.verifiedByCra
              ? 'Verified with CRA Client Data Enquiry.'
              : ledger.balanceSource === 'represent_a_client'
                ? 'This representative is authorized for the business. Payroll and corporate account lines were not itemized on the overview, so those amounts stay blank.'
                : view.tone === 'authorized'
                  ? 'This representative is authorized for the business. Amounts stay blank until CRA returns them.'
                  : 'Refresh asks CRA. Amounts stay blank until CRA returns them.'}
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <div className="font-medium">Programs</div>
          {programs.length === 0 ? (
            <p className="text-muted-foreground">No program accounts selected yet.</p>
          ) : (
            programs.map((program) => (
              <div key={program.label}>✓ {program.label}</div>
            ))
          )}
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link to="/tax-cra/authorizations">Manage authorization</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
