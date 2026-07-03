import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Workflow, Plus, Trash2 } from 'lucide-react';
import { useApprovalRules, type CraApprovalRule } from '@/hooks/useApprovalRules';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

const ROLES = ['admin', 'controller', 'cfo', 'owner'];
const PROGRAMS = ['RP', 'RT', 'RC', 'RC_INSTALLMENT', 'RE', 'NR', 'RZ'];

export default function ApprovalRules() {
  const { rules, isLoading, upsertRule, deleteRule } = useApprovalRules();
  const fmt = useCurrencyFormatter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<CraApprovalRule> | null>(null);

  const openNew = () => {
    setEditing({
      name: '',
      min_amount: 0,
      max_amount: null,
      required_role: 'admin',
      required_approver_count: 1,
      program_codes: [],
      priority: 100,
      active: true,
    });
    setOpen(true);
  };

  const toggleProgram = (code: string) => {
    if (!editing) return;
    const list = editing.program_codes ?? [];
    setEditing({
      ...editing,
      program_codes: list.includes(code) ? list.filter((c) => c !== code) : [...list, code],
    });
  };

  const save = async () => {
    if (!editing || !editing.name) return;
    await upsertRule.mutateAsync(editing);
    setOpen(false);
    setEditing(null);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Workflow className="h-7 w-7 text-primary" />
            Approval Rules
          </h1>
          <p className="text-muted-foreground">
            Configure approval chains for CRA remittances by amount, program, and required role.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> New rule
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rules</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No approval rules configured.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Priority</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Amount range</TableHead>
                  <TableHead>Programs</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Approvers</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.priority}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-xs">
                      {fmt.formatCurrency(Number(r.min_amount), {
                        showCurrencySymbol: true,
                        currencyOverride: 'CAD',
                      })}
                      {' – '}
                      {r.max_amount
                        ? fmt.formatCurrency(Number(r.max_amount), {
                            showCurrencySymbol: true,
                            currencyOverride: 'CAD',
                          })
                        : '∞'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.program_codes.length ? r.program_codes.join(', ') : 'All'}
                    </TableCell>
                    <TableCell className="capitalize">{r.required_role}</TableCell>
                    <TableCell>{r.required_approver_count}</TableCell>
                    <TableCell>
                      <Badge variant={r.active ? 'default' : 'outline'}>
                        {r.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(r);
                          setOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteRule.mutate(r.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit rule' : 'New rule'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Min amount</Label>
                  <Input
                    type="number"
                    value={editing.min_amount ?? 0}
                    onChange={(e) => setEditing({ ...editing, min_amount: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Max amount (blank = ∞)</Label>
                  <Input
                    type="number"
                    value={editing.max_amount ?? ''}
                    onChange={(e) =>
                      setEditing({ ...editing, max_amount: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Required role</Label>
                  <Select
                    value={editing.required_role ?? 'admin'}
                    onValueChange={(v) => setEditing({ ...editing, required_role: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Approvers required</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editing.required_approver_count ?? 1}
                    onChange={(e) =>
                      setEditing({ ...editing, required_approver_count: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Programs (empty = all)</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {PROGRAMS.map((p) => {
                    const on = (editing.program_codes ?? []).includes(p);
                    return (
                      <Badge
                        key={p}
                        variant={on ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleProgram(p)}
                      >
                        {p}
                      </Badge>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Priority</Label>
                  <Input
                    type="number"
                    value={editing.priority ?? 100}
                    onChange={(e) => setEditing({ ...editing, priority: Number(e.target.value) })}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Switch
                    checked={editing.active ?? true}
                    onCheckedChange={(v) => setEditing({ ...editing, active: v })}
                  />
                  <Label>Active</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={upsertRule.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
