import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFundingBankAccounts } from '@/hooks/useFundingBankAccounts';
import { useApprovalRoles, ApprovalRole } from '@/hooks/useApprovalRoles';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';
import { Link } from 'react-router-dom';
import { CheckCircle2, Zap, Star, ExternalLink, ShieldCheck } from 'lucide-react';
import { PadAgreementsCard } from '@/components/treasury/PadAgreementsCard';


import { useCountryTreasuryConfig } from '@/hooks/useCountryTreasuryConfig';

export default function TreasurySettings() {
  const { config } = useCountryTreasuryConfig();
  const {
    accounts, isLoading, enableStripeAch, enablePaysafeEft, disablePaysafeEft, setDefault,
    enableNibss, disableNibss, enableRtgs, disableRtgs,
  } = useFundingBankAccounts();
  const { roles, members, threshold, toggleRole, setThreshold } = useApprovalRoles();
  const isReadOnly = useIsReadOnly();
  const [thresholdInput, setThresholdInput] = useState<string>('');
  useEffect(() => { setThresholdInput(String(threshold ?? 0)); }, [threshold]);

  const hasRole = (uid: string, role: ApprovalRole) =>
    roles.some(r => r.user_id === uid && r.role === role);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">eFinconnect Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Country &amp; Rails
            <Badge variant="outline">{config.displayName} · {config.defaultCurrency}</Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            eFinconnect adapts payment rails, tax payees, and dashboard shortcuts to your
            organization's country. Change your country in Organization Settings to switch profile.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Supported rails</div>
              <div className="flex flex-wrap gap-1.5">
                {config.rails.map((r) => (
                  <Badge key={r.id} variant="secondary" title={r.description}>{r.label}</Badge>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Tax payees</div>
              <div className="flex flex-wrap gap-1.5">
                {config.taxPayees.map((p) => (
                  <Badge key={p.code} variant="outline" title={p.authority}>{p.label}</Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Funding Bank Accounts</CardTitle>
          <p className="text-sm text-muted-foreground">
            Accounts available to fund tax remittances and AP payments. Connect via Plaid in Banking,
            then enable Stripe ACH here to allow outbound debits.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? <p>Loading…</p> : accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No bank accounts. <Link to="/banking/accounts" className="underline">Add one in Banking</Link>.
            </p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Account</TableHead><TableHead>Currency</TableHead>
                <TableHead>Plaid</TableHead><TableHead>Stripe ACH</TableHead>
                <TableHead>EFT (Paysafe)</TableHead>
                {config.countryCode === 'NG' && <><TableHead>NIBSS</TableHead><TableHead>RTGS</TableHead></>}
                <TableHead>Default</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-medium">{a.name}</div>
                      <div className="text-xs text-muted-foreground">{a.institution}</div>
                    </TableCell>
                    <TableCell>{a.currency}</TableCell>
                    <TableCell>
                      {a.isPlaidLinked
                        ? <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3" />Linked</Badge>
                        : <Badge variant="secondary">Not linked</Badge>}
                    </TableCell>
                    <TableCell>
                      {a.isStripeReady
                        ? <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" />Enabled</Badge>
                        : <Badge variant="secondary">Disabled</Badge>}
                    </TableCell>
                    <TableCell>
                      {a.isPaysafeEftEnabled
                        ? <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" />Enabled</Badge>
                        : <Badge variant="secondary">Disabled</Badge>}
                    </TableCell>
                    <TableCell>
                      {a.isDefault && <Badge variant="outline" className="gap-1"><Star className="h-3 w-3" />Default</Badge>}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {!isReadOnly && a.isPlaidLinked && !a.isStripeReady && (
                        <Button size="sm" variant="outline" disabled={enableStripeAch.isPending}
                          onClick={() => enableStripeAch.mutate(a.id)}>
                          <Zap className="mr-2 h-3 w-3" />Enable ACH
                        </Button>
                      )}
                      {!isReadOnly && !a.isPaysafeEftEnabled && (
                        <Button size="sm" variant="outline" disabled={enablePaysafeEft.isPending}
                          onClick={() => enablePaysafeEft.mutate(a.id)}>
                          <Zap className="mr-2 h-3 w-3" />Enable EFT
                        </Button>
                      )}
                      {!isReadOnly && a.isPaysafeEftEnabled && (
                        <Button size="sm" variant="ghost" disabled={disablePaysafeEft.isPending}
                          onClick={() => disablePaysafeEft.mutate(a.id)}>
                          Disable EFT
                        </Button>
                      )}
                      {!isReadOnly && !a.isDefault && (
                        <Button size="sm" variant="ghost" disabled={setDefault.isPending}
                          onClick={() => setDefault.mutate(a.id)}>
                          <Star className="mr-2 h-3 w-3" />Make default
                        </Button>
                      )}
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/banking/accounts">
                          <ExternalLink className="mr-2 h-3 w-3" />Banking
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Payment Rails</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Stripe and Plaid credentials are configured in Lovable Cloud. Connect bank accounts via
            Plaid in the Banking module, then enable ACH above to allow Treasury to draw funds and
            send outbound payments. Tax authorities are managed under Sales Tax → Tax Center.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Payments Approval Hierarchy</CardTitle>
          <p className="text-sm text-muted-foreground">
            Assign Preparer, Reviewer and Approver roles. Payments at or above the threshold require
            review and approval before they can be processed. A user cannot review or approve a payment they prepared.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-2 max-w-md">
            <div className="flex-1">
              <Label>Approval threshold ({"CAD"})</Label>
              <Input type="number" step="0.01" value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)} disabled={isReadOnly} />
              <p className="text-xs text-muted-foreground mt-1">Payments ≥ this amount need full Preparer → Reviewer → Approver flow.</p>
            </div>
            <Button onClick={() => setThreshold.mutate(Number(thresholdInput || 0))}
              disabled={isReadOnly || setThreshold.isPending}>Save</Button>
          </div>

          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No organization members found.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Member</TableHead>
                <TableHead className="text-center">Preparer</TableHead>
                <TableHead className="text-center">Reviewer</TableHead>
                <TableHead className="text-center">Approver</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.user_id}>
                    <TableCell>
                      <div className="font-medium">{m.display_name ?? `User ${m.user_id.slice(0, 8)}`}</div>
                      <div className="text-xs text-muted-foreground">
                        <span className="capitalize">{m.role}</span>
                        <span className="mx-1">·</span>
                        <span className="font-mono">{m.user_id.slice(0, 8)}</span>
                      </div>
                    </TableCell>
                    {(['preparer', 'reviewer', 'approver'] as ApprovalRole[]).map((r) => (
                      <TableCell key={r} className="text-center">
                        <Checkbox
                          checked={hasRole(m.user_id, r)}
                          disabled={isReadOnly || toggleRole.isPending}
                          onCheckedChange={(c) => toggleRole.mutate({ user_id: m.user_id, role: r, enabled: !!c })}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PadAgreementsCard />
    </div>
  );
}

