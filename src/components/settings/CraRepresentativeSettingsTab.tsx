import { useEffect, useState } from 'react';
import { ExternalLink, EyeOff, Pencil, Plus, RotateCcw, ShieldAlert, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useEnabledModules } from '@/hooks/useEnabledModules';
import {
  EMPTY_REPRESENTATIVE,
  useCraRepresentativeSettings,
  type RepresentativeSettings,
  type RepresentedClientInput,
} from '@/hooks/useCraRepresentativeSettings';
import { BUILT_IN_CATALOG, REPRESENT_A_CLIENT_URL, type CatalogOverride, type PayerKind } from '@/lib/cra/mypayment/catalog';
import { DEFAULT_POLICY, type PaymentPolicy } from '@/lib/cra/mypayment/workflow';

const ROLES = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'finance_manager', label: 'Finance manager' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'payroll_officer', label: 'Payroll officer' },
];

const LEVEL_LABEL: Record<string, string> = { level_1: 'Level 1 — view', level_2: 'Level 2 — view and file', level_3: 'Level 3 — business delegate' };

const EMPTY_CLIENT: RepresentedClientInput = {
  client_name: '', payer_kind: 'business', business_number: '', program_accounts: [], access_level: 'level_1',
  status: 'pending', authorized_on: null, expires_on: null, notes: '',
};

export function CraRepresentativeSettingsTab() {
  const rep = useCraRepresentativeSettings();
  const { userRole } = useEnabledModules();
  const canAdmin = ['owner', 'admin', 'finance_manager'].includes(userRole);

  return (
    <div className="space-y-6">
      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription className="text-sm">
          eFinsuite does not store CRA passwords, MFA codes or session tokens, and it never signs in to CRA for you. Sign in to Represent a Client yourself with your CRA user ID or a Sign-In Partner. This page keeps only the representative details and the list of clients who authorized you.
        </AlertDescription>
      </Alert>
      {rep.settingsError ? (
        <Alert variant="destructive"><AlertDescription>The CRA Representative tables are not in the database yet. Apply migration 20261116120000_cra_my_payment_module.sql in Supabase.</AlertDescription></Alert>
      ) : null}
      {!canAdmin ? <p className="text-sm text-muted-foreground">Only an owner, admin or finance manager can change these settings.</p> : null}
      <RepresentativeCard canAdmin={canAdmin} rep={rep} />
      <ClientRegisterCard canAdmin={canAdmin} rep={rep} />
      <PolicyCard canAdmin={canAdmin} rep={rep} />
      <CatalogCard canAdmin={canAdmin} rep={rep} />
    </div>
  );
}

type Rep = ReturnType<typeof useCraRepresentativeSettings>;

function RepresentativeCard({ canAdmin, rep }: { canAdmin: boolean; rep: Rep }) {
    const [form, setForm] = useState<RepresentativeSettings>(EMPTY_REPRESENTATIVE);
    useEffect(() => setForm(rep.settings), []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => setForm(rep.settings), [rep.settings.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps
    const set = <K extends keyof RepresentativeSettings>(k: K, v: RepresentativeSettings[K]) => setForm((f) => ({ ...f, [k]: v }));
    return (
      <Card>
        <CardHeader>
          <CardTitle>CRA Representative</CardTitle>
          <CardDescription>The representative or group clients authorize in My Account or My Business Account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <F label="Representative name"><Input value={form.representative_name} onChange={(e) => set('representative_name', e.target.value)} disabled={!canAdmin} /></F>
            <F label="CRA Representative ID (RepID)"><Input value={form.rep_id} onChange={(e) => set('rep_id', e.target.value.toUpperCase())} maxLength={8} placeholder="e.g. R7EFS18" disabled={!canAdmin} /></F>
            <F label="Group ID (where applicable)"><Input value={form.group_id} onChange={(e) => set('group_id', e.target.value.toUpperCase())} maxLength={8} placeholder="e.g. G1234567" disabled={!canAdmin} /></F>
            <F label="Authentication">
              <Select value={form.authentication_method} onValueChange={(v) => set('authentication_method', v as RepresentativeSettings['authentication_method'])} disabled={!canAdmin}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cra_sign_in">CRA user ID and password (entered on CRA only)</SelectItem>
                  <SelectItem value="sign_in_partner">Sign-In Partner (bank login, on CRA only)</SelectItem>
                </SelectContent>
              </Select>
            </F>
            <F label="Authorization status">
              <Select value={form.authorization_status} onValueChange={(v) => set('authorization_status', v as RepresentativeSettings['authorization_status'])} disabled={!canAdmin}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </F>
            <F label="Access level">
              <Select value={form.access_level} onValueChange={(v) => set('access_level', v as RepresentativeSettings['access_level'])} disabled={!canAdmin}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(LEVEL_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </F>
            <F label="Notes" className="md:col-span-2"><Textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} disabled={!canAdmin} placeholder="Never put a password or code here." /></F>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => rep.saveSettings.mutate(form)} disabled={!canAdmin || rep.saveSettings.isPending}>Save representative</Button>
            <Button variant="outline" asChild>
              <a href={REPRESENT_A_CLIENT_URL} target="_blank" rel="noopener noreferrer">Open Represent a Client on canada.ca <ExternalLink className="ml-1 h-4 w-4" /></a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

function ClientRegisterCard({ canAdmin, rep }: { canAdmin: boolean; rep: Rep }) {
    const [form, setForm] = useState<RepresentedClientInput | null>(null);
    const [accountsText, setAccountsText] = useState('');
    const today = new Date().toISOString().slice(0, 10);
    const edit = (input: RepresentedClientInput) => {
      setForm(input);
      setAccountsText(input.program_accounts.join(', '));
    };
    const save = async () => {
      if (!form) return;
      await rep.saveClient.mutateAsync({ ...form, program_accounts: accountsText.split(/[,\s]+/).filter(Boolean) });
      setForm(null);
    };
    return (
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle>Client authorization register</CardTitle>
            <CardDescription>Clients who authorized this representative. Active clients can be chosen when preparing a CRA payment.</CardDescription>
          </div>
          <Button size="sm" onClick={() => edit(EMPTY_CLIENT)} disabled={!canAdmin}><Plus className="mr-1 h-4 w-4" />Add client</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {form ? (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="grid gap-3 md:grid-cols-3">
                <F label="Client name"><Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></F>
                <F label="Taxpayer">
                  <Select value={form.payer_kind} onValueChange={(v) => setForm({ ...form, payer_kind: v as PayerKind })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="business">Business</SelectItem><SelectItem value="individual">Individual</SelectItem></SelectContent>
                  </Select>
                </F>
                {form.payer_kind === 'business' ? (
                  <F label="Business number"><Input value={form.business_number} onChange={(e) => setForm({ ...form, business_number: e.target.value })} maxLength={9} inputMode="numeric" /></F>
                ) : <div className="text-xs text-muted-foreground md:pt-6">The SIN is not stored for individuals.</div>}
                {form.payer_kind === 'business' ? (
                  <F label="Program accounts" className="md:col-span-3"><Input value={accountsText} onChange={(e) => setAccountsText(e.target.value.toUpperCase())} placeholder="123456789RT0001, 123456789RP0001" /></F>
                ) : null}
                <F label="Access level">
                  <Select value={form.access_level} onValueChange={(v) => setForm({ ...form, access_level: v as RepresentedClientInput['access_level'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(LEVEL_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </F>
                <F label="Status">
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as RepresentedClientInput['status'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem><SelectItem value="active">Active</SelectItem>
                      <SelectItem value="revoked">Revoked</SelectItem><SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </F>
                <div className="grid grid-cols-2 gap-2">
                  <F label="Authorized on"><Input type="date" value={form.authorized_on ?? ''} onChange={(e) => setForm({ ...form, authorized_on: e.target.value || null })} /></F>
                  <F label="Expires on"><Input type="date" value={form.expires_on ?? ''} onChange={(e) => setForm({ ...form, expires_on: e.target.value || null })} /></F>
                </div>
                <F label="Notes" className="md:col-span-3"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></F>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={save} disabled={rep.saveClient.isPending}>Save client</Button>
                <Button size="sm" variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
              </div>
            </div>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow><TableHead>Client</TableHead><TableHead>Business number</TableHead><TableHead>Programs</TableHead><TableHead>Level</TableHead><TableHead>Status</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {rep.clients.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">No clients in the register yet.</TableCell></TableRow>
              ) : rep.clients.map((c) => {
                const expired = c.status === 'active' && !!c.expires_on && c.expires_on < today;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.client_name}</TableCell>
                    <TableCell>{c.business_number || '—'}</TableCell>
                    <TableCell className="text-xs">{c.program_accounts.map((a) => a.slice(9, 11)).join(', ') || '—'}</TableCell>
                    <TableCell className="text-xs">{LEVEL_LABEL[c.access_level]}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === 'active' && !expired ? 'default' : 'outline'}>{expired ? 'Expired' : c.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => edit({ ...c })} disabled={!canAdmin} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => rep.removeClient.mutate(c.id)} disabled={!canAdmin} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

function PolicyCard({ canAdmin, rep }: { canAdmin: boolean; rep: Rep }) {
    const [form, setForm] = useState<PaymentPolicy>(DEFAULT_POLICY);
    const [threshold, setThreshold] = useState('');
    const [limit, setLimit] = useState('');
    useEffect(() => {
      setForm(rep.policy);
      setThreshold(rep.policy.review_threshold?.toString() ?? '');
      setLimit(rep.policy.max_payment_amount?.toString() ?? '');
    }, [rep.policy]);
    const toggleRole = (key: 'reviewer_roles' | 'approver_roles', role: string, on: boolean) =>
      setForm((f) => ({ ...f, [key]: on ? [...new Set([...f[key], role])] : f[key].filter((r) => r !== role) }));
    return (
      <Card>
        <CardHeader>
          <CardTitle>CRA payment approvals</CardTitle>
          <CardDescription>Who can review and approve a CRA payment before anyone pays it on CRA My Payment. The database enforces these rules.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <F label="Approval levels">
              <Select value={String(form.approval_levels)} onValueChange={(v) => setForm({ ...form, approval_levels: v === '2' ? 2 : 1 })} disabled={!canAdmin}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Preparer → Approver</SelectItem>
                  <SelectItem value="2">Preparer → Reviewer → Approver</SelectItem>
                </SelectContent>
              </Select>
            </F>
            <F label="Also require a review at or above (CAD)"><Input value={threshold} onChange={(e) => setThreshold(e.target.value)} inputMode="decimal" placeholder="No threshold" disabled={!canAdmin || form.approval_levels === 2} /></F>
            <F label="Largest single payment (CAD)"><Input value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="decimal" placeholder="No limit" disabled={!canAdmin} /></F>
            <F label="Duplicate check window (days)"><Input type="number" min={0} max={365} value={form.duplicate_window_days} onChange={(e) => setForm({ ...form, duplicate_window_days: Number(e.target.value) })} disabled={!canAdmin} /></F>
          </div>
          <label className="flex items-start gap-3 text-sm">
            <Switch checked={form.separate_duties} onCheckedChange={(v) => setForm({ ...form, separate_duties: v })} disabled={!canAdmin} />
            <span>
              <span className="font-medium">Separate preparation from authorization</span>
              <span className="block text-xs text-muted-foreground">The person who prepares a payment cannot review or approve it. Turn off only for a one-person business.</span>
            </span>
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <RoleList title="Can review" roles={form.reviewer_roles} onToggle={(r, on) => toggleRole('reviewer_roles', r, on)} disabled={!canAdmin} />
            <RoleList title="Can approve" roles={form.approver_roles} onToggle={(r, on) => toggleRole('approver_roles', r, on)} disabled={!canAdmin} />
          </div>
          <Button
            disabled={!canAdmin || rep.savePolicy.isPending}
            onClick={() => rep.savePolicy.mutate({
              ...form,
              review_threshold: threshold.trim() ? Number(threshold) : null,
              max_payment_amount: limit.trim() ? Number(limit) : null,
            })}
          >
            Save approval policy
          </Button>
        </CardContent>
      </Card>
    );
  }

function CatalogCard({ canAdmin, rep }: { canAdmin: boolean; rep: Rep }) {
    const [kind, setKind] = useState<PayerKind>('business');
    const [renaming, setRenaming] = useState<{ key: string; label: string } | null>(null);
    const [custom, setCustom] = useState({ key: '', label: '', program: 'NONE', allocations: '' });
    const overrideFor = (key: string) => rep.overrides.find((o) => o.payer_kind === kind && o.type_key === key);
    const builtIns = BUILT_IN_CATALOG.filter((t) => t.payerKind === kind);
    const customs = rep.overrides.filter((o) => o.payer_kind === kind && !BUILT_IN_CATALOG.some((t) => t.payerKind === kind && t.key === o.type_key));
    const upsert = (input: Partial<CatalogOverride> & { type_key: string }) => {
      const existing = overrideFor(input.type_key);
      rep.saveOverride.mutate({
        payer_kind: kind,
        label: existing?.label ?? null,
        program_code: existing?.program_code ?? null,
        allocations: existing?.allocations ?? null,
        hidden: existing?.hidden ?? false,
        ...input,
      });
    };
    const addCustom = () => {
      const key = custom.key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const allocations = custom.allocations.split('\n').map((l) => l.trim()).filter(Boolean).map((label) => ({
        key: label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'allocation',
        label,
      }));
      if (key.length < 2 || !custom.label.trim() || !allocations.length) return;
      upsert({ type_key: key, label: custom.label.trim(), program_code: custom.program, allocations, hidden: false });
      setCustom({ key: '', label: '', program: 'NONE', allocations: '' });
    };
    return (
      <Card>
        <CardHeader>
          <CardTitle>CRA payment categories</CardTitle>
          <CardDescription>The list follows CRA My Payment. Rename, hide or add categories here when CRA changes its list.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={kind} onValueChange={(v) => setKind(v as PayerKind)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="business">Businesses</SelectItem><SelectItem value="individual">Individuals</SelectItem></SelectContent>
          </Select>
          <ul className="divide-y rounded-lg border text-sm">
            {builtIns.map((t) => {
              const o = overrideFor(t.key);
              return (
                <li key={t.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <div>
                    {renaming?.key === t.key ? (
                      <div className="flex gap-2">
                        <Input value={renaming.label} onChange={(e) => setRenaming({ ...renaming, label: e.target.value })} className="h-8 w-64" />
                        <Button size="sm" onClick={() => { upsert({ type_key: t.key, label: renaming.label.trim() || null }); setRenaming(null); }}>Save</Button>
                      </div>
                    ) : (
                      <span className={o?.hidden ? 'text-muted-foreground line-through' : ''}>{o?.label || t.label}</span>
                    )}
                    <div className="text-xs text-muted-foreground">{t.allocations.map((a) => a.label).join(' · ')}</div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" disabled={!canAdmin} onClick={() => setRenaming({ key: t.key, label: o?.label || t.label })} aria-label="Rename"><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" disabled={!canAdmin} onClick={() => upsert({ type_key: t.key, hidden: !o?.hidden })} aria-label={o?.hidden ? 'Show' : 'Hide'}><EyeOff className="h-4 w-4" /></Button>
                    {o ? <Button size="icon" variant="ghost" disabled={!canAdmin} onClick={() => rep.removeOverride.mutate({ payer_kind: kind, type_key: t.key })} aria-label="Restore default"><RotateCcw className="h-4 w-4" /></Button> : null}
                  </div>
                </li>
              );
            })}
            {customs.map((o) => (
              <li key={o.type_key} className="flex items-center justify-between gap-2 px-3 py-2">
                <div>
                  <span>{o.label}</span> <Badge variant="outline">custom</Badge>
                  <div className="text-xs text-muted-foreground">{(o.allocations ?? []).map((a) => a.label).join(' · ')}</div>
                </div>
                <Button size="icon" variant="ghost" disabled={!canAdmin} onClick={() => rep.removeOverride.mutate({ payer_kind: kind, type_key: o.type_key })} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
          {canAdmin ? (
            <div className="space-y-2 rounded-lg border border-dashed p-3">
              <div className="text-sm font-medium">Add a category</div>
              <div className="grid gap-2 md:grid-cols-3">
                <Input value={custom.label} onChange={(e) => setCustom({ ...custom, label: e.target.value })} placeholder="Name as CRA shows it" />
                <Input value={custom.key} onChange={(e) => setCustom({ ...custom, key: e.target.value })} placeholder="Short key, e.g. digital_services_tax" />
                <Select value={custom.program} onValueChange={(v) => setCustom({ ...custom, program: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['NONE', 'RT', 'RP', 'RC', 'RZ', 'RD', 'RE', 'SY', 'RG', 'XR', 'SIN'].map((p) => <SelectItem key={p} value={p}>{p === 'NONE' ? 'Any account' : p === 'SIN' ? 'SIN (individual)' : `${p} program`}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Textarea className="md:col-span-3" rows={2} value={custom.allocations} onChange={(e) => setCustom({ ...custom, allocations: e.target.value })} placeholder="One allocation per line, e.g. Balance owing" />
              </div>
              <Button size="sm" variant="outline" onClick={addCustom}>Add category</Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

function F({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <div className={`space-y-1 ${className ?? ''}`}><Label className="text-xs">{label}</Label>{children}</div>;
}

function RoleList({ title, roles, onToggle, disabled }: { title: string; roles: string[]; onToggle: (role: string, on: boolean) => void; disabled: boolean }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{title}</div>
      {ROLES.map((r) => (
        <label key={r.value} className="flex items-center gap-2 text-sm">
          <Checkbox checked={roles.includes(r.value)} onCheckedChange={(v) => onToggle(r.value, v === true)} disabled={disabled} />
          {r.label}
        </label>
      ))}
    </div>
  );
}
