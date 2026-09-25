import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CraModule } from '@/components/cra/CraModule';
import { CAPABILITY_COLUMNS, ROLE_MATRIX, effectiveCapabilities, formatWhen } from '@/lib/cra/engine';
import { CRA_REPRESENTATIVE, PROGRAM_LABEL } from '@/lib/cra/representative';
import type { AccessCeiling, CraProfile, CraProgramCode } from '@/lib/cra/types';
import { useCraTaxCentre } from '@/hooks/useCraTaxCentre';

const PROGRAMS: CraProgramCode[] = ['RC', 'RT', 'RP', 'RZ', 'OTHER'];
const PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];
const BUSINESS_TYPES = ['Corporation', 'Sole proprietorship', 'Partnership', 'Trust', 'Non-profit', 'Other'];

export default function CraAuthorizations() {
  const cra = useCraTaxCentre();
  const [profile, setProfile] = useState<CraProfile>(cra.ledger.profile);
  const [ceiling, setCeiling] = useState<AccessCeiling>(cra.ledger.accessCeiling);
  const [checkOpen, setCheckOpen] = useState(false);
  const auth = cra.ledger.authorization;

  useEffect(() => {
    setProfile(cra.ledger.profile);
    setCeiling(cra.ledger.accessCeiling);
  }, [cra.ledger.profile, cra.ledger.accessCeiling]);

  const toggleProgram = (program: CraProgramCode, checked: boolean) => {
    setProfile((current) => ({
      ...current,
      programs: checked ? [...current.programs, program] : current.programs.filter((item) => item !== program),
    }));
  };

  return (
    <CraModule
      title="CRA authorizations"
      description="Represent a Client grants access. EFILE is a separate filing service. Employees only receive the CRA actions their eFinsuite role allows."
    >
      <Card>
        <CardHeader>
          <CardTitle>Connect your CRA business account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>eFinsuite is an authorized CRA representative.</p>
          <p>Representative: {CRA_REPRESENTATIVE.legalName}</p>
          <p>CRA representative ID: {CRA_REPRESENTATIVE.representativeId}</p>
          <p className="text-muted-foreground">
            Status: {auth.status === 'pending_client_confirmation' ? 'Pending client confirmation' : auth.status.replaceAll('_', ' ')}
            {auth.level && auth.status === 'connected' ? ` · ${auth.level === 'level_2' ? 'Level 2' : 'Level 1'}` : ''}
            {auth.reference ? ` · ${auth.reference}` : ''}
          </p>
          {auth.status === 'pending_client_confirmation' ? (
            <p>The business owner or director must confirm {CRA_REPRESENTATIVE.shortName} as an authorized representative through CRA My Business Account.</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => cra.requestAuthorization()} disabled={!cra.can('manage_authorization') || auth.status === 'connected' || auth.status === 'pending_client_confirmation'}>
              Request CRA authorization
            </Button>
            <Button variant="outline" onClick={() => cra.sendInstructions()} disabled={auth.status === 'not_started'}>
              Send instructions
            </Button>
            <Button variant="outline" onClick={() => setCheckOpen(true)}>
              Check status
            </Button>
            <Button variant="ghost" onClick={() => cra.revokeAuthorization()} disabled={!cra.can('manage_authorization') || auth.status === 'not_started'}>
              Revoke
            </Button>
          </div>
          {auth.instructionsSentAt ? (
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Sign in to CRA My Business Account as a director or owner of {profile.legalName}.</li>
              <li>Open Manage authorized representatives.</li>
              <li>Confirm {CRA_REPRESENTATIVE.shortName}, representative ID {CRA_REPRESENTATIVE.representativeId}.</li>
              <li>Return here and check status. eFinsuite never asks for the CRA password.</li>
            </ol>
          ) : null}
          {auth.instructionsSentAt ? <p className="text-xs text-muted-foreground">Instructions prepared {formatWhen(auth.instructionsSentAt)} for {profile.contactEmail}.</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Business profile and program accounts</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Legal business name">
            <Input value={profile.legalName} onChange={(event) => setProfile({ ...profile, legalName: event.target.value })} />
          </Field>
          <Field label="Business number">
            <Input value={profile.businessNumber} onChange={(event) => setProfile({ ...profile, businessNumber: event.target.value })} maxLength={9} />
          </Field>
          <Field label="Corporation number">
            <Input value={profile.corporationNumber} onChange={(event) => setProfile({ ...profile, corporationNumber: event.target.value })} />
          </Field>
          <Field label="Business type">
            <Select value={profile.businessType} onValueChange={(value) => setProfile({ ...profile, businessType: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BUSINESS_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Province">
            <Select value={profile.province} onValueChange={(value) => setProfile({ ...profile, province: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROVINCES.map((province) => <SelectItem key={province} value={province}>{province}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Fiscal year end (MM-DD)">
            <Input value={profile.fiscalYearEnd} onChange={(event) => setProfile({ ...profile, fiscalYearEnd: event.target.value })} />
          </Field>
          <Field label="Registered address">
            <Input value={profile.address} onChange={(event) => setProfile({ ...profile, address: event.target.value })} />
          </Field>
          <Field label="Primary contact">
            <Input value={profile.contactName} onChange={(event) => setProfile({ ...profile, contactName: event.target.value })} />
          </Field>
          <Field label="Contact email">
            <Input value={profile.contactEmail} onChange={(event) => setProfile({ ...profile, contactEmail: event.target.value })} />
          </Field>
          <div className="space-y-2 md:col-span-2">
            <Label>CRA program accounts</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {PROGRAMS.map((program) => (
                <label key={program} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={profile.programs.includes(program)}
                    onCheckedChange={(checked) => toggleProgram(program, checked === true)}
                  />
                  {program === 'OTHER' ? 'Other CRA program accounts' : `${program} — ${PROGRAM_LABEL[program]}`}
                </label>
              ))}
            </div>
            {profile.programs.includes('OTHER') ? (
              <Input
                placeholder="Describe the other program account"
                value={profile.otherProgramNote}
                onChange={(event) => setProfile({ ...profile, otherProgramNote: event.target.value })}
              />
            ) : null}
            <p className="text-xs text-muted-foreground">Only selected accounts are shown. A client does not need every program.</p>
          </div>
          <div>
            <Button onClick={() => cra.saveProfile(profile)} disabled={!cra.can('manage_authorization') && !cra.can('prepare_gst')}>
              Save business profile
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CRA access level</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <CeilingRow label="Level 1 — view CRA information" checked={ceiling.view} onChange={(view) => setCeiling({ ...ceiling, view })} />
            <CeilingRow label="Level 2 — view, plus permitted account changes and filing activity" checked={ceiling.level2} onChange={(level2) => setCeiling({ ...ceiling, level2 })} />
            <CeilingRow label="Tax filing — submit tax returns" checked={ceiling.taxFiling} onChange={(taxFiling) => setCeiling({ ...ceiling, taxFiling })} />
            <CeilingRow label="Remittance — prepare tax payment" checked={ceiling.remittance} onChange={(remittance) => setCeiling({ ...ceiling, remittance })} />
            <CeilingRow label="Administration — manage CRA authorization" checked={ceiling.administration} onChange={(administration) => setCeiling({ ...ceiling, administration })} />
          </div>
          <Button onClick={() => cra.saveAccessCeiling(ceiling)} disabled={!cra.can('manage_authorization')}>
            Save
          </Button>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 pr-3 font-medium">Role</th>
                  {CAPABILITY_COLUMNS.map((column) => (
                    <th key={column.cap} className="px-2 py-2 font-medium">{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROLE_MATRIX.map((row) => {
                  const caps = effectiveCapabilities(row.role, ceiling);
                  return (
                    <tr key={row.role} className="border-b">
                      <td className="py-2 pr-3">{row.label}</td>
                      {CAPABILITY_COLUMNS.map((column) => (
                        <td key={column.cap} className="px-2 py-2">{caps.includes(column.cap) ? '✓' : '—'}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground">
            You are signed in as {cra.actor.email} ({cra.actor.role.replaceAll('_', ' ')}). The ceiling above can only narrow what a role already allows. Owners keep administration so the organization cannot be locked out.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Encryption at rest and in transit for business numbers, program accounts, authorization references, and confirmations.</li>
            <li>MFA, least privilege, and segregation of duties on payment release.</li>
            <li>Every view, filing, and payment is written to the CRA activity log.</li>
          </ul>
        </CardContent>
      </Card>

      <Dialog open={checkOpen} onOpenChange={setCheckOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check CRA authorization</DialogTitle>
            <DialogDescription>
              Confirm only after the director has approved {CRA_REPRESENTATIVE.shortName} in My Business Account. Do not enter a CRA password.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { cra.noteStillPending(); setCheckOpen(false); }}>
              Still pending
            </Button>
            <Button onClick={() => { cra.recordClientConfirmation(); setCheckOpen(false); }} disabled={!cra.can('manage_authorization')}>
              Client confirmed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CraModule>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function CeilingRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      {label}
    </label>
  );
}
