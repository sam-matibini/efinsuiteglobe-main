/**
 * TaxEFile — Phase 11 dashboard
 * Lists submissions, allows building a packet for a filing period and submitting/exporting.
 */
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  ArrowLeft,
  Send,
  Download,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  KeyRound,
  History,
  Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useTaxFilingPeriods } from '@/hooks/useTaxFilingPeriods';
import { useTaxAuthorities } from '@/hooks/useTaxAuthorities';
import { useTaxReturnPreview } from '@/hooks/useTaxReturnPreview';
import { useTaxSubmissions, useAuthorityCredentials } from '@/hooks/useTaxSubmissions';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { buildEFilePacket } from '@/lib/efile';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const STATUS_VARIANT: Record<string, string> = {
  drafted: 'bg-muted text-foreground',
  transmitted: 'bg-blue-500/15 text-blue-600',
  acknowledged: 'bg-emerald-500/15 text-emerald-600',
  rejected: 'bg-destructive/15 text-destructive',
  failed: 'bg-destructive/15 text-destructive',
  superseded: 'bg-muted text-muted-foreground',
};

function downloadFile(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TaxEFile() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const readOnly = useIsReadOnly();
  const { currentOrganization } = useOrganizationContext();
  const { authorities } = useTaxAuthorities();
  const [selectedAuthorityId, setSelectedAuthorityId] = useState<string>('');
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [credDialogOpen, setCredDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(null);
  const [confirmationNumber, setConfirmationNumber] = useState('');

  const { periods } = useTaxFilingPeriods(selectedAuthorityId || undefined);
  const { submissions, createSubmission, transmitDirect, recordConfirmation } = useTaxSubmissions();
  const authority = authorities.find((a) => a.id === selectedAuthorityId);
  const { credentials, upsert: upsertCred } = useAuthorityCredentials(selectedAuthorityId || undefined);

  // Country code lookup
  const { data: country } = useQuery({
    queryKey: ['country', authority?.country_id],
    enabled: Boolean(authority?.country_id),
    queryFn: async () => {
      const { data } = await supabase.from('countries').select('code').eq('id', authority!.country_id!).maybeSingle();
      return data;
    },
  });

  // Period
  const period = periods.find((p) => p.id === selectedPeriodId);
  const previewInput = period && authority ? {
    periodId: period.id,
    periodStart: period.period_start,
    periodEnd: period.period_end,
    authorityId: authority.id,
    authorityName: authority.name,
    authorityRegion: authority.region,
    authorityCountryCode: country?.code ?? null,
    reportingCurrency: authority.reporting_currency,
  } : null;
  const { data: preview } = useTaxReturnPreview(previewInput);

  const hmrcCred = credentials.find((c) => c.credential_type === 'hmrc_oauth');
  const craCred = credentials.find((c) => c.credential_type === 'cra_wac');
  const usCred = credentials.find((c) => c.credential_type === 'us_state_login');

  const packet = useMemo(() => {
    if (!preview?.form || !authority) return null;
    return buildEFilePacket(preview.form, {
      countryCode: country?.code,
      region: authority.region,
      vrn: hmrcCred?.vrn,
      periodKey: period?.period_end?.slice(2, 4) + 'A1', // simplistic
      businessNumber: craCred?.business_number,
      webAccessCode: (craCred?.payload as any)?.wac,
      contactName: currentOrganization?.name,
      registrationNumber: (usCred?.payload as any)?.registration_number,
    });
  }, [preview, authority, country, hmrcCred, craCred, usCred, period, currentOrganization]);

  const handleConnectHmrc = () => {
    if (!authority || !currentOrganization) return;
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hmrc-oauth?action=authorize&authorityId=${authority.id}&orgId=${currentOrganization.id}&returnTo=/tax/e-file`;
    window.location.href = url;
  };

  const handleSubmit = async () => {
    if (!packet || !period || !authority) return;
    const sub = await createSubmission.mutateAsync({
      packet,
      filingPeriodId: period.id,
      authorityId: authority.id,
    });
    if (packet.canDirectSubmit) {
      await transmitDirect.mutateAsync({ submissionId: sub.id, channel: packet.channel });
    } else {
      // For manual channels, mark transmitted and open the portal
      await transmitDirect.mutateAsync({ submissionId: sub.id, channel: packet.channel });
      if (packet.portalUrl) window.open(packet.portalUrl, '_blank', 'noopener');
    }
  };

  const handleDownload = () => {
    if (!packet) return;
    downloadFile(packet.filename, packet.contents, packet.mimeType);
    toast.success('Packet downloaded');
  };

  // Show toast if HMRC just connected
  useMemo(() => {
    if (search.get('hmrc') === 'connected') toast.success('HMRC connected successfully');
  }, [search]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/tax')} className="mb-2">
          <ArrowLeft className="w-4 h-4 mr-2" /> Sales Tax
        </Button>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Send className="w-7 h-7 text-primary" /> E-File Returns
        </h1>
        <p className="text-muted-foreground mt-1">
          Submit tax returns directly to authorities (HMRC) or generate portal-ready packets (CRA, US states).
        </p>
      </div>

      <Tabs defaultValue="new">
        <TabsList>
          <TabsTrigger value="new"><Plus className="w-4 h-4 mr-1" /> New Submission</TabsTrigger>
          <TabsTrigger value="history"><History className="w-4 h-4 mr-1" /> History ({submissions.length})</TabsTrigger>
          <TabsTrigger value="credentials"><KeyRound className="w-4 h-4 mr-1" /> Credentials</TabsTrigger>
        </TabsList>

        {/* NEW SUBMISSION */}
        <TabsContent value="new" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Select filing</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Authority</Label>
                <select
                  className="w-full mt-1 border rounded-md p-2 bg-background"
                  value={selectedAuthorityId}
                  onChange={(e) => { setSelectedAuthorityId(e.target.value); setSelectedPeriodId(''); }}
                >
                  <option value="">Select authority…</option>
                  {authorities.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.region ?? ''})</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Filing period</Label>
                <select
                  className="w-full mt-1 border rounded-md p-2 bg-background"
                  value={selectedPeriodId}
                  onChange={(e) => setSelectedPeriodId(e.target.value)}
                  disabled={!selectedAuthorityId}
                >
                  <option value="">Select period…</option>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {format(parseISO(p.period_start), 'PP')} – {format(parseISO(p.period_end), 'PP')} ({p.status})
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {packet && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                  <span>Submission Packet — {packet.form.formCode}</span>
                  <Badge variant={packet.canDirectSubmit ? 'default' : 'secondary'}>
                    {packet.canDirectSubmit ? 'Direct API' : 'Portal Upload'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm space-y-1">
                  <div><span className="text-muted-foreground">Channel:</span> <span className="font-mono">{packet.channel}</span></div>
                  <div><span className="text-muted-foreground">Format:</span> <span className="font-mono">{packet.format.toUpperCase()}</span></div>
                  <div><span className="text-muted-foreground">Net payable:</span> <span className="font-mono">{packet.form.currency} {packet.form.netPayable.toFixed(2)}</span></div>
                </div>

                {packet.instructions && (
                  <div className="rounded-md border bg-muted/30 p-3 text-sm">
                    <p className="font-medium mb-1">Instructions</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      {packet.instructions.map((i, idx) => <li key={idx}>{i}</li>)}
                    </ul>
                  </div>
                )}

                {packet.channel === 'hmrc_mtd' && !hmrcCred?.access_token && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium">HMRC not connected</p>
                      <p className="text-muted-foreground">Authorise efinsuite to file VAT returns via Making Tax Digital.</p>
                      <Button size="sm" className="mt-2" onClick={handleConnectHmrc}>
                        Connect HMRC <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" onClick={handleDownload}>
                    <Download className="w-4 h-4 mr-2" /> Download {packet.format.toUpperCase()}
                  </Button>
                  {packet.portalUrl && (
                    <Button variant="outline" asChild>
                      <a href={packet.portalUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" /> Open Portal
                      </a>
                    </Button>
                  )}
                  <Button
                    onClick={handleSubmit}
                    disabled={readOnly || createSubmission.isPending || transmitDirect.isPending ||
                      (packet.channel === 'hmrc_mtd' && !hmrcCred?.access_token)}
                  >
                    {(createSubmission.isPending || transmitDirect.isPending) ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    {packet.canDirectSubmit ? 'Submit to HMRC' : 'Mark Transmitted & Open Portal'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history">
          <Card>
            <CardContent className="p-0">
              {submissions.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No submissions yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Created</TableHead>
                      <TableHead>Form</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead>Confirmation</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-xs">{format(parseISO(s.created_at), 'PP p')}</TableCell>
                        <TableCell className="font-mono text-xs">{s.form_code}</TableCell>
                        <TableCell className="text-xs">{s.period_start} → {s.period_end}</TableCell>
                        <TableCell className="font-mono text-xs">{s.channel}</TableCell>
                        <TableCell>
                          <Badge className={STATUS_VARIANT[s.status] ?? 'bg-muted'}>{s.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {s.currency} {Number(s.net_payable ?? 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{s.confirmation_number ?? '—'}</TableCell>
                        <TableCell>
                          {s.status === 'transmitted' && !s.confirmation_number && (
                            <Button size="sm" variant="ghost" onClick={() => {
                              setActiveSubmissionId(s.id);
                              setConfirmDialogOpen(true);
                            }}>
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Record confirmation
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CREDENTIALS */}
        <TabsContent value="credentials">
          <Card>
            <CardHeader>
              <CardTitle>Authority credentials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Authority</Label>
                <select
                  className="w-full mt-1 border rounded-md p-2 bg-background"
                  value={selectedAuthorityId}
                  onChange={(e) => setSelectedAuthorityId(e.target.value)}
                >
                  <option value="">Select authority…</option>
                  {authorities.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.region ?? ''})</option>
                  ))}
                </select>
              </div>

              {selectedAuthorityId && (
                <div className="space-y-3">
                  <CredentialRow
                    label="HMRC OAuth (UK VAT)"
                    connected={Boolean(hmrcCred?.access_token)}
                    detail={hmrcCred?.vrn ? `VRN: ${hmrcCred.vrn}` : 'Not connected'}
                    action={
                      <Button size="sm" onClick={handleConnectHmrc} disabled={readOnly}>
                        {hmrcCred?.access_token ? 'Reconnect' : 'Connect'}
                      </Button>
                    }
                  />
                  <CredentialRow
                    label="CRA Web Access Code"
                    connected={Boolean(craCred?.business_number)}
                    detail={craCred?.business_number ? `BN: ${craCred.business_number}` : 'Not configured'}
                    action={
                      <Button size="sm" variant="outline" onClick={() => setCredDialogOpen(true)} disabled={readOnly}>
                        Configure
                      </Button>
                    }
                  />
                  <CredentialRow
                    label="US State Registration"
                    connected={Boolean(usCred?.account_reference)}
                    detail={usCred?.account_reference ?? 'Not configured'}
                    action={
                      <Button size="sm" variant="outline" onClick={() => {
                        const reg = window.prompt('Enter US state registration / permit number:');
                        if (reg) upsertCred.mutate({
                          credential_type: 'us_state_login',
                          account_reference: reg,
                          payload: { registration_number: reg },
                        });
                      }} disabled={readOnly}>
                        Configure
                      </Button>
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* CRA WAC dialog */}
      <Dialog open={credDialogOpen} onOpenChange={setCredDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>CRA Credentials</DialogTitle>
            <DialogDescription>Business Number (e.g. 123456789RT0001) and optional Web Access Code for NETFILE.</DialogDescription>
          </DialogHeader>
          <CraCredForm onSave={(bn, wac) => {
            upsertCred.mutate({
              credential_type: 'cra_wac',
              business_number: bn,
              payload: wac ? { wac } : {},
            });
            setCredDialogOpen(false);
          }} />
        </DialogContent>
      </Dialog>

      {/* Confirmation number dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Confirmation Number</DialogTitle>
            <DialogDescription>Paste the confirmation reference returned by the authority portal.</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Confirmation number"
            value={confirmationNumber}
            onChange={(e) => setConfirmationNumber(e.target.value)}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!activeSubmissionId || !confirmationNumber.trim()) return;
                await recordConfirmation.mutateAsync({
                  submissionId: activeSubmissionId,
                  confirmationNumber: confirmationNumber.trim(),
                });
                setConfirmDialogOpen(false);
                setConfirmationNumber('');
                setActiveSubmissionId(null);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CredentialRow({ label, connected, detail, action }: {
  label: string; connected: boolean; detail: string; action: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border rounded-md p-3">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={connected ? 'default' : 'outline'}>
          {connected ? 'Connected' : 'Not set'}
        </Badge>
        {action}
      </div>
    </div>
  );
}

function CraCredForm({ onSave }: { onSave: (bn: string, wac?: string) => void }) {
  const [bn, setBn] = useState('');
  const [wac, setWac] = useState('');
  return (
    <div className="space-y-3">
      <div>
        <Label>Business Number</Label>
        <Input value={bn} onChange={(e) => setBn(e.target.value)} placeholder="123456789RT0001" />
      </div>
      <div>
        <Label>Web Access Code (optional)</Label>
        <Input value={wac} onChange={(e) => setWac(e.target.value)} />
      </div>
      <DialogFooter>
        <Button onClick={() => onSave(bn, wac || undefined)} disabled={!bn}>Save</Button>
      </DialogFooter>
    </div>
  );
}
