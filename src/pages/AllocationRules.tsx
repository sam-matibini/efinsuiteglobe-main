import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Calculator, Play, Plus, Trash2, Clock } from 'lucide-react';
import { useAllocationRules, useAllocationRuns, AllocationMethod } from '@/hooks/useAllocations';
import { useAllocationSchedules } from '@/hooks/useAllocationSchedules';
import { useDepartments } from '@/hooks/useDimensions';
import { useAccounts } from '@/hooks/useAccounts';
import { DivisionSelect } from '@/components/dimensions/DivisionSelect';

const METHOD_LABELS: Record<AllocationMethod, string> = {
  revenue_pct: 'Revenue %',
  headcount: 'Headcount',
  fixed_pct: 'Fixed %',
  equal: 'Equal Split',
  user_count: 'User Count',
  manual: 'Manual',
};

export default function AllocationRules() {
  const { data: rules = [], createRule, toggleRule, deleteRule } = useAllocationRules();
  const { data: runs = [], runRule } = useAllocationRuns();
  const { data: divisions = [] } = useDepartments();
  const { data: accounts = [] } = useAccounts();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [method, setMethod] = useState<AllocationMethod>('equal');
  const [sourceAccountId, setSourceAccountId] = useState<string | null>(null);
  const [sourceDept, setSourceDept] = useState<string | null>(null);
  const [targets, setTargets] = useState<Array<{ department_id: string; weight: number }>>([]);

  const [runOpen, setRunOpen] = useState(false);
  const [runRuleId, setRunRuleId] = useState<string | null>(null);
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  const [periodStart, setPeriodStart] = useState(firstOfMonth);
  const [periodEnd, setPeriodEnd] = useState(lastOfMonth);

  const addTarget = () => setTargets([...targets, { department_id: '', weight: 0 }]);
  const updateTarget = (i: number, patch: Partial<{ department_id: string; weight: number }>) => {
    setTargets(targets.map((t, idx) => idx === i ? { ...t, ...patch } : t));
  };

  const submit = async () => {
    await createRule.mutateAsync({
      rule: {
        name, description: null, method, frequency: 'monthly', is_active: true,
        source_account_id: sourceAccountId, source_department_id: sourceDept,
      } as any,
      targets: targets.filter((t) => t.department_id).map((t) => ({
        target_department_id: t.department_id, weight: t.weight, driver_metric: null,
      })),
    });
    setOpen(false); setName(''); setTargets([]); setSourceAccountId(null); setSourceDept(null);
  };

  const sharedDivision = divisions.find((d: any) => d.is_shared);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Calculator className="w-7 h-7" /> Allocation Rules</h1>
          <p className="text-muted-foreground">
            Reallocate shared costs from the <span className="font-medium">{sharedDivision?.name || 'Shared Costs'}</span> division across operating divisions using configurable drivers.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> New Rule</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>New Allocation Rule</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Rule Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rent - by headcount" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Method</Label>
                  <Select value={method} onValueChange={(v) => setMethod(v as AllocationMethod)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Source Division</Label>
                  <DivisionSelect value={sourceDept} onChange={setSourceDept} placeholder="(usually Shared Costs)" />
                </div>
              </div>
              <div>
                <Label>Source Account (optional — leave blank to allocate every account)</Label>
                <Select value={sourceAccountId ?? '__any__'} onValueChange={(v) => setSourceAccountId(v === '__any__' ? null : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any__">Any account in source division</SelectItem>
                    {accounts.filter((a: any) => !a.is_header).map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Targets</Label>
                  <Button size="sm" variant="outline" onClick={addTarget}><Plus className="w-3 h-3 mr-1" /> Add</Button>
                </div>
                {targets.map((t, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <DivisionSelect value={t.department_id} onChange={(v) => updateTarget(i, { department_id: v || '' })} className="flex-1" />
                    <Input type="number" step="0.01" placeholder="Weight" value={t.weight} onChange={(e) => updateTarget(i, { weight: parseFloat(e.target.value) || 0 })} className="w-32" />
                    <Button size="sm" variant="ghost" onClick={() => setTargets(targets.filter((_, idx) => idx !== i))}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter><Button onClick={submit} disabled={!name || targets.length === 0}>Create Rule</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Rules</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Method</TableHead><TableHead>Targets</TableHead><TableHead>Active</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell><Badge variant="outline">{METHOD_LABELS[r.method]}</Badge></TableCell>
                  <TableCell>{r.allocation_rule_targets?.length || 0}</TableCell>
                  <TableCell><Switch checked={r.is_active} onCheckedChange={(v) => toggleRule.mutate({ id: r.id, is_active: v })} /></TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => { setRunRuleId(r.id); setRunOpen(true); }}><Play className="w-3 h-3 mr-1" /> Run</Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteRule.mutate(r.id)}><Trash2 className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {rules.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No rules yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent Runs</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Rule</TableHead><TableHead>Period</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Allocated</TableHead></TableRow></TableHeader>
            <TableBody>
              {runs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.allocation_rules?.name || '—'}</TableCell>
                  <TableCell>{r.period_start} → {r.period_end}</TableCell>
                  <TableCell><Badge>{r.status}</Badge></TableCell>
                  <TableCell className="text-right font-mono">{Number(r.total_allocated).toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {runs.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No runs yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <SchedulesCard ruleOptions={rules.map((r) => ({ id: r.id, name: r.name }))} />

      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Run Allocation</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Period Start</Label><Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} /></div>
            <div><Label>Period End</Label><Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={async () => {
              if (!runRuleId) return;
              await runRule.mutateAsync({ rule_id: runRuleId, period_start: periodStart, period_end: periodEnd, preview: true });
            }}>Preview</Button>
            <Button onClick={async () => {
              if (!runRuleId) return;
              await runRule.mutateAsync({ rule_id: runRuleId, period_start: periodStart, period_end: periodEnd });
              setRunOpen(false);
            }}>Post Allocation JE</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ----------------------------------------------------------------------
// Phase 6 — Allocation Schedules card (automated cron-driven allocations)
// ----------------------------------------------------------------------
function SchedulesCard({ ruleOptions }: { ruleOptions: Array<{ id: string; name: string }> }) {
  const { data: schedules = [], upsert, toggleActive, remove } = useAllocationSchedules();
  const [open, setOpen] = useState(false);
  const [ruleId, setRuleId] = useState<string>('');
  const [frequency, setFrequency] = useState<'monthly' | 'quarterly'>('monthly');
  const [dayOfPeriod, setDayOfPeriod] = useState<number>(1);

  const nameForRule = (id: string) => ruleOptions.find((r) => r.id === id)?.name ?? '—';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><Clock className="w-4 h-4" /> Schedules</CardTitle>
          <CardDescription>Run allocation rules automatically every period.</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={ruleOptions.length === 0}>
              <Plus className="w-3 h-3 mr-1" /> New Schedule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Allocation Schedule</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Rule</Label>
                <Select value={ruleId} onValueChange={setRuleId}>
                  <SelectTrigger><SelectValue placeholder="Select rule" /></SelectTrigger>
                  <SelectContent>
                    {ruleOptions.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Frequency</Label>
                  <Select value={frequency} onValueChange={(v) => setFrequency(v as 'monthly' | 'quarterly')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Day of Period</Label>
                  <Input type="number" min={1} max={31} value={dayOfPeriod} onChange={(e) => setDayOfPeriod(parseInt(e.target.value) || 1)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                disabled={!ruleId}
                onClick={async () => {
                  await upsert.mutateAsync({ rule_id: ruleId, frequency, day_of_period: dayOfPeriod });
                  setOpen(false);
                  setRuleId('');
                }}
              >Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rule</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Next Run</TableHead>
              <TableHead>Last Status</TableHead>
              <TableHead>Active</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{nameForRule(s.rule_id)}</TableCell>
                <TableCell><Badge variant="outline">{s.frequency}</Badge> day {s.day_of_period}</TableCell>
                <TableCell>{new Date(s.next_run_at).toLocaleDateString()}</TableCell>
                <TableCell>{s.last_run_status ? <Badge>{s.last_run_status}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell><Switch checked={s.active} onCheckedChange={(v) => toggleActive.mutate({ id: s.id, active: v })} /></TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(s.id)}><Trash2 className="w-4 h-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {schedules.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No schedules yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
