import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, AlertTriangle, CheckCircle2, Plus } from 'lucide-react';
import { useRpaaSettings, useRpaaSnapshots, useRpaaIncidents } from '@/hooks/useRpaa';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

export default function RpaaCompliance() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-7 w-7 text-primary" />
          RPAA Compliance
        </h1>
        <p className="text-muted-foreground">Retail Payment Activities Act — registration, safeguarding-of-funds, monthly attestation, and 24-hour incident notice to the Bank of Canada.</p>
      </div>

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="safeguarding">Safeguarding Dashboard</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
        </TabsList>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
        <TabsContent value="safeguarding"><SafeguardingTab /></TabsContent>
        <TabsContent value="incidents"><IncidentsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function SettingsTab() {
  const { settings, isLoading, upsert } = useRpaaSettings();
  const { accounts: bankAccounts } = useBankAccounts();
  const [form, setForm] = useState<any>({});

  const merged = { ...settings, ...form };

  return (
    <Card>
      <CardHeader><CardTitle>Registration & Safeguarding</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Registered with Bank of Canada</Label>
                <Select value={String(merged.is_registered ?? false)} onValueChange={(v) => setForm({ ...form, is_registered: v === 'true' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">Not registered</SelectItem>
                    <SelectItem value="true">Registered</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Registration number</Label>
                <Input value={merged.registration_number ?? ''} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} placeholder="e.g. PSP-2026-000123" /></div>
              <div><Label>Registration date</Label>
                <Input type="date" value={merged.registration_date ?? ''} onChange={(e) => setForm({ ...form, registration_date: e.target.value })} /></div>
              <div>
                <Label>Safeguarding method</Label>
                <Select value={merged.safeguarding_method ?? ''} onValueChange={(v) => setForm({ ...form, safeguarding_method: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose method" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trust">Trust account</SelectItem>
                    <SelectItem value="insurance">Insurance / guarantee</SelectItem>
                    <SelectItem value="segregated">Segregated bank account</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Operating account (own funds)</Label>
                <Select value={merged.operating_account_id ?? ''} onValueChange={(v) => setForm({ ...form, operating_account_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose bank account" /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Safeguarding account (end-user funds)</Label>
                <Select value={merged.safeguarding_account_id ?? ''} onValueChange={(v) => setForm({ ...form, safeguarding_account_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose bank account" /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Insurance provider</Label>
                <Input value={merged.insurance_provider ?? ''} onChange={(e) => setForm({ ...form, insurance_provider: e.target.value })} /></div>
              <div><Label>Policy number</Label>
                <Input value={merged.insurance_policy_number ?? ''} onChange={(e) => setForm({ ...form, insurance_policy_number: e.target.value })} /></div>
              <div><Label>Policy expires</Label>
                <Input type="date" value={merged.insurance_expires_on ?? ''} onChange={(e) => setForm({ ...form, insurance_expires_on: e.target.value })} /></div>
              <div><Label>Variance tolerance (CAD)</Label>
                <Input type="number" value={merged.variance_tolerance_cad ?? 100} onChange={(e) => setForm({ ...form, variance_tolerance_cad: Number(e.target.value) })} /></div>
            </div>
            <Button onClick={() => upsert.mutate(form)} disabled={upsert.isPending}>Save settings</Button>
            {merged.operating_account_id && merged.safeguarding_account_id && merged.operating_account_id === merged.safeguarding_account_id && (
              <p className="text-sm text-destructive flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Operating and safeguarding accounts must be different — RPAA s.20 requires segregation.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SafeguardingTab() {
  const { data: snapshots, isLoading } = useRpaaSnapshots();
  const { settings } = useRpaaSettings();
  const fmt = useCurrencyFormatter();
  const list = snapshots ?? [];
  const latest = list[0];
  const tol = Number(settings?.variance_tolerance_cad ?? 100);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">End-user liability</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{latest ? fmt.formatCurrency(Number(latest.end_user_liability), { currencyOverride: 'CAD' }) : '—'}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Safeguarded balance</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{latest ? fmt.formatCurrency(Number(latest.safeguarded_balance), { currencyOverride: 'CAD' }) : '—'}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Variance</CardTitle></CardHeader>
          <CardContent><p className={`text-2xl font-bold ${latest && Math.abs(Number(latest.variance)) > tol ? 'text-destructive' : ''}`}>{latest ? fmt.formatCurrency(Number(latest.variance), { currencyOverride: 'CAD' }) : '—'}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Last snapshot</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{latest?.snapshot_date ?? '—'}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Daily snapshots (90 days)</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
            : list.length === 0 ? <p className="text-sm text-muted-foreground">No snapshots yet. The nightly job populates this table.</p>
            : (
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Liability</TableHead><TableHead className="text-right">Safeguarded</TableHead><TableHead className="text-right">Variance</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{list.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.snapshot_date}</TableCell>
                    <TableCell className="text-right">{fmt.formatCurrency(Number(s.end_user_liability), { currencyOverride: 'CAD' })}</TableCell>
                    <TableCell className="text-right">{fmt.formatCurrency(Number(s.safeguarded_balance), { currencyOverride: 'CAD' })}</TableCell>
                    <TableCell className={`text-right ${Math.abs(Number(s.variance)) > tol ? 'text-destructive font-medium' : ''}`}>{fmt.formatCurrency(Number(s.variance), { currencyOverride: 'CAD' })}</TableCell>
                    <TableCell>{s.breach ? <Badge variant="destructive">Breach</Badge> : <Badge variant="outline">OK</Badge>}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

function IncidentsTab() {
  const { incidents, isLoading, create, markNotified } = useRpaaIncidents();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ incident_type: 'operational', severity: 'medium', occurred_at: new Date().toISOString().slice(0, 16), description: '' });
  const [bocTarget, setBocTarget] = useState<any | null>(null);
  const [bocRef, setBocRef] = useState('');

  const overdue = useMemo(() => incidents.filter((i: any) => !i.boc_notified_at && i.boc_notice_due_at && new Date(i.boc_notice_due_at) < new Date()), [incidents]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{overdue.length > 0 ? <span className="text-destructive font-medium">⚠ {overdue.length} overdue BoC notice(s)</span> : 'All incidents within 24h window.'}</p>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Log incident</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
            : incidents.length === 0 ? <p className="text-sm text-muted-foreground">No incidents logged.</p>
            : (
              <Table>
                <TableHeader><TableRow><TableHead>Occurred</TableHead><TableHead>Type</TableHead><TableHead>Severity</TableHead><TableHead>BoC due</TableHead><TableHead>Notified</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>{incidents.map((i: any) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs">{i.occurred_at?.slice(0, 16).replace('T', ' ')}</TableCell>
                    <TableCell className="capitalize">{i.incident_type}</TableCell>
                    <TableCell><Badge variant={i.severity === 'critical' ? 'destructive' : 'outline'}>{i.severity}</Badge></TableCell>
                    <TableCell className="text-xs">{i.boc_notice_due_at?.slice(0, 16).replace('T', ' ')}</TableCell>
                    <TableCell>{i.boc_notified_at ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Badge variant="destructive">Pending</Badge>}</TableCell>
                    <TableCell className="text-right">{!i.boc_notified_at && <Button size="sm" variant="outline" onClick={() => { setBocTarget(i); setBocRef(''); }}>Mark BoC notified</Button>}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Log RPAA incident</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Type</Label>
                <Select value={form.incident_type} onValueChange={(v) => setForm({ ...form, incident_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operational">Operational</SelectItem>
                    <SelectItem value="security">Security / breach</SelectItem>
                    <SelectItem value="safeguarding">Safeguarding shortfall</SelectItem>
                    <SelectItem value="outage">Outage</SelectItem>
                  </SelectContent>
                </Select></div>
              <div><Label>Severity</Label>
                <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select></div>
            </div>
            <div><Label>Occurred at</Label>
              <Input type="datetime-local" value={form.occurred_at} onChange={(e) => setForm({ ...form, occurred_at: e.target.value })} /></div>
            <div><Label>Description</Label>
              <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Affected users (#)</Label><Input type="number" onChange={(e) => setForm({ ...form, affected_users_count: Number(e.target.value) })} /></div>
              <div><Label>Affected amount (CAD)</Label><Input type="number" onChange={(e) => setForm({ ...form, affected_amount: Number(e.target.value) })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={async () => { await create.mutateAsync({ ...form, occurred_at: new Date(form.occurred_at).toISOString() }); setOpen(false); }} disabled={!form.description}>Log incident</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!bocTarget} onOpenChange={(o) => !o && setBocTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bank of Canada notification</DialogTitle></DialogHeader>
          <div><Label>BoC reference</Label>
            <Input value={bocRef} onChange={(e) => setBocRef(e.target.value)} placeholder="e.g. BoC-INC-2026-0042" /></div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBocTarget(null)}>Cancel</Button>
            <Button disabled={!bocRef.trim()} onClick={async () => { await markNotified.mutateAsync({ id: bocTarget.id, boc_reference: bocRef.trim() }); setBocTarget(null); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
