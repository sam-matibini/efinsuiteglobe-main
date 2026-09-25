import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatWhen } from '@/lib/cra/engine';
import { CRA_REPRESENTATIVE } from '@/lib/cra/representative';
import type { CraLedger } from '@/lib/cra/types';
import { useCraTaxCentre } from '@/hooks/useCraTaxCentre';

export function CraSandboxNote() {
  return (
    <div className="rounded-lg border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
      eFinsuite does not store CRA passwords. Access uses Represent a Client for{' '}
      <span className="text-foreground">{CRA_REPRESENTATIVE.shortName}</span> ({CRA_REPRESENTATIVE.representativeId}).
      Filings go through the EFILE gateway and remittances through the CRA payment engine. Figures are this
      organization's tax ledger; production transmission uses certified CRA web services.
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
      <CraSandboxNote />
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
  const connected = ledger.authorization.status === 'connected';
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
            <div className="text-sm text-muted-foreground">BN {ledger.profile.businessNumber}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className={`inline-flex h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span>{connected ? 'Connected' : ledger.authorization.status.replaceAll('_', ' ')}</span>
            <Badge variant="outline">{connected ? (ledger.authorization.level === 'level_2' ? 'Level 2' : 'Level 1') : 'Not authorized'}</Badge>
          </div>
          <div className="text-sm text-muted-foreground">Last synchronized {formatWhen(ledger.syncedAt)}</div>
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
